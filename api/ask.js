// api/ask.js (Versão Final Completa - Híbrida Inteligente com RAG)

const { google } = require('googleapis');
const { HfInference } = require("@huggingface/inference");

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const FAQ_SHEET_NAME = "FAQ!A:D";
const CACHE_DURATION_SECONDS = 0;

// --- CONFIGURAÇÃO DA IA (HUGGING FACE) ---
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
const modeloHf = "mistralai/Mistral-7B-Instruct-v0.2";

// --- CLIENTE GOOGLE SHEETS ---
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
let cache = { timestamp: null, data: null };

// --- FUNÇÕES DE APOIO (DO SEU CÓDIGO ORIGINAL) ---
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
    throw new Error("Colunas essenciais não encontradas.");
  }
  const palavrasDaBusca = normalizarTexto(pergunta).split(' ').filter(p => p.length > 2);
  let todasAsCorrespondencias = [];
  for (let i = 0; i < dados.length; i++) {
    const linhaAtual = dados[i];
    const textoPerguntaOriginal = linhaAtual[idxPergunta] || '';
    if (!textoPerguntaOriginal) continue;
    const textoPalavrasChave = normalizarTexto(linhaAtual[idxPalavrasChave] || '');
    let relevanceScore = 0;
    palavrasDaBusca.forEach(palavra => {
      if (textoPalavrasChave.includes(palavra)) { relevanceScore++; }
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
  let correspondenciasUnicas = Object.values(uniqueMatches);
  correspondenciasUnicas.sort((a, b) => b.score - a.score);
  return correspondenciasUnicas;
}

// --- NOVA FUNÇÃO DE IA COM HUGGING FACE ---
// >>> SUBSTITUA SUA FUNÇÃO askHuggingFace POR ESTA <<<
async function askHuggingFace(pergunta, contextoDaPlanilha = "Nenhum") {
  try {
    // O prompt para chatCompletion é um array de mensagens, o que é mais estruturado.
    const messages = [
        { role: "system", content: "Você é o VeloBot, um assistente de IA especialista nos processos da Velotax. Sua tarefa é responder à pergunta de um atendente de suporte de forma clara, profissional e direta, utilizando o contexto fornecido. Se o contexto for 'Nenhum', use seu conhecimento geral, mas avise que a informação não foi validada na base interna." },
        { role: "user", content: `Com base no CONTEXTO abaixo, responda à PERGUNTA.\n\nCONTEXTO:\n${contextoDaPlanilha}\n\nPERGUNTA:\n${pergunta}` }
    ];

    // Mudamos de hf.textGeneration para hf.chatCompletion
    const result = await hf.chatCompletion({
      model: modeloHf,
      messages: messages,
      parameters: {
        max_new_tokens: 300,
        temperature: 0.5,
        repetition_penalty: 1.1
      }
    });
    
    // A forma de extrair a resposta também mudou para o padrão de chat
    return result.choices[0].message.content;

  } catch (error) {
    console.error("ERRO AO CHAMAR A API DO HUGGING FACE:", error);
    return "Desculpe, não consegui processar sua pergunta com a IA do Hugging Face neste momento.";
  }
}

// --- FUNÇÃO PRINCIPAL DA API (HANDLER) COM LÓGICA COMPLETA ---
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const { pergunta, email } = req.query;
    if (!pergunta) {
      return res.status(400).json({ error: "Nenhuma pergunta fornecida." });
    }

    const perguntaNormalizada = normalizarTexto(pergunta); 
    if (perguntaNormalizada === 'credito') {
        return res.status(200).json({
          status: "clarification_needed",
          resposta: "Você quer qual informação sobre crédito?",
          options: ["Antecipação", "Crédito ao trabalhador", "Crédito pessoal"],
          source: "Planilha",
          sourceRow: 'Pergunta de Esclarecimento'
        });
    }

    const faqData = await getFaqData();
    const correspondencias = findMatches(pergunta, faqData);

    // --- LÓGICA HÍBRIDA COMPLETA ---
    
    // CASO 1: Nenhuma correspondência encontrada, usa a IA como fallback
    if (correspondencias.length === 0) {
        console.log(`Sem correspondência na planilha. Usando IA como fallback...`);
        await logIaUsage(email, pergunta);
        const respostaDaIA = await askHuggingFace(pergunta);
        return res.status(200).json({
            status: "sucesso_ia",
            resposta: respostaDaIA,
            source: "IA (Fallback)",
            sourceRow: 'Resposta da IA (Sem Contexto)'
        });
    }

    // CASO 2: Encontrou UMA resposta de alta confiança, retorna diretamente da planilha
    if (correspondencias.length === 1 || correspondencias[0].score > (correspondencias[1]?.score || 0)) {
        console.log(`Correspondência de alta confiança encontrada. Retornando direto da planilha.`);
        return res.status(200).json({
            status: "sucesso",
            resposta: correspondencias[0].resposta,
            sourceRow: correspondencias[0].sourceRow,
            tabulacoes: correspondencias[0].tabulacoes,
            source: "Planilha"
        });
    }
    
    // CASO 3: Encontrou VÁRIAS respostas, usa a IA para sintetizar (RAG)
    else {
        console.log(`Múltiplas correspondências. Usando IA para sintetizar a resposta...`);
        const contextoDaPlanilha = correspondencias
            .slice(0, 3)
            .map(c => `Tópico: ${c.perguntaOriginal}\nConteúdo: ${c.resposta}`)
            .join('\n\n---\n\n');
        const respostaDaIA = await askHuggingFace(pergunta, contextoDaPlanilha);
        return res.status(200).json({
            status: "sucesso_ia",
            resposta: respostaDaIA,
            source: "IA (com base na Planilha)",
            sourceRow: 'Resposta Sintetizada'
        });
    }
  } catch (error) {
    console.error("ERRO NO BACKEND:", error);
    return res.status(500).json({ error: "Erro interno no servidor.", details: error.message });
  }
}