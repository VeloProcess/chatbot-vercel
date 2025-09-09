// api/ask.js (Versão Final com busca por Sinônimos e Lógica do Fluxograma)

const { google } = require('googleapis');
const OpenAI = require('openai');

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const FAQ_SHEET_NAME = "FAQ!A:D";
const SINONIMOS_SHEET_NAME = "Sinonimos!A:B"; // <<< NOVO
const CACHE_DURATION_SECONDS = 0;

// --- CONFIGURAÇÃO DA IA (OPENAI) ---
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const modeloOpenAI = "gpt-3.5-turbo";

// --- CLIENTE GOOGLE SHEETS ---
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// --- FUNÇÕES DE APOIO ---

async function getSheetData() {
    // Usando batchGet para buscar FAQs e Sinônimos de uma vez, de forma eficiente
    const response = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: SPREADSHEET_ID,
        ranges: [FAQ_SHEET_NAME, SINONIMOS_SHEET_NAME],
    });
    const faqData = response.data.valueRanges[0].values;
    const sinonimosData = response.data.valueRanges[1].values;

    if (!faqData || faqData.length === 0) {
        throw new Error("Não foi possível ler dados da planilha FAQ ou ela está vazia.");
    }
    return { faqData, sinonimosData };
}

function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim();
}

async function logIaUsage(email, pergunta) { /* ... (continua o mesmo) ... */ }

// >>> FUNÇÃO FINDMATCHES ATUALIZADA PARA USAR SINÔNIMOS <<<
function findMatches(pergunta, faqData, sinonimosData) {
    // 1. Criar um mapa de sinônimos para busca rápida
    const mapaSinonimos = new Map();
    if (sinonimosData && sinonimosData.length > 1) {
        sinonimosData.slice(1).forEach(row => {
            const palavra = normalizarTexto(row[0]);
            const listaSinonimos = (row[1] || '').split(',').map(s => normalizarTexto(s));
            if (palavra) {
                mapaSinonimos.set(palavra, listaSinonimos);
            }
        });
    }

    // 2. Expandir as palavras da busca com sinônimos
    const palavrasDaBusca = normalizarTexto(pergunta).split(' ').filter(p => p.length > 2);
    let palavrasExpandidas = [...palavrasDaBusca];

    palavrasDaBusca.forEach(palavra => {
        if (mapaSinonimos.has(palavra)) {
            palavrasExpandidas.push(...mapaSinonimos.get(palavra));
        }
    });
    // Remove duplicatas
    palavrasExpandidas = [...new Set(palavrasExpandidas)];
    console.log("Termos de busca (com sinônimos):", palavrasExpandidas);


    // 3. O resto da lógica de busca continua, mas usando a lista expandida
    const cabecalho = faqData[0];
    const dados = faqData.slice(1);
    const idxPergunta = cabecalho.indexOf("Pergunta");
    const idxPalavrasChave = cabecalho.indexOf("Palavras-chave");
    const idxResposta = cabecalho.indexOf("Resposta");
    if (idxPergunta === -1 || idxResposta === -1 || idxPalavrasChave === -1) {
        throw new Error("Colunas essenciais (Pergunta, Resposta, Palavras-chave) não encontradas.");
    }
    
    let todasAsCorrespondencias = [];
    for (let i = 0; i < dados.length; i++) {
        const linhaAtual = dados[i];
        const textoPerguntaOriginal = linhaAtual[idxPergunta] || '';
        if (!textoPerguntaOriginal) continue;
        
        const textoPalavrasChave = normalizarTexto(linhaAtual[idxPalavrasChave] || '');
        let relevanceScore = 0;

        // A busca agora usa a lista expandida de palavras
        palavrasExpandidas.forEach(palavra => {
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
    // ... (resto da função findMatches continua igual)
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

async function askOpenAI(pergunta, contextoDaPlanilha = "Nenhum") { /* ... (continua o mesmo) ... */ }

// --- FUNÇÃO PRINCIPAL DA API (HANDLER) ---
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const { pergunta, email } = req.query;
    if (!pergunta) {
      return res.status(400).json({ error: "Nenhuma pergunta fornecida." });
    }

    // Busca os dados das duas abas (FAQ e Sinonimos)
    const { faqData, sinonimosData } = await getSheetData();
    // Passa os sinônimos para a função de busca
    const correspondencias = findMatches(pergunta, faqData, sinonimosData);
    
    const palavras = pergunta.trim().split(/\s+/);

    // --- LÓGICA DO FLUXOGRAMA ---
    if (palavras.length <= 3) {
        console.log("Pergunta curta detectada. Buscando direto na planilha...");
        if (correspondencias.length === 1 || (correspondencias.length > 1 && correspondencias[0].score > (correspondencias[1]?.score || 0))) {
            return res.status(200).json({ status: "sucesso", /*...*/ });
        } else if (correspondencias.length > 1) {
            return res.status(200).json({ status: "clarification_needed", /*...*/ });
        }
    }
    
    // FLUXO 2: Pergunta complexa ou palavra-chave sem resposta direta, aciona a IA
    console.log("Pergunta complexa ou sem correspondência direta. Usando IA...");
    
    if (correspondencias.length === 0) {
      // Caso 2a: Não encontrou NADA, usa a IA como fallback.
      await logIaUsage(email, pergunta);
      const respostaDaIA = await askOpenAI(pergunta);
      return res.status(200).json({
        status: "sucesso_ia",
        resposta: respostaDaIA,
        source: "IA (Fallback)",
        sourceRow: 'Resposta da IA (Sem Contexto)'
      });
    } else {
      // Caso 2b: Encontrou contexto, usa a IA para sintetizar a resposta (RAG).
      const contextoDaPlanilha = correspondencias
        .slice(0, 3)
        .map(c => `Tópico: ${c.perguntaOriginal}\nConteúdo: ${c.resposta}`)
        .join('\n\n---\n\n');
      const respostaDaIA = await askOpenAI(pergunta, contextoDaPlanilha);
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