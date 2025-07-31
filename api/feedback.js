// api/feedback.js (Versão Final com Ordem de Dados Otimizada)

const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const LOG_SHEET_NAME = "Log_Feedback";

export default async function handler(req, res) {
  try {
    const dados = req.body;

    // 1. Prepara a autenticação primeiro
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 2. Prepara e limpa os dados para a nova linha
    const tipoFeedback = dados.action === 'logFeedbackPositivo' ? 'Positivo 👍' : 'Negativo 👎';
    
    const newRow = [
      new Date().toISOString(),
      String(dados.email || 'nao_fornecido'),
      String(dados.question || 'N/A'),
      tipoFeedback,
      String(dados.sourceRow !== null ? dados.sourceRow : 'N/A'),
      String(dados.sugestao || '') // Garante que a sugestão seja sempre um texto
    ];

    // 3. Envia os dados já prontos
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
    console.error("ERRO FINAL NO FEEDBACK:", error);
    return res.status(500).json({ error: "Erro interno ao registrar feedback.", details: error.message });
  }
}