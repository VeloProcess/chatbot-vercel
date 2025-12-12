// Script de teste para verificar se o servidor pode iniciar
console.log('🔍 Testando carregamento de módulos...\n');

const path = require('path');
console.log('📁 Diretório atual:', __dirname);
console.log('📁 package.json existe:', require('fs').existsSync(path.join(__dirname, 'package.json')));
console.log('📁 server-local.js existe:', require('fs').existsSync(path.join(__dirname, 'server-local.js')));
console.log('');

try {
  console.log('📦 Testando require de express...');
  const express = require('express');
  console.log('✅ Express carregado');
  
  console.log('📦 Testando require de dotenv...');
  require('dotenv').config();
  console.log('✅ dotenv carregado');
  
  console.log('\n📦 Testando carregamento de handlers...');
  
  const askMongoDBHandler = require('./api/ask-mongodb');
  console.log('✅ ask-mongodb');
  
  const askHandler = require('./api/ask');
  console.log('✅ ask');
  
  const askSimpleHandler = require('./api/ask-simple');
  console.log('✅ ask-simple');
  
  const askOpenaiHandler = require('./api/AskOpenai');
  console.log('✅ AskOpenai');
  
  const logQuestionHandler = require('./api/logQuestion');
  console.log('✅ logQuestion');
  
  const feedbackHandler = require('./api/feedback');
  console.log('✅ feedback');
  
  const adminHandler = require('./api/admin');
  console.log('✅ admin');
  
  const voiceHandler = require('./api/voice');
  console.log('✅ voice');
  
  const elevenlabsHandler = require('./api/elevenlabs');
  console.log('✅ elevenlabs');
  
  const getNewsHandler = require('./api/getNews');
  console.log('✅ getNews');
  
  const getProductStatusHandler = require('./api/getProductStatus');
  console.log('✅ getProductStatus');
  
  console.log('\n✅ Todos os módulos carregados com sucesso!');
  console.log('🚀 Iniciando servidor...\n');
  
  require('./server-local.js');
  
} catch (error) {
  console.error('\n❌ ERRO:', error.message);
  console.error('❌ Stack:', error.stack);
  process.exit(1);
}

