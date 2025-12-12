// Script para validar estrutura da planilha Google Sheets
// Substitui o sync-google-sheets-to-mongodb.js

const { google } = require('googleapis');

// --- CONFIGURAÇÃO GOOGLE SHEETS ---
const SPREADSHEET_ID = "1d0h9zr4haDx6etLtdMqPVsBXdVvH7n9OsRdqAhOJOp0";
const FAQ_SHEET_NAME = "FAQ!A:D"; // Pergunta, Resposta, Palavras-chave, Sinônimos

// --- CONFIGURAR GOOGLE SHEETS ---
let auth, sheets;

try {
    if (!process.env.GOOGLE_CREDENTIALS) {
        throw new Error('GOOGLE_CREDENTIALS não configurado');
    }
    
    auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Google Sheets configurado');
} catch (error) {
    console.error('❌ Erro ao configurar Google Sheets:', error.message);
    process.exit(1);
}

// --- FUNÇÃO PARA VALIDAR ESTRUTURA DA PLANILHA ---
async function validateSheetStructure() {
    try {
        console.log('🔍 Validando estrutura da planilha...');
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: FAQ_SHEET_NAME,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            throw new Error('Nenhum dado encontrado na planilha');
        }

        const cabecalho = rows[0];
        const dados = rows.slice(1);

        console.log('📊 Estrutura encontrada:');
        console.log('   Cabeçalho:', cabecalho);
        console.log('   Total de linhas:', rows.length);
        console.log('   Linhas de dados:', dados.length);

        // Validar colunas esperadas
        const colunasEsperadas = ['Pergunta', 'Resposta', 'Palavras-chave', 'Sinonimos'];
        const colunasEncontradas = cabecalho.map(col => col ? col.trim() : '');

        console.log('\n🔍 Validação de colunas:');
        colunasEsperadas.forEach((colEsperada, index) => {
            const encontrada = colunasEncontradas.some(col => 
                col.toLowerCase().includes(colEsperada.toLowerCase())
            );
            console.log(`   ${colEsperada}: ${encontrada ? '✅' : '❌'}`);
        });

        // Validar linhas vazias
        const linhasVazias = dados.filter(row => !row || row.length === 0 || !row[0] || row[0].trim() === '');
        console.log(`\n📋 Linhas vazias encontradas: ${linhasVazias.length}`);

        // Estatísticas
        const linhasValidas = dados.filter(row => row && row[0] && row[0].trim() !== '');
        console.log(`\n✅ Linhas válidas: ${linhasValidas.length}`);
        console.log(`📊 Taxa de preenchimento: ${((linhasValidas.length / dados.length) * 100).toFixed(2)}%`);

        // Mostrar primeiras linhas válidas como exemplo
        console.log('\n📝 Primeiras 3 linhas válidas:');
        linhasValidas.slice(0, 3).forEach((row, index) => {
            console.log(`   Linha ${index + 1}:`, {
                pergunta: row[0]?.substring(0, 50) + '...',
                resposta: row[1] ? (row[1].substring(0, 50) + '...') : 'vazia',
                palavrasChave: row[2] || 'vazia'
            });
        });

        console.log('\n✅ Validação concluída com sucesso!');
        return {
            success: true,
            totalRows: rows.length,
            validRows: linhasValidas.length,
            emptyRows: linhasVazias.length,
            header: cabecalho
        };
        
    } catch (error) {
        console.error('❌ Erro ao validar planilha:', error);
        throw error;
    }
}

// --- FUNÇÃO PRINCIPAL ---
async function main() {
    try {
        console.log('🚀 Iniciando validação da planilha Google Sheets');
        console.log(`📋 Planilha ID: ${SPREADSHEET_ID}`);
        console.log(`📋 Aba: ${FAQ_SHEET_NAME}\n`);
        
        const result = await validateSheetStructure();
        
        console.log('\n🎉 Validação finalizada com sucesso!');
        console.log('📊 Resumo:', result);
        
    } catch (error) {
        console.error('❌ Erro na validação:', error);
        process.exit(1);
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    main();
}

module.exports = { main, validateSheetStructure };

