// api/logQuestion.js (Versão Atualizada com Histórico de Login/Logout)

const { google } = require('googleapis');

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";

// Mapeamento dos tipos de log para os nomes das abas
const SHEET_NAMES = {
  question: "Log_Perguntas",
  error: "Log_Erros",
  access: "Log_Acessos"
};

// --- CLIENTE GOOGLE SHEETS OTIMIZADO ---
let auth, sheets;

try {
  if (!process.env.GOOGLE_CREDENTIALS) {
    console.warn('⚠️ GOOGLE_CREDENTIALS não configurado no logQuestion');
  } else {
    auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheets = google.sheets({ version: 'v4', auth });
  }
} catch (error) {
  console.error('❌ Erro ao configurar Google Sheets no logQuestion:', error.message);
}

// --- FUNÇÃO PARA CONSULTAR HISTÓRICO E STATUS DE UM USUÁRIO ---
async function getUserStatusAndHistory(email) {
  try {
    if (!sheets) {
      throw new Error('Google Sheets não configurado');
    }
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.access}!A:D`, // Colunas: Timestamp, Email, Status, SessionID
    });

    const rows = response.data.values || [];
    const now = new Date();
    const onlineThreshold = 5 * 60 * 1000; // 5 minutos para considerar online
    let latestStatus = 'offline';
    let latestLogin = null;
    let latestLogout = null;

    // Filtra entradas do usuário especificado
    const userRows = rows.slice(1).filter(row => row[1] === email); // Ignora cabeçalho
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

    // Verifica se o usuário está online (último login recente e sem logout posterior)
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

// --- A FUNÇÃO PRINCIPAL DA API (HANDLER) ---
module.exports = async function handler(req, res) {
  // --- CONFIGURAÇÃO CORS ---
  res.setHeader('Access-Control-Allow-Origin', '*'); // TODO: Restrinja em produção
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const email = req.query.email;
      if (!email) {
        // Retorna lista de usuários online (como na versão anterior)
        if (!sheets) {
          return res.status(503).json({ 
            status: 'erro', 
            error: 'Google Sheets não configurado' 
          });
        }
        
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAMES.access}!A:D`,
        });

        const rows = response.data.values || [];
        const now = new Date();
        const onlineThreshold = 5 * 60 * 1000; // 5 minutos
        const onlineUsers = {};

        for (const row of rows.slice(1)) {
          const [timestamp, email, status] = row;
          if (status !== 'online') continue;
          const loginTime = new Date(timestamp);
          if (now - loginTime < onlineThreshold) {
            onlineUsers[email] = { timestamp, status };
          }
        }

        return res.status(200).json({
          status: 'sucesso',
          onlineUsers: Object.keys(onlineUsers)
        });
      }

      // Retorna status e histórico para um e-mail específico
      const userData = await getUserStatusAndHistory(email);
      return res.status(200).json({
        status: 'sucesso',
        user: userData
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido. Use POST ou GET.' });
    }

    const { type, payload } = req.body;

    // Validação dos dados recebidos
    if (!type || !payload || !SHEET_NAMES[type]) {
      return res.status(400).json({ error: "Tipo de log ('type') inválido ou 'payload' ausente." });
    }

    // --- CORREÇÃO DE FUSO HORÁRIO ---
    const timestamp = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo'
    });

    const sheetName = SHEET_NAMES[type];
    let newRow = [timestamp];

    // Monta a linha com base no tipo de log
    switch (type) {
      case 'access':
        // Estrutura: Timestamp | Email | Status | SessionID
        newRow.push(payload.email || 'nao_fornecido');
        newRow.push(payload.status || 'unknown');
        newRow.push(payload.sessionId || 'N/A');
        console.log(`📝 Log de acesso registrado na aba Log_Acessos:`, {
          timestamp: newRow[0],
          email: newRow[1],
          status: newRow[2],
          sessionId: newRow[3]
        });
        break;
      case 'question':
        // Estrutura: Data | Pergunta | Email
        newRow.push(payload.question || 'N/A');
        newRow.push(payload.email || 'nao_fornecido');
        console.log(`❓ Log de pergunta registrado na aba Log_Perguntas:`, {
          data: newRow[0],
          pergunta: newRow[1],
          email: newRow[2]
        });
        break;
      case 'error':
        newRow.push(payload.email || 'nao_fornecido');
        newRow.push(payload.question || payload.error || 'N/A');
        console.log(`❌ Log de erro registrado: ${payload.email} - ${payload.question || payload.error}`);
        break;
      default:
        return res.status(400).json({ error: `Tipo de log desconhecido: ${type}` });
    }

    // Envia os dados para a planilha
    if (!sheets) {
      console.warn('⚠️ Google Sheets não configurado - não é possível registrar log');
      return res.status(200).json({ 
        status: 'sucesso', 
        message: `Log do tipo '${type}' registrado (modo offline).`,
        warning: 'Google Sheets não configurado'
      });
    }
    
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [newRow],
      },
    });

    console.log(`✅ Log registrado com sucesso na planilha ${sheetName}:`, newRow);
    return res.status(200).json({ 
      status: 'sucesso', 
      message: `Log do tipo '${type}' registrado.`,
      details: {
        sheet: sheetName,
        row: newRow,
        updatedRange: appendResponse.data.updatedRange
      }
    });

  } catch (error) {
    console.error(`ERRO NO ENDPOINT DE LOG (tipo: ${req.body?.type}):`, error);
    return res.status(500).json({ error: "Erro interno ao registrar o log.", details: error.message });
  }
};