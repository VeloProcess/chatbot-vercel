// api/ask-mongodb.js - Busca no MongoDB + Logs no Google Sheets
const { MongoClient } = require('mongodb');
const { google } = require('googleapis');

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'console_conteudo';
const COLLECTION_NAME = 'Bot_perguntas';

// Configuração do Google Sheets para logs
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";

// Cache global para Vercel (persiste entre requests)
global.mongoCache = global.mongoCache || {
  data: null,
  timestamp: 0,
  ttl: 300000 // 5 minutos - cache mais longo para MongoDB
};

// Cliente MongoDB
let mongoClient = null;

// Cliente Google Sheets para logs
let auth, sheets;

try {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI não configurado no ask-mongodb');
    throw new Error('MONGODB_URI não configurado');
  } else {
    console.log('✅ MONGODB_URI encontrado, configurando conexão...');
    mongoClient = new MongoClient(MONGODB_URI);
    console.log('✅ MongoDB configurado com sucesso');
  }
} catch (error) {
  console.error('❌ Erro ao configurar MongoDB no ask-mongodb:', error.message);
  console.error('❌ Stack trace:', error.stack);
}

// Configurar Google Sheets para logs
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

// Função para buscar dados do MongoDB (com cache global)
async function getFaqData() {
  const now = Date.now();
  
  console.log('🔍 getFaqData: Iniciando busca no MongoDB...');
  console.log('🔍 getFaqData: mongoClient configurado:', !!mongoClient);
  console.log('🔍 getFaqData: cache atual:', global.mongoCache.data ? global.mongoCache.data.length : 'null', 'documentos');
  
  // Usar cache se ainda é válido
  if (global.mongoCache.data && (now - global.mongoCache.timestamp) < global.mongoCache.ttl) {
    console.log('✅ ask-mongodb: Usando cache global do MongoDB');
    return global.mongoCache.data;
  }

  if (!mongoClient) {
    console.error('❌ getFaqData: MongoDB não configurado');
    throw new Error('MongoDB não configurado');
  }

  console.log('🔍 ask-mongodb: Buscando dados do MongoDB...');
  console.log('🔍 getFaqData: MONGODB_URI:', MONGODB_URI ? 'configurado' : 'não configurado');
  console.log('🔍 getFaqData: DB_NAME:', DB_NAME);
  console.log('🔍 getFaqData: COLLECTION_NAME:', COLLECTION_NAME);

  try {
    // Conectar ao MongoDB
    await mongoClient.connect();
    console.log('✅ Conectado ao MongoDB');

    const db = mongoClient.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Buscar todos os documentos
    const documents = await collection.find({}).toArray();
    console.log('🔍 getFaqData: Documentos encontrados:', documents.length);

    if (documents.length === 0) {
      console.error('❌ getFaqData: Nenhum documento encontrado na coleção FAQ');
      throw new Error("Nenhum documento encontrado na coleção FAQ");
    }

    // Atualizar cache global
    global.mongoCache.data = documents;
    global.mongoCache.timestamp = now;

    console.log('✅ ask-mongodb: Dados do MongoDB obtidos:', documents.length, 'documentos');
    return documents;

  } catch (error) {
    console.error('❌ getFaqData: Erro ao buscar dados do MongoDB:', error);
    throw error;
  } finally {
    // Fechar conexão
    if (mongoClient) {
      await mongoClient.close();
      console.log('✅ Conexão MongoDB fechada');
    }
  }
}

// Função para normalizar texto
function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim();
}

