// api/ask-mongodb.js - Sistema que funcionava maravilhosamente bem
const { MongoClient } = require('mongodb');
const { google } = require('googleapis');

// --- CONFIGURAÇÃO MONGODB (versão que funcionava) ---
const MONGODB_URI = "mongodb+srv://gabrielaraujo:sGoeqQgbxlsIwnjc@velohubcentral.od7vwts.mongodb.net/";
const DB_NAME = "console_conteudo";
const FAQ_COLLECTION = "Bot_perguntas";

// --- CONFIGURAÇÃO GOOGLE SHEETS PARA LOGS ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";

// --- CLIENTES ---
let mongoClient = null;
let db = null;
let auth, sheets;

// --- CACHE LOCAL ---
let localFaqCache = {
  data: null,
  timestamp: null,
  lastSync: null,
  syncInterval: 5 * 60 * 1000 // 5 minutos
};

// --- CONFIGURAÇÕES DE TIMEOUT ---
const TIMEOUTS = {
  MONGODB: 5000,              // 5 segundos
  CACHE_SYNC: 10000           // 10 segundos
};

// --- FUNÇÕES DE CONEXÃO MONGODB ---
async function connectToMongoDB() {
  if (mongoClient && db) {
    return { mongoClient, db };
  }

  try {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db(DB_NAME);
    
    console.log('✅ Conectado ao MongoDB:', DB_NAME);
    return { mongoClient, db };
  } catch (error) {
    console.error('❌ Erro ao conectar MongoDB:', error);
    throw error;
  }
}

// --- FUNÇÃO PARA BUSCAR DADOS DO MONGODB ---
async function getFaqData() {
  const now = Date.now();
  
  // Verificar cache primeiro
  if (localFaqCache.data && (now - localFaqCache.timestamp) < localFaqCache.syncInterval) {
    console.log('✅ Usando cache local do MongoDB');
    return localFaqCache.data;
  }

  try {
    console.log('🔍 Buscando dados do MongoDB...');
    console.log('🔍 MONGODB_URI:', MONGODB_URI);
    console.log('🔍 DB_NAME:', DB_NAME);
    console.log('🔍 FAQ_COLLECTION:', FAQ_COLLECTION);
    
    const { mongoClient: client, db: database } = await connectToMongoDB();
    const collection = database.collection(FAQ_COLLECTION);

    // Buscar todos os documentos
    const documents = await collection.find({}).toArray();
    console.log('✅ Documentos encontrados:', documents.length);
    
    // Log dos primeiros documentos para debug
    if (documents.length > 0) {
      console.log('🔍 Primeiro documento:', JSON.stringify(documents[0], null, 2));
      console.log('🔍 Estrutura dos campos:', Object.keys(documents[0]));
    }

    if (documents.length === 0) {
      throw new Error(`Nenhum documento encontrado na coleção ${FAQ_COLLECTION}`);
    }

    // Atualizar cache
    localFaqCache.data = documents;
    localFaqCache.timestamp = now;
    localFaqCache.lastSync = new Date().toISOString();

    console.log('✅ Dados do MongoDB obtidos:', documents.length, 'documentos');
    return documents;

  } catch (error) {
    console.error('❌ Erro ao buscar dados do MongoDB:', error);
    console.error('❌ Stack trace:', error.stack);
    throw error;
  }
}

// --- FUNÇÃO PARA NORMALIZAR TEXTO ---
function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim();
}

