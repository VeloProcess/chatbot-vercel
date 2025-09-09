// api/ask.js (Versão Simplificada SEM EMBEDDINGS)

const { google } = require('googleapis');
const OpenAI = require('openai');
// REMOVIDO: a dependência cosine-similarity não é mais necessária

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
// ALTERADO: Agora lê apenas as colunas A, B, C, D
const FAQ_SHEET_NAME = "FAQ!A:D"; 

// --- CONFIGURAÇÃO DA IA (OPENAI) ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const modeloOpenAI = "gpt-3.5-turbo";

// --- CLIENTE GOOGLE SHEETS ---
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// --- FUNÇÕES DE APOIO ---
async function getFaqData() {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: FAQ_SHEET_NAME,
  });
  if (!response.data.values || response.data.values.length === 0) {
    throw new Error("Não foi possível ler dados da planilha FAQ.");
  }
  return response.data.values;
}

// REMOVIDA: A função findSemanticMatches foi completamente removida.

async function askOpenAI(pergunta, contextoDaPlanilha = "Nenhum") {
  try {
    const messages = [
      { 
        role: "system", 
        content: `
Você é o VeloBot, um assistente de IA de alta precisão especializado em atendimento Velotax.
Regras principais:
1. Responda com base no CONTEXTO fornecido. O contexto vem da nossa base de conhecimento interna e é a fonte da verdade.
2. Se o CONTEXTO for "Nenhum", significa que não encontramos um tópico relacionado na nossa base. Nesse caso, responda apenas: "Não encontrei essa informação na base da Velotax, pode reformular para eu analisar melhor e procurar sua resposta?."
3. Use o CONTEXTO para formular uma resposta completa e útil para o atendente.
`
      },
      { 
        role: "user", 
        content: `CONTEXTO:\n---\n${contextoDaPlanilha}\n---\n\nPERGUNTA DO ATENDENTE:\n${pergunta}` 
      }
    ];

    const chatCompletion = await openai.chat.completions.create({
      messages: messages,
      model: modeloOpenAI,
      temperature: 0.1,
      max_tokens: 1024,
    });
    return chatCompletion.choices[0].message.content;
  } catch (error) {
    console.error("ERRO AO CHAMAR A API DA OPENAI:", error);
    return "Desculpe, não consegui processar sua pergunta com a IA neste momento.";
  }
}

function normalizarTexto(texto) {
  if (!texto) return '';
  return texto
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u00e0-\u00e5]/g, 'a') // Adicionado para normalizar variações de 'a'
    .replace(/[\u00e8-\u00eb]/g, 'e') // Adicionado para normalizar variações de 'e'
    .replace(/[\u00ec-\u00ef]/g, 'i') // Adicionado para normalizar variações de 'i'
    .replace(/[\u00f2-\u00f6]/g, 'o') // Adicionado para normalizar variações de 'o'
    .replace(/[\u00f9-\u00fc]/g, 'u') // Adicionado para normalizar variações de 'u'
    .replace(/[\u00e7]/g, 'c')       // Adicionado para normalizar 'ç'
    .replace(/[\u0300-\u036f]/g, '');
}


async function logIaUsage(email, pergunta) {
  try {
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const LOG_IA_SHEET_NAME = 'Log_IA_Usage';
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: LOG_IA_SHEET_NAME,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[timestamp, email || 'nao_fornecido', pergunta]],
      },
    });
    console.log('Pergunta registrada no log de uso da IA.');
  } catch (error) {
    console.warn('AVISO: Falha ao registrar o uso da IA na planilha.', error.message);
  }
}

// --- FUNÇÃO PRINCIPAL DA API (HANDLER) ---
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
    const faqData = await getFaqData();
    const header = faqData.shift(); // Remove o cabeçalho

    // LÓGICA SIMPLIFICADA: Busca por palavra-chave na pergunta
    const correspondencias = faqData.filter(row => {
        const perguntaDaPlanilha = normalizarTexto(row[0] || ''); // Coluna A: Pergunta
        return perguntaDaPlanilha.includes(perguntaNormalizada);
    });

    let contextoDaPlanilha = "Nenhum";
    let sourceRow = 'Resposta da IA (Sem Contexto)';

    if (correspondencias.length > 0) {
      // Se encontrou, monta o contexto para a IA
      contextoDaPlanilha = correspondencias
        .map(c => `Tópico: ${c[0]}\nConteúdo: ${c[2]}`) // c[0] = Pergunta, c[2] = Resposta
        .join('\n\n---\n\n');
      sourceRow = 'Resposta Sintetizada pela IA';
      console.log(`Contexto encontrado para a pergunta "${pergunta}"`);
    } else {
      // Se não encontrou, registra no log de uso da IA
      await logIaUsage(email, pergunta);
      console.log(`Nenhum contexto encontrado para "${pergunta}". Enviando para IA sem contexto.`);
    }

    // A IA sempre gera a resposta final, mas com ou sem contexto da planilha.
    const respostaDaIA = await askOpenAI(pergunta, contextoDaPlanilha);
    
    return res.status(200).json({
      status: "sucesso_ia",
      resposta: respostaDaIA,
      source: contextoDaPlanilha !== "Nenhum" ? "IA (com base na Planilha)" : "IA (Fallback)",
      sourceRow: sourceRow
    });

  } catch (error) {
    console.error("ERRO NO BACKEND:", error);
    return res.status(500).json({ error: "Erro interno no servidor.", details: error.message });
  }
}