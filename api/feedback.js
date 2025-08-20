// api/feedback.js (Versão de Depuração com Logs Detalhados)

import { google } from 'googleapis';

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const LOG_SHEET_NAME = "Log_Feedback";

// --- CLIENTE GOOGLE SHEETS OTIMIZADO ---
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });


// --- A FUNÇÃO PRINCIPAL DA API (HANDLER) ---
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }
  
  try {
    // --- LOG DE DEPURACÃO 1: Ponto de Entrada ---
    console.log("[DEBUG 1] Endpoint de feedback atingido.");

    const dados = req.body;

    // --- LOG DE DEPURACÃO 2: Dados Recebidos ---
    console.log("[DEBUG 2] Dados recebidos do frontend:", JSON.stringify(dados, null, 2));

    if (!dados || Object.keys(dados).length === 0) {
        console.error("[DEBUG FALHA] Validação falhou: Corpo da requisição vazio.");
        return res.status(400).json({ error: 'Corpo da requisição vazio.' });
    }

    console.log("[DEBUG 3] Criando timestamp...");
    const timestamp = new Date().toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo'
    });
    console.log("[DEBUG 4] Timestamp criado:", timestamp);

    const tipoFeedback = dados.action === 'logFeedbackPositivo' ? 'Positivo 👍' : 'Negativo �';
    
    const newRow = [
      timestamp,
      String(dados.email || 'nao_fornecido'),
      String(dados.question || 'N/A'),
      tipoFeedback,
      String(dados.sourceRow !== null && dados.sourceRow !== undefined ? dados.sourceRow : 'N/A'),
      String(dados.sugestao || '')
    ];

    // --- LOG DE DEPURACÃO 5: Linha a ser Escrita ---
    console.log("[DEBUG 5] Linha preparada para ser enviada para a folha de cálculo:", newRow);

    console.log("[DEBUG 6] A enviar dados para a API do Google Sheets...");
    // Envia os dados para a planilha
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: LOG_SHEET_NAME,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [newRow],
      },
    });

    // --- LOG DE DEPURACÃO 7: Sucesso ---
    console.log("[DEBUG 7] Sucesso! Os dados foram enviados para a API do Google Sheets.");

    return res.status(200).json({ status: 'sucesso', message: 'Feedback registado.' });

  } catch (error) {
    console.error("ERRO NO ENDPOINT DE FEEDBACK:", error);
    return res.status(500).json({ error: "Erro interno ao registar feedback.", details: error.message });
  }
}
