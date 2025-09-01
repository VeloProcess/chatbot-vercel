// api/getOnlineUsers.js

const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
// O nome da sua aba e as colunas que você especificou
const SHEET_RANGE = "Dashboard_geral!K:L";

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  


  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_RANGE,
    });

    const rows = response.data.values || [];
    const users = [];

    // Começa em i = 1 para pular a linha do cabeçalho
    for (let i = 1; i < rows.length; i++) {
      const [email, status] = rows[i];
      // Adiciona à lista apenas se houver um e-mail e um status definidos
      if (email && status) {
        users.push({ email, status });
      }
    }

    return res.status(200).json({ users });

  } catch (error) {
    console.error("ERRO AO BUSCAR LISTA DE USUÁRIOS:", error);
    return res.status(500).json({ error: "Erro ao buscar a lista de usuários." });
  }
}