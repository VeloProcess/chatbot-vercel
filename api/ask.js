// api/ask.js (Versão Busca Local - OpenAI DESATIVADO)

const { google } = require('googleapis');
const axios = require('axios');
// OpenAI DESATIVADO - usando apenas busca local

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1d0h9zr4haDx6etLtdMqPVsBXdVvH7n9OsRdqAhOJOp0";
const FAQ_SHEET_NAME = "FAQ!A:D"; // Pergunta, Resposta, Palavras-chave, Sinônimos
const CACHE_DURATION_SECONDS = 300; // 5 minutos para cache local
const SYNC_INTERVAL_MS = 300000; // 5 minutos para sincronização

// --- CONFIGURAÇÕES DE TIMEOUT ---
const OPENAI_TIMEOUT_MS = 5000; // 5 segundos
const SHEETS_TIMEOUT_MS = 3000; // 3 segundos
const OFFLINE_RESPONSE_TIMEOUT_MS = 2000; // 2 segundos para resposta offline

// --- CLIENTE GOOGLE SHEETS ---
let auth, sheets;

try {
  // Verificar se as credenciais existem
  if (!process.env.GOOGLE_CREDENTIALS) {
    console.warn('⚠️ GOOGLE_CREDENTIALS não configurado');
  } else {
    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      console.log('✅ Credenciais parseadas. Email:', credentials.client_email);
    } catch (parseError) {
      console.error('❌ Erro ao fazer parse do JSON das credenciais:', parseError.message);
      console.error('❌ Verifique se o JSON no .env está correto (sem quebras de linha ou aspas incorretas)');
      throw parseError;
    }
    
    auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Google Sheets cliente configurado com sucesso');
  }
} catch (error) {
  console.error('❌ Erro ao configurar Google Sheets:', error.message);
  console.error('❌ Stack:', error.stack);
}

// OpenAI DESATIVADO - usando apenas busca local

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

// Função de conectividade removida - OpenAI desativado
async function checkConnectivity() {
  // Sempre retornar true para Google Sheets
  return true;
}

async function getFaqDataWithTimeout() {
  try {
    if (!sheets) {
      throw new Error('Google Sheets não configurado');
    }
    
    console.log('🔍 ask.js: Buscando dados da planilha...');
    console.log('🔍 SPREADSHEET_ID:', SPREADSHEET_ID);
    console.log('🔍 FAQ_SHEET_NAME:', FAQ_SHEET_NAME);
    
    // Timeout aumentado para 5 segundos
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout da planilha')), 5000);
    });
    
    const sheetsPromise = sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: FAQ_SHEET_NAME,
    }).catch(error => {
      // Capturar erros específicos do Google Sheets API
      console.error('❌ Erro do Google Sheets API:', error);
      if (error.response) {
        console.error('❌ Status:', error.response.status);
        console.error('❌ Data:', JSON.stringify(error.response.data, null, 2));
        if (error.response.status === 403) {
          throw new Error('PERMISSION_DENIED: A conta de serviço não tem permissão para acessar a planilha.');
        }
        if (error.response.status === 404) {
          throw new Error('NOT_FOUND: Planilha não encontrada. Verifique o SPREADSHEET_ID.');
        }
      }
      // Verificar se a mensagem de erro contém "permission"
      if (error.message && error.message.toLowerCase().includes('permission')) {
        throw new Error('PERMISSION_DENIED: ' + error.message);
      }
      throw error;
    });
    
    const response = await Promise.race([sheetsPromise, timeoutPromise]);
    
    if (!response || !response.data) {
      console.error('❌ Resposta inválida do Google Sheets:', response);
      throw new Error("Resposta inválida do Google Sheets");
    }
    
    if (!response.data.values || response.data.values.length === 0) {
      console.error('❌ Planilha vazia ou sem dados');
      throw new Error("Planilha FAQ vazia ou não encontrada. Verifique se há dados na planilha.");
    }
    
    // Verificar se tem pelo menos cabeçalho + 1 linha de dados
    if (response.data.values.length < 2) {
      console.warn('⚠️ Planilha tem apenas cabeçalho, sem dados');
      throw new Error("Planilha tem apenas cabeçalho. Adicione pelo menos uma linha de dados.");
    }
    
    console.log('✅ ask.js: Dados da planilha obtidos:', response.data.values.length, 'linhas');
    console.log('📋 Primeira linha (cabeçalho):', response.data.values[0]);
    console.log('📋 Segunda linha (primeiro dado):', response.data.values[1]);
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
  if (!sheets) {
    throw new Error('Google Sheets não configurado');
  }
  
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: FAQ_SHEET_NAME,
    });
    if (!response.data.values || response.data.values.length === 0) {
      throw new Error("Não foi possível ler dados da planilha FAQ ou ela está vazia.");
    }
    return response.data.values;
  } catch (error) {
    console.error('❌ Erro em getFaqData:', error.message);
    throw error;
  }
}

function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim();
}

// Função de log de IA removida - OpenAI desativado

