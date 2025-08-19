// api/ask.js (Versão Simplificada - Sem Score)

import { google } from 'googleapis';

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tyS89983odMbF04znYTmDLO6_6nZ9jFs0kz1fkEjnvY";
// --- ALTERADO ---: O range agora só precisa das colunas essenciais.
const FAQ_SHEET_NAME = "FAQ!A:C"; // Colunas: Pergunta, Resposta, Palavras-chave
const CACHE_DURATION_SECONDS = 300; // 5 minutos

// --- CACHE INTELIGENTE ---
let cache = {
  timestamp: null,
  data: null,
};

// --- CLIENTE GOOGLE OTIMIZADO ---
if (!process.env.GOOGLE_CREDENTIALS) {
  throw new Error("A variável de ambiente GOOGLE_CREDENTIALS não está definida.");
}
let credentials;
try {
  credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
} catch (e) {
  throw new Error("GOOGLE_CREDENTIALS não é um JSON válido.");
}

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// --- FUNÇÃO PARA BUSCAR E CACHEAR OS DADOS DA PLANILHA ---
async function getFaqData() {
  const now = new Date();
  if (cache.data && cache.timestamp && (now - cache.timestamp) / 1000 < CACHE_DURATION_SECONDS) {
    console.log("Usando dados do cache.");
    return cache.data;
  }
  console.log("Buscando dados novos da planilha...");
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: FAQ_SHEET_NAME,
  });
  if (!response.data.values || response.data.values.length === 0) {
    throw new Error("Não foi possível ler dados da planilha FAQ ou ela está vazia.");
  }
  cache = {
    timestamp: now,
    data: response.data.values,
  };
  return cache.data;
}

// --- FUNÇÃO PARA NORMALIZAR TEXTO ---
function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim();
}

// --- LÓGICA DE BUSCA NA PLANILHA (SEM SCORE) ---
function findBestMatch(pergunta, faqData) {
  const cabecalho = faqData[0];
  const dados = faqData.slice(1);

  const idxPergunta = cabecalho.indexOf("Pergunta");
  const idxPalavrasChave = cabecalho.indexOf("Palavras-chave");
  const idxResposta = cabecalho.indexOf("Resposta");
  // --- REMOVIDO ---: A busca pelo índice do Score foi removida.
  // const idxScore = cabecalho.indexOf("Score");

  if (idxPergunta === -1 || idxResposta === -1 || idxPalavrasChave === -1) {
    throw new Error("Colunas essenciais (Pergunta, Resposta, Palavras-chave) não encontradas na planilha.");
  }

  const palavrasDaBusca = normalizarTexto(pergunta).split(' ').filter(p => p);
  const termosDoFunil = [];
  while (palavrasDaBusca.length > 0) {
    termosDoFunil.push(palavrasDaBusca.join(' '));
    palavrasDaBusca.pop();
  }

  for (const termo of termosDoFunil) {
    const correspondencias = [];
    for (let i = 0; i < dados.length; i++) {
      const linhaAtual = dados[i];
      if (!linhaAtual[idxPergunta] && !linhaAtual[idxPalavrasChave]) continue;
      
      const textoPergunta = normalizarTexto(linhaAtual[idxPergunta]);
      const textoPalavrasChave = normalizarTexto(linhaAtual[idxPalavrasChave]);

      if (textoPergunta.includes(termo) || textoPalavrasChave.includes(termo)) {
        correspondencias.push({
          dados: linhaAtual[idxResposta],
          linha: i + 2,
          perguntaOriginal: linhaAtual[idxPergunta],
          // --- REMOVIDO ---: A propriedade 'score' não é mais adicionada.
        });
      }
    }

    if (correspondencias.length > 0) {
      // --- REMOVIDO ---: A linha que ordenava os resultados pelo score foi removida.
      // correspondencias.sort((a, b) => b.score - a.score);
      
      const bestMatch = correspondencias[0];
      const suggestions = correspondencias.slice(1);

      return { bestMatch, suggestions };
    }
  }

  return null;
}

// --- A FUNÇÃO PRINCIPAL DA API (HANDLER) ---
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { pergunta } = req.query;
    if (!pergunta) {
      return res.status(400).json({ error: "Nenhuma pergunta fornecida." });
    }

    const faqData = await getFaqData();
    const resultadoBusca = findBestMatch(pergunta, faqData);

    if (resultadoBusca && resultadoBusca.bestMatch) {
      return res.status(200).json({
        status: "sucesso",
        resposta: resultadoBusca.bestMatch.dados,
        sourceRow: resultadoBusca.bestMatch.linha,
        suggestions: resultadoBusca.suggestions.map(s => s.perguntaOriginal)
      });
    } else {
      return res.status(200).json({
        status: "nao_encontrado",
        resposta: `Não encontrei informações sobre "${pergunta}".`,
        sourceRow: null,
      });
    }

  } catch (error) {
    console.error("ERRO NO BACKEND:", error);
    return res.status(500).json({ error: "Erro interno no servidor.", details: error.message });
  }
}