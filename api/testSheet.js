// api/testSheet.js

const { google } = require('googleapis');

// Usando exatamente as mesmas configurações que você confirmou
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const LOG_SHEET_NAME = "Log_Feedback";

export default async function handler(req, res) {
  console.log("--- INICIANDO TESTE DE ESCRITA NA PLANILHA ---");
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    console.log("[TESTE] Autenticação criada.");

    const sheets = google.sheets({ version: 'v4', auth });
    console.log("[TESTE] Cliente do Google Sheets criado.");

    const testRow = [
      new Date().toISOString(),
      'TESTE DE ESCRITA',
      'SE VOCÊ ESTÁ VENDO ISSO, A CONEXÃO FUNCIONOU!',
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
    return res.status(200).json({ status: 'Sucesso', message: 'Teste concluído. Verifique a planilha.' });

  } catch (error) {
    console.error("!!!!!!!!!! [TESTE] OCORREU UM ERRO !!!!!!!!!!", error);
    return res.status(500).json({ status: 'Erro', message: error.message, details: error });
  }
}