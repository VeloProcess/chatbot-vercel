// api/feedback.js (Versão Corrigida)
import { google } from "googleapis";

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const LOG_SHEET_NAME = "Log_Feedback";

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

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
    console.log("[DEBUG 1] Endpoint de feedback atingido.");

    const dados = req.body;
    console.log("[DEBUG 2] Dados recebidos:", JSON.stringify(dados, null, 2));

    if (!dados || Object.keys(dados).length === 0) {
        console.error("[DEBUG FALHA] Validação falhou: Corpo da requisição vazio.");
        return res.status(400).json({ error: 'Corpo da requisição vazio.' });
    }

    console.log("[DEBUG 3] Criando timestamp...");
    const timestamp = new Date().toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo'
    });
    console.log("[DEBUG 4] Timestamp criado:", timestamp);

    const tipoFeedback = dados.action === 'logFeedbackPositivo' ? 'Positivo 👍' : 'Negativo ��';
    
    // Garante que a pergunta seja salva corretamente
    const pergunta = dados.question || 'Pergunta não fornecida';
    console.log("[DEBUG 5] Pergunta a ser salva:", pergunta);
    
    const newRow = [
      timestamp,
      String(dados.email || 'nao_fornecido'),
      String(pergunta), // Pergunta do atendente
      tipoFeedback,
      String(dados.sourceRow !== null && dados.sourceRow !== undefined ? dados.sourceRow : 'N/A'),
      String(dados.sugestao || '')
    ];

    console.log("[DEBUG 6] Linha preparada:", newRow);

    console.log("[DEBUG 7] Enviando para Google Sheets...");
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: LOG_SHEET_NAME,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [newRow],
      },
    });

    console.log("[DEBUG 8] Sucesso! Dados enviados para Google Sheets.");

    return res.status(200).json({ 
      status: 'sucesso', 
      message: 'Feedback registrado com sucesso!',
      perguntaSalva: pergunta
    });

  } catch (error) {
    console.error("[DEBUG ERRO] Erro no processamento:", error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
}