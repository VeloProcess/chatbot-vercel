// api/ask.js (Versão com Busca Semântica por Embeddings)

const { google } = require('googleapis');
const OpenAI = require('openai');
const cosineSimilarity = require('cosine-similarity');

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const FAQ_SHEET_NAME = "FAQ!A:F"; // Lendo até a coluna F para Embeddings

// --- CONFIGURAÇÃO DA IA (OPENAI) ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const modeloOpenAI = "gpt-3.5-turbo";

// --- CLIENTE GOOGLE SHEETS ---
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
let cache = { timestamp: null, data: null }; // O cache ainda pode ser útil

// --- FUNÇÕES DE APOIO ---
async function getFaqData() {
  // A função getFaqData continua a mesma, mas agora busca até a coluna F
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: FAQ_SHEET_NAME,
  });
  if (!response.data.values || response.data.values.length === 0) {
    throw new Error("Não foi possível ler dados da planilha FAQ.");
  }
  return response.data.values;
}

// >>> NOVA FUNÇÃO DE BUSCA SEMÂNTICA <<<
async function findSemanticMatches(pergunta, faqData) {
  const header = faqData[0];
  const data = faqData.slice(1);
  const SIMILARITY_THRESHOLD = 0.75; // Limiar de confiança (ajuste se necessário)

  console.log("1. Gerando embedding para a pergunta do usuário...");
  const questionEmbeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: pergunta,
  });
  const questionVector = questionEmbeddingResponse.data[0].embedding;

  console.log("2. Calculando similaridade com a base de conhecimento...");
  const allMatches = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const embeddingString = row[5]; // Coluna F (Embedding)
    if (embeddingString) {
      try {
        const storedVector = JSON.parse(embeddingString);
        const similarity = cosineSimilarity(questionVector, storedVector);
        
        if (similarity > SIMILARITY_THRESHOLD) {
          allMatches.push({
            resposta: row[2], // Coluna C
            perguntaOriginal: row[0], // Coluna A
            sourceRow: i + 2,
            score: similarity,
            tabulacoes: row[3] || null, // Coluna D
          });
        }
      } catch (e) {
        console.warn(`Aviso: Falha ao parsear embedding na linha ${i + 2}.`);
      }
    }
  }

  allMatches.sort((a, b) => b.score - a.score);
  console.log(`3. Encontradas ${allMatches.length} correspondências acima do limiar.`);
  return allMatches;
}


async function askOpenAI(pergunta, contextoDaPlanilha = "Nenhum") {
  try {
    const messages = [
      { 
        role: "system", 
        content: `
Você é o VeloBot, um assistente de IA de alta precisão especializado em atendimento Velotax.
Regras principais:
1. Você só pode responder se o tópico da pergunta existir na base da planilha.
2. Se o item não estiver na planilha, responda apenas: "Não encontrei essa informação na base da Velotax, pode reformular para eu analisar melhor e procurar sua resposta?."
3. Quando o item existir na planilha, você pode complementar a resposta pesquisando em fontes oficiais (ex.: Receita Federal, gov.br) para enriquecer a explicação, mas nunca criar nada fora do escopo.
4. A pesquisa externa serve apenas para atualizar ou detalhar informações dentro dos tópicos listados.
5. Categorias válidas: Antecipação, App, Crédito do Trabalhador, Crédito Pessoal, Declaração/IRPF, Restituição, Veloprime, PIX e Outros (somente os itens listados).
6. Sempre priorize o conteúdo da planilha. Se usar pesquisa externa, deixe claro que foi para complementar dentro do mesmo tópico.
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
    .normalize('NFD') // Separa os acentos das letras
    .replace(/[\u0300-\u036f]/g, ''); // Remove os acentos
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
    
    if (perguntaNormalizada === 'credito') {
        return res.status(200).json({
          status: "clarification_needed",
          resposta: "Você quer qual informação sobre crédito?",
          options: ["Antecipação", "Crédito ao trabalhador", "Crédito pessoal"],
          source: "Planilha"
        });
    }

    const faqData = await getFaqData(); // <-- A função que estava a faltar
    const correspondencias = await findSemanticMatches(pergunta, faqData);
    const palavras = pergunta.trim().split(/\s+/);
    
    if (palavras.length <= 3) {
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
          resposta: `Encontrei vários tópicos sobre "${pergunta}". Qual deles se encaixa melhor?`,
          options: correspondencias.map(c => c.perguntaOriginal).slice(0, 8),
          source: "Planilha",
          sourceRow: 'Pergunta de Esclarecimento'
        });
      }
    }
    
    if (correspondencias.length === 0) {
      await logIaUsage(email, pergunta);
      const respostaDaIA = await askOpenAI(pergunta);
      return res.status(200).json({
        status: "sucesso_ia",
        resposta: respostaDaIA,
        source: "IA (Fallback)",
        sourceRow: 'Resposta da IA (Sem Contexto)'
      });
    } else {
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