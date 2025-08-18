// api/feedback.js (Versão Corrigida e Otimizada)

import { google } from 'googleapis';

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const LOG_SHEET_NAME = "Log_Feedback"; // Certifique-se que o nome desta aba está correto na sua planilha

// --- CLIENTE GOOGLE SHEETS OTIMIZADO ---
// Criado fora do handler para ser reutilizado (melhor performance)
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Escopo de escrita/leitura
});

const sheets = google.sheets({ version: 'v4', auth });


// --- A FUNÇÃO PRINCIPAL DA API (HANDLER) ---
export default async function handler(req, res) {
  // --- CRÍTICO: ADIÇÃO DA CONFIGURAÇÃO CORS ---
  // Sem isso, o navegador bloqueará a requisição do frontend
  res.setHeader('Access-Control-Allow-Origin', '*'); // Permite acesso de qualquer origem
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Responde OK para requisições 'OPTIONS' (pre-flight do CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Garante que apenas o método POST seja aceito
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }
  
  try {
    const dados = req.body;

    // Validação para garantir que o corpo da requisição não está vazio
    if (!dados || Object.keys(dados).length === 0) {
        return res.status(400).json({ error: 'Corpo da requisição vazio.' });
    }

    // Prepara e limpa os dados para a nova linha
    const tipoFeedback = dados.action === 'logFeedbackPositivo' ? 'Positivo 👍' : 'Negativo 👎';
    
    const newRow = [
      new Date().toISOString(), // Data em formato universal (melhor para planilhas)
      String(dados.email || 'nao_fornecido'),
      String(dados.question || 'N/A'),
      tipoFeedback,
      String(dados.sourceRow !== null && dados.sourceRow !== undefined ? dados.sourceRow : 'N/A'),
      String(dados.sugestao || '') // Garante que a sugestão seja sempre um texto
    ];

    // Envia os dados para a planilha
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: LOG_SHEET_NAME,
      valueInputOption: 'USER_ENTERED', // Permite que o Sheets interprete os dados (ex: datas)
      resource: {
        values: [newRow],
      },
    });

    return res.status(200).json({ status: 'sucesso', message: 'Feedback registrado.' });

  } catch (error) {
    console.error("ERRO NO ENDPOINT DE FEEDBACK:", error);
    return res.status(500).json({ error: "Erro interno ao registrar feedback.", details: error.message });
  }
}