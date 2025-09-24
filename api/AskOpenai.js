// api/AskOpenai.js - Sistema de IA Avançado com Fallback Offline
const OpenAI = require('openai');
const { MongoClient } = require('mongodb');

// --- CONFIGURAÇÃO ---
const MONGODB_URI = "mongodb+srv://gabrielaraujo:sGoeqQgbxlsIwnjc@velohubcentral.od7vwts.mongodb.net/";
const DB_NAME = "console_conteudo";
const FAQ_COLLECTION = "Bot_perguntas";

// --- CLIENTES ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
let mongoClient = null;
let db = null;

// --- CONFIGURAÇÕES DE TIMEOUT ---
const TIMEOUTS = {
  OPENAI_COMPLETION: 5000,    // 5 segundos
  OPENAI_EMBEDDING: 3000,     // 3 segundos
  MONGODB: 3000,              // 3 segundos
  CACHE_SYNC: 10000           // 10 segundos
};

// --- CONFIGURAÇÕES DE SINCRONIZAÇÃO ---
const SYNC_CONFIG = {
  autoSync: true,
  syncInterval: 30000, // 30 segundos
  watchFile: true,
  backupOnSync: true,
  validateData: true
};


// --- CACHE LOCAL ---
let localFaqCache = {
  data: null,
  timestamp: null,
  lastSync: null,
  syncInterval: 5 * 60 * 1000 // 5 minutos
};

// Cache de embeddings
const embeddingsCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas

// Memória de sessão por usuário
let userSessions = {};

// --- FUNÇÕES DE CONEXÃO MONGODB ---

async function connectToMongoDB() {
  if (mongoClient && db) {
    return { mongoClient, db };
  }

  try {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI não configurado');
    }

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

// --- FUNÇÕES DE SINCRONIZAÇÃO AUTOMÁTICA ---

function validateFAQData(data) {
  if (!Array.isArray(data)) {
    throw new Error('Dados devem ser um array');
  }

  const requiredFields = ['Pergunta', 'Resposta'];
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    
    if (!item || typeof item !== 'object') {
      throw new Error(`Item ${i} deve ser um objeto`);
    }
    
    for (const field of requiredFields) {
      if (!item[field] || typeof item[field] !== 'string') {
        throw new Error(`Item ${i} deve ter o campo '${field}' como string`);
      }
    }
    
    // Campos opcionais com valores padrão
    if (!item['Palavras-chave']) {
      item['Palavras-chave'] = '';
    }
    if (!item['Tabulacoes']) {
      item['Tabulacoes'] = '';
    }
    if (!item['Sinonimos']) {
      item['Sinonimos'] = '';
    }
  }
  
  return data;
}

async function syncJsonToMongoDB(jsonData) {
  try {
    console.log('🔄 Iniciando sincronização JSON → MongoDB...');
    
    // Validar dados
    if (SYNC_CONFIG.validateData) {
      jsonData = validateFAQData(jsonData);
    }
    
    // Conectar ao MongoDB
    const { db } = await connectToMongoDB();
    const collection = db.collection(FAQ_COLLECTION);
    
    // Backup dos dados atuais (se habilitado)
    if (SYNC_CONFIG.backupOnSync) {
      await backupCurrentData(collection);
    }
    
    // Limpar coleção atual
    await collection.deleteMany({});
    console.log('🗑️ Coleção limpa');
    
    // Inserir novos dados
    const result = await collection.insertMany(jsonData);
    console.log(`✅ ${result.insertedCount} documentos inseridos`);
    
    // Atualizar cache local
    localFaqCache.data = [
      ['Pergunta', 'Resposta', 'Palavras-chave', 'Tabulacoes'],
      ...jsonData.map(item => [
        item.Pergunta,
        item.Resposta,
        item['Palavras-chave'],
        item.Tabulacoes
      ])
    ];
    localFaqCache.timestamp = Date.now();
    localFaqCache.lastSync = new Date().toISOString();
    
    console.log('🎉 Sincronização concluída com sucesso!');
    
    return {
      status: 'success',
      insertedCount: result.insertedCount,
      lastSync: localFaqCache.lastSync
    };
    
  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    return {
      status: 'error',
      error: error.message
    };
  }
}

