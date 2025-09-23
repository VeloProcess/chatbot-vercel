// api/ai-advanced.js - Sistema de IA Avançada para o VeloBot
const OpenAI = require('openai');
const axios = require('axios');

// Configuração do OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Cache para embeddings
const embeddingsCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas

// ==================== UTILITÁRIOS ====================

function limparJSON(content) {
  let cleaned = content.trim();
  
  // Remover markdown se presente
  if (cleaned.includes('```json')) {
    cleaned = cleaned.replace(/```json\s*/, '').replace(/```\s*$/, '');
  }
  
  // Remover texto antes do JSON se houver
  const jsonStart = cleaned.indexOf('{');
  if (jsonStart > 0) {
    cleaned = cleaned.substring(jsonStart);
  }
  
  return cleaned;
}

// ==================== 1. ANÁLISE SEMÂNTICA COM EMBEDDINGS (COM TIMEOUT) ====================

async function getEmbedding(text) {
  const cacheKey = text.toLowerCase().trim();
  const cached = embeddingsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.embedding;
  }

  try {
    const response = await Promise.race([
      openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Embedding timeout')), 3000)
      )
    ]);
    
    const embedding = response.data[0].embedding;
    embeddingsCache.set(cacheKey, {
      embedding,
      timestamp: Date.now()
    });
    
    return embedding;
  } catch (error) {
    console.error('Erro ao gerar embedding:', error);
    return null;
  }
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function buscaSemantica(pergunta, faqData) {
  try {
    const perguntaEmbedding = await getEmbedding(pergunta);
    if (!perguntaEmbedding) return [];

    const cabecalho = faqData[0];
    const dados = faqData.slice(1);
    const idxPergunta = cabecalho.indexOf("Pergunta");
    const idxResposta = cabecalho.indexOf("Resposta");
    const idxPalavrasChave = cabecalho.indexOf("Palavras-chave");

    if (idxPergunta === -1 || idxResposta === -1) return [];

    const resultados = [];
    const maxItems = Math.min(dados.length, 30); // Reduzido para ser mais rápido

    for (let i = 0; i < maxItems; i++) {
      const linha = dados[i];
      const perguntaItem = linha[idxPergunta];
      const respostaItem = linha[idxResposta];
      const palavrasChave = linha[idxPalavrasChave];

      if (!perguntaItem || !respostaItem) continue;

      // Criar texto combinado para embedding
      const textoCombinado = `${perguntaItem} ${palavrasChave || ''}`;
      const itemEmbedding = await getEmbedding(textoCombinado);
      
      if (itemEmbedding) {
        const similaridade = cosineSimilarity(perguntaEmbedding, itemEmbedding);
        
        if (similaridade > 0.5) { // Threshold reduzido para ser mais rápido
          resultados.push({
            pergunta: perguntaItem,
            resposta: respostaItem,
            similaridade,
            sourceRow: i + 2,
            tipo: 'semantica'
          });
        }
      }
    }

    return resultados.sort((a, b) => b.similaridade - a.similaridade).slice(0, 5); // Limitar a 5 resultados
  } catch (error) {
    console.error('Erro na busca semântica:', error);
    return []; // Retornar array vazio em caso de erro
  }
}

// ==================== 2. CLASSIFICAÇÃO DE INTENÇÃO ====================

