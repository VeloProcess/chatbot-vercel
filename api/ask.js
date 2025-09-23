// api/ask.js (Versão OpenAI Completa – Memória de Sessão e Busca em Sites + IA Avançada + Sistema Offline)

const { google } = require('googleapis');
const axios = require('axios');
const OpenAI = require('openai');
const { processarComIA } = require('./ai-advanced');

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const FAQ_SHEET_NAME = "FAQ!A:D";
const CACHE_DURATION_SECONDS = 300; // 5 minutos para cache local
const SYNC_INTERVAL_MS = 300000; // 5 minutos para sincronização

// --- CONFIGURAÇÕES DE TIMEOUT ---
const OPENAI_TIMEOUT_MS = 5000; // 5 segundos
const SHEETS_TIMEOUT_MS = 3000; // 3 segundos
const OFFLINE_RESPONSE_TIMEOUT_MS = 2000; // 2 segundos para resposta offline

// --- CLIENTE GOOGLE SHEETS ---
let auth, sheets, openai;

try {
  // Verificar se as credenciais existem
  if (!process.env.GOOGLE_CREDENTIALS) {
    console.warn('⚠️ GOOGLE_CREDENTIALS não configurado');
  } else {
    auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    sheets = google.sheets({ version: 'v4', auth });
  }
} catch (error) {
  console.error('❌ Erro ao configurar Google Sheets:', error.message);
}

// --- CLIENTE OPENAI ---
try {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️ OPENAI_API_KEY não configurado');
  } else {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch (error) {
  console.error('❌ Erro ao configurar OpenAI:', error.message);
}

const modeloOpenAI = "gpt-4o-mini"; // Ajustável

// --- MEMÓRIA DE SESSÃO POR USUÁRIO ---
let userSessions = {}; // { email: { contexto: "", ultimaPergunta: "" } }

// --- SISTEMA DE CACHE OFFLINE ---
let offlineCache = {
  faqData: null,
  lastSync: 0,
  embeddings: new Map(),
  isOnline: true,
  connectionFailures: 0
};

// --- MONITORAMENTO DE CONECTIVIDADE ---
let connectivityMonitor = {
  openaiLatency: [],
  sheetsLatency: [],
  lastCheck: 0,
  checkInterval: 30000 // 30 segundos
};

// --- FUNÇÕES DE DETECÇÃO DE LATÊNCIA E CACHE OFFLINE ---

async function checkConnectivity() {
  try {
    // Verificação simples - apenas verificar se as configurações existem
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️ OpenAI API key não configurada');
      offlineCache.isOnline = false;
      return false;
    }
    
    // Verificar se o cliente OpenAI está configurado
    if (!openai) {
      console.log('⚠️ Cliente OpenAI não configurado');
      offlineCache.isOnline = false;
      return false;
    }
    
    // Se chegou aqui, assumir que está online
    offlineCache.isOnline = true;
    offlineCache.connectionFailures = 0;
    console.log('✅ Conectividade verificada: ONLINE');
    return true;
    
  } catch (error) {
    console.log('❌ Erro na verificação de conectividade:', error.message);
    offlineCache.connectionFailures++;
    offlineCache.isOnline = false;
    return false;
  }
}

async function getFaqDataWithTimeout() {
  try {
    if (!sheets) {
      throw new Error('Google Sheets não configurado');
    }
    
    console.log('🔍 ask.js: Buscando dados da planilha...');
    
    // Timeout de 2 segundos para evitar FUNCTION_INVOCATION_TIMEOUT
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout da planilha')), 2000);
    });
    
    const sheetsPromise = sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: FAQ_SHEET_NAME,
    });
    
    const response = await Promise.race([sheetsPromise, timeoutPromise]);
    
    if (!response.data.values || response.data.values.length === 0) {
      throw new Error("Planilha FAQ vazia ou não encontrada");
    }
    
    console.log('✅ ask.js: Dados da planilha obtidos:', response.data.values.length, 'linhas');
    return response.data.values;
    
  } catch (error) {
    console.error('❌ ask.js: Erro ao buscar dados da planilha:', error.message);
    throw error;
  }
}

async function syncOfflineCache() {
  const now = Date.now();
  
  // Verificar se precisa sincronizar
  if (offlineCache.faqData && (now - offlineCache.lastSync) < SYNC_INTERVAL_MS) {
    return offlineCache.faqData;
  }
  
  try {
    console.log('🔄 Sincronizando cache offline...');
    const faqData = await getFaqDataWithTimeout();
    
    offlineCache.faqData = faqData;
    offlineCache.lastSync = now;
    
    console.log('✅ Cache offline sincronizado com sucesso');
    return faqData;
    
  } catch (error) {
    console.error('❌ Erro ao sincronizar cache offline:', error.message);
    
    // Se tem cache antigo, usar ele
    if (offlineCache.faqData) {
      console.log('⚠️ Usando cache offline desatualizado');
      return offlineCache.faqData;
    }
    
    throw error;
  }
}

