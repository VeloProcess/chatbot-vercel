// api/feedback.js - Sistema de Feedback (Apenas Planilhas)

const { google } = require('googleapis');

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1d0h9zr4haDx6etLtdMqPVsBXdVvH7n9OsRdqAhOJOp0";
const FEEDBACK_SHEET_NAME = "FEEDBACK";

// --- CLIENTES ---
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// --- FUNÇÃO DE FEEDBACK ---

async function logFeedback(email, pergunta, feedback, rating, resposta, sugestao = '') {
  try {
    console.log('📝 Logando feedback:', { email, pergunta, feedback, rating, resposta, sugestao });
    
    // Formato: DATA | Operador | Pergunta | Tipo de Feedback | Resposta Recebida | Sugestão/Comentário
    const values = [
      [
        new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),  // Data (fuso horário de Brasília)
        email || 'nao_fornecido',                               // Email do Operador
        pergunta || 'N/A',                           // Pergunta Original
        feedback || '',                     // Tipo de Feedback (👍 Positivo ou 👎 Negativo)
        resposta || '',                     // Resposta Recebida
        sugestao || ''                      // Sugestão/Comentário
      ]
    ];

    console.log('📊 Valores para planilha FEEDBACK:', values);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${FEEDBACK_SHEET_NAME}!A:F`,
      valueInputOption: 'RAW',
      resource: { values }
    });

    console.log('✅ Feedback registrado na aba FEEDBACK:', { email, feedback });
    return { success: true };
  } catch (error) {
    console.error('❌ Erro ao registrar feedback:', error);
    throw error;
  }
}

// --- HANDLER PRINCIPAL ---

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    console.log('📥 Dados recebidos no feedback:', req.body);
    const { action, email, pergunta, feedback, rating, resposta } = req.body;

    // Processar apenas ações relacionadas a feedback
    if (action === 'feedback' || action === 'logFeedbackPositivo' || action === 'logFeedbackNegativo' || action === 'log-feedback') {
      // Determinar tipo de feedback baseado na action
      const feedbackType = action === 'logFeedbackPositivo' ? '👍 Positivo' : 
                          action === 'logFeedbackNegativo' ? '👎 Negativo' : 
                          feedback === 'Positivo' ? '👍 Positivo' :
                          feedback === 'Negativo' ? '👎 Negativo' :
                          feedback || '👍 Positivo';
      
      // Obter sugestão do body
      const sugestao = req.body.sugestao || '';
      
      // Obter pergunta e resposta do body (pode vir como 'question' ou 'pergunta')
      const perguntaFinal = pergunta || req.body.question || '';
      const respostaFinal = resposta || req.body.resposta || '';
      
      await logFeedback(email, perguntaFinal, feedbackType, rating, respostaFinal, sugestao);
      return res.status(200).json({ 
        status: 'success', 
        message: 'Feedback registrado na aba FEEDBACK' 
      });
    }

    return res.status(400).json({ error: 'Ação não reconhecida. Use: feedback, logFeedbackPositivo ou logFeedbackNegativo' });

  } catch (error) {
    console.error('❌ Erro no handler de feedback:', error);
    
    // Tratamento de erros específicos do Google Sheets
    if (error.code === 403) {
      return res.status(403).json({ 
        error: 'Permissão negada. Verifique se a planilha está compartilhada com a conta de serviço.',
        details: error.message 
      });
    }
    
    if (error.code === 404) {
      return res.status(404).json({ 
        error: 'Planilha ou aba não encontrada. Verifique se a aba FEEDBACK existe.',
        details: error.message 
      });
    }
    
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
}