async function classificarIntencao(pergunta, historico = []) {
  const prompt = `
Analise a intenção desta pergunta e classifique em UMA das categorias:

CATEGORIAS:
- CONSULTA: Quer saber informações gerais
- PROBLEMA: Relatando um erro, bug ou dificuldade técnica
- PROCEDIMENTO: Como fazer algo específico (passo a passo)
- STATUS: Verificar situação, andamento, status de algo
- URGENTE: Problema crítico que precisa resolução imediata
- ESCLARECIMENTO: Dúvida sobre algo já mencionado
- OUTRO: Não se encaixa nas anteriores

CONTEXTO DA CONVERSA:
${historico.map(h => `${h.role}: ${h.content}`).join('\n')}

PERGUNTA: "${pergunta}"

Responda APENAS com a categoria (ex: CONSULTA) e uma breve justificativa (ex: Usuário quer saber informações sobre crédito):
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 100
    });

    const resultado = response.choices[0].message.content.trim();
    const [categoria, justificativa] = resultado.split('\n');
    
    return {
      categoria: categoria.replace(/[^A-Z_]/g, ''),
      justificativa: justificativa || categoria,
      confianca: 0.9
    };
  } catch (error) {
    console.error('Erro na classificação de intenção:', error);
    return { categoria: 'OUTRO', justificativa: 'Erro na classificação', confianca: 0.1 };
  }
}

// ==================== 3. ANÁLISE DE SENTIMENTO E URGÊNCIA ====================

async function analisarUrgenciaESentimento(pergunta) {
  const prompt = `
Analise esta pergunta e responda em JSON:

PERGUNTA: "${pergunta}"

Responda com:
{
  "urgencia": 1-5,
  "sentimento": "POSITIVO|NEUTRO|NEGATIVO|FRUSTRADO",
  "palavras_chave_emocionais": ["palavra1", "palavra2"],
  "justificativa": "breve explicação"
}

URGÊNCIA:
1 = Consulta geral
2 = Dúvida sobre procedimento
3 = Problema que precisa resolver
4 = Erro crítico
5 = Emergência

SENTIMENTO:
- POSITIVO: Pergunta educada, agradecimento
- NEUTRO: Pergunta normal, sem emoção
- NEGATIVO: Reclamação, insatisfação
- FRUSTRADO: Múltiplas tentativas, impaciência
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 200
    });

    const content = response.choices[0].message.content;
    const resultado = JSON.parse(limparJSON(content));
    return resultado;
  } catch (error) {
    console.error('Erro na análise de urgência:', error);
    return {
      urgencia: 2,
      sentimento: 'NEUTRO',
      palavras_chave_emocionais: [],
      justificativa: 'Erro na análise'
    };
  }
}

// ==================== 4. BUSCA HÍBRIDA INTELIGENTE ====================

async function buscaHibrida(pergunta, faqData, historico = []) {
  console.log('🔍 Iniciando busca híbrida para:', pergunta);

  // 1. Busca por palavras-chave primeiro (mais rápida)
  const resultadosKeywords = await buscaPorPalavrasChave(pergunta, faqData);
  console.log(`📊 Resultados keywords: ${resultadosKeywords.length}`);

  // 2. Se encontrou resultados bons, não fazer busca semântica
  if (resultadosKeywords.length > 0 && resultadosKeywords[0].score > 0.4) {
    console.log('⚡ Usando apenas resultados keywords - muito rápidos');
    return {
      resultados: resultadosKeywords.slice(0, 3),
      confianca_geral: resultadosKeywords[0].score,
      recomendacao: 'RESPOSTA_DIRETA'
    };
  }

  // 3. Busca semântica apenas se necessário (com timeout reduzido)
  try {
    const resultadosSemanticos = await Promise.race([
      buscaSemantica(pergunta, faqData),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout semântica')), 5000)) // Reduzido para 5s
    ]);
    console.log(`📊 Resultados semânticos: ${resultadosSemanticos.length}`);

    // 4. Combinar resultados manualmente (mais rápido que IA)
    const todos = [...resultadosSemanticos, ...resultadosKeywords];
    const unicos = new Map();

    todos.forEach(item => {
      const key = item.pergunta;
      if (!unicos.has(key) || (item.similaridade || item.score) > (unicos.get(key).similaridade || unicos.get(key).score)) {
        unicos.set(key, item);
      }
    });

    const resultadosCombinados = Array.from(unicos.values()).slice(0, 3);
    
    return {
      resultados: resultadosCombinados,
      confianca_geral: resultadosCombinados[0]?.similaridade || resultadosCombinados[0]?.score || 0.5,
      recomendacao: 'RESPOSTA_DIRETA'
    };

  } catch (error) {
    console.log('⚠️ Busca semântica falhou, usando apenas keywords:', error.message);
    return {
      resultados: resultadosKeywords.slice(0, 3),
      confianca_geral: resultadosKeywords[0]?.score || 0.3,
      recomendacao: 'RESPOSTA_DIRETA'
    };
  }
}

async function buscaPorPalavrasChave(pergunta, faqData) {
  const cabecalho = faqData[0];
  const dados = faqData.slice(1);
  const idxPergunta = cabecalho.indexOf("Pergunta");
  const idxPalavrasChave = cabecalho.indexOf("Palavras-chave");
  const idxResposta = cabecalho.indexOf("Resposta");

  if (idxPergunta === -1 || idxResposta === -1 || idxPalavrasChave === -1) {
    return [];
  }

  const palavrasDaBusca = pergunta.toLowerCase().split(' ').filter(p => p.length > 2);
  const resultados = [];

  for (let i = 0; i < dados.length; i++) {
    const linha = dados[i];
    const textoPalavrasChave = (linha[idxPalavrasChave] || '').toLowerCase();
    let score = 0;

    palavrasDaBusca.forEach(palavra => {
      if (textoPalavrasChave.includes(palavra)) score++;
    });

    if (score > 0) {
      resultados.push({
        pergunta: linha[idxPergunta],
        resposta: linha[idxResposta],
        score: score / palavrasDaBusca.length,
        sourceRow: i + 2,
        tipo: 'keywords'
      });
    }
  }

  return resultados.sort((a, b) => b.score - a.score);
}

