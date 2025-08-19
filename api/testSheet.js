// api/testSheet.js (Versão Corrigida e Otimizada)

import { google } from 'googleapis';

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tyS89983odMbF04znYTmDLO6_6nZ9jFs0kz1fkEjnvY";
const LOG_SHEET_NAME = "Log_Feedback"; // A aba onde o teste vai escrever

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS'); // Permite GET para teste direto no navegador
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log("--- INICIANDO TESTE DE ESCRITA NA PLANILHA ---");
  try {
    // A autenticação e o cliente já foram criados fora da função
    console.log("[TESTE] Usando cliente do Google Sheets pré-configurado.");

    const testRow = [
      new Date().toISOString(),
      'TESTE DE ESCRITA',
      'SE VOCÊ ESTÁ VENDO ISSO, A CONEXÃO FUNCIONOU!',
      `Executado em: ${new Date().toLocaleString('pt-BR')}`
    ];
    console.log("[TESTE] Linha de teste preparada:", testRow);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: LOG_SHEET_NAME,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [testRow],
      },
    });
    
    console.log("[TESTE] SUCESSO! A chamada para a API do Google foi concluída sem erros.");
    return res.status(200).json({ status: 'Sucesso', message: `Teste concluído às ${new Date().toLocaleTimeString('pt-BR')}. Verifique a aba '${LOG_SHEET_NAME}' da sua planilha.` });

  } catch (error) {
    console.error("!!!!!!!!!! [TESTE] OCORREU UM ERRO !!!!!!!!!!", error);
    // Retorna o erro completo para facilitar a depuração
    return res.status(500).json({ 
        status: 'Erro', 
        message: "A escrita na planilha falhou. Verifique os logs da Vercel e as permissões da sua conta de serviço.",
        error_message: error.message, 
        error_details: error 
    });
  }
}