// --- FUNÇÃO PARA BUSCAR CORRESPONDÊNCIAS ---
function findMatches(pergunta, faqData) {
  console.log('🔍 Buscando correspondências em', faqData.length, 'documentos');
  console.log('🔍 Pergunta:', pergunta);

  if (!faqData || faqData.length === 0) {
    throw new Error("Nenhum dado disponível para busca.");
  }

  const palavrasDaBusca = normalizarTexto(pergunta).split(' ').filter(p => p.length > 1); // Reduzir para 1 caractere
  console.log('🔍 Palavras da busca:', palavrasDaBusca);
  console.log('🔍 Pergunta original:', pergunta);
  console.log('🔍 Pergunta normalizada:', normalizarTexto(pergunta));
  let todasAsCorrespondencias = [];

  for (let i = 0; i < faqData.length; i++) {
    const documento = faqData[i];
    const textoPalavrasChave = normalizarTexto(documento.Palavras_chave || '');
    const textoPergunta = normalizarTexto(documento.Pergunta || '');
    const textoSinonimos = normalizarTexto(documento.Sinonimos || '');
    let relevanceScore = 0;

    // Log detalhado para debug (apenas para os primeiros 3 documentos)
    if (i < 3) {
      console.log(`🔍 Documento ${i + 1}:`, {
        pergunta: documento.Pergunta,
        palavrasChave: documento.Palavras_chave,
        sinonimos: documento.Sinonimos,
        textoPalavrasChave,
        textoPergunta,
        textoSinonimos
      });
    }

    // Buscar nas palavras-chave (prioridade alta)
    if (textoPalavrasChave) {
      palavrasDaBusca.forEach(palavra => {
        if (textoPalavrasChave.includes(palavra)) {
          relevanceScore += 3; // Peso maior para palavras-chave
        }
      });
    }

    // Buscar nos sinônimos (prioridade alta)
    if (textoSinonimos) {
      palavrasDaBusca.forEach(palavra => {
        if (textoSinonimos.includes(palavra)) {
          relevanceScore += 2; // Peso alto para sinônimos
        }
      });
    }

    // Buscar na pergunta (prioridade menor)
    if (textoPergunta) {
      palavrasDaBusca.forEach(palavra => {
        if (textoPergunta.includes(palavra)) {
          relevanceScore += 1; // Peso menor para pergunta
        }
      });
    }

    // Busca mais flexível - verificar se a pergunta contém parte do texto
    const perguntaOriginal = documento.Pergunta || '';
    if (perguntaOriginal.toLowerCase().includes(pergunta.toLowerCase())) {
      relevanceScore += 4; // Peso alto para correspondência exata
    }

    // Busca nas palavras-chave com correspondência parcial
    const palavrasChaveOriginal = documento.Palavras_chave || '';
    if (palavrasChaveOriginal.toLowerCase().includes(pergunta.toLowerCase())) {
      relevanceScore += 4; // Peso alto para correspondência exata
    }

    // Busca flexível por palavras individuais na pergunta
    const perguntaNormalizada = normalizarTexto(pergunta);
    const perguntaDocNormalizada = normalizarTexto(perguntaOriginal);
    if (perguntaDocNormalizada.includes(perguntaNormalizada)) {
      relevanceScore += 3; // Peso médio para correspondência parcial
    }

    // Busca flexível por palavras individuais nas palavras-chave
    const palavrasChaveNormalizada = normalizarTexto(palavrasChaveOriginal);
    if (palavrasChaveNormalizada.includes(perguntaNormalizada)) {
      relevanceScore += 3; // Peso médio para correspondência parcial
    }

    if (relevanceScore > 0) {
      console.log(`✅ Correspondência encontrada no documento ${i + 1}:`, {
        pergunta: documento.Pergunta,
        score: relevanceScore,
        palavrasChave: documento.Palavras_chave,
        sinonimos: documento.Sinonimos
      });
      
      todasAsCorrespondencias.push({
        resposta: documento.Resposta || '',
        perguntaOriginal: documento.Pergunta || '',
        sourceRow: documento._id || (i + 1), // Usar _id se disponível, senão índice
        score: relevanceScore,
        tabulacoes: documento.Palavras_chave || null
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
  
  console.log('🔍 Total de correspondências encontradas:', correspondenciasUnicas.length);
  if (correspondenciasUnicas.length > 0) {
    console.log('🔍 Melhor correspondência:', correspondenciasUnicas[0]);
  }
  
  return correspondenciasUnicas;
}

// --- CONFIGURAR GOOGLE SHEETS PARA LOGS ---
try {
  if (!process.env.GOOGLE_CREDENTIALS) {
    console.warn('⚠️ GOOGLE_CREDENTIALS não configurado para logs');
  } else {
    auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Google Sheets configurado para logs');
  }
} catch (error) {
  console.error('❌ Erro ao configurar Google Sheets para logs:', error.message);
}

// --- FUNÇÕES DE LOG NO GOOGLE SHEETS ---
async function logQuestionOnSheet(question, email) {
  if (!sheets) {
    console.warn('⚠️ Google Sheets não configurado para log de perguntas');
    return;
  }

  try {
    const timestamp = new Date().toLocaleString('pt-BR');
    const values = [[timestamp, email, question]];
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Log_Perguntas!A:C',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values }
    });
    
    console.log('✅ Pergunta logada no Google Sheets');
  } catch (error) {
    console.error('❌ Erro ao logar pergunta:', error);
  }
}

// --- HANDLER PRINCIPAL ---
async function askMongoDBHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { pergunta, email, usar_ia_avancada = 'true' } = req.query;
    if (!pergunta) return res.status(400).json({ error: "Nenhuma pergunta fornecida." });

    console.log('🔍 ask-mongodb: Iniciando...');
    console.log('🔍 ask-mongodb: Pergunta recebida:', { pergunta, email, usar_ia_avancada });

    console.log('🔍 ask-mongodb: Buscando dados do MongoDB...');
    const faqData = await getFaqData();
    console.log('🔍 ask-mongodb: Dados obtidos:', faqData ? faqData.length : 'null', 'documentos');
    
    console.log('🔍 ask-mongodb: Buscando correspondências...');
    const correspondencias = findMatches(pergunta, faqData);
    console.log('🔍 ask-mongodb: Correspondências encontradas:', correspondencias.length);

    // Log da pergunta no Google Sheets
    if (email) {
      await logQuestionOnSheet(pergunta, email);
    }

    if (correspondencias.length === 0) {
      return res.status(200).json({
        status: "sucesso_offline",
        resposta: "Desculpe, não encontrei informações sobre essa pergunta na nossa base de dados. Entre em contato com nosso suporte.",
        sourceRow: 'N/A',
        source: 'MongoDB',
        modo: 'offline',
        nivel: 2
      });
    }

    // Se há apenas uma correspondência ou uma correspondência claramente melhor
    if (correspondencias.length === 1) {
      return res.status(200).json({
        status: "sucesso",
        resposta: correspondencias[0].resposta,
        sourceRow: correspondencias[0].sourceRow,
        tabulacoes: correspondencias[0].tabulacoes,
        source: "MongoDB"
      });
    } else if (correspondencias.length > 1 && correspondencias[0].score > correspondencias[1].score + 2) {
      // Se a primeira correspondência tem score significativamente maior (diferença de 2+ pontos)
      return res.status(200).json({
        status: "sucesso",
        resposta: correspondencias[0].resposta,
        sourceRow: correspondencias[0].sourceRow,
        tabulacoes: correspondencias[0].tabulacoes,
        source: "MongoDB"
      });
    } else {
      // Se há múltiplas correspondências com scores similares, mostrar lista
      console.log('📋 Múltiplas correspondências encontradas:', correspondencias.length);
      console.log('📋 Scores:', correspondencias.map(c => ({ pergunta: c.perguntaOriginal, score: c.score })));
      
      return res.status(200).json({
        status: "clarification_needed",
        resposta: `Encontrei vários tópicos sobre "${pergunta}". Qual deles se encaixa melhor na sua dúvida?`,
        options: correspondencias.map(c => c.perguntaOriginal).slice(0, 12),
        source: "MongoDB",
        sourceRow: 'Pergunta de Esclarecimento'
      });
    }

  } catch (error) {
    console.error("❌ ask-mongodb: Erro no processamento:", error);
    console.error("❌ ask-mongodb: Stack trace:", error.stack);
    
    return res.status(500).json({ 
      error: "Erro interno no servidor.",
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// --- HANDLER PRINCIPAL QUE INTEGRA TUDO ---
async function mainHandler(req, res) {
  try {
    console.log('🔍 mainHandler: Iniciando requisição', { method: req.method, url: req.url, query: req.query });
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Verificar se é uma requisição de conversação
    if (req.query.action === 'conversation') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
      }

      const { action, userEmail, message, baseResponse } = req.body;

      try {
        // Implementar lógica de conversação se necessário
        return res.json({ success: true, message: 'Conversação não implementada ainda' });
      } catch (error) {
        console.error('❌ Erro na conversação:', error);
        return res.status(500).json({ error: 'Erro interno na conversação' });
      }
    }

    // Se não for conversação, continuar com o fluxo normal do ask-mongodb
    console.log('🔍 mainHandler: Chamando askMongoDBHandler...');
    return await askMongoDBHandler(req, res);
    
  } catch (error) {
    console.error('❌ mainHandler: Erro geral:', error);
    console.error('❌ mainHandler: Stack trace:', error.stack);
    return res.status(500).json({ 
      error: 'Erro interno no servidor principal',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = mainHandler;