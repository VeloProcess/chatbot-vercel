import { MongoClient } from 'mongodb';

// Versão simplificada para teste
const MONGODB_URI = 'mongodb+srv://gabrielaraujo:sGoeqQgbxlsIwnjc@clustercentral.quqgq6x.mongodb.net/?retryWrites=true&w=majority&appName=ClusterCentral';
const DB_NAME = 'console_conteudo';
const COLLECTION_NAME = 'Bot_perguntas';

// Mapeamento de palavras-chave para categorias
const CATEGORIAS_KEYWORDS = {
  'credito': ['crédito', 'credito', 'antecipação', 'antecipacao', 'trabalhador', 'pessoal', 'empréstimo', 'emprestimo'],
  'antecipacao': ['antecipação', 'antecipacao', 'antecipar', 'restituição', 'restituicao'],
  'credito_trabalhador': ['trabalhador', 'consignado', 'salário', 'salario'],
  'credito_pessoal': ['pessoal', 'empréstimo', 'emprestimo', 'crédito pessoal'],
  'lotes': ['lote', 'lotes', 'data', 'restituição', 'restituicao'],
  'pix': ['pix', 'pagamento', 'transferência', 'transferencia'],
  'conta': ['conta', 'cadastro', 'abertura', 'documento'],
  'app': ['app', 'aplicativo', 'download', 'atualização', 'atualizacao'],
  'declaracao': ['declaração', 'declaracao', 'imposto', 'renda', 'irpf'],
  'veloprime': ['veloprime', 'investimento', 'investir', 'rentabilidade']
};

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { categoria } = req.query;
    
    console.log(`🔍 API Sugestões chamada - Categoria: ${categoria}`);
    
    if (!categoria) {
      return res.status(400).json({
        status: 'erro',
        error: 'Categoria não fornecida'
      });
    }

    // Buscar palavras-chave para a categoria
    const keywords = CATEGORIAS_KEYWORDS[categoria];
    
    if (!keywords) {
      return res.status(404).json({
        status: 'erro',
        error: 'Categoria não encontrada'
      });
    }

    console.log(`🔍 Keywords encontradas: ${keywords.join(', ')}`);

    // Por enquanto, retornar dados mockados para testar se a API funciona
    const titulos = {
      'credito': 'Você deseja saber mais sobre qual assunto de crédito?',
      'antecipacao': 'Sobre Antecipação da Restituição:',
      'credito_trabalhador': 'Sobre Crédito do Trabalhador:',
      'credito_pessoal': 'Sobre Crédito Pessoal:',
      'lotes': 'Data dos Créditos (Lotes):',
      'pix': 'PIX e Pagamentos:',
      'conta': 'Abertura e Gestão de Conta:',
      'app': 'App e Tecnologia:',
      'declaracao': 'Declaração de Imposto de Renda:',
      'veloprime': 'VeloPrime e Investimentos:'
    };

    // Dados mockados para teste
    const opcoes = [
      {
        texto: `Teste de sugestão para ${categoria}`,
        pergunta: `Como funciona ${categoria}?`,
        resposta: `Esta é uma resposta de teste para a categoria ${categoria}.`
      },
      {
        texto: `Outra sugestão para ${categoria}`,
        pergunta: `Quais são os benefícios de ${categoria}?`,
        resposta: `Benefícios de teste para ${categoria}.`
      }
    ];

    const resposta = {
      status: 'sucesso',
      titulo: titulos[categoria] || 'Sugestões relacionadas:',
      opcoes: opcoes
    };

    console.log(`✅ Resposta enviada: ${JSON.stringify(resposta).substring(0, 100)}...`);
    
    return res.status(200).json(resposta);

  } catch (error) {
    console.error('❌ Erro na API de sugestões:', error);
    return res.status(500).json({
      status: 'erro',
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}