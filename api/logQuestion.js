// api/log.js (Versão Corrigida e Otimizada)

import { google } from 'googleapis';

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnwusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";

// Mapeamento dos tipos de log para os nomes das abas
const SHEET_NAMES = {
  question: "Log_Perguntas",
  error: "Log_Erros",
  access: "Log_Acessos"
};

// --- CLIENTE GOOGLE SHEETS OTIMIZADO ---
// Criado fora do handler para ser reutilizado
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });


// --- A FUNÇÃO PRINCIPAL DA API (HANDLER) ---
export default async function handler(req, res) {
  // --- CRÍTICO: ADIÇÃO DA CONFIGURAÇÃO CORS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Garante que apenas o método POST seja aceito
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const { type, payload } = req.body;

    // Validação dos dados recebidos
    if (!type || !payload || !SHEET_NAMES[type]) {
      return res.status(400).json({ error: "Tipo de log ('type') inválido ou 'payload' ausente." });
    }

    const sheetName = SHEET_NAMES[type];
    let newRow = [new Date().toISOString()]; // Coluna de Timestamp é padrão para todos

    // Monta a linha com base no tipo de log
    switch (type) {
      case 'access':
        newRow.push(payload.email || 'nao_fornecido');
        break;
      case 'question':
      case 'error':
        newRow.push(payload.email || 'nao_fornecido');
        newRow.push(payload.question || 'N/A');
        break;
      default:
        // Se um tipo não esperado for passado, não faz nada
        return res.status(400).json({ error: `Tipo de log desconhecido: ${type}` });
    }

    // Envia os dados para a planilha
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [newRow],
      },
    });

    return res.status(200).json({ status: 'sucesso', message: `Log do tipo '${type}' registrado.` });

  } catch (error) {
    console.error(`ERRO NO ENDPOINT DE LOG (tipo: ${req.body.type}):`, error);
    return res.status(500).json({ error: "Erro interno ao registrar o log.", details: error.message });
  }
}