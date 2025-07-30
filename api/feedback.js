// api/feedback.js

const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const LOG_SHEET_NAME = "Log_Feedback";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const dados = req.body;

    // ================================================================
    // LINHA DE DEBUG: Vamos verificar os dados recebidos
    console.log("Dados recebidos no backend de feedback:", JSON.stringify(dados, null, 2));
    // ================================================================

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const tipoFeedback = dados.action === 'logFeedbackPositivo' ? 'Positivo 👍' : 'Negativo 👎';
    
    const newRow = [
      new Date().toISOString(),
      dados.email || 'nao_fornecido',
      dados.question,
      tipoFeedback,
      dados.sourceRow,
      dados.sugestao || '' // Adiciona a sugestão, ou uma string vazia se não houver
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: LOG_SHEET_NAME,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [newRow],
      },
    });

    return res.status(200).json({ status: 'sucesso', message: 'Feedback registrado.' });

  } catch (error) {
    console.error("ERRO NO BACKEND DE FEEDBACK:", error);
    return res.status(500).json({ error: "Erro interno ao registrar feedback.", details: error.message });
  }
}