async function backupCurrentData(collection) {
  try {
    const currentData = await collection.find({}).toArray();
    if (currentData.length > 0) {
      const backupCollection = db.collection(`${FAQ_COLLECTION}_backup_${Date.now()}`);
      await backupCollection.insertMany(currentData);
      console.log('💾 Backup criado com', currentData.length, 'documentos');
    }
  } catch (error) {
    console.error('❌ Erro ao criar backup:', error);
  }
}


// --- FUNÇÕES DE CACHE LOCAL ---

async function syncLocalCache() {
  try {
    console.log('🔄 Sincronizando cache local do MongoDB...');
    
    const { db } = await connectToMongoDB();
    const collection = db.collection(FAQ_COLLECTION);
    
    const faqData = await Promise.race([
      collection.find({}).toArray(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('MONGODB_TIMEOUT')), TIMEOUTS.MONGODB)
      )
    ]);
    
    if (faqData && faqData.length > 0) {
      // Converter dados do MongoDB para formato compatível
      localFaqCache.data = [
        ['Pergunta', 'Resposta', 'Palavras-chave', 'Tabulacoes'], // Cabeçalho
        ...faqData.map(item => [
          item.Pergunta || '',
          item.Resposta || '',
          item['Palavras-chave'] || '',
          item.Tabulacoes || ''
        ])
      ];
      
      localFaqCache.timestamp = Date.now();
      localFaqCache.lastSync = new Date().toISOString();
      console.log('✅ Cache local sincronizado do MongoDB:', faqData.length, 'itens');
    }
  } catch (error) {
    console.error('❌ Erro ao sincronizar cache do MongoDB:', error);
  }
}

function needsSync() {
  return !localFaqCache.lastSync || 
         (Date.now() - localFaqCache.timestamp) > localFaqCache.syncInterval;
}

// --- FUNÇÃO DE BUSCA DIRETA NO MONGODB ---

async function buscarFAQNoMongoDB(pergunta) {
  try {
    console.log('🔍 Buscando FAQ diretamente no MongoDB...');
    
    const { db } = await connectToMongoDB();
    const collection = db.collection(FAQ_COLLECTION);
    
    // Busca por texto completo na pergunta e palavras-chave
    const query = {
      $or: [
        { Pergunta: { $regex: pergunta, $options: 'i' } },
        { 'Palavras-chave': { $regex: pergunta, $options: 'i' } },
        { Sinonimos: { $regex: pergunta, $options: 'i' } }
      ]
    };
    
    const resultados = await Promise.race([
      collection.find(query).toArray(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('MONGODB_TIMEOUT')), TIMEOUTS.MONGODB)
      )
    ]);
    
    if (resultados && resultados.length > 0) {
      console.log('✅ Encontrados', resultados.length, 'resultados no MongoDB');
      
      return resultados.map(item => ({
        resposta: item.Resposta || '',
        perguntaOriginal: item.Pergunta || '',
        sourceRow: item._id,
        score: 1, // Score padrão para resultados diretos
        tabulacoes: item.Tabulacoes || null
      }));
    }
    
    return [];
  } catch (error) {
    console.error('❌ Erro ao buscar no MongoDB:', error);
    return [];
  }
}

// --- FUNÇÕES DE BUSCA LOCAL ---

function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim();
}

function buscaLocalPorPalavrasChave(pergunta) {
  if (!localFaqCache.data) return [];
  
  const cabecalho = localFaqCache.data[0];
  const dados = localFaqCache.data.slice(1);
  const idxPergunta = cabecalho.indexOf("Pergunta");
  const idxPalavrasChave = cabecalho.indexOf("Palavras-chave");
  const idxResposta = cabecalho.indexOf("Resposta");

  if (idxPergunta === -1 || idxResposta === -1 || idxPalavrasChave === -1) {
    return [];
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

// --- FUNÇÕES DE EMBEDDINGS ---

async function getEmbeddingWithCache(text) {
  const cacheKey = text.toLowerCase().trim();
  const cached = embeddingsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.embedding;
  }

  try {
    const response = await Promise.race([
      openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('EMBEDDING_TIMEOUT')), TIMEOUTS.OPENAI_EMBEDDING)
      )
    ]);
    
    const embedding = response.data[0].embedding;
    embeddingsCache.set(cacheKey, {
      embedding,
      timestamp: Date.now()
    });
    
    return embedding;
  } catch (error) {
    console.error('❌ Erro ao gerar embedding:', error);
    return null;
  }
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// --- ANÁLISE DE SENTIMENTO E URGÊNCIA ---

