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

// Mapeamento de categorias para sugestões
const SUGESTOES_MAP = {
  'credito': {
    titulo: 'Você deseja saber mais sobre qual assunto de crédito?',
    opcoes: [
      { texto: 'Antecipação da Restituição', categoria: 'antecipacao' },
      { texto: 'Crédito do Trabalhador', categoria: 'credito_trabalhador' },
      { texto: 'Crédito Pessoal', categoria: 'credito_pessoal' },
      { texto: 'Data dos Créditos (Lotes)', categoria: 'lotes' }
    ]
  },
  'antecipacao': {
    titulo: 'Sobre Antecipação da Restituição:',
    opcoes: [
      { texto: 'Abertura e Gestão de Conta', pergunta: 'Abertura de Conta Celcoin' },
      { texto: 'Como contratar', pergunta: 'Antecipação contratação' },
      { texto: 'Valores e Taxas', pergunta: 'Antecipação - Valores' },
      { texto: 'Problemas e Erros', pergunta: 'Antecipação - Erro na Finalização' },
      { texto: 'Quitação e Pagamento', pergunta: 'Antecipação - Como quitar' }
    ]
  },
  'credito_trabalhador': {
    titulo: 'Sobre Crédito do Trabalhador:',
    opcoes: [
      { texto: 'Como funciona', pergunta: 'Crédito do trabalhador - Como funciona' },
      { texto: 'Contratação', pergunta: 'Crédito do trabalhador - Contratação' },
      { texto: 'Liberação do valor', pergunta: 'Crédito do trabalhador - Liberação do valor' },
      { texto: 'Como é descontado', pergunta: 'Crédito do trabalhador - Como é descontado?' },
      { texto: 'Quitação', pergunta: 'Crédito do Trabalhador - Como quitar' }
    ]
  },
  'credito_pessoal': {
    titulo: 'Sobre Crédito Pessoal:',
    opcoes: [
      { texto: 'Como contratar', pergunta: 'Crédito pessoal - Como contratar' },
      { texto: 'Critérios', pergunta: 'Crédito Pessoal - Critérios' },
      { texto: 'Valores e taxas', pergunta: 'Crédito Pessoal - Quais são as taxas de juros?' },
      { texto: 'Prazos e pagamento', pergunta: 'Crédito Pessoal - Qual o prazo para pagar?' },
      { texto: 'Problemas e erros', pergunta: 'Empréstimo Pessoal - Erros' }
    ]
  },
  'lotes': {
    titulo: 'Data dos Créditos (Lotes):',
    opcoes: [
      { texto: 'Restituição - Data dos lotes', pergunta: 'Restituição - Data dos lotes' },
      { texto: 'Restituição - Consulta', pergunta: 'Restituição - Consulta' },
      { texto: 'Restituição - Em fila', pergunta: 'Restituição - Em fila' },
      { texto: 'Restituição - No lote', pergunta: 'Restituição - No lote' },
      { texto: 'Restituição - Não creditada', pergunta: 'Restituição - Não creditada' },
      { texto: 'Terceiro lote', pergunta: 'Terceiro lote !!!' }
    ]
  },
  'pix': {
    titulo: 'PIX e Pagamentos:',
    opcoes: [
      { texto: 'PIX - Cadastro', pergunta: 'PIX - Cadastro' },
      { texto: 'PIX - Como usar', pergunta: 'PIX - Como usar' },
      { texto: 'PIX - Problemas', pergunta: 'PIX - Problemas' },
      { texto: 'PIX - Valores', pergunta: 'PIX - Valores' }
    ]
  },
  'conta': {
    titulo: 'Abertura e Gestão de Conta:',
    opcoes: [
      { texto: 'Abertura de Conta', pergunta: 'Abertura de Conta Celcoin' },
      { texto: 'Cadastro', pergunta: 'Cadastro' },
      { texto: 'Documentos necessários', pergunta: 'Documentos necessários' },
      { texto: 'Problemas no cadastro', pergunta: 'Problemas no cadastro' }
    ]
  },
  'app': {
    titulo: 'App e Tecnologia:',
    opcoes: [
      { texto: 'Download do App', pergunta: 'Download do App' },
      { texto: 'Problemas no App', pergunta: 'Problemas no App' },
      { texto: 'Atualizações', pergunta: 'Atualizações' },
      { texto: 'Funcionalidades', pergunta: 'Funcionalidades' }
    ]
  },
  'declaracao': {
    titulo: 'Declaração de Imposto de Renda:',
    opcoes: [
      { texto: 'Como declarar', pergunta: 'Como declarar' },
      { texto: 'Documentos necessários', pergunta: 'Documentos necessários' },
      { texto: 'Prazo de entrega', pergunta: 'Prazo de entrega' },
      { texto: 'Problemas na declaração', pergunta: 'Problemas na declaração' }
    ]
  },
  'veloprime': {
    titulo: 'VeloPrime e Investimentos:',
    opcoes: [
      { texto: 'O que é VeloPrime', pergunta: 'O que é VeloPrime' },
      { texto: 'Como investir', pergunta: 'Como investir' },
      { texto: 'Rentabilidade', pergunta: 'Rentabilidade' },
      { texto: 'Resgate', pergunta: 'Resgate' }
    ]
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { categoria } = req.query;
    
    if (!categoria) {
      return res.status(400).json({
        status: 'erro',
        error: 'Categoria não fornecida'
      });
    }

    console.log(`🔍 Buscando sugestões para categoria: ${categoria}`);
    
    // Buscar sugestões no mapeamento
    const sugestoes = SUGESTOES_MAP[categoria];
    
    if (!sugestoes) {
      return res.status(404).json({
        status: 'erro',
        error: 'Categoria não encontrada'
      });
    }

    // Se a categoria tem perguntas específicas, buscar respostas no MongoDB
    const opcoesComRespostas = await Promise.all(
      sugestoes.opcoes.map(async (opcao) => {
        if (opcao.pergunta) {
          try {
            const database = await conectarMongoDB();
            const collection = database.collection(COLLECTION_NAME);
            
            // Buscar resposta no MongoDB
            const resultado = await collection.findOne({
              $or: [
                { pergunta: { $regex: opcao.pergunta, $options: 'i' } },
                { palavras_chave: { $regex: opcao.pergunta, $options: 'i' } }
              ]
            });
            
            if (resultado) {
              return {
                ...opcao,
                resposta: resultado.palavras_chave || resultado.resposta
              };
            }
          } catch (error) {
            console.error('❌ Erro ao buscar resposta:', error);
          }
        }
        
        return opcao;
      })
    );

    return res.status(200).json({
      status: 'sucesso',
      titulo: sugestoes.titulo,
      opcoes: opcoesComRespostas
    });

  } catch (error) {
    console.error('❌ Erro na API de sugestões:', error);
    return res.status(500).json({
      status: 'erro',
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}