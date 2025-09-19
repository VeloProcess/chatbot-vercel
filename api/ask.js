// api/ask.js (Versão OpenAI Completa – Memória de Sessão e Busca em Sites + IA Avançada)

const { google } = require('googleapis');
const axios = require('axios');
const OpenAI = require('openai');
const { processarComIA } = require('./ai-advanced');

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
let userSessions = {}; // { email: { contexto: "", ultimaPergunta: "" } }

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


// --- FUNÇÃO OPENAI ---
        async function askOpenAI(pergunta, contextoPlanilha, email, historicoSessao = []) {
  try {
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

    const completion = await openai.chat.completions.create({
      model: modeloOpenAI,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1024,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("ERRO AO CHAMAR OPENAI:", error);
    return "Desculpe, não consegui processar sua pergunta.";
  }
}

// --- FUNÇÃO PRINCIPAL DA API (HANDLER) ---
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=240');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Timeout de 15 segundos para evitar 504
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout da API ask')), 15000);
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
  const { pergunta, email, reformular, usar_ia_avancada = 'true' } = req.query;
  if (!pergunta) return res.status(400).json({ error: "Nenhuma pergunta fornecida." });

  console.log('🤖 Nova pergunta recebida:', { pergunta, email, usar_ia_avancada });

  // --- VERIFICAR SE DEVE USAR IA AVANÇADA ---
  if (usar_ia_avancada === 'true') {
    try {
      const faqData = await getFaqData();
      const historico = userSessions[email]?.historico || [];
      
      console.log('🚀 Usando IA Avançada...');
      const resultadoIA = await processarComIA(pergunta, faqData, historico, email);
      
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

      return res.status(200).json(resultadoIA);
    } catch (error) {
      console.error('❌ Erro na IA Avançada, usando fallback:', error);
      // Continuar com o método tradicional
    }
  }

  // --- MÉTODO TRADICIONAL (FALLBACK) ---
  const perguntaNormalizada = normalizarTexto(pergunta);

  // --- MENU ESPECÍFICO: CRÉDITO ---
  if (perguntaNormalizada === 'credito') {
    return res.status(200).json({
      status: "clarification_needed",
      resposta: "Você quer qual informação sobre crédito?",
      options: ["Antecipação", "Crédito ao trabalhador", "Crédito pessoal", "Data dos créditos ( lotes )"],
      source: "Planilha",
      sourceRow: 'Pergunta de Esclarecimento'
    });
  }

  const faqData = await getFaqData();
  const correspondencias = findMatches(pergunta, faqData);

  // --- SEM CORRESPONDÊNCIAS NA PLANILHA ---
  if (correspondencias.length === 0) {
    await logIaUsage(email, pergunta);
    const respostaDaIA = await askOpenAI(pergunta, "Nenhum", email, reformular);
    return res.status(200).json({
      status: "sucesso_ia",
      resposta: respostaDaIA,
      source: "IA",
      sourceRow: 'Resposta da IA'
    });
  }

  // --- SE HOUVER CORRESPONDÊNCIAS ---
  if (correspondencias.length === 1 || correspondencias[0].score > correspondencias[1].score) {
    return res.status(200).json({
      status: "sucesso",
      resposta: correspondencias[0].resposta,
      sourceRow: correspondencias[0].sourceRow,
      tabulacoes: correspondencias[0].tabulacoes,
      source: "Planilha"
    });
  } else {
    return res.status(200).json({
      status: "clarification_needed",
      resposta: `Encontrei vários tópicos sobre "${pergunta}". Qual deles se encaixa melhor na sua dúvida?`,
      options: correspondencias.map(c => c.perguntaOriginal).slice(0, 12),
      source: "Planilha",
      sourceRow: 'Pergunta de Esclarecimento'
    });
  }
}