async function analisarSentimento(pergunta) {
  try {
    const prompt = `
Analise o sentimento e urgência desta pergunta:

PERGUNTA: "${pergunta}"

Responda em JSON:
{
  "sentimento": "POSITIVO|NEUTRO|NEGATIVO|FRUSTRADO",
  "urgencia": 1-5,
  "palavras_chave_emocionais": ["palavra1", "palavra2"],
  "recomendacao": "RESPOSTA_DIRETA|PRECISA_ESCLARECIMENTO|ESCALAR_HUMANO"
}

URGÊNCIA:
1 = Consulta geral
2 = Dúvida sobre procedimento
3 = Problema que precisa resolver
4 = Erro crítico
5 = Emergência

SENTIMENTO:
- POSITIVO: Pergunta educada, agradecimento
- NEUTRO: Pergunta normal, sem emoção
- NEGATIVO: Reclamação, insatisfação
- FRUSTRADO: Múltiplas tentativas, impaciência
`;

    const response = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 200
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('SENTIMENT_TIMEOUT')), TIMEOUTS.OPENAI_COMPLETION)
      )
    ]);

    const content = response.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Erro na análise de sentimento:', error);
    return {
      sentimento: 'NEUTRO',
      urgencia: 2,
      palavras_chave_emocionais: [],
      recomendacao: 'RESPOSTA_DIRETA'
    };
  }
}

// --- GERAÇÃO DE RESPOSTAS CONTEXTUAIS ---

async function gerarRespostaContextual(pergunta, contexto, historico, sentimento) {
  const prompt = `
### PERSONA
Você é o VeloBot, assistente oficial da Velotax. Você é especialista em:
- Crédito pessoal e trabalhador
- Antecipação de recebíveis
- PIX e portabilidade
- Procedimentos internos da empresa

### ANÁLISE DA SITUAÇÃO
- Sentimento: ${sentimento.sentimento}
- Urgência: ${sentimento.urgencia}/5
- Recomendação: ${sentimento.recomendacao}

### HISTÓRICO DA CONVERSA
${historico.map(h => `${h.role}: ${h.content}`).join('\n')}

### BASE DE CONHECIMENTO
${contexto}

### INSTRUÇÕES ESPECÍFICAS
- Se for sobre crédito, sempre mencione prazos e documentação necessária
- Se for sobre antecipação, explique o processo passo a passo
- Se for sobre PIX, mencione os benefícios e como fazer
- Se não souber, diga "Vou consultar nossa equipe especializada"
- Sempre seja prestativo e profissional
- Use linguagem clara e acessível
- Adapte o tom baseado na urgência e sentimento
- Se for urgente (4-5), seja direto e ofereça soluções rápidas
- Se for frustrado, seja empático e ofereça ajuda extra

### PERGUNTA ATUAL
"${pergunta}"

### RESPOSTA:
`;

  try {
    const response = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 800
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('COMPLETION_TIMEOUT')), TIMEOUTS.OPENAI_COMPLETION)
      )
    ]);

    return response.choices[0].message.content;
  } catch (error) {
    console.error('❌ Erro ao gerar resposta contextual:', error);
    return "Desculpe, não consegui processar sua pergunta no momento. Tente novamente.";
  }
}

// --- SUGESTÕES PROATIVAS ---

async function gerarSugestoesProativas(pergunta, contexto) {
  try {
    const prompt = `
Baseado na pergunta "${pergunta}" e no contexto da Velotax,
sugira 3 informações proativas que podem ser úteis:

CONTEXTO: ${contexto}

Responda em JSON:
{
  "sugestoes": [
    {
      "titulo": "Título da sugestão",
      "conteudo": "Conteúdo útil",
      "tipo": "INFO|AVISO|LINK|PROCEDIMENTO"
    }
  ]
}
`;

    const response = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 400
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('SUGGESTIONS_TIMEOUT')), TIMEOUTS.OPENAI_COMPLETION)
      )
    ]);

    const content = response.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Erro ao gerar sugestões:', error);
    return { sugestoes: [] };
  }
}

// --- SISTEMA DE FALLBACK PRINCIPAL ---

