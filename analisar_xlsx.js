// analisar_xlsx.js - Analisar arquivo Excel da FAQ

import fs from 'fs';
import XLSX from 'xlsx';

async function analisarXLSX() {
  try {
    console.log("📊 Analisando arquivo FAQ (4).xlsx...\n");
    
    // Ler arquivo Excel
    const workbook = XLSX.readFile('FAQ (4).xlsx');
    
    // Listar todas as planilhas
    console.log("📋 Planilhas encontradas:");
    workbook.SheetNames.forEach((name, index) => {
      console.log(`${index + 1}. ${name}`);
    });
    
    // Analisar primeira planilha (ou a principal)
    const sheetName = workbook.SheetNames[0];
    console.log(`\n🔍 Analisando planilha: "${sheetName}"`);
    
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`\n📊 Dados encontrados:`);
    console.log(`- Total de linhas: ${jsonData.length}`);
    console.log(`- Primeira linha (cabeçalho): ${JSON.stringify(jsonData[0])}`);
    
    // Mostrar estrutura das primeiras linhas
    console.log(`\n📋 Primeiras 5 linhas:`);
    for (let i = 0; i < Math.min(5, jsonData.length); i++) {
      console.log(`Linha ${i + 1}: ${JSON.stringify(jsonData[i])}`);
    }
    
    // Analisar colunas
    if (jsonData.length > 0) {
      const cabecalho = jsonData[0];
      console.log(`\n🏷️  Colunas identificadas:`);
      cabecalho.forEach((col, index) => {
        console.log(`${index + 1}. "${col}"`);
      });
    }
    
    // Procurar por tópicos específicos
    console.log(`\n🔍 Procurando tópicos específicos:`);
    const topicos = ['portabilidade', 'pix', 'antecipação', 'celcoin', 'crédito', 'declaração'];
    
    topicos.forEach(topic => {
      const encontrados = jsonData.filter(linha => 
        linha.some(celula => 
          celula && celula.toString().toLowerCase().includes(topic.toLowerCase())
        )
      );
      console.log(`- "${topic}": ${encontrados.length} ocorrências`);
    });
    
    // Salvar como JSON para análise
    const dadosLimpos = jsonData.filter(linha => linha.some(celula => celula && celula.toString().trim() !== ''));
    
    fs.writeFileSync('analise_faq.json', JSON.stringify(dadosLimpos, null, 2));
    console.log(`\n💾 Dados salvos em: analise_faq.json`);
    
    // Sugerir estrutura para migração
    console.log(`\n💡 Sugestão de estrutura para migração:`);
    console.log(`- Coluna A: Pergunta`);
    console.log(`- Coluna B: Palavras-chave`);
    console.log(`- Coluna C: Resposta`);
    console.log(`- Coluna D: Tabulacoes (opcional)`);
    
    return dadosLimpos;
    
  } catch (error) {
    console.error("❌ Erro ao analisar XLSX:", error.message);
    
    // Verificar se o arquivo existe
    if (fs.existsSync('FAQ (4).xlsx')) {
      console.log("✅ Arquivo encontrado, mas erro ao processar");
    } else {
      console.log("❌ Arquivo não encontrado");
    }
    
    return null;
  }
}

// Executar análise
if (import.meta.url === `file://${process.argv[1]}`) {
  analisarXLSX().catch(console.error);
}

export { analisarXLSX };
