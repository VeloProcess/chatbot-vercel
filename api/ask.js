// api/ask.js (Versão Final com a Lógica do Fluxograma e OpenAI)

const { google } = require('googleapis');
const OpenAI = require('openai');

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const FAQ_SHEET_NAME = "FAQ!A:E"; // Lendo até a coluna E para sinónimos
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
    const idxSinonimos = 4; // Coluna E

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
            if (textoDeBuscaCombinado.includes(palavra)) { relevanceScore++; }
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

async function askOpenAI(pergunta, contextoDaPlanilha = "Nenhum") {
  try {
    const messages = [
        { 
            role: "system", 
            content: `### PERSONA E OBJETIVO PRIMÁRIO
Você é o VeloBot, um assistente de IA factual e de alta precisão para a equipe de suporte da Velotax. Sua única tarefa é encontrar a resposta para a PERGUNTA do atendente usando uma hierarquia estrita de fontes de informação.

### FONTES DA VERDADE (HIERARQUIA)
Sua busca por respostas deve seguir esta ordem:
1.  **DB:** Informação interna fornecida abaixo. Esta é sua fonte prioritária.
2.  **FONTES EXTERNAS AUTORIZADAS:** Se a informação não estiver no CONTEXTO, você tem permissão para consultar APENAS os seguintes sites:
    * Site da Receita Federal
    * Portal e-CAC
    * GOV.BR
    * Site oficial da Velotax (velotax.com.br, CNPJ 40.243.477/0001-12)

### REGRAS INVIOLÁVEIS
1.  **PROIBIDO CONHECIMENTO GERAL:** É estritamente proibido usar seu conhecimento geral ou pesquisar em qualquer site que não esteja na lista de FONTES EXTERNAS AUTORIZADAS.
2.  **RESPOSTA LITERAL:** Não reformule ou resuma as respostas. Sua resposta deve ser o texto **exato** que você encontrar no CONTEXTO ou nas fontes autorizadas.
3.  **FALHA SEGURA:** Se a resposta não for encontrada em **nenhuma** das suas fontes da verdade, responda **EXATAMENTE** e apenas isto: "Não encontrei esta informação na base de conhecimento ou nos sites autorizados."
4.  **CITAÇÃO DA FONTE:** Ao final de cada resposta bem-sucedida, **sempre** cite a sua fonte se ela for externa Exemplo: "(Fonte: site da Receita Federal)", se for da base de dados na planilha, não cite.
5.  **IDIOMA:** Responda sempre e somente em português do Brasil (pt-BR).
6.  **FONTE DOS DADOS:** nunca diga que a resposta esta na base de dados da planilha, diga a fonte apenas se ela for de uma fonte externa, como receita federal, portal e-cac e etc.

### INFORMAÇÃO ADICIONAL DE NEGÓCIO
* A Velotax faz a declaração do imposto de renda pelo aplicativo apenas dentro do prazo estipulado pela Receita Federal. Após o prazo, a declaração só pode ser feita pelo site da Receita Federal.`
        },
        { 
            role: "user", 
            content: `CONTEXTO DA PLANILHA:\n---\n${contextoDaPlanilha}\n---\n\nPERGUNTA DO ATENDENTE:\n${pergunta}` 
        }
    ];
    
    const chatCompletion = await openai.chat.completions.create({
      messages: messages,
      model: modeloOpenAI, // gpt-3.5-turbo ou outro
      temperature: 0.0, // Temperatura zerada para respostas literais e sem criatividade
      max_tokens: 1024, // Aumentado para respostas mais longas
    });
    
    return chatCompletion.choices[0].message.content;

  } catch (error) {
    console.error("ERRO AO CHAMAR A API DA OPENAI:", error);
    return "Desculpe, não consegui processar sua pergunta com a IA neste momento.";
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

    const faqData = await getFaqData();
    const correspondencias = findMatches(pergunta, faqData);
    const palavras = pergunta.trim().split(/\s+/);

    // --- LÓGICA DO FLUXOGRAMA ---

    // FLUXO 1: Pergunta curta (palavra-chave)
    if (palavras.length <= 3) {
      console.log("Pergunta curta detectada. Buscando direto na planilha...");

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