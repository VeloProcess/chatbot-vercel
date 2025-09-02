// api/ask.js (Versão Final com IA Híbrida e Busca Otimizada)

const { google } = require('googleapis');
// Importa a biblioteca da IA do Google
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const FAQ_SHEET_NAME = "FAQ!A:D";
const CACHE_DURATION_SECONDS = 0; // Cache desativado para atualizações instantâneas

// --- CONFIGURAÇÃO DA IA ---
// Pega a chave de API das variáveis de ambiente do seu provedor de hospedagem (ex: Vercel)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"}); // Modelo rápido e eficiente

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
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim();
}

async function logIaUsage(email, pergunta) {
  try {
    const timestamp = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo'
    });
    
    const newRow = [timestamp, email, pergunta];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Log_IA_Usage', // O nome da nova aba
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [newRow],
      },
    });
    console.log("Uso da IA registrado com sucesso.");
  } catch (error) {
    // É importante que um erro no log não quebre a resposta para o usuário.
    console.error("ERRO AO REGISTRAR USO DA IA:", error);
  }
}

// Lógica de busca atualizada para usar APENAS a coluna de palavras-chave
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
    const textoPerguntaOriginal = linhaAtual[idxPergunta] || '';
    if (!textoPerguntaOriginal) continue;

    // A busca agora ocorre apenas no texto das palavras-chave
    const textoPalavrasChave = normalizarTexto(linhaAtual[idxPalavrasChave] || '');
    
    let relevanceScore = 0;
    palavrasDaBusca.forEach(palavra => {
      if (textoPalavrasChave.includes(palavra)) {
        relevanceScore++;
      }
    });

    if (relevanceScore > 0) {
    todasAsCorrespondencias.push({
      resposta: linhaAtual[idxResposta],
      perguntaOriginal: textoPerguntaOriginal,
      sourceRow: i + 2,
      score: relevanceScore,
      tabulacoes: linhaAtual[3] || null // Adiciona o conteúdo da coluna D
    });
    }
  }
  
  // Lógica de desduplicação e ordenação
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

// Função para consultar a IA
async function askGemini(pergunta) {
  try {
    const prompt = `
### Persona
Você é o Veloprocess, um assistente de IA especialista nos processos e produtos internos da empresa Velotax. Seu objetivo é auxiliar os atendentes de suporte (N1) a encontrarem respostas rápidas, precisas e seguras para ajudarem os clientes finais.
### Contexto da Empresa
A Velotax é uma fintech que simplifica a vida tributária e financeira dos brasileiros, oferecendo produtos como declaração de impostos, antecipação de restituição, e linhas de crédito.
### Regras e Tarefa
Você receberá uma PERGUNTA de um atendente e, opcionalmente, um CONTEXTO extraído da nossa base de conhecimento interna. Siga estas regras rigorosamente:
1.  **PRIORIDADE AO CONTEXTO:** Se o CONTEXTO for fornecido, sua resposta deve se basear **EXCLUSIVAMENTE** nele. Não adicione informações externas ou suposições. Se a resposta não estiver no contexto, afirme que a informação específica não foi encontrada nos trechos fornecidos.
2.  **SEM CONTEXTO:** Se nenhum CONTEXTO for fornecido, responda à pergunta com base no seu conhecimento geral sobre o assunto, mas sempre adicione uma ressalva como: "Esta informação é baseada em conhecimento geral e não foi validada em nossa base de processos interna." Se você não souber a resposta, seja honesto e diga que não encontrou essa informação.
3.  **SEJA ACIONÁVEL E DIRETO:** Forneça respostas que ajudem o atendente a agir. Se for um procedimento, use passos numerados (1., 2., 3.). Se for uma lista de itens, use bullet points (*). Use **negrito** para destacar informações críticas como prazos, valores, nomes de documentos ou ações importantes.
4.  **TOM E LINGUAGEM:** Mantenha um tom profissional, prestativo e confiante. Dirija-se ao atendente como um colega de equipe. Evite linguagem casual ou gírias.
5.  **FOCO NO ESCOPO:** Responda apenas a perguntas relacionadas aos processos e produtos da Velotax. Se a pergunta for inadequada ou claramente fora de escopo (ex: "qual a capital da Mongólia?"), recuse-se a responder educadamente.
---
**CONTEXTO FORNECIDO PELA BASE DE CONHECIMENTO:**
"""${contextoDaPlanilha}
"""
**PERGUNTA DO ATENDENTE:**
"${pergunta}"
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error("ERRO AO CHAMAR A API DO GEMINI:", error);
    return "Desculpe, não consegui processar sua pergunta com a IA neste momento. Tente novamente mais tarde.";
  }
}


// --- FUNÇÃO PRINCIPAL DA API (HANDLER) ---
module.exports = async function handler(req, res) {
  // Configuração do CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
    
  try {
    const { pergunta, email } = req.query;
    if (!pergunta) {
      return res.status(400).json({ error: "Nenhuma pergunta fornecida." });
    }

    // --- NOVO BLOCO PARA O MENU 'CRÉDITO' ---
    // Normalizamos a pergunta para uma verificação limpa.
    const perguntaNormalizada = normalizarTexto(pergunta); 
    
    // Se a pergunta for EXATAMENTE "crédito", retorna as opções imediatamente.
    if (perguntaNormalizada === 'credito') {
        return res.status(200).json({
          status: "clarification_needed",
          resposta: "Você quer qual informação sobre crédito?",
          options: ["Antecipação", "Crédito ao trabalhador", "Crédito pessoal"],
          source: "Planilha" // A fonte é a planilha, pois as opções levarão a respostas de lá.
        });
    }
    // --- FIM DO NOVO BLOCO ---

    const faqData = await getFaqData();
    const correspondencias = findMatches(pergunta, faqData);

    // --- LÓGICA HÍBRIDA ---
    // Se não encontrar correspondências na planilha, consulta a IA.
    if (correspondencias.length === 0) {
      console.log(`Sem correspondência na planilha para "${pergunta}". Consultando a IA...`);
      await logIaUsage(email, pergunta); // Registra que a IA foi acionada
      const respostaDaIA = await askGemini(pergunta);
      
      return res.status(200).json({
          status: "sucesso_ia",
          resposta: respostaDaIA,
          source: "IA" // Informa ao frontend que a resposta veio da IA
      });
    }

    // Se encontrar, usa a lógica de decisão original.
    if (correspondencias.length === 1 || correspondencias[0].score > correspondencias[1].score) {
      return res.status(200).json({
        status: "sucesso",
        resposta: correspondencias[0].resposta,
        sourceRow: correspondencias[0].sourceRow,
        tabulacoes: correspondencias[0].tabulacoes, // Envia as tabulações para o frontend
        source: "Planilha"
      });
    } else {
      return res.status(200).json({
        status: "clarification_needed",
        resposta: `Encontrei vários tópicos sobre "${pergunta}". Qual deles se encaixa melhor na sua dúvida?`,
        options: correspondencias.map(c => c.perguntaOriginal).slice(0, 10),
        source: "Planilha"
      });
    }
  } catch (error) {
    console.error("ERRO NO BACKEND:", error);
    return res.status(500).json({ error: "Erro interno no servidor.", details: error.message });
  }
}