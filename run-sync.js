// Script simples para executar a sincronização
require('dotenv').config();
const { main } = require('./sync-google-sheets-to-mongodb');

console.log('🔄 Iniciando sincronização...');
main().then(() => {
    console.log('✅ Sincronização concluída!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Erro:', error);
    process.exit(1);
});
