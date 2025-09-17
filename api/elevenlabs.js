// api/elevenlabs.js - Integração com ElevenLabs para Speech-to-Text e Text-to-Speech
const axios = require('axios');

// Configuração da ElevenLabs
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

console.log('🔑 ELEVENLABS_API_KEY configurada:', !!ELEVENLABS_API_KEY);
console.log('🔑 ELEVENLABS_API_KEY valor:', ELEVENLABS_API_KEY ? ELEVENLABS_API_KEY.substring(0, 10) + '...' : 'undefined');

// ==================== SPEECH-TO-TEXT ====================

async function speechToText(audioBlob) {
  try {
    console.log('🎤 Convertendo áudio para texto...');
    console.log('🎤 Chave da API:', ELEVENLABS_API_KEY ? 'Configurada' : 'Não configurada');
    
    if (!ELEVENLABS_API_KEY) {
      throw new Error('Chave da API ElevenLabs não configurada');
    }
    
    // Converter base64 para buffer
    const audioBuffer = Buffer.from(audioBlob, 'base64');
    
    // Fazer requisição para ElevenLabs Speech-to-Text
    const response = await axios.post(`${ELEVENLABS_BASE_URL}/speech-to-text`, {
      audio: audioBlob, // Já está em base64
      model: 'whisper-1'
    }, {
      headers: {
        'Authorization': `Bearer ${ELEVENLABS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const transcript = response.data.text;
    console.log('✅ Transcrição:', transcript);
    
    return {
      success: true,
      text: transcript,
      confidence: response.data.confidence || 0.9
    };

  } catch (error) {
    console.error('❌ Erro no Speech-to-Text:', error);
    return {
      success: false,
      error: error.message,
      text: ''
    };
  }
}

// ==================== TEXT-TO-SPEECH ====================

async function textToSpeech(text, voiceId = 'pNInz6obpgDQGcFmaJgB') {
  try {
    console.log('🔊 Convertendo texto para áudio...');
    
    const response = await axios.post(`${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`, {
      text: text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0.0,
        use_speaker_boost: true
      }
    }, {
      headers: {
        'Authorization': `Bearer ${ELEVENLABS_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      responseType: 'arraybuffer',
      timeout: 30000
    });

    const audioBuffer = Buffer.from(response.data);
    const audioBase64 = audioBuffer.toString('base64');
    
    console.log('✅ Áudio gerado com sucesso');
    
    return {
      success: true,
      audio: audioBase64,
      format: 'mp3',
      duration: response.headers['content-length'] || 0
    };

  } catch (error) {
    console.error('❌ Erro no Text-to-Speech:', error);
    return {
      success: false,
      error: error.message,
      audio: null
    };
  }
}

// ==================== VOZES DISPONÍVEIS ====================

async function getAvailableVoices() {
  try {
    const response = await axios.get(`${ELEVENLABS_BASE_URL}/voices`, {
      headers: {
        'Authorization': `Bearer ${ELEVENLABS_API_KEY}`
      },
      timeout: 10000
    });

    return {
      success: true,
      voices: response.data.voices.map(voice => ({
        id: voice.voice_id,
        name: voice.name,
        category: voice.category,
        description: voice.description,
        language: voice.labels?.language || 'pt-BR'
      }))
    };

  } catch (error) {
    console.error('❌ Erro ao buscar vozes:', error);
    return {
      success: false,
      error: error.message,
      voices: []
    };
  }
}

// ==================== API HANDLERS ====================

// Speech-to-Text endpoint
async function handleSpeechToText(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    console.log('🎤 Recebendo requisição de Speech-to-Text');
    console.log('🎤 ELEVENLABS_API_KEY existe:', !!ELEVENLABS_API_KEY);
    
    const { audio } = req.body;
    
    if (!audio) {
      return res.status(400).json({ error: 'Áudio não fornecido' });
    }

    console.log('🎤 Áudio recebido, tamanho:', audio.length);
    
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ 
        error: 'Chave da API ElevenLabs não configurada',
        success: false
      });
    }

    const result = await speechToText(audio);
    return res.status(200).json(result);

  } catch (error) {
    console.error('Erro no endpoint Speech-to-Text:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message,
      success: false
    });
  }
}

// Text-to-Speech endpoint
async function handleTextToSpeech(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { text, voiceId } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Texto não fornecido' });
    }

    const result = await textToSpeech(text, voiceId);
    return res.status(200).json(result);

  } catch (error) {
    console.error('Erro no endpoint Text-to-Speech:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
}

// Voices endpoint
async function handleGetVoices(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const result = await getAvailableVoices();
    return res.status(200).json(result);

  } catch (error) {
    console.error('Erro no endpoint Voices:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
}

module.exports = {
  speechToText,
  textToSpeech,
  getAvailableVoices,
  handleSpeechToText,
  handleTextToSpeech,
  handleGetVoices
};
