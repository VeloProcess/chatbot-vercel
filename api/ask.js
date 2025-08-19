// api/ask.js

import { google } from 'googleapis';

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tyS89983odMbF04znYTmDLO6_6nZ9jFs0kz1fkEjnvY";
const DOCUMENT_ID = "1Mv81rBoeTmsoXYHFXyHSmkvPvnPi15w4h5CSojzFjCo"; // ID do documento Google Docs
const FAQ_SHEET_NAME = "FAQ!A:E"; // Otimizado para ler apenas as colunas A, B, C e D
const CACHE_DURATION_SECONDS = 300; // 5 minutos

// --- CACHE INTELIGENTE ---
// Guarda os dados da planilha em memória para evitar leituras repetidas
let cache = {
  timestamp: null,
  data: null,
};

// --- CLIENTE GOOGLE SHEETS OTIMIZADO ---
// Criado fora do handler para ser reutilizado entre as chamadas (melhor performance)
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
  scopes: [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/documents.readonly' // Adicione esta linha
],
});

const sheets = google.sheets({ version: 'v4', auth });

// --- FUNÇÃO PARA BUSCAR E CACHEAR OS DADOS DA PLANILHA ---
async function getFaqData() {
  const now = new Date();
  // Se o cache existe e ainda é válido (menos de 5 minutos), usa o cache
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

  // Atualiza o cache com os novos dados
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

// --- SUA LÓGICA DE BUSCA EM FUNIL (INTACTA) ---
// --- SUA LÓGICA DE BUSCA EM FUNIL (MODIFICADA) ---
function findBestMatch(pergunta, faqData) {
  const cabecalho = faqData[0];
  const dados = faqData.slice(1);

  const idxPergunta = cabecalho.indexOf("Pergunta");
  const idxPalavrasChave = cabecalho.indexOf("Palavras-chave");
  const idxResposta = cabecalho.indexOf("Resposta");
  const idxScore = cabecalho.indexOf("Score");
  const idxUrl = cabecalho.indexOf("URL"); // <-- Adiciona a busca pela coluna URL

  // Validação para garantir que as colunas essenciais existem
  if (idxPergunta === -1 || idxResposta === -1 || idxPalavrasChave === -1) {
    throw new Error("Colunas essenciais (Pergunta, Resposta, Palavras-chave) não encontradas na planilha.");
  }
  
  if (idxUrl === -1) {
    console.warn("Aviso: Coluna 'URL' não encontrada na planilha. A busca em documentos não funcionará.");
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
      const textoPergunta = normalizarTexto(linhaAtual[idxPergunta]);
      const textoPalavrasChave = normalizarTexto(linhaAtual[idxPalavrasChave]);

      if (textoPergunta.includes(termo) || textoPalavrasChave.includes(termo)) {
        correspondencias.push({
          dados: linhaAtual[idxResposta],
          linha: i + 2,
          score: Number(linhaAtual[idxScore]) || 0,
          // Adiciona a URL ao resultado se a coluna existir
          url: idxUrl !== -1 ? linhaAtual[idxUrl] : null 
        });
      }
    }

    if (correspondencias.length > 0) {
      correspondencias.sort((a, b) => b.score - a.score);
      return correspondencias[0];
    }
  }

  return null;
}


// --- A FUNÇÃO PRINCIPAL DA API (HANDLER) ---
export default async function handler(req, res) {
  // Configuração dos cabeçalhos CORS
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

    // --- ETAPA 1: BUSCAR NA PLANILHA (FAQ) ---
    const faqData = await getFaqData();
    const melhorResultadoFAQ = findBestMatch(pergunta, faqData);

    // Se encontrou na planilha, retorna imediatamente.
    if (melhorResultadoFAQ) {
      console.log("Resposta encontrada na Planilha (FAQ).");
      return res.status(200).json({
        status: "sucesso",
        resposta: melhorResultadoFAQ.dados,
        sourceRow: melhorResultadoFAQ.linha,
        source: "Planilha"
      });
    }

    // --- ETAPA 2: SE NÃO ACHOU, BUSCAR NO GOOGLE DOCS ---
    console.log("Não encontrou no FAQ. Tentando busca no Google Docs...");
    const resultadoDocs = await searchGoogleDoc(pergunta);
    
    if (resultadoDocs) {
      console.log("Resposta encontrada no Google Docs.");
      return res.status(200).json({
        status: "sucesso",
        resposta: resultadoDocs,
        sourceRow: null, // Não há linha de fonte para o Docs
        source: "Documento"
      });
    }

    // --- ETAPA 3: SE NÃO ENCONTROU EM NENHUM LUGAR ---
    console.log("Não encontrou em nenhuma das fontes.");
    return res.status(200).json({
      status: "nao_encontrado",
      resposta: `Não encontrei informações sobre "${pergunta}" em nossas bases de conhecimento.`,
      sourceRow: null,
    });

  } catch (error) {
    console.error("ERRO NO BACKEND:", error);
      return res.status(500).json({ error: "Erro interno no servidor.", details: error.message });
    }
  }