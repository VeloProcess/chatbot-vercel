// api/getProductStatus.js

const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Restrinja em produção

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'StatusProdutos!A:B',
    });

    const rows = response.data.values || [];

    if (rows.length < 2) {
      return res.status(200).json({ products: [] });
    }

    const header = rows[0];
    const productsData = rows.slice(1).map(row => ({
      produto: row[0],
      status: row[1]
    }));

    return res.status(200).json({ products: productsData });

  } catch (error) {
    console.error("ERRO AO BUSCAR STATUS DOS PRODUTOS:", error);
    return res.status(500).json({ error: "Erro interno ao buscar status." });
  }
};