async function combinarERanquearResultados(pergunta, semanticos, keywords, historico) {
  const prompt = `
Analise os resultados de busca e ranqueie-os por relevância para a pergunta:

PERGUNTA: "${pergunta}"

HISTÓRICO DA CONVERSA:
${historico.map(h => `${h.role}: ${h.content}`).join('\n')}

RESULTADOS SEMÂNTICOS:
${semanticos.map((r, i) => `${i+1}. ${r.pergunta} (similaridade: ${r.similaridade.toFixed(3)})`).join('\n')}

RESULTADOS POR PALAVRAS-CHAVE:
${keywords.map((r, i) => `${i+1}. ${r.pergunta} (score: ${r.score.toFixed(3)})`).join('\n')}

Responda em JSON com os 5 melhores resultados ranqueados:
{
  "resultados": [
    {
      "pergunta": "texto da pergunta",
      "resposta": "texto da resposta", 
      "relevancia": 0.0-1.0,
      "tipo": "semantica|keywords",
      "sourceRow": 123,
      "justificativa": "por que é relevante"
    }
  ],
  "confianca_geral": 0.0-1.0,
  "recomendacao": "RESPOSTA_DIRETA|PRECISA_ESCLARECIMENTO|MULTIPLAS_OPCOES"
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 1000
    });

    const content = response.choices[0].message.content;
    const resultado = JSON.parse(limparJSON(content));
    return resultado;
  } catch (error) {
    console.error('Erro ao combinar resultados:', error);
    // Fallback: combinar resultados manualmente
    return combinarResultadosManual(semanticos, keywords);
  }
}

function combinarResultadosManual(semanticos, keywords) {
  const todos = [...semanticos, ...keywords];
  const unicos = new Map();

  todos.forEach(item => {
    const key = item.pergunta;
    if (!unicos.has(key) || item.relevancia > unicos.get(key).relevancia) {
      unicos.set(key, item);
    }
  });

  return {
    resultados: Array.from(unicos.values()).slice(0, 5),
    confianca_geral: 0.7,
    recomendacao: 'RESPOSTA_DIRETA'
  };
}

// ==================== 5. GERAÇÃO DE RESPOSTAS CONTEXTUAIS ====================

async function gerarRespostaContextual(pergunta, contexto, historico, intencao, urgencia) {
  const prompt = `
### PERSONA
Você é o VeloBot, assistente oficial da Velotax. Responda de forma inteligente e contextual.

### ANÁLISE DA SITUAÇÃO
- Intenção: ${intencao.categoria} (${intencao.justificativa})
- Urgência: ${urgencia.urgencia}/5
- Sentimento: ${urgencia.sentimento}

### HISTÓRICO DA CONVERSA
${historico.map(h => `${h.role}: ${h.content}`).join('\n')}

### BASE DE CONHECIMENTO
${contexto}

### PERGUNTA ATUAL
"${pergunta}"

### INSTRUÇÕES
- Analise o contexto da conversa para entender o que o usuário realmente quer
- Use informações da base de conhecimento de forma natural e fluida
- Adapte o tom baseado na urgência e sentimento
- Se a pergunta for ambígua, peça esclarecimento específico
- Mantenha o tom profissional da Velotax
- Se for urgente (4-5), seja direto e ofereça soluções rápidas
- Se for frustrado, seja empático e ofereça ajuda extra

### RESPOSTA:
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 800
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Erro ao gerar resposta contextual:', error);
    return "Desculpe, não consegui processar sua pergunta no momento. Tente novamente.";
  }
}

// ==================== 6. SISTEMA DE FOLLOW-UP INTELIGENTE ====================

async function gerarFollowUps(pergunta, resposta, contexto) {
  const prompt = `
Baseado na pergunta e resposta, sugira 3 perguntas de follow-up úteis:

PERGUNTA: "${pergunta}"
RESPOSTA: "${resposta}"
CONTEXTO: ${contexto}

Gere 3 perguntas de follow-up que o usuário provavelmente teria:
1. Uma pergunta para mais detalhes
2. Uma pergunta relacionada
3. Uma pergunta sobre próximos passos

Responda em JSON:
{
  "followups": [
    "Pergunta 1",
    "Pergunta 2", 
    "Pergunta 3"
  ],
  "sugestoes_relacionadas": [
    "Tópico relacionado 1",
    "Tópico relacionado 2"
  ]
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 300
    });

    let content = response.choices[0].message.content.trim();
    
    // Remover markdown se presente
    if (content.includes('```json')) {
      content = content.replace(/```json\s*/, '').replace(/```\s*$/, '');
    }
    
    return JSON.parse(content);
  } catch (error) {
    console.error('Erro ao gerar follow-ups:', error);
    return {
      followups: [],
      sugestoes_relacionadas: []
    };
  }
}

