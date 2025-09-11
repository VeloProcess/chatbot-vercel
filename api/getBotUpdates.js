import { google } from 'googleapis';

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const SHEET_NAME = "AtualizacoesBot";

// Função para ler dados da planilha
async function getBotUpdatesFromSheet() {
    const auth = new google.auth.GoogleAuth({
        keyFile: "credentials.json",
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:C`
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return { temAtualizacao: false, ultimaAtualizacao: null };

    const ultimaLinhaAtiva = rows.reverse().find(row => row[2]?.toLowerCase() === 'ativa');
    if (!ultimaLinhaAtiva) return { temAtualizacao: false, ultimaAtualizacao: null };

    return { temAtualizacao: true, ultimaAtualizacao: ultimaLinhaAtiva[1] };
}

// Exportação padrão obrigatória para API routes (Vercel, Netlify)
export default async function handler(req, res) {
    try {
        const updates = await getBotUpdatesFromSheet();
        res.status(200).json(updates);
    } catch (error) {
        console.error("Erro ao buscar atualizações do bot:", error);
        res.status(500).json({ temAtualizacao: false, ultimaAtualizacao: null });
    }
}