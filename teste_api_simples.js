// Teste simples da API
import fetch from 'node-fetch';

async function testarAPI() {
  try {
    console.log('🚀 Testando API...');
    
    const response = await fetch('http://localhost:3000/api/ask?pergunta=Pix');
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Resposta:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testarAPI();