// ==================== 7. SUGESTÕES PROATIVAS ====================

async function gerarSugestoesProativas(pergunta, historico, contexto) {
  const prompt = `
Analise a conversa e sugira informações proativas que podem ser úteis:

PERGUNTA ATUAL: "${pergunta}"
HISTÓRICO: ${historico.map(h => h.content).join(' | ')}
CONTEXTO: ${contexto}

Sugira 2-3 informações proativas que podem ser relevantes:
- Informações complementares
- Procedimentos relacionados
- Avisos importantes
- Links úteis

Responda em JSON:
{
  "sugestoes_proativas": [
    {
      "titulo": "Título da sugestão",
      "conteudo": "Conteúdo da sugestão",
      "tipo": "INFO|AVISO|LINK|PROCEDIMENTO"
    }
  ]
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 400
    });

    let content = response.choices[0].message.content.trim();
    
    // Remover markdown se presente
    if (content.includes('```json')) {
      content = content.replace(/```json\s*/, '').replace(/```\s*$/, '');
    }
    
    return JSON.parse(content);
  } catch (error) {
    console.error('Erro ao gerar sugestões proativas:', error);
    return { sugestoes_proativas: [] };
  }
}

// ==================== 8. BUSCA EM DOCUMENTOS EXTERNOS ====================

async function buscarEmDocumentosExternos(pergunta) {
  const sites = [
    "https://www.gov.br/receitafederal",
    "https://cav.receita.fazenda.gov.br",
    "https://www.gov.br",
    "https://velotax.com.br"
  ];

  let contexto = "";
  const perguntaEmbedding = await getEmbedding(pergunta);

  for (const site of sites) {
    try {
      const { data } = await axios.get(site, { timeout: 5000 });
      const siteEmbedding = await getEmbedding(data.substring(0, 2000)); // Primeiros 2000 chars
      
      if (perguntaEmbedding && siteEmbedding) {
        const similaridade = cosineSimilarity(perguntaEmbedding, siteEmbedding);
        if (similaridade > 0.3) {
          contexto += `Fonte: ${site}\nRelevância: ${similaridade.toFixed(3)}\n\n`;
        }
      }
    } catch (error) {
      console.error(`Erro ao processar ${site}:`, error.message);
    }
  }

  return contexto;
}

// ==================== 9. SISTEMA DE CONVERSAÇÃO NATURAL ====================

async function manterContextoConversacional(pergunta, historico) {
  const prompt = `
Analise se esta pergunta faz referência ao contexto anterior:

HISTÓRICO:
${historico.map(h => `${h.role}: ${h.content}`).join('\n')}

PERGUNTA ATUAL: "${pergunta}"

Identifique:
1. Se há referências como "isso", "aquilo", "o que você disse"
2. Se é continuação de um tópico anterior
3. Se precisa de contexto para ser entendida

Responda em JSON:
{
  "tem_referencia": true/false,
  "referencias": ["referência 1", "referência 2"],
  "pergunta_expandida": "pergunta com contexto explícito",
  "contexto_necessario": "contexto que precisa ser mantido"
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 300
    });

    let content = response.choices[0].message.content.trim();
    
    // Remover markdown se presente
    if (content.includes('```json')) {
      content = content.replace(/```json\s*/, '').replace(/```\s*$/, '');
    }
    
    return JSON.parse(content);
  } catch (error) {
    console.error('Erro ao analisar contexto:', error);
    return {
      tem_referencia: false,
      referencias: [],
      pergunta_expandida: pergunta,
      contexto_necessario: ""
    };
  }
}

// ==================== 10. FUNÇÃO PRINCIPAL DE IA AVANÇADA ====================

async function processarComIA(pergunta, faqData, historico = [], email = null) {
  console.log('🤖 Iniciando processamento com IA avançada...');

  // Timeout reduzido para 8 segundos para ser mais rápido
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout da IA avançada')), 8000);
  });

  try {
    const result = await Promise.race([
      processarComIACore(pergunta, faqData, historico, email),
      timeoutPromise
    ]);
    return result;
  } catch (error) {
    console.error('❌ Erro no processamento IA:', error);
    return {
      status: "erro_ia",
      resposta: "Desculpe, ocorreu um erro no processamento. Tente novamente.",
      source: "Sistema"
    };
  }
}

