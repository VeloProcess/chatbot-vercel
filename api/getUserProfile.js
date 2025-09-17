// api/getUserProfile.js

const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*'); // Restrinja em produção

  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'E-mail não fornecido.' });
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Usuarios!A:B', // Lê as colunas Email e Funcao da nova aba
    });

    const rows = response.data.values || [];
    let userProfile = { email: email, funcao: 'Atendente' }; // Define 'Atendente' como padrão

    // Procura o email na lista, começando da segunda linha para ignorar o cabeçalho
    for (let i = 1; i < rows.length; i++) {
      const [userEmail, userFuncao] = rows[i];
      if (userEmail && userEmail.toLowerCase() === email.toLowerCase()) {
        userProfile.funcao = userFuncao;
        break; // Para a busca assim que encontrar o usuário
      }
    }

    return res.status(200).json(userProfile);

  } catch (error) {
    console.error("ERRO AO BUSCAR PERFIL DO USUÁRIO:", error);
    // Em caso de erro, retorna o perfil padrão para não quebrar o login
    return res.status(200).json({ email: email, funcao: 'Atendente' });
  }
};