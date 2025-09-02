// api/getNews.js (Versão com Cache)

const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const NEWS_SHEET_NAME = "Noticias!A:D";
const CACHE_DURATION_SECONDS = 180; // Cache de 3 minutos

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

let cache = { timestamp: null, data: null };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const now = new Date();
  
  // Verifica se o cache é válido
  if (cache.data && cache.timestamp && (now - cache.timestamp) / 1000 < CACHE_DURATION_SECONDS) {
    console.log("Servindo notícias do cache.");
    return res.status(200).json(cache.data);
  }

  try {
    console.log("Buscando notícias da Planilha Google.");
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: NEWS_SHEET_NAME,
    });

    const rows = response.data.values || [];
    let newsData = [];

    if (rows.length >= 2) {
      const header = rows[0];
      newsData = rows.slice(1).map(row => {
        const newsItem = {};
        header.forEach((key, index) => {
          const formattedKey = key.charAt(0).toLowerCase() + key.slice(1);
          newsItem[formattedKey] = row[index] || '';
        });
        return newsItem;
      });
    }

    const responseData = { news: newsData.reverse() };
    
    // Salva a nova resposta no cache
    cache = { timestamp: now, data: responseData };
    
    return res.status(200).json(responseData);

  } catch (error) {
    console.error("ERRO AO BUSCAR NOTÍCIAS:", error);
    return res.status(500).json({ error: "Erro interno ao buscar as notícias." });
  }
};