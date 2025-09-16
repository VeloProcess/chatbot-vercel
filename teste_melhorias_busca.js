// teste_melhorias_busca.js - Script para testar as melhorias de busca

import axios from 'axios';

// Configurações do teste
const BASE_URL = 'http://localhost:3000/api/ask';
const EMAIL_TESTE = 'teste@velotax.com.br';

// Casos de teste para validar as melhorias
const casosTeste = [
  {
    nome: "Busca Exata",
    pergunta: "antecipação de restituição",
    esperado: "exact"
  },
  {
    nome: "Busca com Sinônimos",
    pergunta: "adiantamento do ir",
    esperado: "synonym"
  },
  {
    nome: "Busca Parcial",
    pergunta: "como consultar cpf",
    esperado: "partial"
  },
  {
    nome: "Busca Semântica",
    pergunta: "problema com conta digital",
    esperado: "semantic"
  },
  {
    nome: "Análise de Intenção - Problema",
    pergunta: "não consigo acessar minha conta",
    esperado: "problema"
  },
  {
    nome: "Análise de Intenção - Procedimento",
    pergunta: "como fazer a antecipação",
    esperado: "procedimento"
  },
  {
    nome: "Análise de Tema - Antecipação",
    pergunta: "quando recebo o pix da restituição",
    esperado: "antecipacao"
  },
  {
    nome: "Análise de Tema - Celcoin",
    pergunta: "como abrir conta no app",
    esperado: "celcoin"
  },
  {
    nome: "Cache - Segunda Consulta",
    pergunta: "antecipação de restituição",
    esperado: "cached"
  },
  {
    nome: "Urgência",
    pergunta: "urgente: conta bloqueada agora",
    esperado: "urgencia"
  }
];

// Função para executar teste
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
    
    if (dados.matchType) {
      console.log(`🔍 Match Type: ${dados.matchType}`);
    }
    
    if (dados.score) {
      console.log(`📈 Score: ${dados.score}`);
    }
    
    if (dados.contexto) {
      console.log(`🧠 Contexto:`, dados.contexto);
    }
    
    if (dados.cached) {
      console.log(`💾 Cache Hit: ${dados.hits} hits`);
    }
    
    // Validação dos resultados
    let validacao = "❌ FALHOU";
    
    if (caso.esperado === "exact" && dados.matchType === "exact") {
      validacao = "✅ PASSOU";
    } else if (caso.esperado === "synonym" && dados.matchType === "keyword") {
      validacao = "✅ PASSOU";
    } else if (caso.esperado === "partial" && dados.matchType === "partial") {
      validacao = "✅ PASSOU";
    } else if (caso.esperado === "semantic" && dados.matchType === "semantic") {
      validacao = "✅ PASSOU";
    } else if (caso.esperado === "problema" && dados.contexto?.intencao?.includes("problema")) {
      validacao = "✅ PASSOU";
    } else if (caso.esperado === "procedimento" && dados.contexto?.intencao?.includes("procedimento")) {
      validacao = "✅ PASSOU";
    } else if (caso.esperado === "antecipacao" && dados.contexto?.tema === "antecipacao") {
      validacao = "✅ PASSOU";
    } else if (caso.esperado === "celcoin" && dados.contexto?.tema === "celcoin") {
      validacao = "✅ PASSOU";
    } else if (caso.esperado === "cached" && dados.cached) {
      validacao = "✅ PASSOU";
    } else if (caso.esperado === "urgencia" && dados.contexto?.urgencia === "alta") {
      validacao = "✅ PASSOU";
    }
    
    console.log(`🎯 Validação: ${validacao}`);
    
    return {
      caso: caso.nome,
      tempo,
      validacao: validacao.includes("✅"),
      dados
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

// Função principal
async function executarTodosTestes() {
  console.log("🚀 Iniciando testes das melhorias de busca...\n");
  
  const resultados = [];
  
  for (const caso of casosTeste) {
    const resultado = await executarTeste(caso);
    resultados.push(resultado);
    
    // Pausa entre testes para não sobrecarregar
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Relatório final
  console.log("\n" + "=".repeat(60));
  console.log("📊 RELATÓRIO FINAL DOS TESTES");
  console.log("=".repeat(60));
  
  const passou = resultados.filter(r => r.validacao).length;
  const total = resultados.length;
  const tempoMedio = resultados.reduce((acc, r) => acc + r.tempo, 0) / total;
  
  console.log(`✅ Testes que passaram: ${passou}/${total} (${Math.round(passou/total*100)}%)`);
  console.log(`⏱️  Tempo médio: ${Math.round(tempoMedio)}ms`);
  
  console.log("\n📋 Detalhes por teste:");
  resultados.forEach(r => {
    const status = r.validacao ? "✅" : "❌";
    console.log(`${status} ${r.caso}: ${r.tempo}ms`);
  });
  
  // Estatísticas de cache
  const cacheHits = resultados.filter(r => r.dados?.cached).length;
  console.log(`\n💾 Cache hits: ${cacheHits}/${total}`);
  
  // Estatísticas de contexto
  const comContexto = resultados.filter(r => r.dados?.contexto).length;
  console.log(`🧠 Análise de contexto: ${comContexto}/${total}`);
  
  console.log("\n🎉 Testes concluídos!");
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  executarTodosTestes().catch(console.error);
}

export { executarTeste, executarTodosTestes };
