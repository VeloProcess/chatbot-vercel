// api/ask-simple.js - Busca na planilha com cache local
const { google } = require('googleapis');

// Configuração do Google Sheets
const SPREADSHEET_ID = "1d0h9zr4haDx6etLtdMqPVsBXdVvH7n9OsRdqAhOJOp0";
const FAQ_SHEET_NAME = "FAQ!A:D"; // Pergunta, Resposta, Palavras-chave, Sinônimos

// Cache global para Vercel (persiste entre requests)
global.faqCache = global.faqCache || {
  data: null,
  timestamp: 0,
  ttl: 300000 // 5 minutos
};

// Cliente Google Sheets
let auth, sheets;

try {
  if (!process.env.GOOGLE_CREDENTIALS) {
    console.warn('⚠️ GOOGLE_CREDENTIALS não configurado no ask-simple');
  } else {
    auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    sheets = google.sheets({ version: 'v4', auth });
  }
} catch (error) {
  console.error('❌ Erro ao configurar Google Sheets no ask-simple:', error.message);
}

// Função para buscar dados da planilha (com cache global)
async function getFaqData() {
  // Verificar cache global primeiro
  const now = Date.now();
  if (global.faqCache.data && (now - global.faqCache.timestamp) < global.faqCache.ttl) {
    console.log('✅ ask-simple: Usando cache global');
    return global.faqCache.data;
  }
  
  if (!sheets) {
    throw new Error('Google Sheets não configurado');
  }
  
  console.log('🔍 ask-simple: Buscando dados da planilha...');
  
  // Timeout de 8 segundos para Vercel (limite de 10s)
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout da planilha')), 8000);
  });
  
  const sheetsPromise = sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: FAQ_SHEET_NAME,
  });
  
  const response = await Promise.race([sheetsPromise, timeoutPromise]);
  
  if (!response.data.values || response.data.values.length === 0) {
    throw new Error("Planilha FAQ vazia ou não encontrada");
  }
  
  // Atualizar cache global
  global.faqCache.data = response.data.values;
  global.faqCache.timestamp = now;
  
  console.log('✅ ask-simple: Dados da planilha obtidos:', response.data.values.length, 'linhas');
  return response.data.values;
}

// Função para normalizar texto
function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim();
}

// Função para buscar correspondências (igual ao ask.js original)
function findMatches(pergunta, faqData) {
  const cabecalho = faqData[0];
  const dados = faqData.slice(1);
  
  // Busca case-insensitive das colunas
  const idxPergunta = cabecalho.findIndex(col => 
    col && col.toLowerCase().includes('pergunta')
  );
  const idxPalavrasChave = cabecalho.findIndex(col => 
    col && (col.toLowerCase().includes('palavra') || col.toLowerCase().includes('chave'))
  );
  const idxResposta = cabecalho.findIndex(col => 
    col && col.toLowerCase().includes('resposta')
  );
  const idxSinonimos = cabecalho.findIndex(col => 
    col && col.toLowerCase().includes('sinonimo')
  );

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
        sinonimos: idxSinonimos !== -1 ? (linhaAtual[idxSinonimos] || null) : null
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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('🔍 ask-simple: Iniciando...');
    
    const { pergunta, email, usar_ia_avancada = 'true' } = req.query;
    
    if (!pergunta) {
      return res.status(400).json({ error: "Nenhuma pergunta fornecida." });
    }

    console.log('🔍 ask-simple: Pergunta recebida:', { pergunta, email, usar_ia_avancada });

    // Buscar dados da planilha (sempre atualizado)
    const faqData = await getFaqData();
    console.log('📊 ask-simple: Dados obtidos da planilha:', faqData.length, 'linhas');

    // Buscar correspondências na planilha
    const correspondencias = findMatches(pergunta, faqData);
    
    if (correspondencias.length === 0) {
      return res.status(200).json({
        status: "sucesso_offline",
        resposta: "Desculpe, não encontrei informações sobre essa pergunta na nossa base de dados. Entre em contato com nosso suporte.",
        sourceRow: 'N/A',
        source: 'Planilha Google Sheets',
        modo: 'offline',
        nivel: 2
      });
    }

    // Se encontrou correspondências
    if (correspondencias.length === 1 || correspondencias[0].score > correspondencias[1]?.score) {
      console.log('✅ ask-simple: Resposta única encontrada');
      return res.status(200).json({
        status: "sucesso_offline",
        resposta: correspondencias[0].resposta,
        sourceRow: correspondencias[0].sourceRow,
        sinonimos: correspondencias[0].sinonimos,
        source: "Planilha Google Sheets",
        modo: 'offline',
        nivel: 2
      });
    } else {
      console.log('✅ ask-simple: Múltiplas correspondências encontradas');
      return res.status(200).json({
        status: "clarification_needed_offline",
        resposta: `Encontrei vários tópicos sobre "${pergunta}". Qual deles se encaixa melhor na sua dúvida?`,
        options: correspondencias.map(c => c.perguntaOriginal).slice(0, 12),
        source: "Planilha Google Sheets",
        sourceRow: 'Pergunta de Esclarecimento',
        modo: 'offline',
        nivel: 2
      });
    }

  } catch (error) {
    console.error('❌ ask-simple: Erro crítico:', error);
    return res.status(500).json({
      status: "erro_critico",
      resposta: "Erro interno do sistema. Tente novamente.",
      source: "Sistema",
      error: error.message
    });
  }
};