async function processarComIAComFallback(pergunta, email, historico = []) {
  console.log('🤖 Iniciando processamento com IA e fallback MongoDB...');
  const startTime = Date.now();

  // 1. Verificar se precisa sincronizar cache
  if (needsSync()) {
    await syncLocalCache();
  }

  // 2. Tentar IA primeiro com timeout
  try {
    console.log('🚀 Tentando OpenAI...');
    
    // Análise de sentimento em paralelo
    const [sentimento, contextoLocal] = await Promise.all([
      analisarSentimento(pergunta),
      Promise.resolve(localFaqCache.data ? buscaLocalPorPalavrasChave(pergunta) : [])
    ]);

    // Gerar resposta contextual
    const contextoCompleto = contextoLocal.length > 0 
      ? contextoLocal.map(r => `P: ${r.perguntaOriginal}\nR: ${r.resposta}`).join('\n\n')
      : "Nenhuma informação específica encontrada na base de conhecimento.";

    const resposta = await gerarRespostaContextual(pergunta, contextoCompleto, historico, sentimento);

    // Gerar sugestões proativas se relevante
    let sugestoes = { sugestoes: [] };
    if (sentimento.urgencia >= 3) {
      sugestoes = await gerarSugestoesProativas(pergunta, contextoCompleto);
    }

    // Atualizar memória de sessão
    updateUserContext(email, pergunta, resposta, sentimento);

    // Log detalhado da pergunta
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    try {
      await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/feedback?action=log-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          pergunta: pergunta,
          resposta: resposta,
          metadata: {
            source: "IA Avançada + MongoDB",
            sentiment: sentimento.sentimento,
            urgency: sentimento.urgencia,
            responseTime: responseTime,
            contextUsed: contextoLocal.length,
            suggestionsGenerated: sugestoes.sugestoes.length
          }
        })
      });
    } catch (logError) {
      console.error('❌ Erro ao logar pergunta:', logError);
    }

    console.log('✅ Resposta da IA gerada com sucesso');
    
    return {
      status: "sucesso_ia_avancada",
      resposta,
      sentimento: sentimento.sentimento,
      urgencia: sentimento.urgencia,
      recomendacao: sentimento.recomendacao,
      sugestoes_proativas: sugestoes.sugestoes,
      contexto_usado: contextoLocal.length,
      source: "IA Avançada + MongoDB"
    };

  } catch (error) {
    console.log('⚠️ IA falhou, usando fallback MongoDB:', error.message);
    
    // 3. Fallback para busca local (cache)
    let resultadosLocais = buscaLocalPorPalavrasChave(pergunta);
    
    if (resultadosLocais.length > 0) {
      console.log('✅ Usando resposta do cache local');
      
      return {
        status: "sucesso_local",
        resposta: resultadosLocais[0].resposta,
        sourceRow: resultadosLocais[0].sourceRow,
        tabulacoes: resultadosLocais[0].tabulacoes,
        source: "Cache MongoDB",
        fallback: true
      };
    }

    // 4. Fallback para busca direta no MongoDB
    try {
      console.log('🔍 Tentando busca direta no MongoDB...');
      const resultadosMongoDB = await buscarFAQNoMongoDB(pergunta);
      
      if (resultadosMongoDB.length > 0) {
        console.log('✅ Usando resposta direta do MongoDB');
        
        return {
          status: "sucesso_mongodb",
          resposta: resultadosMongoDB[0].resposta,
          sourceRow: resultadosMongoDB[0].sourceRow,
          tabulacoes: resultadosMongoDB[0].tabulacoes,
          source: "MongoDB Direto",
          fallback: true
        };
      }
    } catch (mongoError) {
      console.error('❌ Erro na busca MongoDB:', mongoError);
    }

    // 5. Resposta padrão se tudo falhar
    console.log('❌ Usando resposta padrão');
    return {
      status: "resposta_padrao",
      resposta: "Desculpe, não consegui processar sua pergunta no momento. Nossa equipe está trabalhando para resolver isso. Tente novamente em alguns instantes ou entre em contato conosco.",
      source: "Sistema",
      fallback: true
    };
  }
}

// --- MEMÓRIA DE SESSÃO ---

