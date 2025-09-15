// api/askOpenAI.js
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let documentChunks = [];

async function loadAndChunkJSON() {
  try {
    const filePath = path.join(process.cwd(), "data/base.json");
    console.log("Tentando carregar base JSON em:", filePath);
    const fileContent = await fs.readFile(filePath, "utf-8");
    const jsonData = JSON.parse(fileContent);

    let fullText = "";
    jsonData.forEach(item => {
      if (item.title && item.content) {
        fullText += `${item.title}\n${item.content}\n\n`;
      }
    });

    const chunkSize = 500;
    documentChunks = [];
    for (let start = 0; start < fullText.length; start += chunkSize) {
      documentChunks.push(fullText.slice(start, start + chunkSize));
    }

    console.log(`Base carregada com ${documentChunks.length} chunks.`);
  } catch (err) {
    console.error("Falha ao carregar base.json:", err);
    documentChunks = [];
  }
}

function searchInChunks(pergunta) {
  const lowerQuestion = pergunta.toLowerCase();
  return documentChunks.filter(chunk =>
    chunk.toLowerCase().includes(lowerQuestion)
  );
}

export default async function handler(req, res) {
  try {
    console.log("askOpenAI iniciado. Body recebido:", req.body);
    const { pergunta, email } = req.body || {};
    if (!pergunta || !email) {
      return res.status(400).json({ error: "Faltando parâmetros" });
    }

    if (!global.sessionMemory) global.sessionMemory = {};
    if (!Array.isArray(global.sessionMemory[email])) global.sessionMemory[email] = [];
    const session = global.sessionMemory;
    session[email].push({ role: "user", content: pergunta });

    const historico = session[email].map(h => `${h.role}: ${h.content}`).join("\n");

    if (!documentChunks.length) await loadAndChunkJSON();

    const relevantChunks =
      searchInChunks(pergunta).join("\n\n") ||
      "Nenhum conteúdo encontrado na base de dados interna.";

    const prompt = `
### PERSONA
Você é o VeloBot, assistente interno de suporte da Velotax.
Seu público é o atendente da empresa, não o cliente final.
Sua função é ensinar o atendente como responder corretamente ao cliente.

### HISTÓRICO DA CONVERSA
${historico || "Sem histórico anterior."}

### CONTEXTO DA EMPRESA
${relevantChunks}

### REGRAS DE RESPOSTA
- Responda de forma clara e prática, em tom profissional.
- Sempre descreva o passo a passo ou procedimento que o atendente deve seguir.
- Não se dirija ao cliente diretamente (não use "Prezado cliente", "você" ou "seu").
- Use linguagem interna, como "informe ao cliente que...", "explique que...", "siga este procedimento...".
- Se não encontrar informação relevante, diga: "Não encontrei instrução para este caso na base de dados interna."

### PERGUNTA
"${pergunta}"
`;

    // Novo método de streaming com for-await-of
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1024,
      stream: true
    });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });

    let respostaCompleta = "";
    for await (const part of stream) {
      const chunk = part.choices[0]?.delta?.content || "";
      if (chunk) {
        respostaCompleta += chunk;
        res.write(`data: ${chunk}\n\n`);
      }
    }

    session[email].push({ role: "assistant", content: respostaCompleta });
    res.write("data: [DONE]\n\n");
    res.end();

  } catch (error) {
    console.error("ERRO no handler askOpenAI:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro interno no servidor", details: error.message });
    }
  }
}
