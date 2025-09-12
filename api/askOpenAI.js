import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
import pdf from "pdf-parse"; // <-- nova lib para ler PDFs

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

export default async function handler(req, res) {
  try {
    const { pergunta, contextoPlanilha, email } = req.body;
    if (!pergunta || !email) {
      return res.status(400).json({ error: "Faltando parâmetros" });
    }

    // Carrega os PDFs e converte para texto
    const regrasInternas = await lerPDF(path.join(process.cwd(), "data/regras-internas.pdf"));
    const produtos = await lerPDF(path.join(process.cwd(), "data/produtos.pdf"));

    const prompt = `
### PERSONA
Você é o VeloBot, assistente oficial da Velotax. 
Responda sempre de forma formal, clara e objetiva.

### HISTÓRICO
${email} já perguntou: (histórico pode ser adicionado depois)

### CONTEXTO INTERNO
${contextoPlanilha || "Nenhum"}
${regrasInternas}
${produtos}

### PERGUNTA ATUAL
"${pergunta}"
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1024,
    });

    const resposta = completion.choices[0].message.content;
    res.status(200).json({ resposta });
  } catch (error) {
    console.error("🔥 ERRO no handler askOpenAI:", error);
    res.status(500).json({ error: "Erro interno no servidor", details: error.message });
  }
}