async function getFaqDataOffline() {
  // Tentar buscar dados online primeiro
  try {
    console.log('🔍 Tentando buscar dados do Google Sheets...');
    const faqData = await getFaqDataWithTimeout();
    
    // Atualizar cache
    offlineCache.faqData = faqData;
    offlineCache.lastSync = Date.now();
    
    console.log('✅ Dados do Google Sheets obtidos com sucesso');
    return faqData;
    
  } catch (error) {
    console.log('⚠️ Falha na busca online, tentando cache offline...', error.message);
    
    // Usar cache offline se disponível
    if (offlineCache.faqData) {
      console.log('📦 Usando cache offline');
      return offlineCache.faqData;
    }
    
    // Se não tem cache, retornar erro
    console.log('❌ Nenhum cache disponível e sem conectividade');
    throw new Error('Sem dados disponíveis e sem conectividade');
  }
}

// --- FUNÇÕES DE APOIO ---
async function getFaqData() {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: FAQ_SHEET_NAME,
  });
  if (!response.data.values || response.data.values.length === 0) {
    throw new Error("Não foi possível ler dados da planilha FAQ ou ela está vazia.");
  }
  return response.data.values;
}

function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim();
}

async function logIaUsage(email, pergunta) {
  try {
    if (!sheets) {
      console.warn('⚠️ Google Sheets não configurado - não é possível registrar uso da IA');
      return;
    }
    
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const newRow = [timestamp, email, pergunta];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Log_IA_Usage',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [newRow] },
    });
  } catch (error) {
    console.error("ERRO AO REGISTRAR USO DA IA:", error);
  }
}

function findMatches(pergunta, faqData) {
  const cabecalho = faqData[0];
  const dados = faqData.slice(1);
  const idxPergunta = cabecalho.indexOf("Pergunta");
  const idxPalavrasChave = cabecalho.indexOf("Palavras-chave");
  const idxResposta = cabecalho.indexOf("Resposta");

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


// --- FUNÇÃO OPENAI COM TIMEOUT E DETECÇÃO DE LATÊNCIA ---
async function askOpenAI(pergunta, contextoPlanilha, email, historicoSessao = []) {
  const startTime = Date.now();
  
  try {
    if (!openai) {
      throw new Error('OpenAI não configurado');
    }
    
    const prompt = `
### PERSONA
Você é o VeloBot, assistente oficial da Velotax. Responda com base no histórico de conversa, no contexto da planilha e nos sites autorizados.

### HISTÓRICO DE CONVERSA
${historicoSessao.map(h => `${h.role}: ${h.content}`).join("\n")}

### CONTEXTO DA PLANILHA
${contextoPlanilha}

### REGRAS
- Se a nova pergunta for ambígua, use o histórico para entender o que o atendente quis dizer.
- Seja direto e claro, mas natural.
- Se o atendente disser "não entendi", reformule sua última resposta de forma mais simples.
- Se não encontrar no contexto ou nos sites, diga: "Não encontrei essa informação nem na base de conhecimento nem nos sites oficiais."
- Sempre responda em português do Brasil.

### PERGUNTA ATUAL
"${pergunta}"
`;

    const completion = await Promise.race([
      openai.chat.completions.create({
        model: modeloOpenAI,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 1024,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI timeout')), OPENAI_TIMEOUT_MS)
      )
    ]);

    const latency = Date.now() - startTime;
    connectivityMonitor.openaiLatency.push(latency);
    
    // Manter apenas últimas 10 medições
    if (connectivityMonitor.openaiLatency.length > 10) {
      connectivityMonitor.openaiLatency = connectivityMonitor.openaiLatency.slice(-10);
    }

    return completion.choices[0].message.content;
  } catch (error) {
    const latency = Date.now() - startTime;
    console.error(`❌ ERRO AO CHAMAR OPENAI (${latency}ms):`, error.message);
    
    // Se foi timeout, marcar como offline
    if (error.message === 'OpenAI timeout') {
      offlineCache.isOnline = false;
      offlineCache.connectionFailures++;
    }
    
    throw error;
  }
}

// --- FUNÇÃO PRINCIPAL DA API (HANDLER) ---
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=240');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Timeout de 25 segundos para evitar 504
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout da API ask')), 25000);
  });

  try {
    const result = await Promise.race([
      processAskRequest(req, res),
      timeoutPromise
    ]);
    return result;
  } catch (error) {
    console.error("ERRO NO BACKEND:", error);
    return res.status(200).json({ 
      error: error.message === 'Timeout da API ask' ? 'Timeout - tente novamente' : "Erro interno no servidor.", 
      details: error.message 
    });
  }
};

