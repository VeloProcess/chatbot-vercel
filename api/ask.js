// api/ask.js - Sistema de busca ULTRA-AVANÇADO com MongoDB

import { MongoClient } from 'mongodb';

const MONGODB_URI = 'mongodb+srv://gabrielaraujo:sGoeqQgbxlsIwnjc@clustercentral.quqgq6x.mongodb.net/?retryWrites=true&w=majority&appName=ClusterCentral';
const DB_NAME = 'console_conteudo';
const COLLECTION_NAME = 'Bot_perguntas';

let client = null;
let db = null;

// Cache inteligente com TTL
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Dicionário de sinônimos e variações
const SINONIMOS = {
  'portabilidade': ['portar', 'migrar', 'transferir', 'mudar', 'trocar'],
  'antecipacao': ['antecipar', 'adiantar', 'receber antes', 'liberar'],
  'restituicao': ['restituir', 'devolver', 'reembolsar', 'retornar'],
  'conta': ['account', 'perfil', 'cadastro'],
  'celcoin': ['celcoin', 'cel coin', 'cel-coin'],
  'como': ['como fazer', 'como posso', 'como consigo', 'como faço'],
  'quando': ['quando posso', 'quando consigo', 'quando faço'],
  'onde': ['onde posso', 'onde consigo', 'onde faço'],
  'problema': ['erro', 'dificuldade', 'não funciona', 'não consegui'],
  'valor': ['preço', 'custo', 'taxa', 'valor'],
  'prazo': ['tempo', 'quanto tempo', 'quando', 'data'],
  'documento': ['documentação', 'papel', 'comprovante'],
  'aprovação': ['aprovado', 'aprovar', 'aceito', 'aceitar'],
  'negado': ['negado', 'rejeitado', 'recusado', 'não aprovado'],
  'pix': ['pix', 'transferência instantânea', 'pagamento instantâneo']
};

// Função para normalizar texto
function normalizarTexto(texto) {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ') // Remove pontuação
    .replace(/\s+/g, ' ') // Remove espaços extras
    .trim();
}

// Função para calcular similaridade (Levenshtein)
function calcularSimilaridade(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1 : (maxLen - matrix[len2][len1]) / maxLen;
}

// Função para expandir sinônimos
function expandirSinonimos(texto) {
  if (!texto) return [];
  
  const palavras = texto.split(' ');
  const palavrasExpandidas = [...palavras];
  
  palavras.forEach(palavra => {
    Object.entries(SINONIMOS).forEach(([chave, sinonimos]) => {
      if (sinonimos.includes(palavra)) {
        palavrasExpandidas.push(chave);
      }
      if (palavra === chave) {
        palavrasExpandidas.push(...sinonimos);
      }
    });
  });
  
  return [...new Set(palavrasExpandidas)]; // Remove duplicatas
}

// Função para limpar cache expirado
function limparCacheExpirado() {
  const agora = Date.now();
  for (const [chave, valor] of cache.entries()) {
    if (agora - valor.timestamp > CACHE_TTL) {
      cache.delete(chave);
    }
  }
}

// Função para buscar no cache
function buscarNoCache(pergunta) {
  const chave = normalizarTexto(pergunta);
  const item = cache.get(chave);
  
  if (item && Date.now() - item.timestamp < CACHE_TTL) {
    console.log('🎯 Cache hit!');
    return item.resultado;
  }
  
  return null;
}

// Função para adicionar ao cache
function adicionarAoCache(pergunta, resultado) {
  const chave = normalizarTexto(pergunta);
  cache.set(chave, {
    resultado,
    timestamp: Date.now()
  });
}

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

