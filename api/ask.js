// api/ask.js (Versão Final Completa com Todas as Funções)

const { google } = require('googleapis');
const OpenAI = require('openai');

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const FAQ_SHEET_NAME = "FAQ!A:E"; // Lendo até à coluna E para sinónimos
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
let cache = { timestamp: null, data: null };

// --- FUNÇÕES DE APOIO (RESTAURADAS E COMPLETAS) ---

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

// Substitua sua função findMatches inteira por esta versão aprimorada
function findMatches(pergunta, faqData) {
    const cabecalho = faqData[0];
    const dados = faqData.slice(1);
    const idxPergunta = cabecalho.indexOf("Pergunta");
    const idxPalavrasChave = cabecalho.indexOf("Palavras-chave");
    const idxResposta = cabecalho.indexOf("Resposta");
    const idxSinonimos = 4; // Coluna E (A=0, B=1, C=2, D=3, E=4)

    if (idxPergunta === -1 || idxResposta === -1 || idxPalavrasChave === -1) {
        throw new Error("Colunas essenciais (Pergunta, Resposta, Palavras-chave) não encontradas.");
    }

    const palavrasDaBusca = normalizarTexto(pergunta).split(' ').filter(p => p.length > 2);
    let todasAsCorrespondencias = [];

    for (let i = 0; i < dados.length; i++) {
        const linhaAtual = dados[i];
        const textoPerguntaOriginal = linhaAtual[idxPergunta] || '';
        if (!textoPerguntaOriginal) continue;

        // >>> INÍCIO DA MELHORIA <<<
        // Agora normalizamos e combinamos o texto da Pergunta (A), Palavras-chave (B) e Sinónimos (E)
        const textoPerguntaNormalizado = normalizarTexto(textoPerguntaOriginal);
        const textoPalavrasChave = normalizarTexto(linhaAtual[idxPalavrasChave] || '');
        const textoSinonimos = normalizarTexto(linhaAtual[idxSinonimos] || '');
        
        const textoDeBuscaCombinado = `${textoPerguntaNormalizado} ${textoPalavrasChave} ${textoSinonimos}`;
        // >>> FIM DA MELHORIA <<<
        
        let relevanceScore = 0;
        palavrasDaBusca.forEach(palavra => {
            if (textoDeBuscaCombinado.includes(palavra)) {
                relevanceScore++;
            }
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

async function askOpenAI(pergunta) {
  try {
    const messages = [
        {
            role: "system",
            content: `### Persona e Objetivo
Você é um assistente virtual de suporte interno da empresa Velotax. Sua função é responder a perguntas de atendentes de forma clara, profissional e concisa, utilizando seu conhecimento sobre os seguintes tópicos:

### Tópicos Permitidos
* Antecipação do Imposto de Renda pela Velotax
* Crédito Pessoal pela Velotax
* Crédito do Trabalhador pela Velotax
* Normas, regras e produtos da Velotax
* Processos internos da Velotax
* Funcionamento do aplicativo e do site da Velotax
* Assuntos relacionados a impostos no Brasil que a Velotax ajuda a resolver.

### Regras de Comportamento
1.  **FOCO TOTAL:** Responda **somente** a perguntas relacionadas aos Tópicos Permitidos.
2.  **RECUSA DE TÓPICOS EXTERNOS:** Se a pergunta for sobre qualquer outro assunto não relacionado (como receitas, história, esportes, etc.), recuse educadamente com a frase: "Desculpe, só posso responder a perguntas sobre os processos e produtos da Velotax."
3.  **QUANDO NÃO SOUBER:** Se a pergunta estiver dentro dos tópicos permitidos, mas você não tiver certeza da resposta, diga educadamente que não possui essa informação específica no momento.
4.  **NÃO INVENTE:** É proibido criar informações ou processos que não sejam de conhecimento público sobre a empresa.`
        },
          {
            role: "user",
            content: pergunta
          }
    ];

    const chatCompletion = await openai.chat.completions.create({
      messages: messages,
      model: modeloOpenAI,
      temperature: 0.2, // Temperatura baixa para respostas mais diretas
      max_tokens: 300,
    });
    
    return chatCompletion.choices[0].message.content;

  } catch (error) {
    console.error("ERRO AO CHAMAR A API DA OPENAI:", error);
    return "Desculpe, não consegui processar sua pergunta com a IA da OpenAI neste momento.";
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
    
    if (perguntaNormalizada === 'credito') {
        return res.status(200).json({
          status: "clarification_needed",
          resposta: "Você quer qual informação sobre crédito?",
          options: ["Antecipação", "Crédito ao trabalhador", "Crédito pessoal"],
          source: "Planilha"
        });
    }

    const faqData = await getFaqData(); // <-- A função que estava a faltar
    const correspondencias = findMatches(pergunta, faqData);
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