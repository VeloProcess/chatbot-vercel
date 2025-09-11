const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const SHEET_NAME = "AtualizacoesBot";

// Configurar autenticação
const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json", // Caminho para sua credencial do Google Service Account
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

async function getBotUpdates(req, res) {
    try {
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:C`, // Supondo: Coluna A = Data, B = Atualização, C = Status
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return res.json({ temAtualizacao: false, ultimaAtualizacao: null });
        }

        // Pega a última linha marcada como "Ativa" na Coluna C
        const ultimaLinhaAtiva = rows.reverse().find(row => row[2]?.toLowerCase() === 'ativa');

        if (!ultimaLinhaAtiva) {
            return res.json({ temAtualizacao: false, ultimaAtualizacao: null });
        }

        const ultimaAtualizacao = ultimaLinhaAtiva[1]; // Coluna B = descrição
        return res.json({ temAtualizacao: true, ultimaAtualizacao });
    } catch (error) {
        console.error("Erro ao buscar atualizações do bot:", error);
        return res.status(500).json({ temAtualizacao: false, ultimaAtualizacao: null });
    }
}

module.exports = { getBotUpdates };
