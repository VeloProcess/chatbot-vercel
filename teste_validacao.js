// teste_validacao.js - Validação do sistema com nova planilha

import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api/ask';
const EMAIL_TESTE = 'teste@velotax.com.br';

// Casos de teste baseados nos tópicos que você mencionou
const casosTeste = [
  {
    nome: "Portabilidade PIX",
    pergunta: "como faz portabilidade",
    esperado: "planilha"
  },
  {
    nome: "Abertura Conta Celcoin",
    pergunta: "abertura de conta celcoin",
    esperado: "planilha"
  },
  {
    nome: "Antecipação Restituição",
    pergunta: "antecipação da restituição",
    esperado: "planilha"
  },
  {
    nome: "Crédito Trabalhador",
    pergunta: "crédito do trabalhador",
    esperado: "planilha"
  },
  {
    nome: "Declaração IR",
    pergunta: "declaração de imposto de renda",
    esperado: "planilha"
  },
  {
    nome: "VeloPrime",
    pergunta: "veloprime",
    esperado: "planilha"
  },
  {
    nome: "PIX Cadastro",
    pergunta: "pix cadastro na celcoin",
    esperado: "planilha"
  },
  {
    nome: "Malha Fina",
    pergunta: "acompanhamento de malha fina",
    esperado: "planilha"
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
    
    if (dados.sourceRow) {
      console.log(`📋 SourceRow: ${dados.sourceRow}`);
    }
    
    if (dados.score) {
      console.log(`📈 Score: ${dados.score}`);
    }
    
    if (dados.cached) {
      console.log(`💾 Cache Hit`);
    }
    
    // Validação
    let validacao = "❌ FALHOU";
    if (dados.source === "Planilha" && dados.status === "sucesso") {
      validacao = "✅ PASSOU (Planilha)";
    } else if (dados.source === "Planilha" && dados.status === "clarification_needed") {
      validacao = "✅ PASSOU (Múltiplas opções)";
    } else if (dados.source === "IA") {
      validacao = "⚠️  IA (não encontrou na planilha)";
    }
    
    console.log(`🎯 Resultado: ${validacao}`);
    
    if (dados.resposta && dados.resposta.length > 0) {
      console.log(`💬 Resposta: ${dados.resposta.substring(0, 100)}...`);
    }
    
    return {
      caso: caso.nome,
      tempo,
      validacao: validacao.includes("✅"),
      status: dados.status,
      source: dados.source,
      score: dados.score || 0
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
  console.log("🚀 Validando sistema com nova planilha...\n");
  
  const resultados = [];
  
  for (const caso of casosTeste) {
    const resultado = await executarTeste(caso);
    resultados.push(resultado);
    
    // Pausa entre testes
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Relatório final
  console.log("\n" + "=".repeat(60));
  console.log("📊 RELATÓRIO DE VALIDAÇÃO");
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
  console.log(`📋 Planilha: ${planilha}/${total} (${Math.round(planilha/total*100)}%)`);
  console.log(`🤖 IA: ${ia}/${total} (${Math.round(ia/total*100)}%)`);
  console.log(`💾 Cache: ${cache}/${total}`);
  
  // Scores médios
  const scores = resultados.filter(r => r.score > 0).map(r => r.score);
  if (scores.length > 0) {
    const scoreMedio = scores.reduce((acc, s) => acc + s, 0) / scores.length;
    console.log(`📈 Score médio: ${Math.round(scoreMedio)}`);
  }
  
  console.log("\n📋 Detalhes por teste:");
  resultados.forEach(r => {
    const status = r.validacao ? "✅" : "❌";
    const fonte = r.source || "ERRO";
    const score = r.score ? ` (${r.score})` : "";
    console.log(`${status} ${r.caso}: ${r.tempo}ms - ${fonte}${score}`);
  });
  
  // Análise de performance
  console.log("\n📈 Análise de Performance:");
  if (passou/total >= 0.8) {
    console.log("🎉 EXCELENTE: 80%+ dos testes passaram!");
  } else if (passou/total >= 0.6) {
    console.log("👍 BOM: 60%+ dos testes passaram");
  } else {
    console.log("⚠️  ATENÇÃO: Menos de 60% dos testes passaram");
  }
  
  if (planilha/total >= 0.7) {
    console.log("📋 BOA COBERTURA: 70%+ encontrados na planilha");
  } else {
    console.log("⚠️  BAIXA COBERTURA: Menos de 70% na planilha");
  }
  
  console.log("\n🎉 Validação concluída!");
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  executarTodosTestes().catch(console.error);
}

export { executarTeste, executarTodosTestes };
