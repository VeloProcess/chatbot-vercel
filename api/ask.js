// api/ask.js (Versão OpenAI Completa – Memória de Sessão e Busca em Sites)

const { google } = require('googleapis');
const axios = require('axios');
const OpenAI = require('openai');

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const FAQ_SHEET_NAME = "FAQ!A:D";
const CACHE_DURATION_SECONDS = 0; // Desativado para sempre buscar atualizado

// --- CLIENTE GOOGLE SHEETS ---
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// --- CLIENTE OPENAI ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const modeloOpenAI = "gpt-4o-mini"; // Ajustável

// --- MEMÓRIA DE SESSÃO POR USUÁRIO ---
let userSessions = {}; // { email: { contexto: "", ultimaPergunta: "", historico: [] } }

// --- ANÁLISE DE INTENÇÃO ---
function analisarIntencao(pergunta) {
  const perguntaLower = pergunta.toLowerCase();
  
  const intencoes = {
    'consulta': ['consultar', 'verificar', 'checar', 'buscar', 'procurar', 'como saber', 'onde ver'],
    'problema': ['erro', 'não funciona', 'bloqueado', 'travado', 'problema', 'dificuldade', 'não consegue'],
    'procedimento': ['como fazer', 'passo a passo', 'processo', 'procedimento', 'tutorial', 'instrução'],
    'informacao': ['o que é', 'quando', 'onde', 'quanto', 'qual', 'por que', 'explicar'],
    'urgencia': ['urgente', 'rápido', 'emergência', 'imediato', 'agora', 'hoje']
  };
  
  const intencaoDetectada = [];
  Object.keys(intencoes).forEach(intencao => {
    if (intencoes[intencao].some(palavra => perguntaLower.includes(palavra))) {
      intencaoDetectada.push(intencao);
    }
  });
  
  return intencaoDetectada.length > 0 ? intencaoDetectada : ['informacao'];
}

// --- ANÁLISE DE CONTEXTO ---
function analisarContexto(pergunta, historico) {
  const contexto = {
    intencao: analisarIntencao(pergunta),
    urgencia: analisarIntencao(pergunta).includes('urgencia') ? 'alta' : 'normal',
    continuidade: false,
    tema: 'geral'
  };
  
  // Verifica se é continuação de conversa
  if (historico && historico.length > 0) {
    const ultimaPergunta = historico[historico.length - 1];
    if (ultimaPergunta && ultimaPergunta.includes('?')) {
      contexto.continuidade = true;
    }
  }
  
  // Detecta tema principal
  const temas = {
    'antecipacao': ['antecipação', 'restituição', 'pix', 'cpf'],
    'celcoin': ['celcoin', 'conta', 'digital', 'app'],
    'credito': ['crédito', 'empréstimo', 'pessoal', 'trabalhador'],
    'receita': ['receita', 'federal', 'declaração', 'imposto']
  };
  
  Object.keys(temas).forEach(tema => {
    if (temas[tema].some(palavra => pergunta.toLowerCase().includes(palavra))) {
      contexto.tema = tema;
    }
  });
  
  return contexto;
}

// --- CONFIGURAÇÕES DE BUSCA ---
const CONFIGURACOES_BUSCA = {
  SCORING: {
    EXACT_MATCH: 10,        // Busca exata na pergunta original
    KEYWORD_MATCH: 5,       // Busca nas palavras-chave
    SYNONYM_MATCH: 3,       // Busca com sinônimos
    PARTIAL_MATCH: 2,       // Busca parcial
    SEMANTIC_MATCH: 1,      // Busca semântica
    SPECIFICITY_BONUS: 0.5  // Bonus por especificidade
  },
  SINONIMOS: {
    'antecipacao': ['antecipação', 'adiantamento', 'adiantamento de restituição', 'adiantamento do ir'],
    'restituicao': ['restituição', 'devolução', 'reembolso', 'devolução do ir'],
    'celcoin': ['celcoin', 'conta digital', 'app celcoin', 'aplicativo celcoin'],
    'cpf': ['cpf', 'documento', 'documento de identificação', 'cadastro de pessoa física'],
    'pix': ['pix', 'transferência', 'transferência instantânea', 'pagamento instantâneo'],
    'bloqueio': ['bloqueio', 'travamento', 'suspensão', 'bloqueado', 'travado'],
    'desbloqueio': ['desbloqueio', 'liberação', 'desbloquear', 'liberar'],
    'cadastro': ['cadastro', 'registro', 'inscrição', 'criar conta'],
    'alteracao': ['alteração', 'modificação', 'mudança', 'trocar', 'atualizar'],
    'consulta': ['consulta', 'verificação', 'checagem', 'verificar', 'checar'],
    'receita': ['receita', 'receita federal', 'fazenda', 'fisco'],
    'declaracao': ['declaração', 'declaração de imposto de renda', 'dirpf'],
    'malha': ['malha', 'malha fina', 'pendência', 'pendencia'],
    'cav': ['cav', 'consulta de situação', 'situação cadastral'],
    'velotax': ['velotax', 'velo tax', 'empresa', 'plataforma']
  }
};

