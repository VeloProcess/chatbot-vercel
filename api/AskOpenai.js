// api/AskOpenai.js - Sistema de Busca Local (OpenAI DESATIVADO)
const { google } = require('googleapis');

// --- CONFIGURAÇÃO GOOGLE SHEETS ---
const SPREADSHEET_ID = "1d0h9zr4haDx6etLtdMqPVsBXdVvH7n9OsRdqAhOJOp0";
const FAQ_SHEET_NAME = "FAQ!A:D"; // Pergunta, Resposta, Palavras-chave, Sinônimos

// --- CLIENTES ---
// OpenAI DESATIVADO - usando apenas busca local
let auth, sheets;

// --- CONFIGURAÇÕES DE TIMEOUT ---
const TIMEOUTS = {
  SHEETS: 3000,              // 3 segundos
  CACHE_SYNC: 10000           // 10 segundos
};

// --- CONFIGURAR GOOGLE SHEETS ---
try {
  if (!process.env.GOOGLE_CREDENTIALS) {
    console.warn('⚠️ GOOGLE_CREDENTIALS não configurado');
  } else {
    auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Google Sheets configurado');
  }
} catch (error) {
  console.error('❌ Erro ao configurar Google Sheets:', error.message);
}

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

// Cache de embeddings DESATIVADO (OpenAI não está mais sendo usado)

// Memória de sessão por usuário
let userSessions = {};

// --- FUNÇÕES DE CONEXÃO GOOGLE SHEETS ---
// Google Sheets já configurado acima, não precisa de função de conexão separada

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
    if (!item['Sinonimos']) {
      item['Sinonimos'] = '';
    }
  }
  
  return data;
}

// Função removida - dados agora vêm diretamente do Google Sheets
// Não há necessidade de sincronização JSON → Sheets, pois a planilha é a fonte da verdade
async function syncJsonToGoogleSheets(jsonData) {
  try {
    console.log('⚠️ Sincronização JSON → Google Sheets não implementada');
    console.log('⚠️ A planilha Google Sheets é a fonte da verdade. Edite diretamente na planilha.');
    
    // Apenas atualizar cache local
    localFaqCache.data = [
      ['Pergunta', 'Resposta', 'Palavras-chave', 'Sinônimos'],
      ...jsonData.map(item => [
        item.Pergunta,
        item.Resposta,
        item['Palavras-chave'],
        item.Sinonimos || ''
      ])
    ];
    localFaqCache.timestamp = Date.now();
    localFaqCache.lastSync = new Date().toISOString();
    
    return {
      status: 'warning',
      message: 'Dados atualizados apenas no cache local. Edite a planilha Google Sheets diretamente.',
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


// --- FUNÇÕES DE CACHE LOCAL ---

async function syncLocalCache() {
  try {
    console.log('🔄 Sincronizando cache local do Google Sheets...');
    
    if (!sheets) {
      throw new Error('Google Sheets não configurado');
    }
    
    const response = await Promise.race([
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: FAQ_SHEET_NAME,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('SHEETS_TIMEOUT')), TIMEOUTS.SHEETS)
      )
    ]);
    
    const rows = response.data.values || [];
    
    if (rows && rows.length > 0) {
      // Converter dados do Google Sheets para formato compatível
      const cabecalho = rows[0];
      const dados = rows.slice(1);
      
      const idxPergunta = cabecalho.findIndex(col => 
        col && col.toLowerCase().includes('pergunta')
      );
      const idxResposta = cabecalho.findIndex(col => 
        col && col.toLowerCase().includes('resposta')
      );
      const idxPalavrasChave = cabecalho.findIndex(col => 
        col && (col.toLowerCase().includes('palavra') || col.toLowerCase().includes('chave'))
      );
      const idxSinonimos = cabecalho.findIndex(col => 
        col && col.toLowerCase().includes('sinonimo')
      );
      
      localFaqCache.data = [
        ['Pergunta', 'Resposta', 'Palavras-chave', 'Sinônimos'], // Cabeçalho
        ...dados.map(row => [
          row[idxPergunta] || '',
          row[idxResposta] || '',
          row[idxPalavrasChave] || '',
          idxSinonimos !== -1 ? (row[idxSinonimos] || '') : ''
        ]).filter(row => row[0] && row[0].trim() !== '') // Filtrar linhas vazias
      ];
      
      localFaqCache.timestamp = Date.now();
      localFaqCache.lastSync = new Date().toISOString();
      console.log('✅ Cache local sincronizado do Google Sheets:', dados.length, 'itens');
    }
  } catch (error) {
    console.error('❌ Erro ao sincronizar cache do Google Sheets:', error);
  }
}

