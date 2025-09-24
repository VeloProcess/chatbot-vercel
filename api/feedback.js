// api/feedback.js - Sistema de Logs e Relatórios (Apenas Planilhas)

const { google } = require('googleapis');

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const LOG_SHEET_NAME = "Log_Feedback";

// Nota: Sistema de email implementado via Google Apps Script
// Ver arquivo google-apps-script.js para implementação completa

// --- CLIENTES ---
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// --- FUNÇÕES DE LOG (APENAS PLANILHAS) ---

async function logFeedback(email, pergunta, feedback, rating, resposta) {
  try {
    const values = [
      [
        new Date().toLocaleString('pt-BR'),
        email,
        pergunta,
        feedback || '',
        rating || '',
        resposta || '',
        'Sistema'
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${LOG_SHEET_NAME}!A:G`,
      valueInputOption: 'RAW',
      resource: { values }
    });

    console.log('✅ Feedback registrado na planilha:', { email, feedback });
  } catch (error) {
    console.error('❌ Erro ao registrar feedback:', error);
  }
}

async function logQuestion(email, pergunta, resposta, source = 'Sistema') {
  try {
    const values = [
      [
        new Date().toLocaleString('pt-BR'),
        email,
        pergunta,
        resposta || '',
        source
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `Log_Perguntas!A:E`,
      valueInputOption: 'RAW',
      resource: { values }
    });

    console.log('✅ Pergunta registrada na planilha:', { email, source });
  } catch (error) {
    console.error('❌ Erro ao registrar pergunta:', error);
  }
}

async function logAccess(email, status, sessionId, metadata = {}) {
  try {
    const values = [
      [
        new Date().toLocaleString('pt-BR'),
        email,
        status,
        sessionId || '',
        metadata.ip || '',
        metadata.userAgent || '',
        metadata.duration || 0,
        metadata.source || 'web'
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `Log_Acessos!A:H`,
      valueInputOption: 'RAW',
      resource: { values }
    });

    console.log('✅ Acesso registrado na planilha:', { email, status });
  } catch (error) {
    console.error('❌ Erro ao registrar acesso:', error);
  }
}

// --- HANDLER PRINCIPAL ---

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { action, email, pergunta, feedback, rating, resposta, status, sessionId, metadata } = req.body;

    switch (action) {
      case 'feedback':
        await logFeedback(email, pergunta, feedback, rating, resposta);
        return res.status(200).json({ 
          status: 'success', 
          message: 'Feedback registrado na planilha' 
        });

      case 'question':
        await logQuestion(email, pergunta, resposta, metadata?.source);
        return res.status(200).json({ 
          status: 'success', 
          message: 'Pergunta registrada na planilha' 
        });

      case 'access':
        await logAccess(email, status, sessionId, metadata);
        return res.status(200).json({ 
          status: 'success', 
          message: 'Acesso registrado na planilha' 
        });

      case 'log-question':
        // Log detalhado de pergunta (chamado pelo AskOpenai.js)
        await logQuestion(email, pergunta, resposta, metadata?.source || 'IA Avançada');
        return res.status(200).json({ 
          status: 'success', 
          message: 'Pergunta logada na planilha' 
        });

      case 'log-access':
        // Log detalhado de acesso
        await logAccess(email, status, sessionId, metadata);
        return res.status(200).json({ 
          status: 'success', 
          message: 'Acesso logado na planilha' 
        });

      case 'log-feedback':
        // Log detalhado de feedback
        await logFeedback(email, pergunta, feedback, rating, resposta);
        return res.status(200).json({ 
          status: 'success', 
          message: 'Feedback logado na planilha' 
        });

      default:
        return res.status(400).json({ error: 'Ação não reconhecida' });
    }

  } catch (error) {
    console.error('❌ Erro no handler de feedback:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
}