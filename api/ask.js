// api/ask.js (Versão OpenAI - Com Busca em Sites Oficiais)

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
const modeloOpenAI = "gpt-4o-mini";

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
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Log_IA_Usage',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[timestamp, email, pergunta]] },
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
    palavrasDaBusca.forEach(palavra => { if (textoPalavrasChave.includes(palavra)) relevanceScore++; });
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
    if (!uniqueMatches[key] || match.score > uniqueMatches[key].score) uniqueMatches[key] = match;
  });

  return Object.values(uniqueMatches).sort((a, b) => b.score - a.score);
}

// --- FUNÇÃO OPENAI ---
async function askOpenAI(pergunta, contextoDaPlanilha = "Nenhum") {
  try {
    const prompt = `
### PERSONA E OBJETIVO
Você é o VeloBot, assistente factual da Velotax. Responda à pergunta do atendente usando **somente o contexto abaixo** ou **fontes externas autorizadas**.

### REGRAS DE FORMATAÇÃO
- NÃO REFORMULE ou invente nada.
- FALHA SEGURA: "Não encontrei esta informação na base de conhecimento ou nos sites autorizados."
- Sempre em português do Brasil (pt-BR).

CONTEXTO:
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
    return "Não encontrei esta informação na base de conhecimento ou nos sites autorizados.";
  }
}

// --- FUNÇÃO PARA BUSCAR SITES ---
async function buscarEPrepararContextoSites(pergunta) {
  const sites = [
    "https://www.gov.br/receitafederal",
    "https://cav.receita.fazenda.gov.br",
    "https://www.gov.br",
    "https://velotax.com.br"
  ];
  let contexto = "";
  for (const site of sites) {
    try {
      const { data } = await axios.get(site);
      if (data.toLowerCase().includes(pergunta.toLowerCase())) {
        contexto += `Fonte: ${site}\nTrecho: ${data.substring(0, 1000)}\n\n`;
      }
    } catch (e) {
      console.error(`Falha ao processar site ${site}:`, e.message);
    }
  }
  return contexto || null;
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

    if (correspondencias.length > 0) {
      return res.status(200).json({
        status: "sucesso",
        resposta: correspondencias[0].resposta,
        sourceRow: correspondencias[0].sourceRow,
        tabulacoes: correspondencias[0].tabulacoes,
        source: "Planilha"
      });
    }

    // --- Busca em sites oficiais ---
    const contextoSites = await buscarEPrepararContextoSites(pergunta);

    if (!contextoSites) {
      return res.status(200).json({
        status: "falha_segura",
        resposta: "Não encontrei esta informação na base de conhecimento ou nos sites autorizados.",
        source: null
      });
    }

    await logIaUsage(email, pergunta);
    const respostaDaIA = await askOpenAI(pergunta, contextoSites);
    return res.status(200).json({
      status: "sucesso_ia",
      resposta: respostaDaIA,
      source: "Sites Autorizados"
    });

  } catch (error) {
    console.error("ERRO NO BACKEND:", error);
    return res.status(500).json({ error: "Erro interno no servidor.", details: error.message });
  }
};
