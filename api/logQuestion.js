import { google } from "googleapis";
import fs from "fs";

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";

const SHEET_NAMES = {
  question: "Log_Perguntas",
  error: "Log_Erros",
  access: "Log_Acessos"
};

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function getUserStatusAndHistory(email) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.access}!A:D`,
    });
    const rows = response.data.values || [];
    const now = new Date();
    const onlineThreshold = 5 * 60 * 1000;
    let latestStatus = 'offline';
    let latestLogin = null;
    let latestLogout = null;

    const userRows = rows.slice(1).filter(row => row[1] === email);
    for (const row of userRows) {
      const [timestamp, , status] = row;
      const eventTime = new Date(timestamp);
      if (status === 'online' && (!latestLogin || eventTime > new Date(latestLogin))) {
        latestLogin = timestamp;
      }
      if (status === 'offline' && (!latestLogout || eventTime > new Date(latestLogout))) {
        latestLogout = timestamp;
      }
    }

    if (latestLogin && (!latestLogout || new Date(latestLogin) > new Date(latestLogout))) {
      const loginTime = new Date(latestLogin);
      if (now - loginTime < onlineThreshold) {
        latestStatus = 'online';
      }
    }

    return {
      email,
      status: latestStatus,
      lastLogin: latestLogin || 'N/A',
      lastLogout: latestLogout || 'N/A',
      history: userRows.map(row => ({
        timestamp: row[0],
        status: row[2],
        sessionId: row[3] || 'N/A'
      }))
    };
  } catch (error) {
    console.error(`ERRO AO BUSCAR STATUS/HISTÓRICO DE ${email}:`, error);
    throw error;
  }
}

// Adicione este debug na sua API logQuestion.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    console.log('=== LOG QUESTION API DEBUG ===');
    console.log('Method:', req.method);
    console.log('Body:', req.body);
    
    if (req.method === 'GET') {
      // ... seu código GET existente ...
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido. Use POST ou GET.' });
    }

    const { type, payload } = req.body;
    console.log('Type:', type);
    console.log('Payload:', payload);
    
    if (!type || !payload || !SHEET_NAMES[type]) {
      console.error('❌ Dados inválidos:', { type, payload, validTypes: Object.keys(SHEET_NAMES) });
      return res.status(400).json({ error: "Tipo de log ('type') inválido ou 'payload' ausente." });
    }

    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const sheetName = SHEET_NAMES[type];
    let newRow = [timestamp];

    switch (type) {
      case 'access':
        newRow.push(payload.email || 'nao_fornecido');
        newRow.push(payload.status || 'unknown');
        newRow.push(payload.sessionId || 'N/A');
        break;
      case 'question':
      case 'error':
        newRow.push(payload.email || 'nao_fornecido');
        newRow.push(payload.question || 'N/A');
        break;
      default:
        return res.status(400).json({ error: `Tipo de log desconhecido: ${type}` });
    }

    console.log('Nova linha a ser adicionada:', newRow);
    console.log('Sheet name:', sheetName);

    // Testa se as credenciais estão funcionando
    try {
      const testResponse = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });
      console.log('✅ Acesso à planilha OK:', testResponse.data.properties.title);
    } catch (authError) {
      console.error('❌ ERRO DE AUTENTICAÇÃO:', authError);
      return res.status(500).json({ 
        error: "Erro de autenticação com Google Sheets", 
        details: authError.message 
      });
    }

    const appendResult = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [newRow] },
    });

    console.log('✅ Dados salvos com sucesso:', appendResult.data);
    return res.status(200).json({ 
      status: 'sucesso', 
      message: `Log do tipo '${type}' registrado.`,
      details: {
        sheetName,
        newRow,
        updatedRows: appendResult.data.updates?.updatedRows
      }
    });

  } catch (error) {
    console.error(`❌ ERRO NO ENDPOINT DE LOG (tipo: ${req.body?.type}):`, error);
    console.error('Stack trace:', error.stack);
    return res.status(500).json({ 
      error: "Erro interno ao registrar o log.", 
      details: error.message 
    });
  }
}