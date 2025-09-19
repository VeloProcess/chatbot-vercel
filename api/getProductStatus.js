// api/getProductStatus.js (Versão com Cache)

const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const CACHE_DURATION_SECONDS = 180; // Cache de 3 minutos

const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

let cache = { timestamp: null, data: null };

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=240');

    // Verificar se as credenciais estão disponíveis
    if (!process.env.GOOGLE_CREDENTIALS) {
        console.error("GOOGLE_CREDENTIALS não configurado");
        return res.status(200).json({ 
            products: [],
            error: "Configuração de credenciais não encontrada."
        });
    }

    const now = new Date();
    
    // Verifica se o cache é válido
    if (cache.data && cache.timestamp && (now - cache.timestamp) / 1000 < CACHE_DURATION_SECONDS) {
        console.log("Servindo status de produtos do cache.");
        return res.status(200).json(cache.data);
    }

    // Timeout de 8 segundos para evitar 504
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout da API getProductStatus')), 8000);
    });

    try {
        const result = await Promise.race([
            fetchProductStatusData(),
            timeoutPromise
        ]);
        
        // Salva a nova resposta no cache
        cache = { timestamp: now, data: result };
        
        return res.status(200).json(result);
    } catch (error) {
        console.error('Erro na API getProductStatus:', error);
        return res.status(200).json({ 
            products: [],
            error: error.message === 'Timeout da API getProductStatus' ? 'Timeout - tente novamente' : 'Erro ao carregar status dos produtos'
        });
    }
};

async function fetchProductStatusData() {
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

    return { products: productsData };
}