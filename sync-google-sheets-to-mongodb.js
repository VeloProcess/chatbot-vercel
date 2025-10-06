// Script para sincronizar Google Sheets com MongoDB
// A planilha é a fonte da verdade

const { MongoClient } = require('mongodb');
const { google } = require('googleapis');

// --- CONFIGURAÇÃO MONGODB ---
const MONGODB_URI = "mongodb+srv://gabrielaraujo:sGoeqQgbxlsIwnjc@velohubcentral.od7vwts.mongodb.net/";
const DB_NAME = "console_conteudo";
const COLLECTION_NAME = "Bot_perguntas";

// --- CONFIGURAÇÃO GOOGLE SHEETS ---
const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ"; // Substitua pelo ID da sua planilha
const SHEET_NAME = "FAQ!A:E"; // Ajuste conforme suas colunas

// --- CONFIGURAR GOOGLE SHEETS ---
let auth, sheets;

try {
    if (!process.env.GOOGLE_CREDENTIALS) {
        throw new Error('GOOGLE_CREDENTIALS não configurado');
    }
    
    auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Google Sheets configurado');
} catch (error) {
    console.error('❌ Erro ao configurar Google Sheets:', error.message);
    process.exit(1);
}

// --- FUNÇÃO PARA BUSCAR DADOS DA PLANILHA ---
async function getSheetData() {
    try {
        console.log('🔍 Buscando dados da planilha...');
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_NAME,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            throw new Error('Nenhum dado encontrado na planilha');
        }

        // Converter para objetos (pular cabeçalho se houver)
        const data = rows.slice(1).map((row, index) => ({
            pergunta: row[0] || '',
            resposta: row[1] || '',
            palavrasChave: row[2] || '',
            sinonimos: row[3] || '',
            tabulacao: row[4] || '',
            createdAt: new Date(),
            updatedAt: new Date()
        })).filter(item => item.pergunta.trim() !== ''); // Filtrar linhas vazias

        console.log('✅ Dados da planilha obtidos:', data.length, 'registros');
        return data;
    } catch (error) {
        console.error('❌ Erro ao buscar dados da planilha:', error);
        throw error;
    }
}

// --- FUNÇÃO PARA BUSCAR DADOS DO MONGODB ---
async function getMongoData(client) {
    try {
        console.log('🔍 Buscando dados do MongoDB...');
        
        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);
        
        const data = await collection.find({}).toArray();
        console.log('✅ Dados do MongoDB obtidos:', data.length, 'registros');
        return data;
    } catch (error) {
        console.error('❌ Erro ao buscar dados do MongoDB:', error);
        throw error;
    }
}

// --- FUNÇÃO PARA COMPARAR E SINCRONIZAR ---
async function syncData(sheetData, mongoData, client) {
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    console.log('🔄 Iniciando sincronização...');
    
    // Criar mapas para comparação rápida
    const sheetMap = new Map();
    const mongoMap = new Map();
    
    // Mapear dados da planilha
    sheetData.forEach(item => {
        if (item.pergunta && typeof item.pergunta === 'string') {
            const key = item.pergunta.toLowerCase().trim();
            sheetMap.set(key, item);
        }
    });
    
    // Mapear dados do MongoDB
    mongoData.forEach(item => {
        if (item.pergunta && typeof item.pergunta === 'string') {
            const key = item.pergunta.toLowerCase().trim();
            mongoMap.set(key, item);
        }
    });
    
    let added = 0;
    let updated = 0;
    let removed = 0;
    
    // 1. ADICIONAR/ATUALIZAR: Para cada item da planilha
    for (const [key, sheetItem] of sheetMap) {
        const mongoItem = mongoMap.get(key);
        
        if (!mongoItem) {
            // Item não existe no MongoDB - ADICIONAR
            await collection.insertOne(sheetItem);
            added++;
            console.log('➕ Adicionado:', sheetItem.pergunta);
        } else {
            // Item existe - verificar se precisa ATUALIZAR
            const needsUpdate = 
                mongoItem.resposta !== sheetItem.resposta ||
                mongoItem.palavrasChave !== sheetItem.palavrasChave ||
                mongoItem.sinonimos !== sheetItem.sinonimos ||
                mongoItem.tabulacao !== sheetItem.tabulacao;
            
            if (needsUpdate) {
                // Atualizar com updatedAt
                const updateData = {
                    ...sheetItem,
                    updatedAt: new Date()
                };
                await collection.updateOne(
                    { _id: mongoItem._id },
                    { $set: updateData }
                );
                updated++;
                console.log('🔄 Atualizado:', sheetItem.pergunta);
            }
        }
    }
    
    // 2. REMOVER: Itens que estão no MongoDB mas não na planilha
    for (const [key, mongoItem] of mongoMap) {
        if (!sheetMap.has(key)) {
            await collection.deleteOne({ _id: mongoItem._id });
            removed++;
            console.log('➖ Removido:', mongoItem.pergunta);
        }
    }
    
    console.log('✅ Sincronização concluída:');
    console.log('   ➕ Adicionados:', added);
    console.log('   🔄 Atualizados:', updated);
    console.log('   ➖ Removidos:', removed);
    console.log('   📊 Total na planilha:', sheetData.length);
    console.log('   📊 Total no MongoDB:', await collection.countDocuments());
}

// --- FUNÇÃO PRINCIPAL ---
async function main() {
    let client;
    
    try {
        console.log('🚀 Iniciando sincronização Google Sheets → MongoDB');
        
        // Conectar ao MongoDB
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        console.log('✅ Conectado ao MongoDB');
        
        // Buscar dados
        const sheetData = await getSheetData();
        const mongoData = await getMongoData(client);
        
        // Sincronizar
        await syncData(sheetData, mongoData, client);
        
        console.log('🎉 Sincronização finalizada com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro na sincronização:', error);
    } finally {
        if (client) {
            await client.close();
            console.log('✅ Conexão MongoDB fechada');
        }
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    main();
}

module.exports = { main, getSheetData, getMongoData, syncData };