// --- CACHE INTELIGENTE ---
let cacheRespostas = {}; // { pergunta_hash: { resposta, timestamp, hits } }
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutos
const MAX_CACHE_SIZE = 1000; // Máximo de entradas no cache

// Função para gerar hash da pergunta
function gerarHashPergunta(pergunta) {
  return normalizarTexto(pergunta).replace(/\s+/g, '_');
}

// Função para limpar cache expirado
function limparCacheExpirado() {
  const agora = Date.now();
  Object.keys(cacheRespostas).forEach(hash => {
    if (agora - cacheRespostas[hash].timestamp > CACHE_DURATION_MS) {
      delete cacheRespostas[hash];
    }
  });
}

// Função para adicionar ao cache
function adicionarAoCache(pergunta, resposta, source) {
  const hash = gerarHashPergunta(pergunta);
  
  // Limpa cache se estiver muito grande
  if (Object.keys(cacheRespostas).length >= MAX_CACHE_SIZE) {
    limparCacheExpirado();
  }
  
  cacheRespostas[hash] = {
    resposta: resposta,
    source: source,
    timestamp: Date.now(),
    hits: 1
  };
}

// Função para buscar no cache
function buscarNoCache(pergunta) {
  const hash = gerarHashPergunta(pergunta);
  const cached = cacheRespostas[hash];
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION_MS) {
    cached.hits++;
    return cached;
  }
  
  return null;
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

  const perguntaNormalizada = normalizarTexto(pergunta);
  const palavrasDaBusca = perguntaNormalizada.split(' ').filter(p => p.length > 2);
  let todasAsCorrespondencias = [];

  // Usa dicionário de sinônimos das configurações
  const sinonimos = CONFIGURACOES_BUSCA.SINONIMOS;

  // Função para expandir sinônimos
  function expandirSinonimos(texto) {
    let textoExpandido = texto;
    Object.keys(sinonimos).forEach(palavra => {
      sinonimos[palavra].forEach(sinonimo => {
        if (textoExpandido.includes(palavra)) {
          textoExpandido += ' ' + sinonimo;
        }
        if (textoExpandido.includes(sinonimo)) {
          textoExpandido += ' ' + palavra;
        }
      });
    });
    return textoExpandido;
  }

  for (let i = 0; i < dados.length; i++) {
    const linhaAtual = dados[i];
    const perguntaOriginal = linhaAtual[idxPergunta] || '';
    const textoPalavrasChave = normalizarTexto(linhaAtual[idxPalavrasChave] || '');
    const resposta = linhaAtual[idxResposta] || '';
    
    // Busca expandida com sinônimos
    const perguntaExpandida = expandirSinonimos(perguntaNormalizada);
    const palavrasExpandidas = perguntaExpandida.split(' ').filter(p => p.length > 2);
    
    let relevanceScore = 0;
    let matchType = 'keyword'; // keyword, exact, partial, semantic
    
    // 1. Busca exata na pergunta original (peso máximo)
    if (perguntaOriginal.toLowerCase().includes(pergunta.toLowerCase())) {
      relevanceScore += CONFIGURACOES_BUSCA.SCORING.EXACT_MATCH;
      matchType = 'exact';
    }
    
    // 2. Busca nas palavras-chave (peso alto)
    palavrasDaBusca.forEach(palavra => {
      if (textoPalavrasChave.includes(palavra)) {
        relevanceScore += CONFIGURACOES_BUSCA.SCORING.KEYWORD_MATCH;
      }
    });
    
    // 3. Busca com sinônimos expandidos (peso médio)
    palavrasExpandidas.forEach(palavra => {
      if (textoPalavrasChave.includes(palavra)) {
        relevanceScore += CONFIGURACOES_BUSCA.SCORING.SYNONYM_MATCH;
      }
    });
    
    // 4. Busca parcial na pergunta original (peso baixo)
    const palavrasPerguntaOriginal = normalizarTexto(perguntaOriginal).split(' ');
    let matchesParciais = 0;
    palavrasDaBusca.forEach(palavra => {
      if (palavrasPerguntaOriginal.some(p => p.includes(palavra) || palavra.includes(p))) {
        matchesParciais++;
      }
    });
    if (matchesParciais > 0) {
      relevanceScore += matchesParciais * CONFIGURACOES_BUSCA.SCORING.PARTIAL_MATCH;
      matchType = 'partial';
    }
    
    // 5. Busca semântica simples (peso baixo)
    const palavrasResposta = normalizarTexto(resposta).split(' ').filter(p => p.length > 3);
    let matchesSemanticos = 0;
    palavrasDaBusca.forEach(palavra => {
      if (palavrasResposta.some(p => p.includes(palavra) || palavra.includes(p))) {
        matchesSemanticos++;
      }
    });
    if (matchesSemanticos > 0) {
      relevanceScore += matchesSemanticos * CONFIGURACOES_BUSCA.SCORING.SEMANTIC_MATCH;
      matchType = 'semantic';
    }
    
    // 6. Bonus por comprimento da pergunta (perguntas mais específicas têm prioridade)
    const bonusEspecificidade = Math.min(palavrasDaBusca.length * CONFIGURACOES_BUSCA.SCORING.SPECIFICITY_BONUS, 3);
    relevanceScore += bonusEspecificidade;
    
    if (relevanceScore > 0) {
      todasAsCorrespondencias.push({
        resposta: resposta,
        perguntaOriginal: perguntaOriginal,
        sourceRow: i + 2,
        score: relevanceScore,
        matchType: matchType,
        tabulacoes: linhaAtual[3] || null
      });
    }
  }

  // Desduplicação e ordenação melhorada
  const uniqueMatches = {};
  todasAsCorrespondencias.forEach(match => {
    const key = match.perguntaOriginal.trim();
    if (!uniqueMatches[key] || match.score > uniqueMatches[key].score) {
      uniqueMatches[key] = match;
    }
  });
  
  let correspondenciasUnicas = Object.values(uniqueMatches);
  
  // Ordenação por score e tipo de match
  correspondenciasUnicas.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    
    // Em caso de empate, priorizar tipos de match
    const tipoPrioridade = { 'exact': 4, 'keyword': 3, 'partial': 2, 'semantic': 1 };
    return tipoPrioridade[b.matchType] - tipoPrioridade[a.matchType];
  });
  
  return correspondenciasUnicas;
}

