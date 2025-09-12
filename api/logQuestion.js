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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const email = req.query.email;
      if (!email) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAMES.access}!A:D`,
        });
        const rows = response.data.values || [];
        const now = new Date();
        const onlineThreshold = 5 * 60 * 1000;
        const onlineUsers = {};

        for (const row of rows.slice(1)) {
          const [timestamp, email, status] = row;
          if (status !== 'online') continue;
          const loginTime = new Date(timestamp);
          if (now - loginTime < onlineThreshold) onlineUsers[email] = { timestamp, status };
        }

        return res.status(200).json({
          status: 'sucesso',
          onlineUsers: Object.keys(onlineUsers)
        });
      }

      const userData = await getUserStatusAndHistory(email);
      return res.status(200).json({ status: 'sucesso', user: userData });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido. Use POST ou GET.' });
    }

    const { type, payload } = req.body;
    if (!type || !payload || !SHEET_NAMES[type]) {
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

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [newRow] },
    });

    return res.status(200).json({ status: 'sucesso', message: `Log do tipo '${type}' registrado.` });

  } catch (error) {
    console.error(`ERRO NO ENDPOINT DE LOG (tipo: ${req.body?.type}):`, error);
    return res.status(500).json({ error: "Erro interno ao registrar o log.", details: error.message });
  }
}
