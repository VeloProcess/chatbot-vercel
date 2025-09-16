// teste_rapido.js - Teste rápido para portabilidade

import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api/ask';

async function testarPortabilidade() {
  try {
    console.log("🧪 Testando: 'como faz portabilidade'");
    
    const response = await axios.get(BASE_URL, {
      params: {
        pergunta: "como faz portabilidade",
        email: "teste@velotax.com.br"
      }
    });
    
    const dados = response.data;
    
    console.log(`\n📊 RESULTADO:`);
    console.log(`Status: ${dados.status}`);
    console.log(`Source: ${dados.source}`);
    console.log(`SourceRow: ${dados.sourceRow}`);
    
    if (dados.resposta) {
      console.log(`\n💬 Resposta:`);
      console.log(dados.resposta.substring(0, 200) + "...");
    }
    
    if (dados.score) {
      console.log(`\n📈 Score: ${dados.score}`);
    }
    
    if (dados.source === "Planilha") {
      console.log("\n✅ SUCESSO: Encontrou na planilha!");
    } else {
      console.log("\n❌ Ainda não encontrou na planilha");
    }
    
  } catch (error) {
    console.error("❌ ERRO:", error.message);
  }
}

testarPortabilidade();
