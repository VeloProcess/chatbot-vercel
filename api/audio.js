// api/audio.js - Endpoint para servir áudio convertido
// VERSION: v1.0.0 | DATE: 2025-01-22 | AUTHOR: Assistant

export default async function handler(req, res) {
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
}
