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

// --- CONFIGURAÇÕES SIMPLES ---

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
  try {
    // Tentar usar base local primeiro (mais rápido)
    const fs = require('fs');
    const path = require('path');
    const basePath = path.join(process.cwd(), 'data', 'base_atualizada.json');
    
    if (fs.existsSync(basePath)) {
      const baseData = JSON.parse(fs.readFileSync(basePath, 'utf8'));
      console.log(`📊 Usando base local: ${baseData.length} itens`);
      
      // Converter para formato da planilha
      return [
        ['Pergunta', 'Palavras-chave', 'Resposta', 'Tabulacoes'],
        ...baseData.map(item => [
          item.pergunta,
          item.palavras_chave,
          item.resposta,
          item.tabulacoes
        ])
      ];
    }
  } catch (error) {
    console.log('⚠️ Erro ao carregar base local, usando planilha...');
  }
  
  // Fallback para planilha Google Sheets
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

  const perguntaLower = pergunta.toLowerCase();
  const perguntaNormalizada = normalizarTexto(pergunta);
  let todasAsCorrespondencias = [];

  for (let i = 0; i < dados.length; i++) {
    const linhaAtual = dados[i];
    const perguntaOriginal = linhaAtual[idxPergunta] || '';
    const textoPalavrasChave = normalizarTexto(linhaAtual[idxPalavrasChave] || '');
    const resposta = linhaAtual[idxResposta] || '';
    
    let score = 0;
    
    // 1. BUSCA EXATA na pergunta original (prioridade máxima)
    if (perguntaOriginal.toLowerCase().includes(perguntaLower)) {
      score = 100;
    }
    // 2. BUSCA EXATA nas palavras-chave
    else if (textoPalavrasChave.includes(perguntaNormalizada)) {
      score = 90;
    }
    // 3. BUSCA PARCIAL na pergunta original (mais flexível)
    else if (perguntaOriginal.toLowerCase().includes(perguntaLower.split(' ')[0])) {
      score = 80;
    }
    // 4. BUSCA PARCIAL nas palavras-chave
    else {
      const palavrasPergunta = perguntaNormalizada.split(' ').filter(p => p.length > 2);
      const palavrasChave = textoPalavrasChave.split(' ');
      let matches = 0;
      
      palavrasPergunta.forEach(palavra => {
        if (palavrasChave.some(p => p.includes(palavra) || palavra.includes(p))) {
          matches++;
        }
      });
      
      if (matches > 0) {
        score = matches * 30; // 30 pontos por palavra encontrada
      }
    }
    
    if (score > 0) {
      todasAsCorrespondencias.push({
        resposta: resposta,
        perguntaOriginal: perguntaOriginal,
        sourceRow: i + 2,
        score: score,
        tabulacoes: linhaAtual[3] || null
      });
    }
  }

  // Ordenação por score (maior primeiro)
  todasAsCorrespondencias.sort((a, b) => b.score - a.score);
  
  return todasAsCorrespondencias;
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

    // --- VERIFICA CACHE PRIMEIRO (exceto se for reformulação) ---
    if (!reformular) {
      const cached = buscarNoCache(pergunta);
      if (cached) {
        console.log(`✅ Cache hit para: "${pergunta}"`);
        return res.status(200).json({
          status: "sucesso",
          resposta: cached.resposta,
          source: cached.source,
          sourceRow: 'Cache',
          cached: true
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
    
    console.log(`🔍 Busca para: "${pergunta}"`);
    console.log(`📊 Encontradas: ${correspondencias.length} correspondências`);
    if (correspondencias.length > 0) {
      console.log(`🎯 Melhor match: "${correspondencias[0].perguntaOriginal}" (score: ${correspondencias[0].score})`);
    }

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
        sourceRow: 'Resposta da IA'
    });
}

    // --- SE HOUVER CORRESPONDÊNCIAS ---
    if (correspondencias.length === 1 || correspondencias[0].score >= 60) {
      const resposta = correspondencias[0].resposta;
      
      // Adiciona resposta da planilha ao cache
      adicionarAoCache(pergunta, resposta, "Planilha");
      
      return res.status(200).json({
        status: "sucesso",
        resposta: resposta,
        sourceRow: correspondencias[0].sourceRow,
        tabulacoes: correspondencias[0].tabulacoes,
        source: "Planilha"
      });
    } else if (correspondencias.length > 1) {
      const resposta = `Encontrei vários tópicos sobre "${pergunta}". Qual deles se encaixa melhor na sua dúvida?`;
      
      // Adiciona pergunta de esclarecimento ao cache
      adicionarAoCache(pergunta, resposta, "Planilha");
      
      return res.status(200).json({
        status: "clarification_needed",
        resposta: resposta,
        options: correspondencias.map(c => c.perguntaOriginal).slice(0, 8),
        source: "Planilha",
        sourceRow: 'Pergunta de Esclarecimento'
      });
    }

  } catch (error) {
    console.error("ERRO NO BACKEND:", error);
    return res.status(500).json({ error: "Erro interno no servidor.", details: error.message });
  }
};
