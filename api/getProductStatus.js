// api/getProductStatus.js (Versão com Cache)

const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const CACHE_DURATION_SECONDS = 180; // Cache de 3 minutos

const auth = new google.auth.GoogleAuth({
    credentials: process.env.GOOGLE_CREDENTIALS ? JSON.parse(process.env.GOOGLE_CREDENTIALS) : {},
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

let cache = { timestamp: null, data: null };

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=240');

        const now = new Date();
    
  // Verifica se o cache é válido
    if (cache.data && cache.timestamp && (now - cache.timestamp) / 1000 < CACHE_DURATION_SECONDS) {
    console.log("Servindo status de produtos do cache.");
    return res.status(200).json(cache.data);
    }

    try {
    console.log("Buscando status de produtos da Planilha Google.");
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'StatusProdutos!A:B',
    });

    const rows = response.data.values || [];
    let productsData = [];

    if (rows.length >= 2) {
        productsData = rows.slice(1).map(row => ({
        produto: row[0],
        status: row[1]
        }));
    }

    const responseData = { products: productsData };

    // Salva a nova resposta no cache
    cache = { timestamp: now, data: responseData };

    return res.status(200).json(responseData);

    } catch (error) {
    console.error("ERRO AO BUSCAR STATUS DOS PRODUTOS:", error);
    console.error("Detalhes do erro:", {
        message: error.message,
        code: error.code,
        status: error.status
    });
    
    // Retornar dados vazios em caso de erro para não quebrar a interface
    return res.status(200).json({ 
        products: [],
        error: "Não foi possível carregar o status dos produtos no momento."
    });
    }
};