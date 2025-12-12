// Script simples para validar a planilha Google Sheets
require('dotenv').config();
const { main } = require('./validate-google-sheets');

console.log('🔄 Iniciando validação da planilha...');
main().then(() => {
    console.log('✅ Validação concluída!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Erro:', error);
    process.exit(1);
});
