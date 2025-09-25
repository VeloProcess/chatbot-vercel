// api/voice.js - API consolidada para todas as funcionalidades de voz
// VERSION: v2.0.0 | DATE: 2025-01-22 | AUTHOR: Assistant
const { handleSpeechToText, handleTextToSpeech, handleGetVoices } = require('./elevenlabs');

module.exports = async function handler(req, res) {
  const { action } = req.query;

  switch (action) {
    case 'speech-to-text':
      return await handleSpeechToText(req, res);
    
    case 'text-to-speech':
      return await handleTextToSpeech(req, res);
    
    case 'voices':
      return await handleGetVoices(req, res);
    
    case 'audio':
      return await handleAudio(req, res);
    
    case 'debug':
      // Endpoint de debug para verificar variáveis de ambiente
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
      
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
    
    default:
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
      
      return res.status(400).json({ 
        error: 'Ação não especificada. Use: ?action=speech-to-text, ?action=text-to-speech, ?action=voices, ?action=audio, ou ?action=debug' 
      });
  }
}

// Função para servir áudio (movida do audio.js)
async function handleAudio(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { audioData, format = 'mp3' } = req.body;
    
    if (!audioData) {
      return res.status(400).json({ error: 'Dados de áudio não fornecidos' });
    }

    // Converter base64 para buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    // Definir tipo MIME baseado no formato
    const mimeType = format === 'mp3' ? 'audio/mpeg' : 'audio/mpeg';
    
    // Configurar headers para streaming de áudio
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Enviar o áudio como stream
    res.send(audioBuffer);
    
  } catch (error) {
    console.error('❌ Erro no endpoint de áudio:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
};
