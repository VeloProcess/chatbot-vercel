// api/getUserProfile.js

import { google } from "googleapis";

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const SHEET_NAME = "Usuarios";

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: "v4", auth });

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "Email não fornecido." });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:B`, // Colunas A e B
    });

    const rows = response.data.values || [];
    if (rows.length < 1) return res.status(404).json({ error: "Nenhum usuário encontrado." });

    const userRow = rows.find(row => row[0]?.toLowerCase() === email.toLowerCase());
    if (!userRow) return res.status(404).json({ error: "Usuário não encontrado." });

    const userData = {
      email: userRow[0],
      cargo: userRow[1] || null,
    };

    return res.status(200).json({ status: "sucesso", user: userData });
  } catch (error) {
    console.error("Erro ao buscar perfil do usuário:", error);
    return res.status(500).json({ error: "Erro interno ao buscar perfil." });
  }
}
