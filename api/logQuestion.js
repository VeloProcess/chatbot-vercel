// api/logQuestion.js

const { google } = require('googleapis');

// ID da sua planilha
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ"; 
// NOME DA ABA ONDE AS PERGUNTAS SERÃO SALVAS
const LOG_SHEET_NAME = "Log_Perguntas"; 

export default async function handler(req, res) {
  // Apenas aceita requisições do tipo POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Pega os dados enviados pelo frontend
    const { question, email } = req.body;

    // Autenticação com a API do Google Sheets
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Prepara a nova linha com os dados no formato que você quer
    const newRow = [
      new Date().toISOString(), // Coluna 1: Data e Hora
      question,                 // Coluna 2: Pergunta
      email                     // Coluna 3: Email do usuário
    ];

    // Adiciona a nova linha na aba especificada
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: LOG_SHEET_NAME, // Usa a aba "Log_Perguntas"
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [newRow],
      },
    });

    // Retorna uma resposta de sucesso
    return res.status(200).json({ status: 'sucesso', message: 'Pergunta registrada.' });

  } catch (error) {
    console.error("ERRO NO BACKEND DE LOG DE PERGUNTA:", error);
    return res.status(500).json({ error: "Erro interno ao registrar pergunta.", details: error.message });
  }
}