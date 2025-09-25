// api/ask-mongodb.js - Busca na planilha Google Sheets
const { google } = require('googleapis');

// Configuração do Google Sheets
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const FAQ_SHEET_NAME = "FAQ!A:C"; // Coluna A: Pergunta, B: Resposta, C: Palavras-chave

// Cache global para Vercel (persiste entre requests)
global.sheetsCache = global.sheetsCache || {
  data: null,
  timestamp: 0,
  lastModified: null,
  ttl: 60000 // 1 minuto - cache mais curto para atualizações mais rápidas
};

// Cliente Google Sheets
let auth, sheets;

try {
  if (!process.env.GOOGLE_CREDENTIALS) {
    console.warn('⚠️ GOOGLE_CREDENTIALS não configurado no ask-mongodb');
  } else {
    auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    sheets = google.sheets({ version: 'v4', auth });
  }
} catch (error) {
  console.error('❌ Erro ao configurar Google Sheets no ask-mongodb:', error.message);
}

// Função para verificar se a planilha foi modificada
async function checkSheetModified() {
  if (!sheets) {
    return false;
  }

  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: 'properties.modifiedTime'
    });

    const lastModified = response.data.properties.modifiedTime;
    const cacheLastModified = global.sheetsCache.lastModified;

    if (!cacheLastModified || lastModified !== cacheLastModified) {
      console.log('🔄 ask-mongodb: Planilha foi modificada, invalidando cache');
      global.sheetsCache.lastModified = lastModified;
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ Erro ao verificar modificação da planilha:', error);
    return false;
  }
}

// Função para buscar dados da planilha (com cache global e verificação de modificação)
async function getFaqData() {
  const now = Date.now();
  
  // Verificar se a planilha foi modificada (sempre verificar)
  const wasModified = await checkSheetModified();
  
  // Se não foi modificada e o cache ainda é válido, usar cache
  if (!wasModified && global.sheetsCache.data && (now - global.sheetsCache.timestamp) < global.sheetsCache.ttl) {
    console.log('✅ ask-mongodb: Usando cache global da planilha (não modificada)');
    return global.sheetsCache.data;
  }

  if (!sheets) {
    throw new Error('Google Sheets não configurado');
  }

  console.log('🔍 ask-mongodb: Buscando dados da planilha...');

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
  global.sheetsCache.data = response.data.values;
  global.sheetsCache.timestamp = now;

  console.log('✅ ask-mongodb: Dados da planilha obtidos:', response.data.values.length, 'linhas');
  return response.data.values;
}

// Função para normalizar texto
function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim();
}

// Função para buscar correspondências na planilha
function findMatches(pergunta, faqData) {
  const cabecalho = faqData[0];
  const dados = faqData.slice(1);
  const idxPergunta = cabecalho.indexOf("Pergunta");
  const idxPalavrasChave = cabecalho.indexOf("Palavras-chave");
  const idxResposta = cabecalho.indexOf("Resposta");

  if (idxPergunta === -1 || idxResposta === -1 || idxPalavrasChave === -1) {
    throw new Error("Colunas essenciais (Pergunta, Resposta, Palavras-chave) não encontradas na planilha.");
  }

  const palavrasDaBusca = normalizarTexto(pergunta).split(' ').filter(p => p.length > 2);
  let todasAsCorrespondencias = [];

  for (let i = 0; i < dados.length; i++) {
    const linhaAtual = dados[i];
    const textoPalavrasChave = normalizarTexto(linhaAtual[idxPalavrasChave] || '');
    const textoPergunta = normalizarTexto(linhaAtual[idxPergunta] || '');
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
    const perguntaOriginal = linhaAtual[idxPergunta] || '';
    if (perguntaOriginal.toLowerCase().includes(pergunta.toLowerCase())) {
      relevanceScore += 4; // Peso alto para correspondência exata
    }

    // Busca nas palavras-chave com correspondência parcial
    const palavrasChaveOriginal = linhaAtual[idxPalavrasChave] || '';
    if (palavrasChaveOriginal.toLowerCase().includes(pergunta.toLowerCase())) {
      relevanceScore += 4; // Peso alto para correspondência exata
    }

    if (relevanceScore > 0) {
      todasAsCorrespondencias.push({
        resposta: linhaAtual[idxResposta],
        perguntaOriginal: linhaAtual[idxPergunta],
        sourceRow: i + 2, // +2 porque começamos do índice 1 e pulamos o cabeçalho
        score: relevanceScore,
        tabulacoes: linhaAtual[idxPalavrasChave] || null
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

    const faqData = await getFaqData();
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

    if (correspondencias.length === 1 || correspondencias[0].score > correspondencias[1]?.score) {
      return res.status(200).json({
        status: "sucesso",
        resposta: correspondencias[0].resposta,
        sourceRow: correspondencias[0].sourceRow,
        tabulacoes: correspondencias[0].tabulacoes,
        source: "Planilha Google Sheets"
      });
    } else {
      return res.status(200).json({
        status: "clarification_needed",
        resposta: `Encontrei vários tópicos sobre "${pergunta}". Qual deles se encaixa melhor na sua dúvida?`,
        options: correspondencias.map(c => c.perguntaOriginal).slice(0, 12),
        source: "Planilha Google Sheets",
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

// Handler principal que integra conversação, busca e operações CRUD do MongoDB
async function mainHandler(req, res) {
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
  return askMongoDBHandler(req, res);
}

module.exports = mainHandler;


// ==================== FIM DA LÓGICA DE CONVERSAÇÃO ====================