function needsSync() {
  return !localFaqCache.lastSync || 
         (Date.now() - localFaqCache.timestamp) > localFaqCache.syncInterval;
}

// --- FUNÇÃO DE BUSCA DIRETA NO GOOGLE SHEETS ---

async function buscarFAQNoGoogleSheets(pergunta) {
  try {
    console.log('🔍 Buscando FAQ diretamente no Google Sheets...');
    
    if (!sheets) {
      throw new Error('Google Sheets não configurado');
    }
    
    const response = await Promise.race([
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: FAQ_SHEET_NAME,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('SHEETS_TIMEOUT')), TIMEOUTS.SHEETS)
      )
    ]);
    
    const rows = response.data.values || [];
    if (rows.length === 0) return [];
    
    const cabecalho = rows[0];
    const dados = rows.slice(1);
    
    const idxPergunta = cabecalho.findIndex(col => 
      col && col.toLowerCase().includes('pergunta')
    );
    const idxResposta = cabecalho.findIndex(col => 
      col && col.toLowerCase().includes('resposta')
    );
    const idxPalavrasChave = cabecalho.findIndex(col => 
      col && (col.toLowerCase().includes('palavra') || col.toLowerCase().includes('chave'))
    );
    const idxSinonimos = cabecalho.findIndex(col => 
      col && col.toLowerCase().includes('sinonimo')
    );
    const perguntaLower = pergunta.toLowerCase();
    const resultados = dados
      .map((row, index) => ({
        pergunta: row[idxPergunta] || '',
        resposta: row[idxResposta] || '',
        palavrasChave: row[idxPalavrasChave] || '',
        sinonimos: row[idxSinonimos] || '',
        rowIndex: index + 2
      }))
      .filter(item => {
        const perguntaMatch = item.pergunta.toLowerCase().includes(perguntaLower);
        const palavrasChaveMatch = item.palavrasChave.toLowerCase().includes(perguntaLower);
        const sinonimosMatch = item.sinonimos.toLowerCase().includes(perguntaLower);
        return perguntaMatch || palavrasChaveMatch || sinonimosMatch;
      });
    
    if (resultados && resultados.length > 0) {
      console.log('✅ Encontrados', resultados.length, 'resultados no Google Sheets');
      
      return resultados.map(item => ({
        resposta: item.resposta || '',
        perguntaOriginal: item.pergunta || '',
        sourceRow: item.rowIndex,
        score: 1, // Score padrão para resultados diretos
        sinonimos: item.sinonimos || null
      }));
    }
    
    return [];
  } catch (error) {
    console.error('❌ Erro ao buscar no Google Sheets:', error);
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
        sinonimos: linhaAtual[3] || null
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
// DESATIVADO - OpenAI não está mais sendo usado

// --- ANÁLISE DE SENTIMENTO E URGÊNCIA ---
// DESATIVADO - OpenAI não está mais sendo usado

// --- GERAÇÃO DE RESPOSTAS CONTEXTUAIS ---
// DESATIVADO - OpenAI não está mais sendo usado

// --- SUGESTÕES PROATIVAS ---
// DESATIVADO - OpenAI não está mais sendo usado

// --- SISTEMA DE FALLBACK PRINCIPAL ---

async function processarComIAComFallback(pergunta, email, historico = []) {
  console.log('🔍 Iniciando busca local (Google Sheets)...');
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
            source: "IA Avançada + Google Sheets",
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
      source: "Google Sheets"
    };

  } catch (error) {
    console.log('⚠️ Erro na busca:', error.message);
    
    // 3. Fallback para busca local (cache)
    let resultadosLocais = buscaLocalPorPalavrasChave(pergunta);
    
    if (resultadosLocais.length > 0) {
      console.log('✅ Usando resposta do cache local');
      
      return {
        status: "sucesso_local",
        resposta: resultadosLocais[0].resposta,
        sourceRow: resultadosLocais[0].sourceRow,
        sinonimos: resultadosLocais[0].sinonimos,
        source: "Cache Google Sheets",
        fallback: true
      };
    }

    // 4. Fallback para busca direta no Google Sheets
    try {
      console.log('🔍 Tentando busca direta no Google Sheets...');
      const resultadosSheets = await buscarFAQNoGoogleSheets(pergunta);
      
      if (resultadosSheets.length > 0) {
        console.log('✅ Usando resposta direta do Google Sheets');
        
        return {
          status: "sucesso_sheets",
          resposta: resultadosSheets[0].resposta,
          sourceRow: resultadosSheets[0].sourceRow,
          sinonimos: resultadosSheets[0].sinonimos,
          source: "Google Sheets Direto",
          fallback: true
        };
      }
    } catch (sheetsError) {
      console.error('❌ Erro na busca Google Sheets:', sheetsError);
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

function updateUserContext(email, pergunta, resposta) {
  if (!email) return;
  
  if (!userSessions[email]) {
    userSessions[email] = {
      contexto: "",
      ultimaPergunta: "",
      historico: [],
      preferencias: {},
      topicosInteresse: []
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
}

function getUserContext(email) {
  return userSessions[email] || {
    contexto: "",
    ultimaPergunta: "",
    historico: [],
    preferencias: {},
    topicosInteresse: []
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
            const result = await syncJsonToGoogleSheets(req.body);
            return res.status(200).json(result);
          } else {
            return res.status(400).json({ error: 'Dados JSON necessários para sincronização' });
          }
          
        case 'status':
          return res.status(200).json({
            lastSync: localFaqCache.lastSync,
            cacheSize: localFaqCache.data ? localFaqCache.data.length : 0,
            sheetsConnected: sheets ? true : false,
            spreadsheetId: SPREADSHEET_ID,
            sheetName: FAQ_SHEET_NAME,
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
    userSessions: Object.keys(userSessions).length,
    sheetsConnected: sheets ? true : false,
    spreadsheetId: SPREADSHEET_ID,
    sheetName: FAQ_SHEET_NAME
  };
}

function clearCache() {
  localFaqCache = { data: null, timestamp: null, lastSync: null };
  console.log('✅ Cache limpo');
}

// Não há necessidade de fechar conexão com Google Sheets
// A conexão é gerenciada automaticamente pelo cliente

// ==================== INÍCIO DA LÓGICA DE CONVERSAÇÃO CONTÍNUA ====================
// Sistema de conversação similar aos agentes da ElevenLabs
// Mantém contexto da conversa e permite perguntas de volta do bot

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

// ==================== ANÁLISE DE INTENÇÃO CONVERSACIONAL ====================

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

// ==================== GERAÇÃO DE PERGUNTAS DE SEGUIMENTO ====================

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

// ==================== RESPOSTA CONVERSACIONAL CONTEXTUAL ====================

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

// ==================== HANDLER DE CONVERSAÇÃO ====================

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

// ==================== FIM DA LÓGICA DE CONVERSAÇÃO CONTÍNUA ====================

// Exportar funções auxiliares
module.exports.getCacheStatus = getCacheStatus;
module.exports.clearCache = clearCache;
module.exports.syncLocalCache = syncLocalCache;
// Função closeMongoConnection removida - MongoDB não é mais usado
module.exports.syncJsonToGoogleSheets = syncJsonToGoogleSheets;
module.exports.validateFAQData = validateFAQData;

// Exportar funções de conversação
module.exports.handleConversationAction = handleConversationAction;
module.exports.analyzeConversationalIntent = analyzeConversationalIntent;
module.exports.generateFollowupQuestion = generateFollowupQuestion;
module.exports.generateConversationalResponse = generateConversationalResponse;
