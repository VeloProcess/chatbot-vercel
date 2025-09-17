import { MongoClient } from 'mongodb';


const MONGODB_URI = 'mongodb+srv://gabrielaraujo:sGoeqQgbxlsIwnjc@clustercentral.quqgq6x.mongodb.net/?retryWrites=true&w=majority&appName=ClusterCentral';
const DB_NAME = 'console_conteudo';
const COLLECTION_NAME = 'Bot_perguntas';

let client = null;
let db = null;

async function conectarMongoDB() {
  if (!client) {
    try {
      client = new MongoClient(MONGODB_URI);
      await client.connect();
      db = client.db(DB_NAME);
      console.log('✅ Conectado ao MongoDB');
    } catch (error) {
      console.error('❌ Erro ao conectar MongoDB:', error.message);
      throw error;
    }
  }
  return db;
}

// Mapeamento de palavras-chave para categorias
const CATEGORIAS_KEYWORDS = {
  'credito': ['crédito', 'credito', 'antecipação', 'antecipacao', 'trabalhador', 'pessoal', 'empréstimo', 'emprestimo'],
  'antecipacao': ['antecipação', 'antecipacao', 'antecipar', 'restituição', 'restituicao'],
  'credito_trabalhador': ['trabalhador', 'consignado', 'salário', 'salario', 'contratação', 'contratacao', 'crédito do trabalhador', 'credito do trabalhador', 'como contratar', 'contratar'],
  'credito_pessoal': ['pessoal', 'empréstimo', 'emprestimo', 'crédito pessoal', 'credito pessoal'],
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
    
    // Conectar ao MongoDB
    const database = await conectarMongoDB();
    const collection = database.collection(COLLECTION_NAME);
    
    // Buscar perguntas relacionadas no MongoDB com busca mais específica
    const resultados = await collection.find({
      $or: [
        // Busca exata na pergunta
        { pergunta: { $regex: keywords.join('|'), $options: 'i' } },
        // Busca nas palavras-chave
        { palavras_chave: { $regex: keywords.join('|'), $options: 'i' } },
        // Busca na resposta
        { resposta: { $regex: keywords.join('|'), $options: 'i' } }
      ]
    }).limit(15).toArray();
    
    console.log(`🔍 Resultados encontrados: ${resultados.length}`);
    
    if (resultados.length === 0) {
      return res.status(404).json({
        status: 'erro',
        error: 'Nenhuma sugestão encontrada para esta categoria'
      });
    }

    // Gerar título baseado na categoria
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

    // Criar opções baseadas nos resultados do MongoDB
    const opcoes = resultados.map(item => {
      console.log('📋 Item do MongoDB:', {
        pergunta: item.pergunta,
        resposta: item.resposta,
        palavras_chave: item.palavras_chave,
        content: item.content
      });
      
      // Limpar e formatar os dados
      const pergunta = item.pergunta || 'Pergunta não disponível';
      
      // Priorizar o campo 'resposta' real, não palavras_chave
      const resposta = item.resposta || item.content || 'Resposta não disponível';
      
      // Limpar caracteres especiais e quebras de linha
      const perguntaLimpa = pergunta
        .replace(/[\r\n\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      const respostaLimpa = resposta
        .replace(/[\r\n\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log('✅ Dados processados:', {
        perguntaLimpa,
        respostaLimpa
      });
      
      return {
        texto: perguntaLimpa,
        pergunta: perguntaLimpa,
        resposta: respostaLimpa
      };
    });

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