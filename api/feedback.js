// api/feedback.js (Mantém formato atual da planilha + ML interno)
import { google } from "googleapis";
import fs from "fs";

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const LOG_SHEET_NAME = "Log_Feedback";

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// === ANÁLISE ML INTERNA (SÓ PARA VOCÊ) ===
function analisarPadroesML(question, feedback) {
    const padroes = {
        incompleta: ['incompleta', 'faltou', 'não explicou', 'superficial', 'pouco detalhe'],
        incorreta: ['errado', 'incorreto', 'falso', 'mentira', 'não é assim'],
        confusa: ['confuso', 'não entendi', 'claro', 'explicação', 'complicado'],
        desatualizada: ['antigo', 'desatualizado', 'mudou', 'atual', 'novo'],
        irrelevante: ['não responde', 'fora do assunto', 'irrelevante', 'não tem a ver']
    };

    const feedbackLower = feedback.toLowerCase();
    
    for (const [tipo, palavras] of Object.entries(padroes)) {
        if (palavras.some(palavra => feedbackLower.includes(palavra))) {
            return tipo;
        }
    }
    
    return 'outro';
}

function gerarSugestoesML(question, feedback, tipo) {
    const sugestoes = [];
    
    switch (tipo) {
        case 'incompleta':
            sugestoes.push('Adicionar mais detalhes na resposta');
            sugestoes.push('Incluir passo a passo');
            break;
        case 'incorreta':
            sugestoes.push('Verificar informações na base de dados');
            sugestoes.push('Atualizar conteúdo desatualizado');
            break;
        case 'confusa':
            sugestoes.push('Simplificar linguagem');
            sugestoes.push('Usar exemplos práticos');
            break;
        case 'desatualizada':
            sugestoes.push('Atualizar informações');
            sugestoes.push('Verificar prazos e valores');
            break;
        case 'irrelevante':
            sugestoes.push('Melhorar algoritmo de busca');
            sugestoes.push('Adicionar sinônimos');
            break;
    }
    
    return sugestoes;
}

// Salva análise ML internamente (só você vê)
function salvarAnaliseML(question, feedback, tipo, sugestoes) {
    try {
        const analisePath = './data/ml_analysis.json';
        let analises = [];
        
        if (fs.existsSync(analisePath)) {
            analises = JSON.parse(fs.readFileSync(analisePath, 'utf8'));
        }
        
        const novaAnalise = {
            timestamp: new Date().toISOString(),
            question: question,
            feedback: feedback,
            tipo: tipo,
            sugestoes: sugestoes,
            melhorou: false
        };
        
        analises.push(novaAnalise);
        fs.writeFileSync(analisePath, JSON.stringify(analises, null, 2));
        
        console.log('🤖 Análise ML salva internamente');
    } catch (error) {
        console.error('❌ Erro ao salvar análise ML:', error);
    }
}

// === API PRINCIPAL (MANTÉM FORMATO ATUAL) ===
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }
    
    try {
        console.log("[DEBUG 1] Endpoint de feedback atingido.");

        const dados = req.body;
        console.log("[DEBUG 2] Dados recebidos:", JSON.stringify(dados, null, 2));

        if (!dados || Object.keys(dados).length === 0) {
            console.error("[DEBUG FALHA] Validação falhou: Corpo da requisição vazio.");
            return res.status(400).json({ error: 'Corpo da requisição vazio.' });
        }

        const timestamp = new Date().toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo'
        });

        const tipoFeedback = dados.action === 'logFeedbackPositivo' ? 'Positivo ��' : 'Negativo 👎';
        
        // === ANÁLISE ML INTERNA (SÓ PARA VOCÊ) ===
        if (dados.action !== 'logFeedbackPositivo' && dados.sugestao) {
            const tipoML = analisarPadroesML(dados.question, dados.sugestao);
            const sugestoesML = gerarSugestoesML(dados.question, dados.sugestao, tipoML);
            
            // Salva análise ML internamente
            salvarAnaliseML(dados.question, dados.sugestao, tipoML, sugestoesML);
            
            console.log(`�� ML: Tipo detectado: ${tipoML}`);
            console.log(`🤖 ML: Sugestões: ${sugestoesML.join(', ')}`);
        }
        
        // === PLANILHA (FORMATO ATUAL) ===
        const newRow = [
            timestamp,                                    // A - Data
            String(dados.email || 'nao_fornecido'),      // B - Email do Atendente
            String(dados.question || 'N/A'),             // C - Pergunta Original
            tipoFeedback,                                // D - Tipo de Feedback
            String(dados.sourceRow !== null && dados.sourceRow !== undefined ? dados.sourceRow : 'N/A'), // E - Linha da Fonte
            String(dados.sugestao || '')                 // F - Sugestão
        ];

        console.log("[DEBUG 5] Linha para planilha (formato atual):", newRow);

        // Envia para a planilha no formato atual
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: LOG_SHEET_NAME,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [newRow],
            },
        });

        console.log("[DEBUG 7] Sucesso! Dados enviados para Google Sheets (formato atual).");

        return res.status(200).json({ 
            status: 'sucesso', 
            message: 'Feedback registrado na planilha.'
        });

    } catch (error) {
        console.error("ERRO NO ENDPOINT DE FEEDBACK:", error);
        return res.status(500).json({ 
            error: "Erro interno ao registrar feedback.", 
            details: error.message
        });
    }
}