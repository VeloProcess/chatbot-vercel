// api/feedback.js (Versão Final e Robusta)

const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const LOG_SHEET_NAME = "Log_Feedback";

export default async function handler(req, res) {
  try {
    const dados = req.body;

    // **Melhoria:** Validação e conversão de todos os dados para evitar erros
    const question = String(dados.question || 'Pergunta não informada');
    const email = String(dados.email || 'nao_fornecido');
    const sourceRow = String(dados.sourceRow !== null ? dados.sourceRow : 'N/A');
    const sugestao = String(dados.sugestao || ''); // Garante que a sugestão seja sempre uma string
    const tipoFeedback = dados.action === 'logFeedbackPositivo' ? 'Positivo 👍' : 'Negativo 👎';

    const newRow = [
      new Date().toISOString(),
      email,
      question,
      tipoFeedback,
      sourceRow,
      sugestao,
    ];

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

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
    // Log de erro para qualquer falha inesperada
    console.error("ERRO FINAL NO FEEDBACK:", error);
    return res.status(500).json({ error: "Erro interno ao registrar feedback.", details: error.message });
  }
}