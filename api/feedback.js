// api/feedback.js (Versão de teste - Apenas Emoji)

const { google } = require('googleapis');

// Suas configurações
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const LOG_SHEET_NAME = "Log_Feedback";

export default async function handler(req, res) {
  // Ignora completamente o que vem do frontend (req.body) para este teste.
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Cria uma linha fixa apenas com a data e o emoji para o teste.
    const newRow = [
      new Date().toISOString(),      // Coluna A
      'Teste de Envio de Emoji',     // Coluna B
      '👎'                           // Coluna C
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: LOG_SHEET_NAME,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [newRow],
      },
    });

    // Se chegou até aqui, a escrita na planilha funcionou.
    return res.status(200).json({ status: 'sucesso', message: 'Teste de emoji enviado.' });

  } catch (error) {
    // Se algo der errado, veremos o erro nos logs da Vercel.
    console.error("ERRO NO TESTE DE EMOJI:", error);
    return res.status(500).json({ error: "Erro ao registrar o teste de emoji.", details: error.message });
  }
}