// api/logQuestion.js (Versão Atualizada com Histórico de Login/Logout)

const { google } = require('googleapis');

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1d0h9zr4haDx6etLtdMqPVsBXdVvH7n9OsRdqAhOJOp0";

// Todos os logs vão para a aba LOGS
const LOG_SHEET_NAME = "LOGS";

// --- CLIENTE GOOGLE SHEETS OTIMIZADO ---
let auth, sheets;

try {
  if (!process.env.GOOGLE_CREDENTIALS) {
    console.warn('⚠️ GOOGLE_CREDENTIALS não configurado no logQuestion');
  } else {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Google Sheets configurado para logQuestion. Email:', credentials.client_email);
  }
} catch (error) {
  console.error('❌ Erro ao configurar Google Sheets no logQuestion:', error.message);
  console.error('❌ Stack:', error.stack);
}

// --- FUNÇÃO PARA CONSULTAR HISTÓRICO E STATUS DE UM USUÁRIO ---
async function getUserStatusAndHistory(email) {
  try {
    if (!sheets) {
      throw new Error('Google Sheets não configurado');
    }
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${LOG_SHEET_NAME}!A:D`, // Colunas: Timestamp, Email, Status, SessionID
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
    console.log('📝 logQuestion.js: Recebendo requisição', {
      method: req.method,
      body: req.body,
      query: req.query
    });

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
          range: `${LOG_SHEET_NAME}!A:D`,
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

    console.log('📝 Recebendo log:', JSON.stringify(req.body, null, 2));
    
    // Validação básica do body
    if (!req.body) {
      console.error('❌ Request body está vazio');
      return res.status(400).json({ 
        error: "Request body está vazio",
        received: req.body
      });
    }
    
    const { type, payload } = req.body;

    // Validação dos dados recebidos
    if (!type || !payload) {
      console.error('❌ Dados inválidos recebidos:', { type, payload, body: req.body });
      return res.status(400).json({ 
        error: "Tipo de log ('type') inválido ou 'payload' ausente.",
        received: { type, payload, fullBody: req.body }
      });
    }

    console.log('✅ Validação passou. Tipo:', type, 'Payload keys:', Object.keys(payload));

    // --- CORREÇÃO DE FUSO HORÁRIO ---
    // Formato: DD/MM/YYYY HH:mm:ss
    const now = new Date();
    const timestamp = now.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const sheetName = LOG_SHEET_NAME; // Deve ser "LOGS"
    let newRow = [timestamp];
    
    // Validação: garantir que sheetName está correto
    if (!sheetName || sheetName !== 'LOGS') {
      console.error(`❌ ERRO CRÍTICO: sheetName incorreto: "${sheetName}". Deve ser "LOGS".`);
      return res.status(500).json({ 
        error: 'Erro de configuração: nome da aba incorreto',
        details: `sheetName: "${sheetName}", esperado: "LOGS"`
      });
    }

    // Monta a linha com base no tipo de log
    switch (type) {
      case 'access':
        // Estrutura: Timestamp | Email | Status | SessionID
        newRow.push(payload.email || 'nao_fornecido');
        newRow.push(payload.status || 'unknown');
        newRow.push(payload.sessionId || 'N/A');
        console.log(`📝 Log de acesso registrado na aba LOGS:`, {
          timestamp: newRow[0],
          email: newRow[1],
          status: newRow[2],
          sessionId: newRow[3]
        });
        break;
      case 'question':
        // Estrutura: DATA | Operador | Pergunta | Categoria | Achou? | Resposta
        // Sanitizar e truncar dados para evitar problemas
        const operador = String(payload.email || 'nao_fornecido').substring(0, 100);
        const pergunta = String(payload.question || 'N/A').substring(0, 500);
        const categoria = String(payload.categoria || 'Outros').substring(0, 50);
        const achou = String(payload.achou || 'Não').substring(0, 10);
        // Resposta pode ser maior, mas limitar a 5000 caracteres
        const resposta = String(payload.resposta || '').substring(0, 5000);
        
        newRow.push(operador); // Operador
        newRow.push(pergunta); // Pergunta
        newRow.push(categoria); // Categoria
        newRow.push(achou); // Achou? (Sim ou Não)
        newRow.push(resposta); // Resposta (vazio se não achou)
        
        console.log(`❓ Preparando log de pergunta:`, {
          timestamp: newRow[0],
          operador: newRow[1],
          pergunta: newRow[2].substring(0, 50) + (newRow[2].length > 50 ? '...' : ''),
          categoria: newRow[3],
          achou: newRow[4],
          resposta: newRow[5] ? (newRow[5].length > 50 ? newRow[5].substring(0, 50) + '...' : newRow[5]) : '(vazio)'
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

    // Verificar se newRow foi construído corretamente
    if (!newRow || newRow.length === 0) {
      console.error('❌ Erro: newRow está vazio ou inválido');
      return res.status(400).json({ 
        error: 'Erro ao construir linha de log',
        type: type,
        payload: payload
      });
    }

    // Envia os dados para a planilha
    if (!sheets) {
      console.warn('⚠️ Google Sheets não configurado - não é possível registrar log');
      console.warn('⚠️ Verifique se GOOGLE_CREDENTIALS está configurado no .env');
      return res.status(200).json({ 
        status: 'sucesso', 
        message: `Log do tipo '${type}' registrado (modo offline).`,
        warning: 'Google Sheets não configurado'
      });
    }

    console.log('✅ Google Sheets configurado. Tentando registrar log...');
    
    try {
      // Verificar se a aba LOGS existe antes de tentar escrever
      try {
        const sheetInfo = await sheets.spreadsheets.get({
          spreadsheetId: SPREADSHEET_ID,
        });
        
        const sheetExists = sheetInfo.data.sheets?.some(
          sheet => sheet.properties.title === 'LOGS'
        );
        
        if (!sheetExists) {
          console.error('❌ Aba LOGS não encontrada na planilha!');
          console.error('❌ Abas existentes:', sheetInfo.data.sheets?.map(s => s.properties.title).join(', ') || 'nenhuma');
          throw new Error('Aba LOGS não encontrada na planilha. Por favor, crie uma aba chamada "LOGS" com os cabeçalhos: DATA, Operador, Pergunta, Categoria, Achou?, Resposta');
        }
        
        console.log('✅ Aba LOGS encontrada na planilha');
      } catch (checkError) {
        console.error('❌ Erro ao verificar abas da planilha:', checkError.message);
        // Continuar mesmo assim, pode ser erro de permissão
      }
      
      // Para o tipo 'question', usar range específico A:F (DATA, Operador, Pergunta, Categoria, Achou?, Resposta)
      // Usar diretamente "LOGS" para garantir que está correto
      const range = type === 'question' ? `LOGS!A:F` : `LOGS!A:Z`;
      
      console.log(`📝 ========== TENTANDO REGISTRAR LOG ==========`);
      console.log(`📝 Range que será usado: "${range}"`);
      console.log(`📝 Sheet name configurado: "${sheetName}"`);
      console.log(`📝 Tipo de log: "${type}"`);
      console.log(`📝 Spreadsheet ID: "${SPREADSHEET_ID}"`);
      console.log(`📝 Dados a serem registrados:`, newRow);
      console.log(`📝 ===========================================`);
      
      const appendResponse = await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [newRow],
        },
      });
      
      console.log(`✅ Log registrado com sucesso na planilha ${sheetName}:`, newRow);
      console.log(`✅ Range atualizado:`, appendResponse.data.updatedRange);
      return res.status(200).json({ 
        status: 'sucesso', 
        message: `Log do tipo '${type}' registrado.`,
        details: {
          sheet: sheetName,
          row: newRow,
          updatedRange: appendResponse.data.updatedRange
        }
      });
    } catch (appendError) {
      console.error('❌ Erro ao fazer append na planilha:');
      console.error('❌ Mensagem:', appendError.message);
      console.error('❌ Código:', appendError.code);
      console.error('❌ Status:', appendError.response?.status);
      console.error('❌ Response data:', JSON.stringify(appendError.response?.data, null, 2));
      console.error('❌ Stack:', appendError.stack);
      
      // Verificar se é erro de permissão
      if (appendError.response?.status === 403 || 
          appendError.message?.includes('permission_denied') ||
          appendError.message?.includes('PERMISSION_DENIED') ||
          appendError.code === 403 ||
          appendError.response?.data?.error?.message?.includes('permission')) {
        const errorMsg = 'PERMISSION_DENIED: A conta de serviço não tem permissão para escrever na planilha. Verifique as permissões no Google Sheets.';
        console.error('❌', errorMsg);
        throw new Error(errorMsg);
      }
      
      // Se a aba não existe, tentar criar ou retornar erro mais específico
      const errorMessage = appendError.message || '';
      const apiErrorMessage = appendError.response?.data?.error?.message || '';
      const fullErrorText = `${errorMessage} ${apiErrorMessage}`;
      
      console.error('❌ ========== ERRO COMPLETO DO GOOGLE SHEETS ==========');
      console.error('❌ Error message:', errorMessage);
      console.error('❌ API error message:', apiErrorMessage);
      console.error('❌ Full error text:', fullErrorText);
      console.error('❌ Range que tentamos usar:', range);
      console.error('❌ Response data completo:', JSON.stringify(appendError.response?.data, null, 2));
      console.error('❌ ===================================================');
      
      if (fullErrorText.includes('Unable to parse range')) {
        // Extrair o nome da aba do erro se possível
        const rangeMatch = fullErrorText.match(/range[:\s]+([^\s!]+)/i);
        const problematicSheet = rangeMatch ? rangeMatch[1] : 'desconhecida';
        
        const errorMsg = `Erro ao acessar aba na planilha. Range usado: "LOGS!A:F". Erro do Google: "${problematicSheet}". Verifique se a aba "LOGS" existe na planilha.`;
        console.error('❌', errorMsg);
        console.error('❌ Range que tentamos usar:', range);
        console.error('❌ Sheet name configurado:', sheetName);
        throw new Error(errorMsg);
      }
      
      // Erro genérico
      const errorMsg = appendError.message || 'Erro desconhecido ao escrever na planilha';
      console.error('❌ Erro genérico:', errorMsg);
      throw appendError;
    }


  } catch (error) {
    console.error(`ERRO NO ENDPOINT DE LOG (tipo: ${req.body?.type}):`, error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Request body:', JSON.stringify(req.body, null, 2));
    console.error('❌ Error response:', error.response?.data);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error status:', error.response?.status);
    
    // Verificar se é erro de configuração
    if (error.message && error.message.includes('não configurado')) {
      return res.status(200).json({ 
        status: 'sucesso', 
        message: `Log do tipo '${req.body?.type}' registrado (modo offline).`,
        warning: 'Google Sheets não configurado'
      });
    }
    
    // Verificar se é erro de permissão
    let errorMessage = "Erro interno ao registrar o log.";
    let errorDetails = error.message || 'Erro desconhecido';
    
    if (error.message && (
      error.message.includes('PERMISSION_DENIED') ||
      error.message.includes('permission_denied') ||
      error.response?.status === 403
    )) {
      errorMessage = "Erro de permissão: A conta de serviço não tem acesso à planilha. Verifique as permissões no Google Sheets.";
      errorDetails = "PERMISSION_DENIED";
    } else if (error.message && error.message.includes('Unable to parse range')) {
      // O erro pode mencionar "Log_Perguntas" se vier do Google Sheets API
      // Mas estamos usando "LOGS", então vamos verificar o erro completo
      const apiErrorMsg = error.response?.data?.error?.message || error.message;
      errorMessage = `Erro ao acessar aba na planilha. Verifique se a aba "LOGS" existe. Erro do Google: ${apiErrorMsg}`;
      errorDetails = apiErrorMsg;
    } else if (error.response?.data?.error?.message) {
      errorDetails = error.response.data.error.message;
      
      // Se o erro menciona "Log_Perguntas", pode ser um erro antigo do Google Sheets
      if (errorDetails.includes('Log_Perguntas')) {
        errorMessage = `A planilha pode ter uma referência antiga à aba "Log_Perguntas". Verifique se a aba "LOGS" existe e se não há referências antigas. Erro: ${errorDetails}`;
      }
      if (errorDetails.includes('API has not been used')) {
        errorMessage = "Google Sheets API não está habilitada no projeto. Habilite a API no Google Cloud Console.";
      }
    }
    
    return res.status(500).json({ 
      error: errorMessage, 
      details: errorDetails,
      type: req.body?.type,
      errorType: error.message && error.message.includes('PERMISSION_DENIED') ? 'permission_denied' : 'unknown',
      statusCode: error.response?.status,
      apiError: error.response?.data?.error
    });
  }
};