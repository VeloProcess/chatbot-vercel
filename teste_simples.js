// teste_simples.js - Teste da busca simplificada (80/20)

import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api/ask';
const EMAIL_TESTE = 'teste@velotax.com.br';

// Casos de teste baseados nos tópicos reais da planilha
const casosTeste = [
  {
    nome: "Busca Exata - Antecipação",
    pergunta: "antecipação da restituição",
    esperado: "exact"
  },
  {
    nome: "Busca Exata - Celcoin",
    pergunta: "abertura de conta celcoin",
    esperado: "exact"
  },
  {
    nome: "Busca Exata - Crédito",
    pergunta: "crédito do trabalhador",
    esperado: "exact"
  },
  {
    nome: "Busca Exata - PIX",
    pergunta: "pix cadastro na celcoin",
    esperado: "exact"
  },
  {
    nome: "Busca Exata - Declaração",
    pergunta: "declaração de imposto de renda",
    esperado: "exact"
  },
  {
    nome: "Busca Exata - VeloPrime",
    pergunta: "veloprime ações no exterior",
    esperado: "exact"
  },
  {
    nome: "Busca Parcial - Antecipação",
    pergunta: "como funciona a antecipação",
    esperado: "partial"
  },
  {
    nome: "Busca Parcial - Crédito",
    pergunta: "quanto tempo para receber crédito",
    esperado: "partial"
  },
  {
    nome: "Busca Parcial - PIX",
    pergunta: "problema com pix",
    esperado: "partial"
  },
  {
    nome: "Busca Parcial - Declaração",
    pergunta: "erro na declaração",
    esperado: "partial"
  }
];

async function executarTeste(caso) {
  try {
    console.log(`\n🧪 Testando: ${caso.nome}`);
    console.log(`❓ Pergunta: "${caso.pergunta}"`);
    
    const inicio = Date.now();
    const response = await axios.get(BASE_URL, {
      params: {
        pergunta: caso.pergunta,
        email: EMAIL_TESTE
      }
    });
    const tempo = Date.now() - inicio;
    
    const dados = response.data;
    
    console.log(`⏱️  Tempo: ${tempo}ms`);
    console.log(`📊 Status: ${dados.status}`);
    console.log(`🎯 Source: ${dados.source}`);
    
    if (dados.score) {
      console.log(`📈 Score: ${dados.score}`);
    }
    
    if (dados.cached) {
      console.log(`💾 Cache Hit`);
    }
    
    // Validação simples
    let validacao = "❌ FALHOU";
    
    if (dados.status === "sucesso" && dados.source === "Planilha") {
      validacao = "✅ PASSOU";
    } else if (dados.status === "clarification_needed" && dados.options) {
      validacao = "✅ PASSOU (Múltiplas opções)";
    } else if (dados.status === "sucesso_ia" && dados.source === "IA") {
      validacao = "✅ PASSOU (IA)";
    }
    
    console.log(`🎯 Resultado: ${validacao}`);
    
    return {
      caso: caso.nome,
      tempo,
      validacao: validacao.includes("✅"),
      status: dados.status,
      source: dados.source
    };
    
  } catch (error) {
    console.log(`❌ ERRO: ${error.message}`);
    return {
      caso: caso.nome,
      tempo: 0,
      validacao: false,
      erro: error.message
    };
  }
}

async function executarTodosTestes() {
  console.log("🚀 Testando busca simplificada (80/20)...\n");
  
  const resultados = [];
  
  for (const caso of casosTeste) {
    const resultado = await executarTeste(caso);
    resultados.push(resultado);
    
    // Pausa entre testes
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Relatório final
  console.log("\n" + "=".repeat(60));
  console.log("📊 RELATÓRIO FINAL - BUSCA SIMPLIFICADA");
  console.log("=".repeat(60));
  
  const passou = resultados.filter(r => r.validacao).length;
  const total = resultados.length;
  const tempoMedio = resultados.reduce((acc, r) => acc + r.tempo, 0) / total;
  
  console.log(`✅ Testes que passaram: ${passou}/${total} (${Math.round(passou/total*100)}%)`);
  console.log(`⏱️  Tempo médio: ${Math.round(tempoMedio)}ms`);
  
  // Estatísticas por fonte
  const planilha = resultados.filter(r => r.source === "Planilha").length;
  const ia = resultados.filter(r => r.source === "IA").length;
  const cache = resultados.filter(r => r.cached).length;
  
  console.log(`\n📊 Estatísticas:`);
  console.log(`📋 Planilha: ${planilha}/${total}`);
  console.log(`🤖 IA: ${ia}/${total}`);
  console.log(`💾 Cache: ${cache}/${total}`);
  
  console.log("\n📋 Detalhes por teste:");
  resultados.forEach(r => {
    const status = r.validacao ? "✅" : "❌";
    const fonte = r.source || "ERRO";
    console.log(`${status} ${r.caso}: ${r.tempo}ms (${fonte})`);
  });
  
  console.log("\n🎉 Teste concluído!");
  console.log("\n💡 Dica: Se muitos testes falharam, verifique se:");
  console.log("   - O servidor está rodando (npm run dev)");
  console.log("   - A planilha tem os tópicos corretos");
  console.log("   - As colunas estão na ordem: Pergunta, Palavras-chave, Resposta");
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  executarTodosTestes().catch(console.error);
}

export { executarTeste, executarTodosTestes };
