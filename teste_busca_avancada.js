
// Teste do sistema de busca ULTRA-AVANÇADO
import { MongoClient } from 'mongodb';

const MONGODB_URI = 'mongodb+srv://gabrielaraujo:sGoeqQgbxlsIwnjc@clustercentral.quqgq6x.mongodb.net/?retryWrites=true&w=majority&appName=ClusterCentral';
const DB_NAME = 'console_conteudo';
const COLLECTION_NAME = 'Bot_perguntas';

// Casos de teste
const casosTeste = [
  "como faz portabilidade",
  "portar conta",
  "antecipação restituição",
  "quando posso receber",
  "problema com conta",
  "valor da taxa",
  "documentos necessários",
  "aprovação negada",
  "celcoin conta",
  "tempo de liberação"
];

async function testarBusca() {
  let client = null;
  
  try {
    console.log('🚀 Iniciando teste do sistema de busca ULTRA-AVANÇADO...\n');
    
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    console.log('✅ Conectado ao MongoDB\n');
    
    for (const pergunta of casosTeste) {
      console.log(`\n🔍 Testando: "${pergunta}"`);
      console.log('─'.repeat(50));
      
      try {
        const response = await fetch(`http://localhost:3000/api/ask?pergunta=${encodeURIComponent(pergunta)}`);
        const resultado = await response.json();
        
        if (resultado.status === 'sucesso') {
          console.log(`✅ ENCONTRADO!`);
          console.log(`📊 Score: ${resultado.score}`);
          console.log(`🎯 Tipo: ${resultado.matchType}`);
          console.log(`📝 Pergunta Original: "${resultado.perguntaOriginal}"`);
          console.log(`💬 Resposta: ${resultado.resposta.substring(0, 100)}...`);
          if (resultado.similaridade) {
            console.log(`📈 Similaridade: P=${resultado.similaridade.pergunta?.toFixed(2) || 'N/A'}, K=${resultado.similaridade.palavras?.toFixed(2) || 'N/A'}, R=${resultado.similaridade.resposta?.toFixed(2) || 'N/A'}`);
          }
        } else {
          console.log(`❌ NÃO ENCONTRADO`);
          console.log(`💡 Sugestões: ${resultado.sugestoes?.join(', ') || 'Nenhuma'}`);
        }
        
      } catch (error) {
        console.log(`❌ ERRO: ${error.message}`);
      }
      
      // Pequena pausa entre testes
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n🎉 Teste concluído!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Executar teste
testarBusca();