async function processarComIACore(pergunta, faqData, historico = [], email = null) {
  try {
    // 1. Busca rápida primeiro (sem IA)
    const buscaResultados = await buscaHibrida(pergunta, faqData, historico);
    
    // 2. Se encontrou resultados bons, usar IA apenas para melhorar a resposta
    if (buscaResultados.confianca_geral > 0.7 && buscaResultados.resultados.length > 0) {
      console.log('⚡ Resposta rápida - usando IA apenas para melhorar');
      
      const contextoCompleto = buscaResultados.resultados.map(r => `P: ${r.pergunta}\nR: ${r.resposta}`).join('\n\n');
      
      // Análise rápida (sem chamadas extras)
      const intencao = { categoria: 'CONSULTA', justificativa: 'Busca rápida' };
      const urgencia = { urgencia: 2, sentimento: 'NEUTRO', palavras_chave_emocionais: [] };
      
      const resposta = await gerarRespostaContextual(
        pergunta, 
        contextoCompleto, 
        historico, 
        intencao, 
        urgencia
      );

      return {
        status: "sucesso_ia_avancada",
        resposta,
        intencao: intencao.categoria,
        urgencia: urgencia.urgencia,
        sentimento: urgencia.sentimento,
        confianca: buscaResultados.confianca_geral,
        recomendacao: buscaResultados.recomendacao,
        followups: [],
        sugestoes_relacionadas: [],
        sugestoes_proativas: [],
        contexto_usado: buscaResultados.resultados.length,
        source: "IA Avançada (Rápida)"
      };
    }

    // 3. Para casos complexos, usar análise completa (mas otimizada)
    console.log('🔍 Análise completa - caso complexo');
    
    // Análise paralela (mais rápida)
    const [intencao, urgencia] = await Promise.all([
      classificarIntencao(pergunta, historico),
      analisarUrgenciaESentimento(pergunta)
    ]);

    console.log('📊 Análise:', { intencao: intencao.categoria, urgencia: urgencia.urgencia });

    // 4. Busca em documentos externos apenas se necessário
    let contextoExterno = "";
    if (buscaResultados.confianca_geral < 0.5) {
      contextoExterno = await buscarEmDocumentosExternos(pergunta);
    }

    // 5. Gerar resposta contextual
    const contextoCompleto = `
${buscaResultados.resultados.map(r => `P: ${r.pergunta}\nR: ${r.resposta}`).join('\n\n')}

${contextoExterno}
    `.trim();

    const resposta = await gerarRespostaContextual(
      pergunta, 
      contextoCompleto, 
      historico, 
      intencao, 
      urgencia
    );

    // 6. Gerar follow-ups e sugestões apenas se necessário
    let followUps = { followups: [], sugestoes_relacionadas: [] };
    let sugestoesProativas = { sugestoes_proativas: [] };
    
    if (buscaResultados.confianca_geral > 0.8) {
      // Gerar sugestões apenas para respostas de alta confiança
      [followUps, sugestoesProativas] = await Promise.all([
        gerarFollowUps(pergunta, resposta, contextoCompleto),
        gerarSugestoesProativas(pergunta, historico, contextoCompleto)
      ]);
    }

    // 7. Preparar resposta final
    const respostaFinal = {
      status: "sucesso_ia_avancada",
      resposta,
      intencao: intencao.categoria,
      urgencia: urgencia.urgencia,
      sentimento: urgencia.sentimento,
      confianca: buscaResultados.confianca_geral,
      recomendacao: buscaResultados.recomendacao,
      followups: followUps.followups,
      sugestoes_relacionadas: followUps.sugestoes_relacionadas,
      sugestoes_proativas: sugestoesProativas.sugestoes_proativas,
      contexto_usado: buscaResultados.resultados.length,
      source: "IA Avançada"
    };

    console.log('✅ Processamento concluído:', {
      intencao: intencao.categoria,
      urgencia: urgencia.urgencia,
      confianca: buscaResultados.confianca_geral
    });

    return respostaFinal;

  } catch (error) {
    console.error('❌ Erro no processamento IA core:', error);
    return {
      status: "erro_ia",
      resposta: "Desculpe, ocorreu um erro no processamento. Tente novamente.",
      source: "Sistema"
    };
  }
}

module.exports = {
  processarComIA,
  classificarIntencao,
  analisarUrgenciaESentimento,
  buscaHibrida,
  gerarFollowUps,
  gerarSugestoesProativas,
  manterContextoConversacional,
  buscarEmDocumentosExternos
};
