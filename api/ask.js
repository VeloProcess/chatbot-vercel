// api/ask.js (Versão OpenAI - Sem Gemini)

const { google } = require('googleapis');
const axios = require('axios');
const OpenAI = require('openai');

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const FAQ_SHEET_NAME = "FAQ!A:D";

// --- CLIENTE GOOGLE SHEETS ---
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// --- CLIENTE OPENAI ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const modeloOpenAI = "gpt-4o-mini"; // Modelo ajustável

// --- FUNÇÕES DE APOIO ---
async function getFaqData() {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: FAQ_SHEET_NAME,
  });
  if (!response.data.values || response.data.values.length === 0) {
    throw new Error("Não foi possível ler dados da planilha FAQ ou ela está vazia.");
  }
  return response.data.values;
}

function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim();
}

async function logIaUsage(email, pergunta) {
  try {
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const newRow = [timestamp, email, pergunta];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Log_IA_Usage',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [newRow] },
    });
  } catch (error) {
    console.error("ERRO AO REGISTRAR USO DA IA:", error);
  }
}

function findMatches(pergunta, faqData) {
  const cabecalho = faqData[0];
  const dados = faqData.slice(1);
  const idxPergunta = cabecalho.indexOf("Pergunta");
  const idxPalavrasChave = cabecalho.indexOf("Palavras-chave");
  const idxResposta = cabecalho.indexOf("Resposta");

  if (idxPergunta === -1 || idxResposta === -1 || idxPalavrasChave === -1) {
    throw new Error("Colunas essenciais (Pergunta, Resposta, Palavras-chave) não encontradas.");
  }

  const palavrasDaBusca = normalizarTexto(pergunta).split(' ').filter(p => p.length > 2);
  let todasAsCorrespondencias = [];

  for (let i = 0; i < dados.length; i++) {
    const linhaAtual = dados[i];
    const textoPalavrasChave = normalizarTexto(linhaAtual[idxPalavrasChave] || '');
    let relevanceScore = 0;
    palavrasDaBusca.forEach(palavra => {
      if (textoPalavrasChave.includes(palavra)) relevanceScore++;
    });
    if (relevanceScore > 0) {
      todasAsCorrespondencias.push({
        resposta: linhaAtual[idxResposta],
        perguntaOriginal: linhaAtual[idxPergunta],
        sourceRow: i + 2,
        score: relevanceScore,
        tabulacoes: linhaAtual[3] || null
      });
    }
  }

  // Desduplicação e ordenação
  const uniqueMatches = {};
  todasAsCorrespondencias.forEach(match => {
    const key = match.perguntaOriginal.trim();
    if (!uniqueMatches[key] || match.score > uniqueMatches[key].score) {
      uniqueMatches[key] = match;
    }
  });
  let correspondenciasUnicas = Object.values(uniqueMatches);
  correspondenciasUnicas.sort((a, b) => b.score - a.score);
  return correspondenciasUnicas;
}

// --- FUNÇÃO OPENAI ---
async function askOpenAI(pergunta, contextoDaPlanilha = "Nenhum") {
  try {
    const prompt = `
### PERSONA E OBJETIVO
Você é o VeloBot, assistente factual da Velotax. Responda à pergunta do atendente usando **somente o contexto abaixo** ou **fontes externas autorizadas**.

### FONTES DA VERDADE
1. CONTEXTO DA PLANILHA (prioridade máxima)
2. FONTES EXTERNAS AUTORIZADAS:
   - Site da Receita Federal
   - Portal e-CAC
   - GOV.BR
   - Site oficial da Velotax (velotax.com.br)

### REGRAS DE FORMATAÇÃO
- SE NO CONTEXTO DA PLANILHA:
achei isto na minha base de dados sobre
${pergunta}

[INSIRA A INFORMAÇÃO EXATA DO CONTEXTO]

fonte: base de conhecimento

- SE EM FONTES EXTERNAS:
sobre
${pergunta} eu encontrei em [NOME DO SITE]

[INSIRA A INFORMAÇÃO EXATA DO SITE]

fonte: [NOME DO SITE]

- NÃO REFORMULE ou resuma.
- FALHA SEGURA: "Não encontrei esta informação na base de conhecimento ou nos sites autorizados."
- Sempre em português do Brasil (pt-BR).

---
CONTEXTO DA PLANILHA:
"""
${contextoDaPlanilha}
"""

PERGUNTA DO ATENDENTE:
"${pergunta}"
`;

    const chatCompletion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: modeloOpenAI,
      temperature: 0,
      max_tokens: 1024,
    });

    return chatCompletion.choices[0].message.content;
  } catch (error) {
    console.error("ERRO AO CHAMAR A API DA OPENAI:", error);
    return "Desculpe, não consegui processar sua pergunta com a IA neste momento.";
  }
}

// --- FUNÇÃO PRINCIPAL DA API (HANDLER) ---
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=240');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { pergunta, email } = req.query;
    if (!pergunta) return res.status(400).json({ error: "Nenhuma pergunta fornecida." });

    // --- BLOCO DE MENU ESPECÍFICO ---
    const perguntaNormalizada = normalizarTexto(pergunta);
    if (perguntaNormalizada === 'credito') {
      return res.status(200).json({
        status: "clarification_needed",
        resposta: "Você quer qual informação sobre crédito?",
        options: ["Antecipação", "Crédito ao trabalhador", "Crédito pessoal"],
        source: "Planilha",
        sourceRow: 'Pergunta de Esclarecimento'
      });
    }

    const faqData = await getFaqData();
    const correspondencias = findMatches(pergunta, faqData);

    // --- LÓGICA HÍBRIDA USANDO OPENAI ---
    if (correspondencias.length === 0) {
      await logIaUsage(email, pergunta);
      const contextoSites = ""; // Se quiser, pode chamar buscarEPrepararContextoSites()
      const respostaDaIA = await askOpenAI(pergunta, contextoSites);
      return res.status(200).json({
        status: "sucesso_ia",
        resposta: respostaDaIA,
        source: "IA",
        sourceRow: 'Resposta da IA'
      });
    }

    // --- SE HOUVER CORRESPONDÊNCIAS ---
    if (correspondencias.length === 1 || correspondencias[0].score > correspondencias[1].score) {
      return res.status(200).json({
        status: "sucesso",
        resposta: correspondencias[0].resposta,
        sourceRow: correspondencias[0].sourceRow,
        tabulacoes: correspondencias[0].tabulacoes,
        source: "Planilha"
      });
    } else {
      return res.status(200).json({
        status: "clarification_needed",
        resposta: `Encontrei vários tópicos sobre "${pergunta}". Qual deles se encaixa melhor na sua dúvida?`,
        options: correspondencias.map(c => c.perguntaOriginal).slice(0, 12),
        source: "Planilha",
        sourceRow: 'Pergunta de Esclarecimento'
      });
    }
  } catch (error) {
    console.error("ERRO NO BACKEND:", error);
    return res.status(500).json({ error: "Erro interno no servidor.", details: error.message });
  }
};