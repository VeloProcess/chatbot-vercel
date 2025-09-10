// api/ask.js (Versão Final Completa com RAG, Sites Resumidos, IA Fallback e Lógica de Listas)

const { google } = require('googleapis');
const OpenAI = require('openai');
const axios = require('axios');

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const FAQ_SHEET_NAME = "FAQ!A:E";
const CACHE_DURATION_SECONDS = 0;

// --- CONFIGURAÇÃO DA IA (OPENAI) ---
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const modeloOpenAI = "gpt-4o";

// --- CLIENTE GOOGLE SHEETS ---
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
let cache = { timestamp: null, data: null };

// --- FUNÇÕES DE APOIO ---
async function getFaqData() {
  const now = new Date();
  if (cache.data && cache.timestamp && (now - cache.timestamp) / 1000 < CACHE_DURATION_SECONDS) {
    return cache.data;
  }
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: FAQ_SHEET_NAME,
  });
  if (!response.data.values || response.data.values.length === 0) {
    throw new Error("Não foi possível ler dados da planilha FAQ ou ela está vazia.");
  }
  cache = { timestamp: now, data: response.data.values };
  return cache.data;
}

function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/gi, '')
    .trim();
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
  const idxSinonimos = 4;

  if (idxPergunta === -1 || idxResposta === -1 || idxPalavrasChave === -1) {
    throw new Error("Colunas essenciais (Pergunta, Resposta, Palavras-chave) não encontradas.");
  }

  const palavrasDaBusca = normalizarTexto(pergunta).split(' ').filter(p => p.length > 2);
  let todasAsCorrespondencias = [];

  for (let i = 0; i < dados.length; i++) {
    const linhaAtual = dados[i];
    const textoPerguntaOriginal = linhaAtual[idxPergunta] || '';
    if (!textoPerguntaOriginal) continue;
    const textoPerguntaNormalizado = normalizarTexto(textoPerguntaOriginal);
    const textoPalavrasChave = normalizarTexto(linhaAtual[idxPalavrasChave] || '');
    const textoSinonimos = normalizarTexto(linhaAtual[idxSinonimos] || '');
    const textoDeBuscaCombinado = `${textoPerguntaNormalizado} ${textoPalavrasChave} ${textoSinonimos}`;
    let relevanceScore = 0;
    palavrasDaBusca.forEach(palavra => {
      if (textoDeBuscaCombinado.includes(palavra)) relevanceScore++;
    });
    if (relevanceScore > 0) {
      todasAsCorrespondencias.push({
        resposta: linhaAtual[idxResposta],
        perguntaOriginal: textoPerguntaOriginal,
        sourceRow: i + 2,
        score: relevanceScore,
        tabulacoes: linhaAtual[3] || null
      });
    }
  }

  const uniqueMatches = {};
  todasAsCorrespondencias.forEach(match => {
    const key = match.perguntaOriginal.trim();
    if (!uniqueMatches[key] || match.score > uniqueMatches[key].score) {
      uniqueMatches[key] = match;
    }
  });

  return Object.values(uniqueMatches).sort((a, b) => b.score - a.score);
}

// --- FUNÇÃO DE IA COM PROMPT CORRIGIDO ---
async function askOpenAI(pergunta, contextoDaPlanilha = "Nenhum") {
  try {
    const prompt = `
### PERSONA E OBJETIVO
Você é o VeloBot, assistente factual da Velotax. Responda à pergunta do atendente usando **somente o contexto abaixo** ou **fontes externas autorizadas**.

### FONTES DA VERDADE
1. CONTEXTO DA PLANILHA (prioridade máxima)
2. FONTES EXTERNAS AUTORIZADAS:
   - Site da Receita Federal
   - Portal e-CAC
   - GOV.BR
   - Site oficial da Velotax (velotax.com.br)

### REGRAS DE FORMATAÇÃO
- SE NO CONTEXTO DA PLANILHA:
achei isto na minha base de dados sobre
${pergunta}

[INSIRA A INFORMAÇÃO EXATA DO CONTEXTO]

fonte: base de conhecimento

- SE EM FONTES EXTERNAS:
sobre
${pergunta} eu encontrei em [NOME DO SITE]

[INSIRA A INFORMAÇÃO EXATA DO SITE]

fonte: [NOME DO SITE]

- NÃO REFORMULE ou resuma.
- FALHA SEGURA: "Não encontrei esta informação na base de conhecimento ou nos sites autorizados."
- Sempre em português do Brasil (pt-BR).

---
CONTEXTO DA PLANILHA:
"""
${contextoDaPlanilha}
"""

PERGUNTA DO ATENDENTE:
"${pergunta}"
`;

    const chatCompletion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: modeloOpenAI,
      temperature: 0,
      max_tokens: 1024,
    });

    return chatCompletion.choices[0].message.content;
  } catch (error) {
    console.error("ERRO AO CHAMAR A API DA OPENAI:", error);
    return "Desculpe, não consegui processar sua pergunta com a IA neste momento.";
  }
}

