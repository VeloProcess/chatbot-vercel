// api/getNews.js

const { google } = require('googleapis');

// --- CONFIGURAÇÃO ---
// Recomendo usar Variáveis de Ambiente para isso, como em seus outros arquivos.
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const NEWS_SHEET_NAME = "Noticias!A:D"; // O intervalo exato que queremos ler

// --- CLIENTE GOOGLE SHEETS ---
const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'], // Apenas leitura é necessário
});

const sheets = google.sheets({ version: 'v4', auth });

// --- A FUNÇÃO PRINCIPAL DA API (HANDLER) ---
module.exports = async function handler(req, res) {
  // --- CONFIGURAÇÃO CORS ---
  // IMPORTANTE: Em produção, restrinja para a URL do seu site.
            res.setHeader('Access-Control-Allow-Origin', '*'); 
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
    return res.status(200).end();
    }

    try {
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: NEWS_SHEET_NAME,
    });

    const rows = response.data.values || [];

    if (rows.length < 2) {
      // Se não houver dados (só o cabeçalho ou vazio)
        return res.status(200).json({ news: [] });
    }

    // Transforma o array de arrays em um array de objetos (muito melhor para o frontend)
    const header = rows[0];
    const newsData = rows.slice(1).map(row => {
        const newsItem = {};
        header.forEach((key, index) => {
        // Normaliza o nome da chave para ser usado em JS (ex: "PublicadoEm" -> "publicadoEm")
        const formattedKey = key.charAt(0).toLowerCase() + key.slice(1);
        newsItem[formattedKey] = row[index] || '';
        });
        return newsItem;
    });

      const reversedNews = newsData.reverse();

    // Agora, define a ordem de prioridade
    const priorityOrder = {
      'critico': 1,
      'alerta': 2,
      'info': 3
    };

    // Ordena a lista com base na prioridade
    reversedNews.sort((a, b) => {
      const priorityA = priorityOrder[a.tipo] || 4; // Se o tipo não existir, fica por último
      const priorityB = priorityOrder[b.tipo] || 4;
      return priorityA - priorityB;
    });

    // Envia os dados agora ordenados por prioridade
    return res.status(200).json({ news: reversedNews });
    } catch (error) {
    console.error("ERRO AO BUSCAR NOTÍCIAS:", error);
    return res.status(500).json({ 
        error: "Erro interno ao buscar as notícias.", 
        details: error.message 
    });
    }
    
};