async function buscarFAQ(pergunta) {
  try {
    const database = await conectarMongoDB();
    const collection = database.collection(COLLECTION_NAME);
    
    // Limpar cache expirado
    limparCacheExpirado();
    
    // Verificar cache primeiro
    const cacheResult = buscarNoCache(pergunta);
    if (cacheResult) {
      return cacheResult;
    }
    
    const perguntaNormalizada = normalizarTexto(pergunta);
    const palavrasPergunta = perguntaNormalizada.split(' ').filter(p => p.length > 2);
    const sinonimos = expandirSinonimos(perguntaNormalizada);
    
    console.log(`🔍 Buscando: "${pergunta}"`);
    console.log(`📝 Palavras: [${palavrasPergunta.join(', ')}]`);
    console.log(`🔄 Sinônimos: [${sinonimos.join(', ')}]`);
    
    // Busca no MongoDB com query simples
    const resultados = await collection.find({
      $or: [
        { pergunta: { $regex: perguntaNormalizada, $options: 'i' } },
        { palavras_chave: { $regex: perguntaNormalizada, $options: 'i' } },
        { resposta: { $regex: perguntaNormalizada, $options: 'i' } }
      ]
    }).limit(10).toArray();
    
    if (resultados.length === 0) {
      console.log('❌ Nenhum resultado encontrado no MongoDB');
      return null;
    }
    
    // Aplicar scoring avançado no JavaScript
    const resultadosComScore = resultados.map(item => {
      let score = 0;
      
      // Match exato na pergunta
      if (normalizarTexto(item.pergunta).includes(perguntaNormalizada)) {
        score += 1000;
      }
      
      // Match exato nas palavras-chave
      if (normalizarTexto(item.palavras_chave || '').includes(perguntaNormalizada)) {
        score += 900;
      }
      
      // Match exato na resposta
      if (normalizarTexto(item.resposta || '').includes(perguntaNormalizada)) {
        score += 800;
      }
      
      // Busca por palavras individuais
      palavrasPergunta.forEach(palavra => {
        if (normalizarTexto(item.pergunta).includes(palavra)) {
          score += 100;
        }
        if (normalizarTexto(item.palavras_chave || '').includes(palavra)) {
          score += 80;
        }
        if (normalizarTexto(item.resposta || '').includes(palavra)) {
          score += 60;
        }
      });
      
      // Busca por sinônimos
      sinonimos.forEach(sinonimo => {
        if (normalizarTexto(item.pergunta).includes(sinonimo)) {
          score += 70;
        }
        if (normalizarTexto(item.palavras_chave || '').includes(sinonimo)) {
          score += 50;
        }
        if (normalizarTexto(item.resposta || '').includes(sinonimo)) {
          score += 40;
        }
      });
      
      // Similaridade de texto
      const similaridadePergunta = calcularSimilaridade(perguntaNormalizada, normalizarTexto(item.pergunta));
      const similaridadePalavras = calcularSimilaridade(perguntaNormalizada, normalizarTexto(item.palavras_chave || ''));
      const similaridadeResposta = calcularSimilaridade(perguntaNormalizada, normalizarTexto(item.resposta || ''));
      
      const scoreSimilaridade = Math.max(similaridadePergunta, similaridadePalavras, similaridadeResposta) * 200;
      
      return {
        ...item,
        scoreFinal: score + scoreSimilaridade,
        similaridade: {
          pergunta: similaridadePergunta,
          palavras: similaridadePalavras,
          resposta: similaridadeResposta
        }
      };
    });
    
    // Ordenar por score final
    resultadosComScore.sort((a, b) => b.scoreFinal - a.scoreFinal);
    
    const melhorResultado = resultadosComScore[0];
    
    console.log(`✅ Melhor resultado: "${melhorResultado.pergunta}" (score: ${melhorResultado.scoreFinal})`);
    console.log(`📊 Similaridade: P=${melhorResultado.similaridade.pergunta.toFixed(2)}, K=${melhorResultado.similaridade.palavras.toFixed(2)}, R=${melhorResultado.similaridade.resposta.toFixed(2)}`);
    
    // Adicionar ao cache
    adicionarAoCache(pergunta, melhorResultado);
    
    return melhorResultado;
    
  } catch (error) {
    console.error('❌ Erro ao buscar FAQ:', error.message);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { pergunta } = req.query;
    
    if (!pergunta) {
      return res.status(400).json({ 
        error: "Nenhuma pergunta fornecida." 
      });
    }

    console.log(`\n🚀 Nova pergunta: "${pergunta}"`);
    
    const resultado = await buscarFAQ(pergunta);
    
    if (resultado && resultado.scoreFinal >= 100) {
      console.log(`✅ Encontrado: "${resultado.pergunta}" (score: ${resultado.scoreFinal})`);
      
      return res.status(200).json({
        status: "sucesso",
        resposta: resultado.resposta,
        source: "MongoDB",
        sourceRow: resultado._id,
        score: resultado.scoreFinal,
        perguntaOriginal: resultado.pergunta,
        similaridade: resultado.similaridade,
        matchType: resultado.scoreFinal >= 1000 ? "exato" : 
                   resultado.scoreFinal >= 500 ? "alto" : 
                   resultado.scoreFinal >= 200 ? "medio" : "baixo"
      });
    } else {
      console.log(`❌ Não encontrado na base (score: ${resultado?.scoreFinal || 0})`);
      
      return res.status(200).json({
        status: "nao_encontrado",
        resposta: "Não encontrei informações específicas sobre sua pergunta na base de dados. Tente reformular ou ser mais específico.",
        source: "Sistema",
        sourceRow: "N/A",
        sugestoes: [
          "Tente usar palavras-chave mais específicas",
          "Verifique se digitou corretamente",
          "Use sinônimos (ex: 'portar' em vez de 'portabilidade')",
          "Seja mais descritivo na sua pergunta"
        ]
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