// --- BUSCA EM SITES AUTORIZADOS ---
async function buscarEPrepararContextoSites(pergunta) {
  const sites = [
    "https://www.gov.br/receitafederal",
    "https://cav.receita.fazenda.gov.br",
    "https://www.gov.br",
    "https://velotax.com.br"
  ];
  let contexto = "";
  for (const site of sites) {
    try {
      const { data } = await axios.get(site);
      if (data.toLowerCase().includes(pergunta.toLowerCase())) {
        const promptResumo = `
Você é um assistente que deve resumir apenas o conteúdo relevante da seguinte página
em português do Brasil, para responder a pergunta do usuário.
Pergunta: "${pergunta}"
Conteúdo da página: """${data}"""
Resuma apenas o necessário para responder a pergunta, mantendo informações literais.
`;
        const resumo = await openai.chat.completions.create({
          messages: [{ role: "user", content: promptResumo }],
          model: modeloOpenAI,
          temperature: 0,
          max_tokens: 512
        });
        const trechoResumido = resumo.choices[0].message.content;
        contexto += `Fonte: ${site}\n${trechoResumido}\n\n`;
      }
    } catch (e) {
      console.error(`Falha ao processar site ${site}:`, e.message);
    }
  }
  return contexto || null;
}

// --- HANDLER PRINCIPAL ---
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { pergunta, email, perguntaOriginal } = req.query;
           // Se o frontend enviar perguntaOriginal (quando o usuário clica em uma opção), usamos ela direto
    const perguntaFinal = perguntaOriginal || pergunta;
        if (!perguntaFinal) {
  return res.status(400).json({ error: "Nenhuma pergunta fornecida." });
}
    const perguntaNormalizada = normalizarTexto(pergunta);
    if (perguntaNormalizada === 'credito') {
      return res.status(200).json({
        status: "clarification_needed",
        resposta: "Você quer qual informação sobre crédito?",
        options: ["Antecipação", "Crédito ao trabalhador", "Crédito pessoal"],
        source: "Planilha"
      });
    }

    const faqData = await getFaqData();
    const correspondencias = findMatches(pergunta, faqData);

    if (correspondencias.length === 1 || (correspondencias.length > 1 && correspondencias[0].score > (correspondencias[1]?.score || 0))) {
      return res.status(200).json({
        status: "sucesso",
        resposta: correspondencias[0].resposta,
        sourceRow: correspondencias[0].sourceRow,
        tabulacoes: correspondencias[0].tabulacoes,
        source: "Planilha"
      });
    } else if (correspondencias.length > 1) {
  return res.status(200).json({
    status: "clarification_needed",
    resposta: `Encontrei vários tópicos sobre "${perguntaFinal}". Qual deles se encaixa melhor?`,
    options: correspondencias.slice(0, 10).map(c => c.perguntaOriginal),
    source: "Planilha",
    sourceRow: "Pergunta de Esclarecimento"
  });
}

    const contextoSites = await buscarEPrepararContextoSites(pergunta);
    if (contextoSites) {
      const respostaIaSites = await askOpenAI(pergunta, contextoSites);
      return res.status(200).json({
        status: "sucesso_site",
        resposta: respostaIaSites,
        source: "Sites autorizados (resumidos)"
      });
    }

    await logIaUsage(email, pergunta);
    const respostaIa = await askOpenAI(pergunta);
    return res.status(200).json({
      status: "sucesso_ia",
      resposta: respostaIa,
      source: "IA (Fallback)"
    });

  } catch (error) {
    console.error("ERRO NO BACKEND:", error);
    return res.status(500).json({ error: "Erro interno no servidor.", details: error.message });
  }
};