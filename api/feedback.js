// api/feedback.js (versão com mais logs para depuração)

const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const LOG_SHEET_NAME = "Log_Feedback";

export default async function handler(req, res) {
  console.log("============= INÍCIO DA REQUISIÇÃO DE FEEDBACK =============");

  if (req.method !== 'POST') {
    console.log(`Método ${req.method} não permitido.`);
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const dados = req.body;
    console.log("DADOS RECEBIDOS DO FRONTEND:", JSON.stringify(dados, null, 2));

    if (!process.env.GOOGLE_CREDENTIALS) {
        console.error("ERRO GRAVE: A variável de ambiente GOOGLE_CREDENTIALS não está definida!");
        return res.status(500).json({ error: "Configuração do servidor incompleta." });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    console.log("Autenticação com Google iniciada com sucesso.");

    const sheets = google.sheets({ version: 'v4', auth });

    const tipoFeedback = dados.action === 'logFeedbackPositivo' ? 'Positivo 👍' : 'Negativo 👎';

    const newRow = [
      new Date().toISOString(),
      dados.email || 'nao_fornecido',
      dados.question,
      tipoFeedback,
      dados.sourceRow,
      dados.sugestao || ''
    ];
    console.log("LINHA PREPARADA PARA ENVIO:", newRow);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: LOG_SHEET_NAME,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [newRow],
      },
    });
    console.log("SUCESSO: Linha enviada para a Planilha Google.");

    console.log("============= FIM DA REQUISIÇÃO DE FEEDBACK =============");
    return res.status(200).json({ status: 'sucesso', message: 'Feedback registado.' });

  } catch (error) {
    console.error("!!!!!!!!!! ERRO NO BACKEND DE FEEDBACK !!!!!!!!!!:", error);
    console.log("============= FIM DA REQUISIÇÃO DE FEEDBACK (COM ERRO) =============");
    return res.status(500).json({ error: "Erro interno ao registar feedback.", details: error.message });
  }
}