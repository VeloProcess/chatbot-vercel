// api/sugestoes.js - Sistema de sugestões por categoria

import { MongoClient } from 'mongodb';

const MONGODB_URI = 'mongodb+srv://gabrielaraujo:sGoeqQgbxlsIwnjc@clustercentral.quqgq6x.mongodb.net/?retryWrites=true&w=majority&appName=ClusterCentral';
const DB_NAME = 'console_conteudo';
const COLLECTION_NAME = 'Bot_perguntas';

let client = null;
let db = null;

// Mapeamento de categorias e suas sugestões
const CATEGORIAS_SUGESTOES = {
  'credito': {
    titulo: 'Você deseja saber mais sobre qual assunto de crédito?',
    opcoes: [
      { texto: 'Antecipação', categoria: 'antecipacao' },
      { texto: 'Crédito do Trabalhador', categoria: 'credito_trabalhador' },
      { texto: 'Crédito Pessoal', categoria: 'credito_pessoal' },
      { texto: 'Data dos Créditos (Lotes)', categoria: 'lotes' }
    ]
  },
  'antecipacao': {
    titulo: 'Sobre Antecipação da Restituição:',
    opcoes: [
      { texto: 'Abertura e Gestão de Conta', categoria: 'conta' },
      { texto: 'Como contratar', categoria: 'contratacao' },
      { texto: 'Valores e Taxas', categoria: 'valores' },
      { texto: 'Problemas e Erros', categoria: 'problemas' },
      { texto: 'Quitação e Pagamento', categoria: 'quitacao' }
    ]
  },
  'conta': {
    titulo: 'Abertura e Gestão de Conta:',
    opcoes: [
      { texto: 'Abertura de Conta Celcoin', pergunta: 'Abertura de Conta Celcoin' },
      { texto: 'Alteração de Conta ou Chave PIX', pergunta: 'Alteração de Conta ou Chave PIX' },
      { texto: 'App - Como acessar a conta', pergunta: 'App - Como acessar a conta' },
      { texto: 'App - Atualizar dados', pergunta: 'App - Atualizar dados' },
      { texto: 'App - Cancelamento de conta Celcoin', pergunta: 'App - Cancelamento de conta Celcoin' },
      { texto: 'Conta - Bloqueio Judicial', pergunta: 'conta - Bloqueio Judicial' },
      { texto: 'Conta - Saldo Insuficiente', pergunta: 'conta - Saldo Insuficiente' }
    ]
  },
  'contratacao': {
    titulo: 'Como Contratar Antecipação:',
    opcoes: [
      { texto: 'Antecipação - Documentação', pergunta: 'Antecipação - Documentação' },
      { texto: 'Antecipação - Disponibilidade', pergunta: 'Antecipação - Disponibilidade' },
      { texto: 'Antecipação - Validação de documento', pergunta: 'Antecipação - Validação de documento' },
      { texto: 'Antecipação - Posso contratar com CPF irregular?', pergunta: 'Antecipação - Posso contratar com CPF irregular?' },
      { texto: 'Antecipação contratação', pergunta: 'Antecipação contratação' },
      { texto: 'Antecipação critérios', pergunta: 'Antecipação critérios' }
    ]
  },
  'valores': {
    titulo: 'Valores e Taxas:',
    opcoes: [
      { texto: 'Antecipação - Valores', pergunta: 'Antecipação - Valores' },
      { texto: 'Antecipação - Por que o valor oferecido foi baixo?', pergunta: 'Antecipação - Por que o valor oferecido foi baixo?' },
      { texto: 'Antecipação - Como os juros são calculados?', pergunta: 'Antecipação - Como os juros são calculados?' },
      { texto: 'Como são calculados os juros cobrados na antecipação da restituição?', pergunta: 'Como são calculados os juros cobrados na antecipação da restituição?' },
      { texto: 'Quais são as taxas de antecipação?', pergunta: 'quais são as taxas de antecipação?' },
      { texto: 'Métodos de pagamento da antecipação', pergunta: 'Metodos de pagamento da antecipação' }
    ]
  },
  'problemas': {
    titulo: 'Problemas e Erros:',
    opcoes: [
      { texto: 'Antecipação - Bloqueio de conta', pergunta: 'Antecipação - Bloqueio de conta' },
      { texto: 'Antecipação - Cliente não concorda com o débito', pergunta: 'Antecipação - Cliente não concorda com o débito do valor' },
      { texto: 'Antecipação - Erro na Abertura de Conta', pergunta: 'Antecipação - Erro na Abertura de Conta' },
      { texto: 'Antecipação - Erro na Finalização', pergunta: 'Antecipação - Erro na Finalização' },
      { texto: 'Antecipação - Negativa', pergunta: 'Antecipação - Negativa' },
      { texto: 'Divergência em Valores de Antecipação', pergunta: 'Divergência em Valores de Antecipação' },
      { texto: 'Indisponibilidade de Antecipação', pergunta: 'Indisponibilidade de Antecipação' }
    ]
  },
  'quitacao': {
    titulo: 'Quitação e Pagamento:',
    opcoes: [
      { texto: 'Antecipação - Como quitar', pergunta: 'Antecipação - Como quitar' },
      { texto: 'Antecipação - Quitação Antecipada', pergunta: 'Antecipação - Quitação Antecipada' },
      { texto: 'Antecipação - Como saber quando o cliente recebe', pergunta: 'Antecipação - Como saber quando o cliente recebe' },
      { texto: 'Antecipação - Liquidação', pergunta: 'Antecipação - Liquidação' }
    ]
  },
  'credito_trabalhador': {
    titulo: 'Crédito do Trabalhador:',
    opcoes: [
      { texto: 'Como funciona', pergunta: 'Crédito do trabalhador - Como funciona' },
      { texto: 'Como contratar', pergunta: 'Crédito do trabalhador - Contratação' },
      { texto: 'Como é descontado', pergunta: 'Crédito do trabalhador - Como é descontado?' },
      { texto: 'Liberação do valor', pergunta: 'Crédito do trabalhador - Liberação do valor' },
      { texto: 'Limites e critérios', pergunta: 'Crédito do trabalhador - Limite de idade' },
      { texto: 'Cancelamento', pergunta: 'Crédito do Trabalhador - Posso cancelar o empréstimo?' },
      { texto: 'Parcelas e prazos', pergunta: 'Crédito do trabalhador - Parcelas' }
    ]
  },
  'credito_pessoal': {
    titulo: 'Crédito Pessoal:',
    opcoes: [
      { texto: 'Como contratar', pergunta: 'Crédito pessoal - Como contratar' },
      { texto: 'Critérios e requisitos', pergunta: 'Crédito Pessoal - Critérios' },
      { texto: 'Documentos necessários', pergunta: 'Crédito Pessoal - Quais documentos são necessários para contratação?' },
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
      { texto: 'PIX - Cadastro na Celcoin', pergunta: 'Pix - Cadastro na Celcoin' },
      { texto: 'PIX - Como fazer portabilidade', pergunta: 'Pix - Como fazer portabilidade' },
      { texto: 'PIX - Limite', pergunta: 'PIX - Limite' },
      { texto: 'PIX - Envio por engano', pergunta: 'PIX - Envio por engano' },
      { texto: 'PIX - Retirada com dívida', pergunta: 'PIX - Retirada com dívida em aberto' },
      { texto: 'Problemas com PIX na Caixa', pergunta: 'Problemas com PIX na Caixa' }
    ]
  },
  'conta': {
    titulo: 'Abertura e Gestão de Conta:',
    opcoes: [
      { texto: 'Abertura de Conta Celcoin', pergunta: 'Abertura de Conta Celcoin' },
      { texto: 'Alteração de Conta ou Chave PIX', pergunta: 'Alteração de Conta ou Chave PIX' },
      { texto: 'App - Como acessar a conta', pergunta: 'App - Como acessar a conta' },
      { texto: 'App - Atualizar dados', pergunta: 'App - Atualizar dados' },
      { texto: 'App - Cancelamento de conta Celcoin', pergunta: 'App - Cancelamento de conta Celcoin' },
      { texto: 'Conta - Bloqueio Judicial', pergunta: 'conta - Bloqueio Judicial' },
      { texto: 'Conta - Saldo Insuficiente', pergunta: 'conta - Saldo Insuficiente' }
    ]
  },
  'app': {
    titulo: 'Aplicativo e Funcionalidades:',
    opcoes: [
      { texto: 'App - Como acessar a conta', pergunta: 'App - Como acessar a conta' },
      { texto: 'App - Atualizar dados', pergunta: 'App - Atualizar dados' },
      { texto: 'App - Atualizar situação', pergunta: 'App - Atualizar situação' },
      { texto: 'App - Cancelamento de conta Celcoin', pergunta: 'App - Cancelamento de conta Celcoin' },
      { texto: 'App - Cancelar procuração', pergunta: 'App - Cancelar procuração' },
      { texto: 'App - Excluir conta Velotax', pergunta: 'App - Excluir conta Velotax' },
      { texto: 'App - Reativar conta', pergunta: 'App - Reativar conta' }
    ]
  },
  'declaracao': {
    titulo: 'Declaração de Imposto de Renda (IRPF):',
    opcoes: [
      { texto: 'Acompanhamento de Malha Fina', pergunta: 'Acompanhamento de Malha Fina' },
      { texto: 'Declaração/IRPF - Como consultar pendências', pergunta: 'Declaração/IRPF - Como consultar pendências' },
      { texto: 'Declaração/IRPF - Malha Fina', pergunta: 'Declaração/IRPF - Malha Fina' },
      { texto: 'Declaração/IRPF - Retificar', pergunta: 'Declaração/IRPF - Retificar' },
      { texto: 'Declaração/IRPF - Cancelamento', pergunta: 'Declaração/IRPF- Cancelamento' },
      { texto: 'Status de Declaração', pergunta: 'Status de Declaração' },
      { texto: 'Erro no Envio de Declaração', pergunta: 'Erro no Envio de Declaração' }
    ]
  },
  'veloprime': {
    titulo: 'VeloPrime e Investimentos:',
    opcoes: [
      { texto: 'Veloprime - Planos', pergunta: 'Veloprime - Planos' },
      { texto: 'Veloprime - Gratuito', pergunta: 'Veloprime - Gratuito' },
      { texto: 'Veloprime - Cancelamento', pergunta: 'Veloprime - Cancelamento' },
      { texto: 'Veloprime - Pagamento', pergunta: 'Veloprime - Pagamento' },
      { texto: 'Veloprime - Ações no Exterior', pergunta: 'Veloprime - Ações no Exterior' },
      { texto: 'Veloprime - Bolsa de Valores (B3)', pergunta: 'Veloprime - Bolsa de Valores (B3)' },
      { texto: 'O que é renda fixa?', pergunta: 'O que é renda fixa?' },
      { texto: 'O que é renda variável?', pergunta: 'O que é renda variável?' }
    ]
  }
};

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
        error: "Categoria não fornecida." 
      });
    }

    console.log(`🔍 Buscando sugestões para categoria: "${categoria}"`);
    
    // Verificar se é uma categoria conhecida
    if (CATEGORIAS_SUGESTOES[categoria]) {
      const sugestao = CATEGORIAS_SUGESTOES[categoria];
      
      // Se tem perguntas específicas, buscar no MongoDB
      if (sugestao.opcoes.some(opcao => opcao.pergunta)) {
        const database = await conectarMongoDB();
        const collection = database.collection(COLLECTION_NAME);
        
        // Buscar perguntas específicas
        const perguntas = sugestao.opcoes
          .filter(opcao => opcao.pergunta)
          .map(opcao => opcao.pergunta);
        
        const resultados = await collection.find({
          pergunta: { $in: perguntas }
        }).toArray();
        
        // Mapear resultados para as opções
        const opcoesComRespostas = sugestao.opcoes.map(opcao => {
          if (opcao.pergunta) {
            const resultado = resultados.find(r => r.pergunta === opcao.pergunta);
            return {
              ...opcao,
              resposta: resultado ? resultado.resposta : null,
              id: resultado ? resultado._id : null
            };
          }
          return opcao;
        });
        
        return res.status(200).json({
          status: "sucesso",
          categoria: categoria,
          titulo: sugestao.titulo,
          opcoes: opcoesComRespostas,
          total: opcoesComRespostas.length
        });
      } else {
        // Apenas categorias sem perguntas específicas
        return res.status(200).json({
          status: "sucesso",
          categoria: categoria,
          titulo: sugestao.titulo,
          opcoes: sugestao.opcoes,
          total: sugestao.opcoes.length
        });
      }
    } else {
      return res.status(404).json({
        status: "nao_encontrado",
        error: "Categoria não encontrada",
        categorias_disponiveis: Object.keys(CATEGORIAS_SUGESTOES)
      });
    }

  } catch (error) {
    console.error("❌ ERRO:", error);
    return res.status(500).json({ 
      error: "Erro interno no servidor.", 
      details: error.message 
    });
  }
};
