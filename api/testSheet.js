// api/testSheet.js (Versão de Diagnóstico Avançado)

import { google } from "googleapis";
import fs from "fs";

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const LOG_SHEET_NAME = "Log_Feedback"; // Garanta que este nome é EXATAMENTE igual ao do seu separador na planilha

// --- CLIENTE GOOGLE SHEETS OTIMIZADO ---
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// --- A FUNÇÃO PRINCIPAL DA API (HANDLER) ---
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log("A preparar a linha de teste...");
    const testRow = [
      new Date().toISOString(),
      'TESTE DE ESCRITA',
      'SE VOCÊ ESTÁ VENDO ISTO, A CONEXÃO FUNCIONOU!',
      `Executado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
    ];

    console.log("A enviar dados para a API do Google Sheets...");
    const responseFromGoogle = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: LOG_SHEET_NAME,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [testRow],
      },
    });
    
    // --- NOVO LOG DE DIAGNÓSTICO ---
    // Este log mostrará a resposta completa da API da Google.
    console.log("RESPOSTA DA API DO GOOGLE:", JSON.stringify(responseFromGoogle, null, 2));

    return res.status(200).json({ status: 'Sucesso', message: `Teste concluído. Verifique o separador '${LOG_SHEET_NAME}' da sua planilha.` });

  } catch (error) {
    console.error("ERRO NO SCRIPT DE TESTE:", error);
    return res.status(500).json({ 
        status: 'Erro', 
        message: "A escrita na planilha falhou. Verifique os logs da Vercel e as permissões da sua conta de serviço.",
        error_message: error.message, 
        error_details: error 
    });
  }
}
