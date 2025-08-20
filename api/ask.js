// api/ask.js (Com Lógica de Relevância para Entender Perguntas Completas)

import { google } from 'googleapis';

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const FAQ_SHEET_NAME = "FAQ!A:C"; // Colunas: Pergunta, Resposta, Palavras-chave
const CACHE_DURATION_SECONDS = 300;

// --- CACHE ---
let cache = { timestamp: null, data: null };

// --- CLIENTE GOOGLE ---
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

// --- FUNÇÕES DE APOIO ---
async function getFaqData() {
  const now = new Date();
  if (cache.data && cache.timestamp && (now - cache.timestamp) / 1000 < CACHE_DURATION_SECONDS) {
    return cache.data;
  }
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: FAQ_SHEET_NAME,
  });
  if (!response.data.values || response.data.values.length === 0) {
    throw new Error("Não foi possível ler dados da planilha FAQ ou ela está vazia.");
  }
  cache = { timestamp: now, data: response.data.values };
  return cache.data;
}

function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim();
}

// --- LÓGICA DE BUSCA POR RELEVÂNCIA ---
function findMatches(pergunta, faqData) {
  const cabecalho = faqData[0];
  const dados = faqData.slice(1);

  const idxPergunta = cabecalho.indexOf("Pergunta");
  const idxPalavrasChave = cabecalho.indexOf("Palavras-chave");
  const idxResposta = cabecalho.indexOf("Resposta");

  if (idxPergunta === -1 || idxResposta === -1 || idxPalavrasChave === -1) {
    throw new Error("Colunas essenciais (Pergunta, Resposta, Palavras-chave) não encontradas na planilha.");
  }

  // 1. Quebra a pergunta do usuário em palavras-chave individuais
  const palavrasDaBusca = normalizarTexto(pergunta).split(' ').filter(p => p.length > 2);
  let todasAsCorrespondencias = [];

  // 2. Itera por todas as linhas da planilha
  for (let i = 0; i < dados.length; i++) {
    const linhaAtual = dados[i];
    const textoPergunta = normalizarTexto(linhaAtual[idxPergunta] || '');
    const textoPalavrasChave = normalizarTexto(linhaAtual[idxPalavrasChave] || '');
    const textoCompletoDaLinha = textoPergunta + ' ' + textoPalavrasChave;
    
    let relevanceScore = 0;
    // 3. Conta quantas palavras da busca do usuário existem nesta linha
    palavrasDaBusca.forEach(palavra => {
      if (textoCompletoDaLinha.includes(palavra)) {
        relevanceScore++;
      }
    });

    // 4. Se houver pelo menos uma correspondência, adiciona à lista com sua pontuação
    if (relevanceScore > 0) {
      todasAsCorrespondencias.push({
        resposta: linhaAtual[idxResposta],
        perguntaOriginal: linhaAtual[idxPergunta],
        sourceRow: i + 2,
        score: relevanceScore 
      });
    }
  }

  if (todasAsCorrespondencias.length === 0) {
    return [];
  }

  // 5. Ordena os resultados pela pontuação de relevância
  todasAsCorrespondencias.sort((a, b) => b.score - a.score);

  return todasAsCorrespondencias;
}

// --- FUNÇÃO PRINCIPAL (HANDLER) ---
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { pergunta } = req.query;
    if (!pergunta) {
      return res.status(400).json({ error: "Nenhuma pergunta fornecida." });
    }

    const faqData = await getFaqData();
    const correspondencias = findMatches(pergunta, faqData);

    if (correspondencias.length === 0) {
      return res.status(200).json({ status: "nao_encontrado", resposta: `Não encontrei informações sobre "${pergunta}".` });
    } else if (correspondencias.length === 1) {
      return res.status(200).json({
        status: "sucesso",
        resposta: correspondencias[0].resposta,
        sourceRow: correspondencias[0].sourceRow,
      });
    } else {
      // Se a melhor resposta for claramente mais relevante que a segunda, responde direto
      if (correspondencias[0].score > correspondencias[1].score) {
          return res.status(200).json({
            status: "sucesso",
            resposta: correspondencias[0].resposta,
            sourceRow: correspondencias[0].sourceRow,
          });
      }
      // Se houver empate ou resultados próximos, pede esclarecimento
      return res.status(200).json({
        status: "clarification_needed",
        resposta: `Encontrei vários tópicos sobre "${pergunta}". Qual deles se encaixa melhor na sua dúvida?`,
        options: correspondencias.slice(0, 5).map(c => c.perguntaOriginal)
      });
    }
  } catch (error) {
    console.error("ERRO NO BACKEND:", error);
    return res.status(500).json({ error: "Erro interno no servidor.", details: error.message });
  }
}
