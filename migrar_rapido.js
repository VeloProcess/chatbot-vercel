// migrar_rapido.js - Migração rápida da planilha

import fs from 'fs';
import XLSX from 'xlsx';

async function migrarRapido() {
  try {
    console.log("🚀 Migração rápida iniciada...");
    
    // Ler planilha FAQ
    const workbook = XLSX.readFile('FAQ (4).xlsx');
    const worksheet = workbook.Sheets['FAQ'];
    const dados = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`📊 ${dados.length} linhas encontradas`);
    
    // Converter para formato da base
    const baseAtualizada = [];
    
    for (let i = 1; i < dados.length; i++) {
      const linha = dados[i];
      if (linha[0] && linha[1] && linha[2]) {
        baseAtualizada.push({
          id: `FAQ_${i.toString().padStart(3, '0')}`,
          pergunta: linha[0] || '',
          palavras_chave: linha[1] || '',
          resposta: linha[2] || '',
          tabulacoes: linha[3] || '',
          categoria: 'faq',
          status: 'ativo',
          ultima_atualizacao: new Date().toISOString().split('T')[0]
        });
      }
    }
    
    // Salvar base atualizada
    fs.writeFileSync('data/base_atualizada.json', JSON.stringify(baseAtualizada, null, 2));
    
    console.log(`✅ ${baseAtualizada.length} itens migrados`);
    console.log(`💾 Salvo em: data/base_atualizada.json`);
    
    // Mostrar alguns exemplos
    console.log(`\n📋 Exemplos migrados:`);
    baseAtualizada.slice(0, 3).forEach((item, i) => {
      console.log(`${i + 1}. ${item.pergunta}`);
    });
    
    return baseAtualizada;
    
  } catch (error) {
    console.error("❌ Erro:", error.message);
    return null;
  }
}

// Executar
migrarRapido().then(() => {
  console.log("\n🎉 Migração concluída!");
}).catch(console.error);
