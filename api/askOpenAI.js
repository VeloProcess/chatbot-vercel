// api/askOpenAI.js
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ------------------- CHUNKER -------------------
let documentChunks = [];

// Função para carregar a base JSON e criar chunks
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

    console.log("Base carregada com", documentChunks.length, "chunks.");
  } catch (err) {
    console.error("Falha ao carregar base.json:", err);
    documentChunks = [];
  }
}

// Função para buscar nos chunks
function searchInChunks(pergunta) {
  const lowerQuestion = pergunta.toLowerCase();
  return documentChunks.filter(chunk =>
    chunk.toLowerCase().includes(lowerQuestion)
  );
}

// ------------------- HANDLER STREAMING -------------------
export default async function handler(req, res) {
  try {
    console.log("askOpenAI iniciado. Body recebido:", req.body);
    const { pergunta, email } = req.body || {};
    if (!pergunta || !email) {
      return res.status(400).json({ error: "Faltando parâmetros" });
    }

    // Inicializa memória de sessão global
    if (!global.sessionMemory) global.sessionMemory = {};
    if (!Array.isArray(global.sessionMemory[email])) global.sessionMemory[email] = [];
    const session = global.sessionMemory;

    session[email].push({ role: "user", content: pergunta });

    const historico = session[email].map(h => `${h.role}: ${h.content}`).join("\n");

    // Carrega base se necessário
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

    // Cria a resposta em streaming
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1024,
      stream: true
    });

    if (!completion.body) {
      console.error("Resposta da API não contém body.");
      return res.status(500).json({ error: "Falha ao iniciar streaming de resposta." });
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });

    let respostaCompleta = "";
    let buffer = "";
    const reader = completion.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        buffer += chunk;

        // Envia apenas quando o buffer tiver conteúdo significativo
        if (buffer.length > 20) {
          res.write(`data: ${buffer}\n\n`);
          respostaCompleta += buffer;
          buffer = "";
        }
      }

      // Envia o que sobrou no buffer
      if (buffer.length) {
        res.write(`data: ${buffer}\n\n`);
        respostaCompleta += buffer;
      }

      session[email].push({ role: "assistant", content: respostaCompleta });
      res.write("data: [DONE]\n\n");
    } catch (streamError) {
      console.error("Erro durante o streaming:", streamError);
      if (!res.headersSent) {
        res.write(`data: Erro durante o streaming.\n\n`);
      }
    } finally {
      res.end();
    }

  } catch (error) {
    console.error("ERRO no handler askOpenAI:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Erro interno no servidor", details: error.message });
    }
  }
}
