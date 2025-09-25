// api/ask-mongodb.js - Busca no MongoDB
const { MongoClient } = require('mongodb');

// Configuração do MongoDB
const MONGODB_URI = "mongodb+srv://gabrielaraujo:sGoeqQgbxlsIwnjc@velohubcentral.od7vwts.mongodb.net/";
const DATABASE_NAME = "console_conteudo";
const COLLECTION_NAME = "Bot_perguntas";

// Cache global para Vercel (persiste entre requests)
global.mongodbCache = global.mongodbCache || {
  data: null,
  timestamp: 0,
  ttl: 300000 // 5 minutos
};

// Cliente MongoDB
let client, db, collection;

// Função para conectar ao MongoDB
async function connectToMongoDB() {
  if (client && client.topology && client.topology.isConnected()) {
    return { client, db, collection };
  }

  try {
    client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5 segundos
      connectTimeoutMS: 10000, // 10 segundos
    });

    await client.connect();
    db = client.db(DATABASE_NAME);
    collection = db.collection(COLLECTION_NAME);
    
    console.log('✅ MongoDB conectado com sucesso');
    return { client, db, collection };
  } catch (error) {
    console.error('❌ Erro ao conectar MongoDB:', error);
    throw error;
  }
}

// Função para buscar dados do MongoDB (com cache global)
async function getFaqData() {
  // Verificar cache global primeiro
  const now = Date.now();
  if (global.mongodbCache.data && (now - global.mongodbCache.timestamp) < global.mongodbCache.ttl) {
    console.log('✅ ask-mongodb: Usando cache global');
    return global.mongodbCache.data;
  }

  try {
    const { collection } = await connectToMongoDB();
    
    console.log('🔍 ask-mongodb: Buscando dados do MongoDB...');

    // Timeout de 8 segundos para Vercel (limite de 10s)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout do MongoDB')), 8000);
    });

    const mongoPromise = collection.find({}).toArray();

    const data = await Promise.race([mongoPromise, timeoutPromise]);

    if (!data || data.length === 0) {
      throw new Error("Collection Bot_perguntas vazia ou não encontrada");
    }

    // Atualizar cache global
    global.mongodbCache.data = data;
    global.mongodbCache.timestamp = now;

    console.log('✅ ask-mongodb: Dados do MongoDB obtidos:', data.length, 'documentos');
    return data;
  } catch (error) {
    console.error('❌ ask-mongodb: Erro ao buscar dados do MongoDB:', error);
    throw error;
  }
}

// Função para normalizar texto
function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim();
}

// Função para buscar correspondências
function findMatches(pergunta, faqData) {
  const palavrasDaBusca = normalizarTexto(pergunta).split(' ').filter(p => p.length > 2);
  let todasAsCorrespondencias = [];

  for (let i = 0; i < faqData.length; i++) {
    const documento = faqData[i];
    const textoPalavrasChave = normalizarTexto(documento.Palavras_chave || '');
    const textoPergunta = normalizarTexto(documento.Pergunta || '');
    const textoSinonimos = normalizarTexto(documento.Sinonimos || '');
    let relevanceScore = 0;

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

    if (relevanceScore > 0) {
      todasAsCorrespondencias.push({
        resposta: documento.Resposta,
        perguntaOriginal: documento.Pergunta,
        sourceRow: documento._id,
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
    const { pergunta, email, usar_ia_avancada = 'true' } = req.query;
    if (!pergunta) return res.status(400).json({ error: "Nenhuma pergunta fornecida." });

    console.log('🔍 ask-mongodb: Iniciando...');
    console.log('🔍 ask-mongodb: Pergunta recebida:', { pergunta, email, usar_ia_avancada });

    const faqData = await getFaqData();
    const correspondencias = findMatches(pergunta, faqData);

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
    return res.status(500).json({ 
      error: "Erro interno no servidor.", 
      details: error.message 
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

// Handler principal que integra conversação e busca MongoDB
async function mainHandler(req, res) {
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

  // Se não for conversação, continuar com o fluxo normal do ask-mongodb
  return askMongoDBHandler(req, res);
}

module.exports = mainHandler;

// ==================== FIM DA LÓGICA DE CONVERSAÇÃO ====================