// api/getProductStatus.js - Buscar status de produtos do arquivo JSON
const fs = require('fs');
const path = require('path');

// Cache global para os produtos
global.productsCache = global.productsCache || {
  data: null,
  timestamp: 0,
  ttl: 300000 // 5 minutos
};

// Função para carregar dados de produtos do arquivo JSON
function loadProductsData() {
  // Verificar cache primeiro
  const now = Date.now();
  if (global.productsCache.data && (now - global.productsCache.timestamp) < global.productsCache.ttl) {
    console.log('✅ getProductStatus: Usando cache global');
    return global.productsCache.data;
  }

  try {
    const productsPath = path.join(__dirname, '../Produtos.json');
    console.log('🔍 getProductStatus: Carregando dados de produtos de:', productsPath);
    
    const fileContent = fs.readFileSync(productsPath, 'utf8');
    const productsData = JSON.parse(fileContent);
    
    // Atualizar cache
    global.productsCache.data = productsData;
    global.productsCache.timestamp = now;
    
    console.log('✅ getProductStatus: Dados de produtos carregados:', productsData.length, 'produtos');
    return productsData;
    
  } catch (error) {
    console.error('❌ getProductStatus: Erro ao carregar dados de produtos:', error);
    return [];
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('🔍 getProductStatus: Buscando status de produtos...');
    
    const productsData = loadProductsData();
    
    if (!productsData || productsData.length === 0) {
      return res.status(200).json({
        success: true,
        products: [],
        message: 'Nenhum produto encontrado'
      });
    }

    // Separar produtos por status
    const availableProducts = productsData.filter(p => p.status.toLowerCase() === 'disponível');
    const unavailableProducts = productsData.filter(p => p.status.toLowerCase() === 'indisponivel');

    console.log('✅ getProductStatus: Retornando', productsData.length, 'produtos');
    
    return res.status(200).json({
      success: true,
      products: productsData,
      available: availableProducts,
      unavailable: unavailableProducts,
      count: productsData.length,
      source: 'JSON Local'
    });

  } catch (error) {
    console.error('❌ getProductStatus: Erro no processamento:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor', 
      details: error.message 
    });
  }
};