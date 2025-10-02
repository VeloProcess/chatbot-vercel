// api/elevenlabs.js - Integração com ElevenLabs para Speech-to-Text e Text-to-Speech
// VERSION: v2.3.0 | DATE: 2025-01-22 | AUTHOR: Assistant
const axios = require('axios');

// Configuração da ElevenLabs
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

console.log('🔑 ELEVENLABS_API_KEY configurada:', !!ELEVENLABS_API_KEY);
console.log('🔑 ELEVENLABS_API_KEY valor:', ELEVENLABS_API_KEY ? ELEVENLABS_API_KEY.substring(0, 10) + '...' : 'undefined');

// ==================== SPEECH-TO-TEXT ====================

async function speechToText(audioBlob) {
  try {
    console.log('🎤 Convertendo áudio para texto usando OpenAI Whisper...');
    console.log('🎤 Tamanho do áudio base64:', audioBlob.length);
    console.log('🎤 Primeiros 100 caracteres do áudio:', audioBlob.substring(0, 100));
    
    // Usar OpenAI Whisper em vez da ElevenLabs
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      throw new Error('Chave da API OpenAI não configurada');
    }
    
    // Limpar a chave da API de caracteres especiais
    const cleanApiKey = OPENAI_API_KEY.trim().replace(/[\r\n\t]/g, '');
    console.log('🎤 Chave da API limpa:', cleanApiKey.substring(0, 10) + '...');
    
    // Converter base64 para buffer
    const audioBuffer = Buffer.from(audioBlob, 'base64');
    console.log('🎤 Tamanho do buffer:', audioBuffer.length);
    console.log('🎤 Primeiros 20 bytes do buffer:', audioBuffer.slice(0, 20));
    
    // Verificar se o buffer não está vazio
    if (audioBuffer.length === 0) {
      throw new Error('Buffer de áudio está vazio');
    }
    
    // Otimização: Verificar se o áudio não é muito grande (limite de 25MB da OpenAI)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioBuffer.length > maxSize) {
      console.log('⚠️ Áudio muito grande, pode causar lentidão:', audioBuffer.length);
      // Podemos implementar compressão aqui se necessário
    }
    
    // Verificar se o áudio é muito pequeno (menos de 1KB pode ser problema)
    if (audioBuffer.length < 1024) {
      console.log('⚠️ Áudio muito pequeno, pode causar erro:', audioBuffer.length);
    }
    
    // Criar FormData para OpenAI Whisper
    const FormData = require('form-data');
    const form = new FormData();
    
    form.append('file', audioBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav'
    });
    form.append('model', 'whisper-1');
    // Remover parâmetros que podem causar erro 400
    // form.append('language', 'pt');
    // form.append('response_format', 'json');
    // form.append('temperature', '0.0');
    
    console.log('🎤 Parâmetros da requisição:', {
      filename: 'audio.wav',
      contentType: 'audio/wav',
      model: 'whisper-1',
      audioSize: audioBuffer.length
    });
    
    // Fazer requisição para OpenAI Whisper com configurações otimizadas
    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        'Authorization': `Bearer ${cleanApiKey}`,
        ...form.getHeaders()
      },
      timeout: 60000, // Aumentar timeout para 60 segundos
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      // Configurações adicionais para melhor performance
      validateStatus: function (status) {
        return status >= 200 && status < 300; // Aceitar apenas status de sucesso
      }
    });

    console.log('🎤 Resposta da API:', response.status);
    console.log('🎤 Dados da resposta:', response.data);
    console.log('🎤 Tipo da resposta:', typeof response.data);
    
    const transcript = response.data.text || '';
    console.log('✅ Transcrição recebida:', transcript);
    console.log('✅ Tamanho da transcrição:', transcript.length);
    
    // Verificar se a transcrição não está vazia ou com texto estranho
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('Transcrição vazia recebida da API');
    }
    
    // Verificar se não é texto de legenda/placeholder
    const invalidTexts = [
      'legendas pela comunidade amara.org',
      'subtitles by amara.org',
      'legendas',
      'subtitles',
      'amara.org'
    ];
    
    const lowerTranscript = transcript.toLowerCase();
    const foundInvalid = invalidTexts.find(invalid => lowerTranscript.includes(invalid));
    if (foundInvalid) {
      console.log('❌ Texto inválido detectado:', foundInvalid);
      throw new Error(`Transcrição contém texto de legenda inválido: "${foundInvalid}"`);
    }
    
    const result = {
      success: true,
      text: transcript.trim(),
      confidence: 0.9
    };
    
    console.log('✅ Retornando resultado:', result);
    return result;

  } catch (error) {
    console.error('❌ Erro no Speech-to-Text:', error);
    console.error('❌ Status:', error.response?.status);
    console.error('❌ Dados do erro:', JSON.stringify(error.response?.data, null, 2));
    console.error('❌ Headers do erro:', error.response?.headers);
    console.error('❌ Configuração da requisição:', {
      url: 'https://api.openai.com/v1/audio/transcriptions',
      method: 'POST',
      timeout: 60000,
      audioSize: audioBlob.length,
      audioType: 'audio/webm'
    });
    
    // Log adicional para debug
    if (error.response?.data?.error) {
      console.error('❌ Erro específico da OpenAI:', error.response.data.error);
    }
    
    return {
      success: false,
      error: error.message,
      text: '',
      details: error.response?.data,
      statusCode: error.response?.status
    };
  }
}

