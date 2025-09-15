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
    const fileContent = await fs.readFile(filePath, "utf-8");
    const jsonData = JSON.parse(fileContent);

    console.log("Base JSON carregada:", filePath);

    let fullText = "";
    jsonData.forEach(item => {
      if (item.title && item.content) {
        fullText += `${item.title}\n${item.content}\n\n`;
      }
    });

    // cria chunks de 500 caracteres
    const chunkSize = 500;
    documentChunks = [];
    for (let start = 0; start < fullText.length; start += chunkSize) {
      documentChunks.push(fullText.slice(start, start + chunkSize));
    }

    console.log(`Base dividida em ${documentChunks.length} chunks.`);
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

// ------------------- HANDLER -------------------
export default async function handler(req, res) {
  try {
    const { pergunta, email } = req.body || {};
    if (!pergunta || !email) {
      return res.status(400).json({ error: "Faltando parâmetros" });
    }

    // Inicializa memória de sessão global
    if (!global.sessionMemory) global.sessionMemory = {};
    if (!Array.isArray(global.sessionMemory[email])) global.sessionMemory[email] = [];
    const session = global.sessionMemory;

    // Adiciona pergunta ao histórico
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1024
    });

    const resposta = completion.choices[0].message.content;
    session[email].push({ role: "assistant", content: resposta });

    return res.status(200).json({ resposta });

  } catch (error) {
    console.error("ERRO no handler askOpenAI:", error);
    return res.status(500).json({ error: "Erro interno no servidor", details: error.message });
  }
}