function updateUserContext(email, pergunta, resposta, sentimento) {
  if (!email) return;
  
  if (!userSessions[email]) {
    userSessions[email] = {
      contexto: "",
      ultimaPergunta: "",
      historico: [],
      preferencias: {},
      topicosInteresse: [],
      sentimentoMedio: 'NEUTRO',
      urgenciaMedia: 2
    };
  }

  // Atualizar histórico
  userSessions[email].historico.push(
    { role: "user", content: pergunta },
    { role: "assistant", content: resposta }
  );

  // Manter apenas últimas 20 interações
  if (userSessions[email].historico.length > 20) {
    userSessions[email].historico = userSessions[email].historico.slice(-20);
  }

  // Atualizar métricas
  userSessions[email].sentimentoMedio = sentimento.sentimento;
  userSessions[email].urgenciaMedia = sentimento.urgencia;
}

function getUserContext(email) {
  return userSessions[email] || {
    contexto: "",
    ultimaPergunta: "",
    historico: [],
    preferencias: {},
    topicosInteresse: [],
    sentimentoMedio: 'NEUTRO',
    urgenciaMedia: 2
  };
}

// --- FUNÇÃO PRINCIPAL DE EXPORTAÇÃO ---

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=240');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { pergunta, email, usar_fallback = 'true', action } = req.query;
  
  // Ações de sincronização
  if (action) {
    try {
      switch (action) {
        case 'sync':
          if (req.method === 'POST' && req.body) {
            const result = await syncJsonToMongoDB(req.body);
            return res.status(200).json(result);
          } else {
            return res.status(400).json({ error: 'Dados JSON necessários para sincronização' });
          }
          
        case 'status':
          return res.status(200).json({
            lastSync: localFaqCache.lastSync,
            cacheSize: localFaqCache.data ? localFaqCache.data.length : 0,
            mongoConnected: mongoClient ? true : false,
            dbName: DB_NAME,
            collection: FAQ_COLLECTION,
            config: SYNC_CONFIG
          });
          
        case 'clear-cache':
          clearCache();
          return res.status(200).json({ status: 'success', message: 'Cache limpo' });
          
        case 'force-sync':
          if (needsSync()) {
            await syncLocalCache();
            return res.status(200).json({ status: 'success', message: 'Cache sincronizado' });
          } else {
            return res.status(200).json({ status: 'no_changes', message: 'Cache já atualizado' });
          }
          
        default:
          return res.status(400).json({
            error: 'Ação não reconhecida',
            availableActions: ['sync', 'status', 'clear-cache', 'force-sync']
          });
      }
    } catch (error) {
      console.error('❌ Erro na ação:', error);
      return res.status(500).json({
        error: 'Erro interno do servidor',
        details: error.message
      });
    }
  }
  
  // Processamento normal de perguntas
  if (!pergunta) {
    return res.status(400).json({ error: "Nenhuma pergunta fornecida." });
  }

  console.log('🤖 Nova pergunta recebida:', { pergunta, email, usar_fallback });

  try {
    const userContext = getUserContext(email);
    const resultado = await processarComIAComFallback(pergunta, email, userContext.historico);
    
    return res.status(200).json(resultado);
    
  } catch (error) {
    console.error("❌ ERRO NO BACKEND:", error);
    return res.status(200).json({ 
      error: "Erro interno no servidor.", 
      details: error.message 
    });
  }
};

// --- FUNÇÕES AUXILIARES PARA DEBUG ---

function getCacheStatus() {
  return {
    cacheSize: localFaqCache.data ? localFaqCache.data.length : 0,
    lastSync: localFaqCache.lastSync,
    needsSync: needsSync(),
    embeddingsCache: embeddingsCache.size,
    userSessions: Object.keys(userSessions).length,
    mongoConnected: mongoClient ? true : false,
    dbName: DB_NAME,
    collection: FAQ_COLLECTION
  };
}

function clearCache() {
  localFaqCache = { data: null, timestamp: null, lastSync: null };
  embeddingsCache.clear();
  console.log('✅ Cache limpo');
}

async function closeMongoConnection() {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    db = null;
    console.log('✅ Conexão MongoDB fechada');
  }
}

// Exportar funções auxiliares
module.exports.getCacheStatus = getCacheStatus;
module.exports.clearCache = clearCache;
module.exports.syncLocalCache = syncLocalCache;
module.exports.closeMongoConnection = closeMongoConnection;
module.exports.connectToMongoDB = connectToMongoDB;
module.exports.syncJsonToMongoDB = syncJsonToMongoDB;
module.exports.validateFAQData = validateFAQData;
