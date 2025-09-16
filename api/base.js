// api/base.js - Carregamento da base via MongoDB
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

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        console.log('=== API BASE - CARREGANDO VIA MONGODB ===');
        
        const database = await conectarMongoDB();
        const collection = database.collection(COLLECTION_NAME);
        
        // Buscar todos os documentos
        const baseData = await collection.find({}).toArray();
        
        // Converter para o formato esperado pelo frontend
        const baseFormatada = baseData.map(item => ({
            id: item.id || item._id,
            title: item.pergunta || item.titulo || 'Sem título',
            content: item.palavras_chave || item.resposta || item.conteudo || 'Sem conteúdo',
            keywords: item.palavras_chave ? item.palavras_chave.split(/\s+/).filter(k => k.length > 2) : [],
            sinonimos: [], // Pode ser expandido no futuro
            categoria: item.categoria || 'geral',
            status: item.status || 'ativo'
        }));
        
        // Gerar categorias dinamicamente
        const categorias = {};
        const tags = { tags_contexto: {} };
        
        baseFormatada.forEach(item => {
            if (item.categoria) {
                if (!categorias[item.categoria]) {
                    categorias[item.categoria] = [];
                }
                categorias[item.categoria].push(item.id);
            }
            
            // Extrair tags das palavras-chave
            if (item.keywords && Array.isArray(item.keywords)) {
                item.keywords.forEach(palavra => {
                    if (palavra.length > 3) {
                        if (!tags.tags_contexto[palavra]) {
                            tags.tags_contexto[palavra] = [];
                        }
                        tags.tags_contexto[palavra].push(item.id);
                    }
                });
            }
        });
        
        console.log(`✅ Base carregada: ${baseFormatada.length} itens`);
        console.log(`✅ Categorias: ${Object.keys(categorias).length}`);
        console.log(`✅ Tags: ${Object.keys(tags.tags_contexto).length}`);
        
        res.status(200).json({
            base: baseFormatada,
            categorias: categorias,
            tags: tags
        });
    } catch (error) {
        console.error('❌ Erro ao carregar base via MongoDB:', error);
        res.status(500).json({ 
            error: 'Erro ao carregar base de dados',
            details: error.message 
        });
    }
}