// ==================== TEXT-TO-SPEECH ====================

async function textToSpeech(text, voiceId = 'pNInz6obpgDQGcFmaJgB', speed = 1.0) {
  try {
    console.log('🔊 Convertendo texto para áudio...');
    console.log('🔊 Velocidade solicitada:', speed);
    
    // Verificar se a API key está configurada
    if (!ELEVENLABS_API_KEY) {
      throw new Error('Chave da API ElevenLabs não configurada');
    }
    
    console.log('🔑 Usando API key ElevenLabs:', ELEVENLABS_API_KEY.substring(0, 10) + '...');
    
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
        'xi-api-key': ELEVENLABS_API_KEY,
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
      duration: response.headers['content-length'] || 0,
      speed: speed // Incluir velocidade nos metadados
    };

  } catch (error) {
    console.error('❌ Erro no Text-to-Speech:', error);
    
    let errorMessage = error.message;
    
    // Tratamento específico para erro 401 (não autorizado)
    if (error.response && error.response.status === 401) {
      errorMessage = 'Chave da API ElevenLabs inválida ou expirada. Verifique as configurações.';
      console.error('🔑 Erro de autenticação ElevenLabs - Status 401');
    } else if (error.response && error.response.status === 403) {
      errorMessage = 'Acesso negado à API ElevenLabs. Verifique os limites da conta.';
      console.error('🚫 Erro de permissão ElevenLabs - Status 403');
    } else if (error.response && error.response.status === 429) {
      errorMessage = 'Limite de requisições excedido na API ElevenLabs.';
      console.error('⏰ Limite de requisições ElevenLabs - Status 429');
    }
    
    return {
      success: false,
      error: errorMessage,
      audio: null,
      statusCode: error.response ? error.response.status : null
    };
  }
}

// ==================== VOZES DISPONÍVEIS ====================

async function getAvailableVoices() {
  try {
    const response = await axios.get(`${ELEVENLABS_BASE_URL}/voices`, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
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
    console.log('🎤 OPENAI_API_KEY existe:', !!process.env.OPENAI_API_KEY);
    
    const { audio } = req.body;
    
    if (!audio) {
      console.log('❌ Áudio não fornecido no body');
      return res.status(400).json({ error: 'Áudio não fornecido' });
    }

    console.log('🎤 Áudio recebido, tamanho:', audio.length);
    console.log('🎤 Primeiros 100 caracteres do áudio:', audio.substring(0, 100));
    
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ 
        error: 'Chave da API ElevenLabs não configurada',
        success: false
      });
    }

    console.log('🎤 Chamando speechToText...');
    const result = await speechToText(audio);
    console.log('🎤 Resultado do speechToText:', result);
    
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
    const { text, voiceId, speed = 1.0 } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Texto não fornecido' });
    }

    console.log('🔊 Parâmetros recebidos:', { text: text.substring(0, 50) + '...', voiceId, speed });
    const result = await textToSpeech(text, voiceId, speed);
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
