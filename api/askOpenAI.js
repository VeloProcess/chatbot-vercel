import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
import pdf from "pdf-parse";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Função para ler PDF
async function lerPDF(caminho) {
  try {
    const buffer = await fs.readFile(caminho);
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    console.error(`Erro ao ler PDF ${caminho}:`, error.message);
    return "";
  }
}

// Função para criar chunks
function chunkText(text, size = 500) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + size));
    start += size;
  }
  return chunks;
}

// Função de busca nos chunks
function searchInChunks(pergunta, chunks) {
  const lowerQuestion = pergunta.toLowerCase();
  return chunks.filter(chunk => chunk.toLowerCase().includes(lowerQuestion));
}

// 🔧 Pré-carrega os PDFs (fora do handler, para não ler em toda requisição)
let documentChunks = [];
(async () => {
  const regrasInternas = await lerPDF(path.join(process.cwd(), "data/regras-internas.pdf"));
  const produtos = await lerPDF(path.join(process.cwd(), "data/produtos.pdf"));
  const documentText = regrasInternas + "\n\n" + produtos;
  documentChunks = chunkText(documentText, 500);
})();

export default async function handler(req, res) {
  try {
    const { pergunta, email } = req.body;
    if (!pergunta || !email) {
      return res.status(400).json({ error: "Faltando parâmetros" });
    }

    // Garante memória global
    if (!global.sessionMemory) global.sessionMemory = {};
    const session = global.sessionMemory;

    if (!Array.isArray(session[email])) session[email] = [];
    session[email].push({ role: "user", content: pergunta });

    const historico = session[email].length
      ? session[email].map(h => `${h.role}: ${h.content}`).join("\n")
      : "Nenhum histórico anterior.";

    // Busca nos chunks relevantes
    const relevantChunks = searchInChunks(pergunta, documentChunks).join("\n\n");

    const prompt = `
### PERSONA
Você é o **VeloBot**, assistente interno de suporte da Velotax.
Seu público é o atendente da empresa, não o cliente final.
Sua função é ensinar o atendente como responder corretamente ao cliente.

### HISTÓRICO DA CONVERSA
${historico}

### CONTEXTO DA EMPRESA
${relevantChunks || 'Nenhum conteúdo encontrado nos documentos.'}

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
    session[email].push({ role: "assistant", content: resposta });

    res.status(200).send(resposta);
  } catch (error) {
    console.error("ERRO no handler askOpenAI:", error);
    res.status(500).json({ error: "Erro interno no servidor", details: error.message });
  }
}