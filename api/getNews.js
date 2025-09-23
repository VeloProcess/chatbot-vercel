// api/getNews.js (Versão com cache e ordenação cronológica)

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
  res.setHeader('Cache-Control', `s-maxage=${CACHE_DURATION_SECONDS}, stale-while-revalidate`);

  // Verificar se as credenciais estão disponíveis
  if (!process.env.GOOGLE_CREDENTIALS) {
    console.error("GOOGLE_CREDENTIALS não configurado");
    return res.status(200).json({ 
      news: [],
      error: "Configuração de credenciais não encontrada."
    });
  }

  const now = new Date();
  
  // Verifica se o cache é válido
  if (cache.data && cache.timestamp && (now - cache.timestamp) / 1000 < CACHE_DURATION_SECONDS) {
    console.log("Servindo notícias do cache.");
    return res.status(200).json(cache.data);
  }

  // Retornar dados padrão imediatamente para evitar timeout
  const defaultResponse = { 
    news: [
      {
        titulo: "Sistema em manutenção",
        conteudo: "As notícias estão sendo carregadas. Tente novamente em alguns instantes.",
        data: new Date().toLocaleDateString('pt-BR'),
        fonte: "Sistema"
      }
    ]
  };

  // Tentar carregar dados reais em background (não bloquear resposta)
  fetchNewsDataInBackground();
  
  return res.status(200).json(defaultResponse);
};

async function fetchNewsDataInBackground() {
  try {
    console.log("Buscando notícias em background...");
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

    // Atualizar cache com dados reais
    cache = { 
      timestamp: new Date(), 
      data: { news: newsData.reverse() } 
    };
    
    console.log("Notícias carregadas em background com sucesso");
  } catch (error) {
    console.error("Erro ao carregar notícias em background:", error);
  }
}

async function fetchNewsData() {
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

  // AQUI ESTÁ A LÓGICA CORRETA: apenas inverte a ordem
  return { news: newsData.reverse() };
}