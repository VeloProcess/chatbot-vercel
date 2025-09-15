// api/getUserProfile.js

import { google } from "googleapis";

// Configurações
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const SHEET_NAME = "Usuarios"; // Aba onde estão os usuários (alterar se necessário)

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

export default async function handler(req, res) {
  // Configura CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido. Use GET.' });
  }

  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "Email não fornecido" });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:Z`, // Colunas da aba de usuários
    });

    const rows = response.data.values || [];
    if (!rows.length) return res.status(404).json({ error: "Nenhum usuário encontrado na planilha." });

    const header = rows[0];
    const userRow = rows.slice(1).find(row => row[1]?.toLowerCase() === email.toLowerCase()); // email na coluna B

    if (!userRow) return res.status(404).json({ error: "Usuário não encontrado" });

    // Monta objeto com os dados do usuário
    const userData = {};
    header.forEach((key, idx) => {
      userData[key] = userRow[idx] || null;
    });

    return res.status(200).json({ status: "sucesso", user: userData });

  } catch (error) {
    console.error("Erro ao buscar perfil do usuário:", error);
    return res.status(500).json({ error: "Erro interno ao buscar perfil do usuário." });
  }
}