// --- FUNÇÃO DE BUSCA EM SITES AUTORIZADOS ---
async function buscarEPrepararContextoSites(pergunta) {
  const sites = [
    {
      url: "https://www.gov.br/receitafederal",
      keywords: ["receita", "federal", "imposto", "renda", "declaração", "restituição"],
      priority: 1
    },
    {
      url: "https://cav.receita.fazenda.gov.br",
      keywords: ["cav", "receita", "consulta", "cpf", "situação"],
      priority: 2
    },
    {
      url: "https://www.gov.br",
      keywords: ["governo", "federal", "serviços", "digitais"],
      priority: 3
    },
    {
      url: "https://velotax.com.br",
      keywords: ["velotax", "antecipação", "celcoin", "crédito"],
      priority: 4
    }
  ];

  const perguntaNormalizada = normalizarTexto(pergunta);
  const palavrasChave = perguntaNormalizada.split(' ').filter(p => p.length > 2);
  
  let contexto = "";
  let sitesEncontrados = 0;
  const maxSites = 2; // Limita para não sobrecarregar

  // Ordena sites por prioridade e relevância
  const sitesRelevantes = sites
    .map(site => {
      let relevancia = 0;
      palavrasChave.forEach(palavra => {
        if (site.keywords.some(keyword => keyword.includes(palavra) || palavra.includes(keyword))) {
          relevancia++;
        }
      });
      return { ...site, relevancia };
    })
    .filter(site => site.relevancia > 0)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, maxSites);

  for (const site of sitesRelevantes) {
    try {
      console.log(`🔍 Buscando em: ${site.url}`);
      const { data } = await axios.get(site.url, { 
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VeloBot/1.0)'
        }
      });
      
      // Busca mais inteligente no conteúdo
      const conteudo = data.toLowerCase();
      const perguntaLower = pergunta.toLowerCase();
      
      // Verifica se o site contém palavras-chave relevantes
      const palavrasEncontradas = palavrasChave.filter(palavra => 
        conteudo.includes(palavra.toLowerCase())
      );
      
      if (palavrasEncontradas.length > 0) {
        // Extrai trecho relevante (simplificado)
        const indice = conteudo.indexOf(palavrasEncontradas[0]);
        const trecho = data.substring(
          Math.max(0, indice - 200), 
          Math.min(data.length, indice + 300)
        ).replace(/<[^>]*>/g, ' ').trim();
        
        contexto += `Fonte: ${site.url}\nTrecho relevante: ${trecho}\n\n`;
        sitesEncontrados++;
        
        if (sitesEncontrados >= maxSites) break;
      }
    } catch (e) {
      console.error(`❌ Falha ao processar site ${site.url}:`, e.message);
    }
  }
  
  return contexto || null;
}


