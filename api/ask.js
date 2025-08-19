// api/ask.js (Com Lógica de Esclarecimento/Disambiguation)

import { google } from 'googleapis';

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tyS89983odMbF04znYTmDLO6_6nZ9jFs0kz1fkEjnvY";
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
  scopes: ['https://www.googleapis.comcom/auth/spreadsheets.readonly'],
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

// --- NOVA LÓGICA DE BUSCA ---
function findMatches(pergunta, faqData) {
  const cabecalho = faqData[0];
  const dados = faqData.slice(1);

  const idxPergunta = cabecalho.indexOf("Pergunta");
  const idxPalavrasChave = cabecalho.indexOf("Palavras-chave");
  const idxResposta = cabecalho.indexOf("Resposta");

  if (idxPergunta === -1 || idxResposta === -1 || idxPalavrasChave === -1) {
    throw new Error("Colunas essenciais (Pergunta, Resposta, Palavras-chave) não encontradas na planilha.");
  }

  const termoDeBusca = normalizarTexto(pergunta);
  let correspondencias = [];

  for (let i = 0; i < dados.length; i++) {
    const linhaAtual = dados[i];
    const textoPergunta = normalizarTexto(linhaAtual[idxPergunta] || '');
    const textoPalavrasChave = normalizarTexto(linhaAtual[idxPalavrasChave] || '');

    // Busca pela pergunta exata (quando o usuário clica no botão)
    if (textoPergunta === termoDeBusca) {
        // Se encontrou a pergunta exata, retorna apenas ela com prioridade máxima
        return [{
            resposta: linhaAtual[idxResposta],
            perguntaOriginal: linhaAtual[idxPergunta],
            sourceRow: i + 2,
        }];
    }

    // Busca por palavra-chave
    if (textoPalavrasChave.includes(termoDeBusca)) {
      correspondencias.push({
        resposta: linhaAtual[idxResposta],
        perguntaOriginal: linhaAtual[idxPergunta],
        sourceRow: i + 2,
      });
    }
  }
  return correspondencias;
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
      // Nenhuma correspondência
      return res.status(200).json({ status: "nao_encontrado", resposta: `Não encontrei informações sobre "${pergunta}".` });
    } else if (correspondencias.length === 1) {
      // Resposta única e direta
      return res.status(200).json({
        status: "sucesso",
        resposta: correspondencias[0].resposta,
        sourceRow: correspondencias[0].sourceRow,
      });
    } else {
      // Múltiplas correspondências, precisa de esclarecimento
      return res.status(200).json({
        status: "clarification_needed",
        resposta: `Encontrei vários tópicos sobre "${pergunta}". Qual deles você gostaria de ver?`,
        options: correspondencias.map(c => c.perguntaOriginal) // Envia a lista de perguntas como opções
      });
    }
  } catch (error) {
    console.error("ERRO NO BACKEND:", error);
    return res.status(500).json({ error: "Erro interno no servidor.", details: error.message });
  }
}