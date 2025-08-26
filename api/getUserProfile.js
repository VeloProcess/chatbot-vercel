// api/getUserProfile.js

const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const USER_SHEET_NAME = "Usuarios!A:B"; // Colunas Email e Funcao

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // ... (outros headers CORS se necessário) ...

  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: "Email não fornecido." });
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: USER_SHEET_NAME,
    });

    const rows = response.data.values || [];
    let userProfile = { email, funcao: 'Atendente' }; // Padrão é Atendente

    // Pula o cabeçalho
    for (let i = 1; i < rows.length; i++) {
      const [userEmail, userFuncao] = rows[i];
      if (userEmail && userEmail.toLowerCase() === email.toLowerCase()) {
        userProfile.funcao = userFuncao;
        break; // Encontrou o usuário, pode parar
      }
    }

    return res.status(200).json(userProfile);

  } catch (error) {
    console.error("ERRO AO BUSCAR PERFIL DO USUÁRIO:", error);
    return res.status(500).json({ error: "Erro ao verificar permissões." });
  }
}