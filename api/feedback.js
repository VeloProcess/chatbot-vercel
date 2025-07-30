// api/feedback.js

const { google } = require('googleapis');

// As constantes da sua planilha
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const LOG_SHEET_NAME = "Log_Feedback"; // A aba onde os feedbacks são salvos

// A função principal do nosso backend de feedback
export default async function handler(req, res) {
  // 1. Garantir que a requisição é um POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Vercel já converte o corpo da requisição para JSON automaticamente
    const dados = req.body;

    // 2. Autenticar com a API do Google Sheets
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Escopo de escrita
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 3. Preparar a nova linha para adicionar à planilha
    const tipoFeedback = dados.action === 'logFeedbackPositivo' ? 'Positivo 👍' : 'Negativo 👎';
    
    const newRow = [
      new Date().toISOString(),         // Timestamp
      dados.email || 'nao_fornecido',     // Email do Atendente
      dados.question,                     // Pergunta Original
      tipoFeedback,                       // Tipo de Feedback
      dados.sourceRow                     // Linha da Fonte na FAQ
    ];

    // 4. Adicionar a nova linha à planilha usando o método 'append'
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: LOG_SHEET_NAME, // A mágica acontece aqui: 'append' adiciona ao final
      valueInputOption: 'USER_ENTERED', // Trata os dados como se tivessem sido digitados pelo usuário
      resource: {
        values: [newRow],
      },
    });

    // 5. Retornar uma resposta de sucesso
    return res.status(200).json({ status: 'sucesso', message: 'Feedback registrado.' });

  } catch (error) {
    console.error("ERRO NO BACKEND DE FEEDBACK:", error);
    return res.status(500).json({ error: "Erro interno ao registrar feedback.", details: error.message });
  }
}