// --- FUNÇÃO PRINCIPAL DA API (HANDLER) ---
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=240');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { pergunta, email, reformular } = req.query;
    if (!pergunta) return res.status(400).json({ error: "Nenhuma pergunta fornecida." });

    const perguntaNormalizada = normalizarTexto(pergunta);

    // --- INICIALIZA SESSÃO DO USUÁRIO ---
    if (!userSessions[email]) {
      userSessions[email] = { contexto: "", ultimaPergunta: "", historico: [] };
    }
    
    // --- ANÁLISE DE CONTEXTO E INTENÇÃO ---
    const contextoAnalise = analisarContexto(pergunta, userSessions[email].historico);
    console.log(`🧠 Contexto detectado:`, contextoAnalise);
    
    // Atualiza histórico
    userSessions[email].historico.push(pergunta);
    if (userSessions[email].historico.length > 10) {
      userSessions[email].historico = userSessions[email].historico.slice(-10);
    }

    // --- VERIFICA CACHE PRIMEIRO (exceto se for reformulação) ---
    if (!reformular) {
      const cached = buscarNoCache(pergunta);
      if (cached) {
        console.log(`✅ Cache hit para: "${pergunta}" (${cached.hits} hits)`);
        return res.status(200).json({
          status: "sucesso",
          resposta: cached.resposta,
          source: cached.source,
          sourceRow: 'Cache',
          cached: true,
          hits: cached.hits,
          contexto: contextoAnalise
        });
      }
    }

    // --- MENU ESPECÍFICO: CRÉDITO ---
    if (perguntaNormalizada === 'credito') {
      const resposta = {
        status: "clarification_needed",
        resposta: "Você quer qual informação sobre crédito?",
        options: ["Antecipação", "Crédito ao trabalhador", "Crédito pessoal", "Data dos créditos ( lotes )"],
        source: "Planilha",
        sourceRow: 'Pergunta de Esclarecimento'
      };
      
      // Adiciona ao cache
      adicionarAoCache(pergunta, resposta.resposta, "Planilha");
      
      return res.status(200).json(resposta);
    }

    const faqData = await getFaqData();
    const correspondencias = findMatches(pergunta, faqData);

    // --- SEM CORRESPONDÊNCIAS NA PLANILHA ---
    if (correspondencias.length === 0) {
      // Loga o uso da IA
      await logIaUsage(email, pergunta);
      // Prepara o contexto dos sites autorizados
      const contextoSites = await buscarEPrepararContextoSites(pergunta);
      // Pergunta à OpenAI
      const respostaDaIA = await askOpenAI(pergunta, contextoSites || "Nenhum", email, reformular);
      
      // Adiciona resposta da IA ao cache
      adicionarAoCache(pergunta, respostaDaIA, "IA");
      
      // Retorna a resposta da IA
      return res.status(200).json({
        status: "sucesso_ia",
        resposta: respostaDaIA,
        source: "IA",
        sourceRow: 'Resposta da IA',
        contexto: contextoAnalise
      });
    }

    // --- SE HOUVER CORRESPONDÊNCIAS ---
    if (correspondencias.length === 1 || correspondencias[0].score > correspondencias[1].score) {
      const resposta = correspondencias[0].resposta;
      
      // Adiciona resposta da planilha ao cache
      adicionarAoCache(pergunta, resposta, "Planilha");
      
      return res.status(200).json({
        status: "sucesso",
        resposta: resposta,
        sourceRow: correspondencias[0].sourceRow,
        tabulacoes: correspondencias[0].tabulacoes,
        source: "Planilha",
        matchType: correspondencias[0].matchType,
        score: correspondencias[0].score,
        contexto: contextoAnalise
      });
    } else {
      const resposta = `Encontrei vários tópicos sobre "${pergunta}". Qual deles se encaixa melhor na sua dúvida?`;
      
      // Adiciona pergunta de esclarecimento ao cache
      adicionarAoCache(pergunta, resposta, "Planilha");
      
      return res.status(200).json({
        status: "clarification_needed",
        resposta: resposta,
        options: correspondencias.map(c => c.perguntaOriginal).slice(0, 12),
        source: "Planilha",
        sourceRow: 'Pergunta de Esclarecimento',
        contexto: contextoAnalise
      });
    }

  } catch (error) {
    console.error("ERRO NO BACKEND:", error);
    return res.status(500).json({ error: "Erro interno no servidor.", details: error.message });
  }
};
