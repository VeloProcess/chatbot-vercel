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

// Função corrigida para determinar status do usuário
async function getUserStatusAndHistory(email) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.access}!A:D`, // Timestamp, Email, Status, SessionID
    });
    const rows = response.data.values || [];
    const now = new Date();
    const onlineThreshold = 10 * 60 * 1000; // 10 minutos
    let latestStatus = 'offline';
    let latestLogin = null;
    let latestLogout = null;

    console.log('=== DEBUG STATUS USER ===');
    console.log('Email:', email);
    console.log('Total de linhas:', rows.length);
    console.log('Agora:', now.toISOString());

    // CORREÇÃO: Lê na sequência correta
    const userRows = rows.slice(1).filter(row => row[1] === email); // Email na coluna B (índice 1)
    console.log('Linhas do usuário:', userRows.length);
    
    for (const row of userRows) {
      const [timestamp, , status, sessionId] = row; // Timestamp, Email, Status, SessionID
      const eventTime = new Date(timestamp);
      console.log(`Evento: ${timestamp} - Status: ${status} - SessionId: ${sessionId}`);
      
      if (status === 'online' && (!latestLogin || eventTime > new Date(latestLogin))) {
        latestLogin = timestamp;
        console.log('Novo login mais recente:', latestLogin);
      }
      if (status === 'offline' && (!latestLogout || eventTime > new Date(latestLogout))) {
        latestLogout = timestamp;
        console.log('Novo logout mais recente:', latestLogout);
      }
    }

    // Lógica corrigida para determinar status
    if (latestLogin) {
      const loginTime = new Date(latestLogin);
      const timeSinceLogin = now - loginTime;
      
      console.log('Login mais recente:', latestLogin);
      console.log('Tempo desde login (ms):', timeSinceLogin);
      console.log('Threshold (ms):', onlineThreshold);
      
      // Se não há logout ou o login é mais recente que o logout
      if (!latestLogout || loginTime > new Date(latestLogout)) {
        if (timeSinceLogin < onlineThreshold) {
          latestStatus = 'online';
          console.log('✅ Usuário considerado ONLINE');
        } else {
          console.log('❌ Usuário OFFLINE - tempo limite excedido');
        }
      } else {
        console.log('❌ Usuário OFFLINE - logout mais recente que login');
      }
    } else {
      console.log('❌ Usuário OFFLINE - sem logins registrados');
    }

    console.log('Status final:', latestStatus);

    return {
      email,
      status: latestStatus,
      lastLogin: latestLogin || 'N/A',
      lastLogout: latestLogout || 'N/A',
      history: userRows.map(row => ({
        timestamp: row[0], // Timestamp
        status: row[2],    // Status
        sessionId: row[3] || 'N/A' // SessionID
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
    console.log('=== LOG QUESTION API ===');
    console.log('Method:', req.method);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
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
    console.log('Type:', type);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    if (!type || !payload || !SHEET_NAMES[type]) {
      console.error('❌ Dados inválidos:', { 
        type, 
        payload, 
        validTypes: Object.keys(SHEET_NAMES),
        hasType: !!type,
        hasPayload: !!payload,
        isValidType: !!SHEET_NAMES[type]
      });
      return res.status(400).json({ error: "Tipo de log ('type') inválido ou 'payload' ausente." });
    }

    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const sheetName = SHEET_NAMES[type];
    
    // CORREÇÃO: Sequência correta para Log_Acessos
    let newRow = [];
    
    if (type === 'access') {
      // Sequência: Timestamp, Email, Status, SessionID
      newRow = [
        timestamp,
        payload.email || 'nao_fornecido',
        payload.status || 'unknown',
        payload.sessionId || 'N/A'
      ];
    } else if (type === 'question' || type === 'error') {
      // Para outros tipos, mantém a sequência original
      newRow = [
        timestamp,
        payload.email || 'nao_fornecido',
        payload.question || 'N/A'
      ];
    } else {
      return res.status(400).json({ error: `Tipo de log desconhecido: ${type}` });
    }

    console.log('Nova linha a ser adicionada:', newRow);
    console.log('Sheet name:', sheetName);
    console.log('Spreadsheet ID:', SPREADSHEET_ID);

    // CORREÇÃO: Range específico para cada tipo
    let range;
    if (type === 'access') {
      range = `${sheetName}!A:D`; // Timestamp, Email, Status, SessionID
    } else {
      range = `${sheetName}!A:C`; // Timestamp, Email, Pergunta
    }
    
    console.log('Range:', range);

    // Testa se consegue acessar a planilha
    try {
      const testResponse = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });
      console.log('✅ Acesso à planilha OK:', testResponse.data.properties.title);
    } catch (authError) {
      console.error('❌ ERRO DE AUTENTICAÇÃO:', authError.message);
      return res.status(500).json({ 
        error: "Erro de autenticação com Google Sheets", 
        details: authError.message 
      });
    }

    // Tenta adicionar a linha
    try {
      console.log('Tentando adicionar linha...');
      
      const appendResult = await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: range, // Usa o range corrigido
        valueInputOption: 'USER_ENTERED',
        resource: { values: [newRow] },
      });

      console.log('✅ Dados salvos com sucesso!');
      console.log('Resultado do append:', JSON.stringify(appendResult.data, null, 2));
      
      return res.status(200).json({ 
        status: 'sucesso', 
        message: `Log do tipo '${type}' registrado.`,
        details: {
          sheetName,
          newRow,
          range: range,
          updatedRows: appendResult.data.updates?.updatedRows,
          updatedRange: appendResult.data.updates?.updatedRange
        }
      });
    } catch (appendError) {
      console.error('❌ ERRO AO ADICIONAR LINHA:', appendError.message);
      console.error('Stack trace:', appendError.stack);
      return res.status(500).json({ 
        error: "Erro ao adicionar linha na planilha", 
        details: appendError.message 
      });
    }

  } catch (error) {
    console.error(`❌ ERRO GERAL NO ENDPOINT DE LOG:`, error);
    console.error('Stack trace:', error.stack);
    return res.status(500).json({ 
      error: "Erro interno ao registrar o log.", 
      details: error.message 
    });
  }
}