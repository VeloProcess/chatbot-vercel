// api/admin.js - API Unificada de Administração

const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  // Verificar se as credenciais estão disponíveis
  if (!process.env.GOOGLE_CREDENTIALS) {
    console.error("GOOGLE_CREDENTIALS não configurado");
    return res.status(200).json({ 
      error: "Configuração de credenciais não encontrada.",
      success: false
    });
  }

  const { action, email, adminEmail } = req.query;

  // Timeout de 10 segundos para evitar 504
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout da API admin')), 10000);
  });

  try {
    const result = await Promise.race([
      processAdminAction(action, email, adminEmail, res),
      timeoutPromise
    ]);
    return result;
  } catch (error) {
    console.error('Erro na API de administração:', error);
    return res.status(200).json({ 
      error: error.message === 'Timeout da API admin' ? 'Timeout - tente novamente' : 'Erro interno do servidor',
      success: false
    });
  }
};

async function processAdminAction(action, email, adminEmail, res) {
  switch (action) {
    case 'getOnlineUsers':
      return await getOnlineUsers(res);
    
    case 'forceLogout':
      if (!email || !adminEmail) {
        return res.status(400).json({ error: 'Email do usuário e admin são obrigatórios' });
      }
      return await forceLogoutUser(email, adminEmail, res);
    
    case 'getUserHistory':
      if (!email) {
        return res.status(400).json({ error: 'Email do usuário é obrigatório' });
      }
      return await getUserHistory(email, res);
    
    case 'getUserProfile':
      if (!email) {
        return res.status(400).json({ error: 'Email do usuário é obrigatório' });
      }
      return await getUserProfile(email, res);
    
    default:
      return res.status(400).json({ error: 'Ação não reconhecida' });
  }
}

// Buscar usuários online
async function getOnlineUsers(res) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Log_Acessos!A:D',
    });

    const rows = response.data.values || [];
    const now = new Date();
    const onlineThreshold = 5 * 60 * 1000; // 5 minutos
    const onlineUsersList = [];

    for (let i = 1; i < rows.length; i++) {
      const [timestamp, email, status, sessionId] = rows[i];
      
      if (status === 'online') {
        const loginTime = new Date(timestamp);
        if (now - loginTime < onlineThreshold) {
          const userProfile = await getUserProfileData(email);
          onlineUsersList.push({
            email,
            nome: userProfile.nome || 'Usuário',
            cargo: userProfile.funcao || 'Atendente',
            ultimoLogin: timestamp,
            sessionId: sessionId || 'N/A'
          });
        }
      }
    }

    onlineUsersList.sort((a, b) => new Date(b.ultimoLogin) - new Date(a.ultimoLogin));

    return res.status(200).json({
      success: true,
      onlineUsers: onlineUsersList,
      total: onlineUsersList.length
    });

  } catch (error) {
    console.error('Erro ao buscar usuários online:', error);
    return res.status(500).json({ error: 'Erro ao buscar usuários online' });
  }
}

// Forçar logout de um usuário
async function forceLogoutUser(email, adminEmail, res) {
  try {
    const timestamp = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo'
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Log_Acessos',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[
          timestamp,
          email,
          'offline_forced',
          `Forçado por: ${adminEmail}`
        ]]
      }
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Log_Admin',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[
          timestamp,
          adminEmail,
          'force_logout',
          `Deslogou: ${email}`
        ]]
      }
    });

    console.log(`🔴 Logout forçado: ${adminEmail} deslogou ${email}`);

    return res.status(200).json({
      success: true,
      message: `Usuário ${email} foi deslogado com sucesso`,
      timestamp
    });

  } catch (error) {
    console.error('Erro ao forçar logout:', error);
    return res.status(500).json({ error: 'Erro ao forçar logout do usuário' });
  }
}

// Buscar histórico de um usuário
async function getUserHistory(email, res) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Log_Acessos!A:D',
    });

    const rows = response.data.values || [];
    const userHistory = [];

    for (let i = 1; i < rows.length; i++) {
      const [timestamp, userEmail, status, sessionId] = rows[i];
      
      if (userEmail === email) {
        userHistory.push({
          timestamp,
          status,
          sessionId: sessionId || 'N/A'
        });
      }
    }

    userHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.status(200).json({
      success: true,
      email,
      history: userHistory
    });

  } catch (error) {
    console.error('Erro ao buscar histórico do usuário:', error);
    return res.status(500).json({ error: 'Erro ao buscar histórico do usuário' });
  }
}

// Buscar perfil do usuário
async function getUserProfile(email, res) {
  try {
    const userProfile = await getUserProfileData(email);
    return res.status(200).json({
      success: true,
      ...userProfile
    });
  } catch (error) {
    console.error('Erro ao buscar perfil do usuário:', error);
    // Retornar perfil padrão em caso de erro
    return res.status(200).json({
      success: false,
      email: email,
      nome: 'Usuário',
      funcao: 'Atendente',
      error: 'Erro ao carregar perfil completo'
    });
  }
}

// Função auxiliar para buscar perfil do usuário (otimizada)
async function getUserProfileData(email) {
  try {
    // Timeout de 5 segundos para busca de perfil
    const profilePromise = sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Usuarios!A:C',
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout na busca de perfil')), 5000);
    });

    const response = await Promise.race([profilePromise, timeoutPromise]);
    const rows = response.data.values || [];
    
    // Busca otimizada - parar no primeiro match
    for (let i = 1; i < Math.min(rows.length, 100); i++) { // Limitar a 100 linhas
      const [userEmail, nomeCompleto, cargo] = rows[i];
      if (userEmail && userEmail.toLowerCase() === email.toLowerCase()) {
        return {
          email: email,
          nome: nomeCompleto || 'Usuário',
          funcao: cargo || 'Atendente'
        };
      }
    }

    // Se não encontrou, retornar perfil padrão
    return { 
      email: email, 
      nome: 'Usuário', 
      funcao: 'Atendente' 
    };
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    // Sempre retornar perfil padrão em caso de erro
    return { 
      email: email, 
      nome: 'Usuário', 
      funcao: 'Atendente' 
    };
  }
}