async function processAskRequest(req, res) {
  try {
    console.log('🔍 Iniciando processAskRequest...');
    
    const { pergunta, email, reformular, usar_ia_avancada = 'true' } = req.query;
    if (!pergunta) return res.status(400).json({ error: "Nenhuma pergunta fornecida." });

    console.log('🤖 Nova pergunta recebida:', { pergunta, email, usar_ia_avancada });

  // --- SISTEMA DE FALLBACK AUTOMÁTICO DE 3 NÍVEIS ---
  
  // NÍVEL 1: IA AVANÇADA (OpenAI + busca semântica) - PRIMEIRA TENTATIVA
  if (usar_ia_avancada === 'true') {
    try {
      console.log('🔍 NÍVEL 1: Verificando conectividade...');
      // Verificar conectividade primeiro
      const isOnline = await checkConnectivity();
      console.log('🔍 Conectividade verificada:', isOnline);
      
      if (isOnline) {
        console.log('🚀 NÍVEL 1: Tentando IA Avançada...');
        
        const faqData = await getFaqDataOffline();
        const historico = userSessions[email]?.historico || [];
        
        // Timeout para IA avançada
        const resultadoIA = await Promise.race([
          processarComIA(pergunta, faqData, historico, email),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('IA Avançada timeout')), OPENAI_TIMEOUT_MS)
          )
        ]);
        
        // Atualizar histórico da sessão
        if (email) {
          if (!userSessions[email]) {
            userSessions[email] = { contexto: "", ultimaPergunta: "", historico: [] };
          }
          userSessions[email].historico.push(
            { role: "user", content: pergunta },
            { role: "assistant", content: resultadoIA.resposta }
          );
          // Manter apenas últimas 10 interações
          if (userSessions[email].historico.length > 20) {
            userSessions[email].historico = userSessions[email].historico.slice(-20);
          }
        }

        // Log de uso da IA
        await logIaUsage(email, pergunta);

        console.log('✅ NÍVEL 1: IA Avançada funcionou');
        return res.status(200).json({
          ...resultadoIA,
          modo: 'online',
          nivel: 1
        });
      }
    } catch (error) {
      console.error('❌ NÍVEL 1: Falha na IA Avançada:', error.message);
      offlineCache.isOnline = false;
      offlineCache.connectionFailures++;
    }
  }

  // NÍVEL 2: Busca local por palavras-chave - FALLBACK AUTOMÁTICO
  try {
    console.log('🔍 NÍVEL 2: Tentando busca local...');
    
    const faqData = await getFaqDataOffline();
    const correspondencias = findMatches(pergunta, faqData);
    
    if (correspondencias.length > 0) {
      console.log('✅ NÍVEL 2: Busca local funcionou');
      
      if (correspondencias.length === 1 || correspondencias[0].score > correspondencias[1]?.score) {
        return res.status(200).json({
          status: "sucesso_offline",
          resposta: correspondencias[0].resposta,
          sourceRow: correspondencias[0].sourceRow,
          tabulacoes: correspondencias[0].tabulacoes,
          source: "Cache Local",
          modo: 'offline',
          nivel: 2
        });
      } else {
        return res.status(200).json({
          status: "clarification_needed_offline",
          resposta: `Encontrei vários tópicos sobre "${pergunta}". Qual deles se encaixa melhor na sua dúvida?`,
          options: correspondencias.map(c => c.perguntaOriginal).slice(0, 12),
          source: "Cache Local",
          sourceRow: 'Pergunta de Esclarecimento',
          modo: 'offline',
          nivel: 2
        });
      }
    }
  } catch (error) {
    console.error('❌ NÍVEL 2: Falha na busca local:', error.message);
  }

  // NÍVEL 3: Erro - Sem dados disponíveis
  console.log('❌ NÍVEL 3: Sem dados disponíveis');
  
  return res.status(500).json({
    status: "erro_sem_dados",
    resposta: "Sistema temporariamente indisponível. Tente novamente em alguns instantes.",
    source: "Sistema",
    sourceRow: 'Erro',
    modo: 'offline',
    nivel: 3,
    aviso: 'Sistema indisponível - sem acesso à base de dados'
  });
    
  } catch (error) {
    console.error('❌ Erro crítico em processAskRequest:', error);
    return res.status(500).json({
      status: "erro_critico",
      resposta: "Erro interno do sistema. Tente novamente.",
      source: "Sistema",
      error: error.message
    });
  }
}