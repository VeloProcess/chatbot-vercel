import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  const { pergunta, contextoPlanilha, email } = req.body;
  if (!pergunta || !email) return res.status(400).json({ error: "Faltando parâmetros" });

  try {
    const session = global.sessionMemory || {};
    if (!session[email]) session[email] = [];
    session[email].push({ role: "user", content: pergunta });

    const prompt = `
### PERSONA
Você é o VeloBot, assistente da Velotax.
### HISTÓRICO
${session[email].map(h => `${h.role}: ${h.content}`).join("\n")}
### CONTEXTO
${contextoPlanilha}
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

    res.status(200).send(resposta);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao chamar OpenAI" });
  }
}
