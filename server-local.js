// server-local.js - Servidor Express Local na Porta 3000
const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Configurar CORS para todas as rotas
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Importar handlers da API com tratamento de erros
let askMongoDBHandler, askHandler, askSimpleHandler, askOpenaiHandler;
let logQuestionHandler, feedbackHandler, adminHandler;
let getNewsHandler, getProductStatusHandler;

try {
  console.log('📦 Carregando handlers da API...');
  askMongoDBHandler = require('./api/ask-mongodb');
  console.log('✅ ask-mongodb carregado');
  
  askHandler = require('./api/ask');
  console.log('✅ ask carregado');
  
  askSimpleHandler = require('./api/ask-simple');
  console.log('✅ ask-simple carregado');
  
  askOpenaiHandler = require('./api/AskOpenai');
  console.log('✅ AskOpenai carregado');
  
  logQuestionHandler = require('./api/logQuestion');
  console.log('✅ logQuestion carregado');
  
  feedbackHandler = require('./api/feedback');
  console.log('✅ feedback carregado');
  
  adminHandler = require('./api/admin');
  console.log('✅ admin carregado');
  
  // voice e elevenlabs removidos
  
  getNewsHandler = require('./api/getNews');
  console.log('✅ getNews carregado');
  
  getProductStatusHandler = require('./api/getProductStatus');
  console.log('✅ getProductStatus carregado');
  
  console.log('✅ Todos os handlers carregados com sucesso!\n');
} catch (error) {
  console.error('❌ Erro ao carregar handlers:', error.message);
  console.error('❌ Stack:', error.stack);
  process.exit(1);
}

// Rotas da API
app.get('/api/ask-mongodb', askMongoDBHandler);
app.get('/api/ask', askHandler);
app.get('/api/ask-simple', askSimpleHandler);
app.get('/api/AskOpenai', askOpenaiHandler);
app.post('/api/AskOpenai', askOpenaiHandler);

app.get('/api/logQuestion', logQuestionHandler);
app.post('/api/logQuestion', logQuestionHandler);

app.post('/api/feedback', feedbackHandler);

app.get('/api/admin', adminHandler);

// Rotas de voice e elevenlabs removidas

app.get('/api/getNews', getNewsHandler);
app.get('/api/getProductStatus', getProductStatusHandler);

// Rota raiz - servir index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error('❌ Erro no servidor:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('🚀 Servidor iniciado!');
  console.log(`📡 Rodando em: http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`📁 Arquivos estáticos: ./public`);
  console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  console.log('✅ APIs disponíveis:');
  console.log(`   GET  /api/ask-mongodb`);
  console.log(`   GET  /api/ask`);
  console.log(`   GET  /api/ask-simple`);
  console.log(`   GET  /api/AskOpenai`);
  console.log(`   GET  /api/logQuestion`);
  console.log(`   POST /api/logQuestion`);
  console.log(`   POST /api/feedback`);
  console.log(`   GET  /api/admin`);
  console.log(`   GET  /api/getNews`);
  console.log(`   GET  /api/getProductStatus`);
  console.log('');
  
  // Verificar variáveis de ambiente importantes
  if (!process.env.GOOGLE_CREDENTIALS) {
    console.warn('⚠️  GOOGLE_CREDENTIALS não configurado');
  } else {
    console.log('✅ GOOGLE_CREDENTIALS configurado');
  }
  
  console.log('');
  console.log('💡 Pressione Ctrl+C para parar o servidor');
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