// Função para buscar correspondências no MongoDB
function findMatches(pergunta, faqData) {
  console.log('🔍 findMatches: Iniciando busca em', faqData.length, 'documentos');
  console.log('🔍 findMatches: Pergunta:', pergunta);

  if (!faqData || faqData.length === 0) {
    throw new Error("Nenhum dado disponível para busca.");
  }

  const palavrasDaBusca = normalizarTexto(pergunta).split(' ').filter(p => p.length > 2);
  let todasAsCorrespondencias = [];

  for (let i = 0; i < faqData.length; i++) {
    const documento = faqData[i];
    const textoPalavrasChave = normalizarTexto(documento.palavrasChave || documento.palavras_chave || '');
    const textoPergunta = normalizarTexto(documento.pergunta || '');
    let relevanceScore = 0;

    // Buscar nas palavras-chave (prioridade alta)
    if (textoPalavrasChave) {
      palavrasDaBusca.forEach(palavra => {
        if (textoPalavrasChave.includes(palavra)) {
          relevanceScore += 3; // Peso maior para palavras-chave
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
    const perguntaOriginal = documento.pergunta || '';
    if (perguntaOriginal.toLowerCase().includes(pergunta.toLowerCase())) {
      relevanceScore += 4; // Peso alto para correspondência exata
    }

    // Busca nas palavras-chave com correspondência parcial
    const palavrasChaveOriginal = documento.palavrasChave || documento.palavras_chave || '';
    if (palavrasChaveOriginal.toLowerCase().includes(pergunta.toLowerCase())) {
      relevanceScore += 4; // Peso alto para correspondência exata
    }

    if (relevanceScore > 0) {
      todasAsCorrespondencias.push({
        resposta: documento.resposta || '',
        perguntaOriginal: documento.pergunta || '',
        sourceRow: i + 1, // +1 porque começamos do índice 0
        score: relevanceScore,
        tabulacoes: documento.palavrasChave || documento.palavras_chave || null
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

// ==================== FUNÇÕES DE LOG NO GOOGLE SHEETS ====================

// Função para log de perguntas
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

// Função para log de acesso
async function logAccessOnSheet(email) {
  if (!sheets) {
    console.warn('⚠️ Google Sheets não configurado para log de acesso');
    return;
  }

  try {
    const timestamp = new Date().toLocaleString('pt-BR');
    const values = [[timestamp, email]];
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Log_Acessos!A:B',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values }
    });
    
    console.log('✅ Acesso logado no Google Sheets');
  } catch (error) {
    console.error('❌ Erro ao logar acesso:', error);
  }
}

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

    if (correspondencias.length === 1 || correspondencias[0].score > correspondencias[1]?.score) {
      return res.status(200).json({
        status: "sucesso",
        resposta: correspondencias[0].resposta,
        sourceRow: correspondencias[0].sourceRow,
        tabulacoes: correspondencias[0].tabulacoes,
        source: "MongoDB"
      });
    } else {
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
    console.error("❌ ask-mongodb: Tipo do erro:", error.constructor.name);
    
    // Retornar erro mais específico baseado no tipo
    let errorMessage = "Erro interno no servidor.";
    let errorDetails = error.message;
    
    if (error.message.includes('GOOGLE_CREDENTIALS')) {
      errorMessage = "Erro de configuração: Credenciais do Google não configuradas.";
    } else if (error.message.includes('Timeout')) {
      errorMessage = "Timeout: A planilha demorou muito para responder.";
    } else if (error.message.includes('Planilha FAQ vazia')) {
      errorMessage = "Erro de dados: Planilha FAQ não encontrada ou vazia.";
    } else if (error.message.includes('Google Sheets não configurado')) {
      errorMessage = "Erro de configuração: Google Sheets não configurado.";
    }
    
    return res.status(500).json({ 
      error: errorMessage,
      details: errorDetails,
      type: error.constructor.name,
      timestamp: new Date().toISOString()
    });
  }
};

// ==================== INÍCIO DA LÓGICA DE CONVERSAÇÃO ====================
// Sistema de conversação similar aos agentes da ElevenLabs
// Integrado no ask-mongodb.js para manter limite de 12 serverless functions

const { OpenAI } = require('openai');

// Cliente OpenAI para conversação
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Cache de conversações ativas
const activeConversations = new Map();

// ==================== ESTRUTURA DE CONVERSAÇÃO ====================

class ConversationSession {
  constructor(userEmail, initialContext = {}) {
    this.userEmail = userEmail;
    this.messages = [];
    this.context = initialContext;
    this.topics = new Set();
    this.userPreferences = {};
    this.createdAt = new Date();
    this.lastActivity = new Date();
    this.isWaitingForResponse = false;
    this.pendingQuestion = null;
  }

  addMessage(role, content, metadata = {}) {
    this.messages.push({
      role,
      content,
      timestamp: new Date(),
      metadata
    });
    this.lastActivity = new Date();
    
    // Manter apenas últimas 50 mensagens para evitar tokens excessivos
    if (this.messages.length > 50) {
      this.messages = this.messages.slice(-50);
    }
  }

  getContextSummary() {
    const recentMessages = this.messages.slice(-10);
    return recentMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
  }

  extractTopics(content) {
    // Extrair tópicos mencionados na conversa
    const topicKeywords = [
      'crédito', 'antecipação', 'pix', 'portabilidade', 'darff', 'irpf', 
      'declaração', 'restituição', 'emprestimo', 'trabalhador', 'pessoal',
      'veloprime', 'bolsa', 'investimento', 'cdi', 'lci', 'tesouro'
    ];
    
    const lowerContent = content.toLowerCase();
    topicKeywords.forEach(keyword => {
      if (lowerContent.includes(keyword)) {
        this.topics.add(keyword);
      }
    });
  }
}


// ==================== FUNÇÕES DE CONVERSAÇÃO ====================

async function analyzeConversationalIntent(userMessage, conversationHistory) {
  const prompt = `
Analise a intenção conversacional desta mensagem:

HISTÓRICO DA CONVERSA:
${conversationHistory}

MENSAGEM ATUAL: "${userMessage}"

Identifique:
1. Se é uma pergunta direta
2. Se é uma resposta a uma pergunta anterior do bot
3. Se é uma continuação de tópico
4. Se é uma nova pergunta relacionada ao contexto
5. Se o usuário está pedindo esclarecimento

Responda em JSON:
{
  "intent": "question|answer|continuation|clarification|new_topic",
  "confidence": 0.0-1.0,
  "requires_bot_response": true/false,
  "should_ask_followup": true/false,
  "context_needed": "contexto necessário para entender",
  "suggested_followup": "pergunta sugerida para o bot fazer"
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 300
    });

    let content = response.choices[0].message.content.trim();
    
    if (content.includes('```json')) {
      content = content.replace(/```json\s*/, '').replace(/```\s*$/, '');
    }
    
    return JSON.parse(content);
  } catch (error) {
    console.error('Erro ao analisar intenção:', error);
    return {
      intent: "question",
      confidence: 0.5,
      requires_bot_response: true,
      should_ask_followup: false,
      context_needed: "",
      suggested_followup: ""
    };
  }
}

async function generateFollowupQuestion(userMessage, conversationContext, topics) {
  const prompt = `
Você é o VeloBot, assistente da Velotax. Baseado na conversa, gere uma pergunta de seguimento natural.

CONTEXTO DA CONVERSA:
${conversationContext}

TÓPICOS DISCUTIDOS: ${Array.from(topics).join(', ')}

ÚLTIMA MENSAGEM DO USUÁRIO: "${userMessage}"

Gere uma pergunta de seguimento que:
1. Seja natural e conversacional
2. Demonstre interesse genuíno em ajudar
3. Explore o tópico de forma útil
4. Seja específica ao contexto da Velotax

Responda apenas com a pergunta, sem explicações adicionais.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 150
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Erro ao gerar pergunta de seguimento:', error);
    return "Posso ajudar com mais alguma coisa sobre isso?";
  }
}

async function generateConversationalResponse(userMessage, conversationSession, baseResponse) {
  const contextSummary = conversationSession.getContextSummary();
  const topics = Array.from(conversationSession.topics);
  
  const prompt = `
Você é o VeloBot, assistente da Velotax. Responda de forma conversacional e natural.

CONTEXTO DA CONVERSA:
${contextSummary}

TÓPICOS DISCUTIDOS: ${topics.join(', ')}

RESPOSTA BASE: "${baseResponse}"

INSTRUÇÕES:
1. Torne a resposta mais conversacional e natural
2. Faça referência ao contexto quando apropriado
3. Demonstre que você "lembra" da conversa anterior
4. Seja prestativo e empático
5. Se apropriado, sugira próximos passos ou perguntas relacionadas

Responda de forma natural, como se fosse uma conversa real.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      max_tokens: 400
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Erro ao gerar resposta conversacional:', error);
    return baseResponse;
  }
}

async function handleConversationAction(action, userEmail, message, baseResponse) {
  try {
    // Obter ou criar sessão de conversa
    let session = activeConversations.get(userEmail);
    if (!session) {
      session = new ConversationSession(userEmail);
      activeConversations.set(userEmail, session);
    }

    switch (action) {
      case 'analyze_intent':
        const intent = await analyzeConversationalIntent(message, session.getContextSummary());
        session.addMessage('user', message);
        session.extractTopics(message);
        
        return {
          success: true,
          intent,
          sessionId: userEmail,
          shouldAskFollowup: intent.should_ask_followup
        };

      case 'generate_followup':
        const followupQuestion = await generateFollowupQuestion(
          message, 
          session.getContextSummary(), 
          session.topics
        );
        
        session.addMessage('assistant', followupQuestion);
        session.isWaitingForResponse = true;
        session.pendingQuestion = followupQuestion;
        
        return {
          success: true,
          followupQuestion,
          sessionId: userEmail
        };

      case 'conversational_response':
        const conversationalResponse = await generateConversationalResponse(
          message,
          session,
          baseResponse
        );
        
        session.addMessage('assistant', conversationalResponse);
        session.isWaitingForResponse = false;
        session.pendingQuestion = null;
        
        return {
          success: true,
          conversationalResponse,
          sessionId: userEmail,
          topics: Array.from(session.topics)
        };

      case 'get_session':
        return {
          success: true,
          session: {
            messages: session.messages.slice(-10), // Últimas 10 mensagens
            topics: Array.from(session.topics),
            isWaitingForResponse: session.isWaitingForResponse,
            pendingQuestion: session.pendingQuestion,
            lastActivity: session.lastActivity
          }
        };

      default:
        return { success: false, error: 'Ação não reconhecida' };
    }

  } catch (error) {
    console.error('Erro no sistema de conversação:', error);
    return { 
      success: false,
      error: 'Erro interno do servidor',
      details: error.message 
    };
  }
}

// Handler principal que integra conversação, busca e operações CRUD do MongoDB
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
      const result = await handleConversationAction(action, userEmail, message, baseResponse);
      return res.json(result);
    } catch (error) {
      console.error('Erro no sistema de conversação:', error);
      return res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message 
      });
    }
  }

  // Verificar se é uma requisição para atualizar cache
  if (req.query.action === 'refresh') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
      // Forçar atualização do cache
      global.sheetsCache.data = null;
      global.sheetsCache.timestamp = 0;
      global.sheetsCache.lastModified = null;
      
      // Buscar dados atualizados
      const faqData = await getFaqData();
      
      return res.json({
        success: true,
        message: 'Cache atualizado com sucesso',
        dataCount: faqData.length
      });
    } catch (error) {
      console.error('Erro ao atualizar cache:', error);
      return res.status(500).json({ 
        error: 'Erro ao atualizar cache',
        details: error.message 
      });
    }
  }


  // Se não for conversação nem CRUD, continuar com o fluxo normal do ask-mongodb
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


// ==================== FIM DA LÓGICA DE CONVERSAÇÃO ====================