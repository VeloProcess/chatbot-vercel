// Script de teste para o endpoint de log
require('dotenv').config();

async function testLogEndpoint() {
  const testData = {
    type: 'question',
    payload: {
      question: 'Como negociar dívida?',
      email: 'teste@velotax.com.br',
      achou: 'Sim',
      resposta: 'Para negociar uma dívida, entre em contato com o setor de cobrança.',
      categoria: 'Negociação/Desconto'
    }
  };

  try {
    const response = await fetch('http://localhost:3000/api/logQuestion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Erro ao testar:', error);
  }
}

testLogEndpoint();