function findMatches(pergunta, faqData) {
  if (!faqData || faqData.length === 0) {
    throw new Error("Dados da planilha vazios");
  }
  
  const cabecalho = faqData[0];
  const dados = faqData.slice(1);
  
  if (!cabecalho || !Array.isArray(cabecalho)) {
    throw new Error("Cabeçalho da planilha inválido");
  }
  
  console.log('📋 Cabeçalho encontrado:', cabecalho);
  
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

  console.log('📋 Índices das colunas:', {
    Pergunta: idxPergunta,
    'Palavras-chave': idxPalavrasChave,
    Resposta: idxResposta,
    Sinônimos: idxSinonimos
  });

  if (idxPergunta === -1 || idxResposta === -1 || idxPalavrasChave === -1) {
    throw new Error(`Colunas essenciais não encontradas. Cabeçalho: ${cabecalho.join(', ')}`);
  }

  // Filtrar palavras da busca (aceitar palavras com 2 ou mais caracteres)
  const palavrasDaBusca = normalizarTexto(pergunta).split(' ').filter(p => p.length >= 2);
  const perguntaNormalizada = normalizarTexto(pergunta);
  let todasAsCorrespondencias = [];

  console.log('🔍 Buscando por:', pergunta);
  console.log('🔍 Palavras da busca:', palavrasDaBusca);

  for (let i = 0; i < dados.length; i++) {
    const linhaAtual = dados[i];
    
    // Verificar se a linha tem dados válidos
    if (!linhaAtual || !Array.isArray(linhaAtual)) {
      console.warn(`⚠️ Linha ${i + 2} inválida ou vazia`);
      continue;
    }
    
    // Verificar se a linha tem pergunta (coluna obrigatória)
    if (!linhaAtual[idxPergunta] || linhaAtual[idxPergunta].trim() === '') {
      console.warn(`⚠️ Linha ${i + 2} sem pergunta, pulando...`);
      continue;
    }
    
    const textoPalavrasChave = normalizarTexto(linhaAtual[idxPalavrasChave] || '');
    const textoPergunta = normalizarTexto(linhaAtual[idxPergunta] || '');
    const textoSinonimos = idxSinonimos !== -1 ? normalizarTexto(linhaAtual[idxSinonimos] || '') : '';
    
    let relevanceScore = 0;
    
    // Buscar nas palavras-chave
    palavrasDaBusca.forEach(palavra => {
      if (textoPalavrasChave.includes(palavra)) {
        relevanceScore += 2; // Palavras-chave têm peso maior
      }
      // Também buscar na pergunta original
      if (textoPergunta.includes(palavra)) {
        relevanceScore += 1;
      }
      // Buscar nos sinônimos
      if (textoSinonimos && textoSinonimos.includes(palavra)) {
        relevanceScore += 1.5;
      }
    });
    
    // Também verificar correspondência parcial da pergunta completa
    if (textoPergunta.includes(perguntaNormalizada) || perguntaNormalizada.includes(textoPergunta)) {
      relevanceScore += 3;
    }
    
    if (relevanceScore > 0) {
      todasAsCorrespondencias.push({
        resposta: linhaAtual[idxResposta] || '',
        perguntaOriginal: linhaAtual[idxPergunta] || '',
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


// Função OpenAI removida - OpenAI desativado

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
    
    const { pergunta, email, reformular, usar_ia_avancada = 'true', isFromOption = 'false' } = req.query;
    if (!pergunta) return res.status(400).json({ error: "Nenhuma pergunta fornecida." });

    const isFromOptionBool = isFromOption === 'true';
    console.log('🤖 Nova pergunta recebida:', { pergunta, email, usar_ia_avancada, isFromOption: isFromOptionBool });

    // Verificar se Google Sheets está configurado
    if (!sheets) {
      console.error('❌ Google Sheets não configurado');
      return res.status(500).json({
        status: "erro_configuracao",
        resposta: "Sistema temporariamente indisponível. Erro de configuração.",
        source: "Sistema",
        error: "Google Sheets não configurado"
      });
    }

  // --- SISTEMA DE FALLBACK AUTOMÁTICO DE 3 NÍVEIS ---
  
  // OpenAI DESATIVADO - usando apenas busca local
  
  // NÍVEL 1: Busca local por palavras-chave
  try {
    console.log('🔍 NÍVEL 2: Tentando busca local...');
    
    const faqData = await getFaqDataOffline();
    console.log('✅ Dados obtidos:', faqData ? `${faqData.length} linhas` : 'null');
    
    if (!faqData || faqData.length === 0) {
      throw new Error('Nenhum dado encontrado na planilha');
    }
    
    const correspondencias = findMatches(pergunta, faqData);
    console.log('✅ Correspondências encontradas:', correspondencias.length);
    
    if (correspondencias.length > 0) {
      console.log('✅ NÍVEL 2: Busca local funcionou');
      
      // Se veio de uma opção clicada, buscar correspondência exata ou mais próxima
      if (isFromOptionBool) {
        // Buscar correspondência exata primeiro
        const correspondenciaExata = correspondencias.find(c => 
          c.perguntaOriginal.toLowerCase().trim() === pergunta.toLowerCase().trim()
        );
        
        if (correspondenciaExata) {
          // Encontrou correspondência exata
          return res.status(200).json({
            status: "sucesso",
            resposta: correspondenciaExata.resposta,
            sourceRow: correspondenciaExata.sourceRow,
            sinonimos: correspondenciaExata.sinonimos,
            source: "Google Sheets",
            modo: 'online',
            nivel: 2
          });
        } else if (correspondencias.length === 1) {
          // Apenas uma correspondência, usar ela
          return res.status(200).json({
            status: "sucesso",
            resposta: correspondencias[0].resposta,
            sourceRow: correspondencias[0].sourceRow,
            sinonimos: correspondencias[0].sinonimos,
            source: "Google Sheets",
            modo: 'online',
            nivel: 2
          });
        } else {
          // Múltiplas correspondências mas veio de opção - não mostrar nova lista
          // Usar a primeira (maior score) ou retornar sem correspondência
          if (correspondencias[0].score > correspondencias[1]?.score) {
            return res.status(200).json({
              status: "sucesso",
              resposta: correspondencias[0].resposta,
              sourceRow: correspondencias[0].sourceRow,
              sinonimos: correspondencias[0].sinonimos,
              source: "Google Sheets",
              modo: 'online',
              nivel: 2
            });
          } else {
            // Não há correspondência clara, retornar sem correspondência
            return res.status(200).json({
              status: "sem_correspondencia",
              resposta: `Não encontrei uma resposta específica para "${pergunta}". Por favor, reformule sua pergunta de forma mais detalhada.`,
              source: "Google Sheets",
              sourceRow: 'Sem correspondência',
              modo: 'online',
              nivel: 2
            });
          }
        }
      }
      
      // Lógica normal para perguntas não vindas de opções
      if (correspondencias.length === 1 || correspondencias[0].score > correspondencias[1]?.score) {
        return res.status(200).json({
          status: "sucesso",
          resposta: correspondencias[0].resposta,
          sourceRow: correspondencias[0].sourceRow,
          sinonimos: correspondencias[0].sinonimos,
          source: "Google Sheets",
          modo: 'online',
          nivel: 2
        });
      } else {
        return res.status(200).json({
          status: "clarification_needed",
          resposta: `Encontrei vários tópicos sobre "${pergunta}". Qual deles se encaixa melhor na sua dúvida?`,
          options: correspondencias.map(c => c.perguntaOriginal).slice(0, 12),
          source: "Google Sheets",
          sourceRow: 'Pergunta de Esclarecimento',
          modo: 'online',
          nivel: 2
        });
      }
    } else {
      // Se não encontrou correspondências, retornar mensagem amigável
      console.log('⚠️ Nenhuma correspondência encontrada para:', pergunta);
      return res.status(200).json({
        status: "sem_correspondencia",
        resposta: `Não encontrei informações específicas sobre "${pergunta}". Tente reformular sua pergunta ou entre em contato com o suporte para mais informações.`,
        source: "Google Sheets",
        sourceRow: 'Sem correspondência',
        modo: 'online',
        nivel: 2
      });
    }
  } catch (error) {
    console.error('❌ NÍVEL 2: Falha na busca local:', error.message);
    console.error('❌ Stack trace:', error.stack);
    
    // Verificar tipo de erro para retornar mensagem apropriada
    let errorMessage = "Sistema temporariamente indisponível. Tente novamente em alguns instantes.";
    let errorDetails = error.message;
    
    if (error.message.includes('PERMISSION_DENIED') || error.message.includes('permission_denied')) {
      errorMessage = "Erro de permissão: A conta de serviço não tem acesso à planilha. Verifique as permissões no Google Sheets.";
      errorDetails = "PERMISSION_DENIED: Verifique se a conta de serviço tem permissão de Editor na planilha.";
    } else if (error.message.includes('UNAUTHORIZED') || error.message.includes('unauthorized')) {
      errorMessage = "Erro de autenticação: Credenciais inválidas ou expiradas.";
      errorDetails = "UNAUTHORIZED: Verifique GOOGLE_CREDENTIALS no arquivo .env";
    } else if (error.message.includes('não configurado')) {
      errorMessage = "Erro de configuração do sistema. Contate o suporte.";
    } else if (error.message.includes('Timeout')) {
      errorMessage = "Timeout ao buscar dados. Tente novamente.";
    } else if (error.message.includes('vazia') || error.message.includes('não encontrada')) {
      errorMessage = "Base de dados vazia ou não encontrada.";
    }
    
    // Retornar erro mais detalhado para debug
    return res.status(500).json({
      status: "erro_sem_dados",
      resposta: errorMessage,
      source: "Sistema",
      sourceRow: 'Erro',
      modo: 'offline',
      nivel: 3,
      aviso: 'Sistema indisponível - sem acesso à base de dados',
      error: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
      errorType: error.message.includes('PERMISSION_DENIED') ? 'permission_denied' : 
                 error.message.includes('UNAUTHORIZED') ? 'unauthorized' : 'unknown'
    });
  }

  // NÍVEL 3: Erro - Sem dados disponíveis (não deveria chegar aqui se tudo estiver funcionando)
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