import OpenAI from "openai";
import { carregarBase } from "../chunker.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Carrega base de dados e chunks logo no início
const { json: baseDeDados, chunks: documentChunks } = carregarBase();

function searchInChunks(pergunta) {
  const lowerQuestion = pergunta.toLowerCase();
  return documentChunks.filter(chunk => chunk.toLowerCase().includes(lowerQuestion));
}

export default async function handler(req, res) {
  try {
    const { pergunta, email } = req.body;
    if (!pergunta || !email) {
      return res.status(400).json({ error: "Faltando parâmetros" });
    }

    // Memória de sessão global
    if (!global.sessionMemory) {
      global.sessionMemory = {};
    }
    const session = global.sessionMemory;

    if (!Array.isArray(session[email])) {
      session[email] = [];
    }

    // Adiciona pergunta ao histórico
    session[email].push({ role: "user", content: pergunta });

    const historico = session[email].length
      ? session[email].map(h => `${h.role}: ${h.content}`).join("\n")
      : "Nenhum histórico anterior.";

    // Busca nos chunks
    const relevantChunks = searchInChunks(pergunta).join("\n\n");

    
    const prompt = `
### PERSONA
Você é o **VeloBot**, assistente interno de suporte da Velotax.
Seu público é o atendente da empresa, não o cliente final.
Sua função é ensinar o atendente como responder corretamente ao cliente.

### HISTÓRICO DA CONVERSA
${historico}

### CONTEXTO DA EMPRESA
${relevantChunks || "Nenhum conteúdo encontrado nos documentos."}

### REGRAS DE RESPOSTA
- Responda de forma clara e prática, em tom profissional.
- Sempre descreva o passo a passo ou procedimento que o atendente deve seguir.
- **Não se dirija ao cliente diretamente** (não use "Prezado cliente", "você" ou "seu").
- Use uma linguagem de orientação interna, como "informe ao cliente que...", "explique que...", "siga este procedimento...".
- Se não encontrar informação relevante, diga: "Não encontrei instrução para este caso. Se for algum procedimento interno, tente pesquisar com outras palavras para eu localizar em minha base."

### PERGUNTA
"${pergunta}"
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1024,
    });

    const resposta = completion.choices[0].message.content;
    res.status(200).send(resposta);
  } catch (error) {
    console.error("ERRO no handler askOpenAI:", error);
    res.status(500).json({ error: "Erro interno no servidor", details: error.message });
  }
}