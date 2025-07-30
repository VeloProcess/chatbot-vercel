// api/ask.js

const { google } = require('googleapis');

// As constantes da sua planilha
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const FAQ_SHEET_NAME = "FAQ";

// Função para normalizar texto (igual à do Apps Script)
function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim();
}

// A função principal do nosso backend
export default async function handler(req, res) {
  // Configura os cabeçalhos para permitir o acesso (bom para testes locais)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Se for uma requisição OPTIONS (pre-flight), apenas retorne OK.
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { pergunta } = req.query;
    if (!pergunta) {
      return res.status(400).json({ error: "Nenhuma pergunta fornecida." });
    }

    // --- AUTENTICAÇÃO COM GOOGLE SHEETS ---
    const auth = new google.auth.GoogleAuth({
      // As credenciais virão das Variáveis de Ambiente da Vercel
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // --- BUSCA DOS DADOS NA PLANILHA ---
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: FAQ_SHEET_NAME,
    });

    const dados = response.data.values;
    if (!dados || dados.length === 0) {
      throw new Error("Não foi possível ler dados da planilha FAQ.");
    }

    const cabecalho = dados.shift();
    const idxPergunta = cabecalho.indexOf("Pergunta");
    const idxPalavrasChave = cabecalho.indexOf("Palavras-chave");
    const idxResposta = cabecalho.indexOf("Resposta");
    const idxScore = cabecalho.indexOf("Score");

    // --- LÓGICA DA BUSCA EM FUNIL (exatamente a mesma de antes) ---
    const palavrasDaBusca = normalizarTexto(pergunta).split(' ').filter(p => p);
    const termosDoFunil = [];
    while (palavrasDaBusca.length > 0) {
      termosDoFunil.push(palavrasDaBusca.join(' '));
      palavrasDaBusca.pop();
    }

    for (const termo of termosDoFunil) {
      const correspondencias = [];
      for (let i = 0; i < dados.length; i++) {
        const linhaAtual = dados[i];
        const textoPergunta = normalizarTexto(linhaAtual[idxPergunta]);
        const textoPalavrasChave = normalizarTexto(linhaAtual[idxPalavrasChave]);

        if (textoPergunta.includes(termo) || textoPalavrasChave.includes(termo)) {
          correspondencias.push({
            dados: linhaAtual[idxResposta],
            linha: i + 2,
            score: Number(linhaAtual[idxScore]) || 0
          });
        }
      }

      if (correspondencias.length > 0) {
        correspondencias.sort((a, b) => b.score - a.score);
        const melhorResultado = correspondencias[0];

        // Se encontrou, retorna a resposta e encerra
        return res.status(200).json({
          status: "sucesso",
          resposta: melhorResultado.dados,
          sourceRow: melhorResultado.linha,
        });
      }
    }

    // Se o funil inteiro não encontrou nada
    return res.status(200).json({
        status: "nao_encontrado",
        resposta: `Não encontrei informações sobre "${pergunta}".`,
        sourceRow: null,
    });

  } catch (error) {
    console.error("ERRO NO BACKEND:", error);
    return res.status(500).json({ error: "Erro interno no servidor.", details: error.message });
  }
}