// api/test-whisper.js - Teste da API Whisper
const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('🧪 Testando API Whisper...');
    
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: 'Chave da API OpenAI não configurada',
        success: false
      });
    }

    // Criar um arquivo de áudio de teste simples (silêncio)
    const testAudioBuffer = Buffer.alloc(1000, 0); // 1KB de zeros
    
    const FormData = require('form-data');
    const form = new FormData();
    
    form.append('file', testAudioBuffer, {
      filename: 'test.wav',
      contentType: 'audio/wav'
    });
    form.append('model', 'whisper-1');
    
    console.log('🧪 Enviando arquivo de teste para Whisper...');
    console.log('🧪 Tamanho do arquivo:', testAudioBuffer.length);
    
    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        ...form.getHeaders()
      },
      timeout: 30000
    });

    console.log('🧪 Resposta da API:', response.status);
    console.log('🧪 Dados da resposta:', response.data);

    return res.status(200).json({
      success: true,
      message: 'Teste da API Whisper realizado com sucesso',
      response: response.data,
      status: response.status
    });

  } catch (error) {
    console.error('❌ Erro no teste da API Whisper:', error);
    console.error('❌ Status:', error.response?.status);
    console.error('❌ Dados do erro:', JSON.stringify(error.response?.data, null, 2));
    
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data,
      statusCode: error.response?.status
    });
  }
};
