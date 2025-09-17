// api/voice.js - API consolidada para todas as funcionalidades de voz
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
    
    default:
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
      
      return res.status(400).json({ 
        error: 'Ação não especificada. Use: ?action=speech-to-text, ?action=text-to-speech, ou ?action=voices' 
      });
  }
};
