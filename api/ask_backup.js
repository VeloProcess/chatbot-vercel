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
  'negado': ['negado', 'rejeitado', 'recusado', 'não aprovado']
};

// Função para normalizar texto
function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ') // Remove pontuação
    .replace(/\s+/g, ' ') // Remove espaços extras
    .trim();
}

// Função para calcular similaridade (Levenshtein)
function calcularSimilaridade(str1, str2) {
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
    const palavrasPergunta = perguntaNormalizada.split(' ');
    const sinonimos = expandirSinonimos(perguntaNormalizada);
    
    console.log(`🔍 Buscando: "${pergunta}"`);
    console.log(`📝 Palavras: [${palavrasPergunta.join(', ')}]`);
    console.log(`🔄 Sinônimos: [${sinonimos.join(', ')}]`);
    
    // Busca ultra-avançada com múltiplas técnicas
    const resultados = await collection.aggregate([
      {
        $addFields: {
          score: {
            $add: [
              // 1. MATCH EXATO na pergunta (score máximo)
              {
                $cond: [
                  { $regexMatch: { input: { $toLower: "$pergunta" }, regex: perguntaNormalizada } },
                  1000,
                  0
                ]
              },
              
              // 2. MATCH EXATO nas palavras-chave
              {
                $cond: [
                  { $regexMatch: { input: { $toLower: "$palavras_chave" }, regex: perguntaNormalizada } },
                  900,
                  0
                ]
              },
              
              // 3. MATCH EXATO na resposta
              {
                $cond: [
                  { $regexMatch: { input: { $toLower: "$resposta" }, regex: perguntaNormalizada } },
                  800,
                  0
                ]
              },
              
              // 4. MATCH PARCIAL na pergunta (palavras individuais)
              {
                $reduce: {
                  input: palavrasPergunta,
                  initialValue: 0,
                  in: {
                    $add: [
                      "$$value",
                      {
                        $cond: [
                          { $regexMatch: { input: { $toLower: "$pergunta" }, regex: "$$this" } },
                          100,
                          0
                        ]
                      }
                    ]
                  }
                }
              },
              
              // 5. MATCH PARCIAL nas palavras-chave
              {
                $reduce: {
                  input: palavrasPergunta,
                  initialValue: 0,
                  in: {
                    $add: [
                      "$$value",
                      {
                        $cond: [
                          { $regexMatch: { input: { $toLower: "$palavras_chave" }, regex: "$$this" } },
                          80,
                          0
                        ]
                      }
                    ]
                  }
                }
              },
              
              // 6. MATCH PARCIAL na resposta
              {
                $reduce: {
                  input: palavrasPergunta,
                  initialValue: 0,
                  in: {
                    $add: [
                      "$$value",
                      {
                        $cond: [
                          { $regexMatch: { input: { $toLower: "$resposta" }, regex: "$$this" } },
                          60,
                          0
                        ]
                      }
                    ]
                  }
                }
              },
              
              // 7. MATCH com sinônimos na pergunta
              {
                $reduce: {
                  input: sinonimos,
                  initialValue: 0,
                  in: {
                    $add: [
                      "$$value",
                      {
                        $cond: [
                          { $regexMatch: { input: { $toLower: "$pergunta" }, regex: "$$this" } },
                          70,
                          0
                        ]
                      }
                    ]
                  }
                }
              },
              
              // 8. MATCH com sinônimos nas palavras-chave
              {
                $reduce: {
                  input: sinonimos,
                  initialValue: 0,
                  in: {
                    $add: [
                      "$$value",
                      {
                        $cond: [
                          { $regexMatch: { input: { $toLower: "$palavras_chave" }, regex: "$$this" } },
                          50,
                          0
                        ]
                      }
                    ]
                  }
                }
              },
              
              // 9. MATCH com sinônimos na resposta
              {
                $reduce: {
                  input: sinonimos,
                  initialValue: 0,
                  in: {
                    $add: [
                      "$$value",
                      {
                        $cond: [
                          { $regexMatch: { input: { $toLower: "$resposta" }, regex: "$$this" } },
                          40,
                          0
                        ]
                      }
                    ]
                  }
                }
              }
            ]
          }
        }
      },
      {
        $match: {
          score: { $gt: 0 }
        }
      },
      {
        $sort: { score: -1 }
      },
      {
        $limit: 5 // Pegar top 5 para análise
      }
    ]).toArray();
    
    if (resultados.length === 0) {
      console.log('❌ Nenhum resultado encontrado');
      return null;
    }
    
    // Aplicar similaridade de texto para refinamento
    const resultadosComSimilaridade = resultados.map(item => {
      const similaridadePergunta = calcularSimilaridade(perguntaNormalizada, normalizarTexto(item.pergunta));
      const similaridadePalavras = calcularSimilaridade(perguntaNormalizada, normalizarTexto(item.palavras_chave || ''));
      const similaridadeResposta = calcularSimilaridade(perguntaNormalizada, normalizarTexto(item.resposta || ''));
      
      const scoreSimilaridade = Math.max(similaridadePergunta, similaridadePalavras, similaridadeResposta) * 200;
      
      return {
        ...item,
        scoreFinal: item.score + scoreSimilaridade,
        similaridade: {
          pergunta: similaridadePergunta,
          palavras: similaridadePalavras,
          resposta: similaridadeResposta
        }
      };
    });
    
    // Ordenar por score final
    resultadosComSimilaridade.sort((a, b) => b.scoreFinal - a.scoreFinal);
    
    const melhorResultado = resultadosComSimilaridade[0];
    
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
    const { pergunta, email } = req.query;
    
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
