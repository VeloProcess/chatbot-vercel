const { google } = require("googleapis");

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const SHEET_NAME = "AtualizacoesBot";

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// --- Busca a última atualização ---
async function buscarUltimaAtualizacao(email) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_NAME + "!A:D",
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return null; // sem dados
  const cabecalho = rows[0];
  const dados = rows.slice(1);

  // pega a última linha
  const ultima = dados[dados.length - 1];
  const [versao, data, texto, usuariosLidos] = ultima;
  const lido = usuariosLidos?.split(",").map(u => u.trim()) || [];

  return {
    versao,
    data,
    texto,
    lido,
    estaLido: lido.includes(email)
  };
}

// --- Marca como lida ---
async function marcarComoLido(email) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_NAME + "!A:D",
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return;

  const ultima = rows[rows.length - 1];
  const [versao, data, texto, usuariosLidos] = ultima;
  const lido = usuariosLidos?.split(",").map(u => u.trim()) || [];
  if (!lido.includes(email)) lido.push(email);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!D${rows.length}`,
    valueInputOption: "RAW",
    resource: { values: [[lido.join(", ")]] },
  });
}
