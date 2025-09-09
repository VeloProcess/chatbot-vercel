require('dotenv').config();
const { google } = require('googleapis');
const OpenAI = require('openai');

// --- CONFIGURAÇÃO ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const FAQ_SHEET_NAME = "FAQ";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// Função de apoio para adicionar uma pequena pausa e evitar limites da API da OpenAI
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function generateAndStoreEmbeddings() {
  try {
    console.log("1. Lendo todos os dados da planilha FAQ...");
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${FAQ_SHEET_NAME}!A:F`, // Lê até à coluna F para verificar embeddings existentes
    });

    const rows = response.data.values || [];
    if (rows.length < 2) {
      console.log("Planilha FAQ vazia ou sem dados.");
      return;
    }

    const header = rows[0];
    const data = rows.slice(1);
    const embeddingsToUpdate = [];

    console.log(`2. Encontradas ${data.length} linhas para processar...`);

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const existingEmbedding = row[5]; // Coluna F

      // Se já existir um embedding, pula para a próxima linha para economizar tempo e custos.
      if (existingEmbedding && existingEmbedding.startsWith('[')) {
        console.log(`Linha ${i + 2}: Embedding já existe. Pulando.`);
        embeddingsToUpdate.push([existingEmbedding]); // Mantém o valor antigo
        continue;
      }

      const textToEmbed = `${row[0] || ''} - ${row[2] || ''}`; // Combina Pergunta e Resposta

      if (textToEmbed.trim() === '-') {
        console.log(`Linha ${i + 2}: Pulando, pois está vazia.`);
        embeddingsToUpdate.push(['']); // Adiciona uma célula vazia
        continue;
      }

      console.log(`3. Gerando embedding para a linha ${i + 2}...`);
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: textToEmbed,
      });

      const embedding = embeddingResponse.data[0].embedding;
      embeddingsToUpdate.push([JSON.stringify(embedding)]);

      await delay(50); // Adiciona uma pequena pausa de 50ms para ser gentil com a API da OpenAI
    }

    if (embeddingsToUpdate.length > 0) {
        console.log(`4. Preparando para salvar ${embeddingsToUpdate.length} embeddings na planilha de uma só vez...`);
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${FAQ_SHEET_NAME}!F2:F${data.length + 1}`, // Escreve em toda a coluna F de uma vez
            valueInputOption: 'USER_ENTERED',
            resource: {
            values: embeddingsToUpdate,
            },
        });
    }

    console.log("✅ Processo de indexação concluído com sucesso!");

  } catch (error) {
    console.error("❌ Erro durante o processo de indexação:", error.response ? error.response.data : error.message);
  }
}

generateAndStoreEmbeddings();