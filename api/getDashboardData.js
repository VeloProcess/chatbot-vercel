// api/getDashboardData.js

const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

// Função para processar os dados de cada log
function processData(accessLog, questionsLog, feedbackLog, iaLog) {
  // 1. Processar Atividade do Usuário (Log_Acessos)
  const userActivity = {};
  (accessLog || []).slice(1).forEach(([timestamp, email, status]) => {
    if (!userActivity[email] || new Date(timestamp) > new Date(userActivity[email].lastTimestamp)) {
      userActivity[email] = {
        status: status,
        lastTimestamp: timestamp
      };
    }
  });

  // 2. Processar Perguntas Frequentes (Log_Perguntas)
  const questionCounts = {};
  (questionsLog || []).slice(1).forEach(([, , question]) => {
    if (question && question !== 'N/A') {
      questionCounts[question] = (questionCounts[question] || 0) + 1;
    }
  });
  const frequentQuestions = Object.entries(questionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5) // Top 5
    .map(([question, count]) => ({ question, count }));

  // 3. Processar Feedback (Log_Feedback)
  const feedbackSummary = { positive: 0, negative: 0 };
  (feedbackLog || []).slice(1).forEach(([, , , type]) => {
    if (type && type.includes('Positivo')) {
      feedbackSummary.positive += 1;
    } else if (type && type.includes('Negativo')) {
      feedbackSummary.negative += 1;
    }
  });

  // 4. Processar Perguntas para IA (Log_IA_Usage)
  const iaQuestions = (iaLog || []).slice(1).map(([, email, question]) => ({ email, question })).reverse().slice(0, 10); // Últimas 10

  return { userActivity, frequentQuestions, feedbackSummary, iaQuestions };
}


// Handler principal da API
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*'); // Restrinja em produção

  try {
    const ranges = [
      'Log_Acessos!A:C',   //
      'Log_Perguntas!A:C', //
      'Log_Feedback!A:D',  //
      'Log_IA_Usage!A:C'   //
    ];

    // Busca todos os dados da planilha em paralelo para mais eficiência
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: ranges,
    });

    const [accessLog, questionsLog, feedbackLog, iaLog] = response.data.valueRanges.map(range => range.values);

    const processedData = processData(accessLog, questionsLog, feedbackLog, iaLog);

    return res.status(200).json(processedData);

  } catch (error) {
    console.error("ERRO AO BUSCAR DADOS DO DASHBOARD:", error);
    return res.status(500).json({ error: "Erro interno ao buscar dados.", details: error.message });
  }
};