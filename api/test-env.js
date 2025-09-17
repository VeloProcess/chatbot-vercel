// api/test-env.js - Teste de variáveis de ambiente
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const envVars = {
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ? 'Configurada' : 'Não configurada',
      ELEVENLABS_API_KEY_LENGTH: process.env.ELEVENLABS_API_KEY ? process.env.ELEVENLABS_API_KEY.length : 0,
      ELEVENLABS_API_KEY_PREFIX: process.env.ELEVENLABS_API_KEY ? process.env.ELEVENLABS_API_KEY.substring(0, 10) + '...' : 'undefined',
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV
    };

    console.log('🔍 Variáveis de ambiente:', envVars);

    return res.status(200).json({
      success: true,
      message: 'Variáveis de ambiente verificadas',
      envVars: envVars
    });

  } catch (error) {
    console.error('❌ Erro ao verificar variáveis:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
