// Google Apps Script - Sistema Completo VeloBot
// Inclui: Relatórios Automáticos + Perguntas Frequentes
// Cole este código no Google Apps Script (script.google.com)

// ========================================
// CONFIGURAÇÕES
// ========================================

const CONFIG = {
  // IDs das planilhas
  SPREADSHEET_ID: "1d0h9zr4haDx6etLtdMqPVsBXdVvH7n9OsRdqAhOJOp0",
  LOG_SHEET_NAME: "LOGS",
  
  // Destinatários dos relatórios
  EMAIL_RECIPIENTS: {
    semanal: [
      "gabriel@velotax.com.br",
      "gestor1@velotax.com.br", 
      "gestor2@velotax.com.br"
    ],
    mensal: [
      "gabriel@velotax.com.br",
      "diretor@velotax.com.br",
      "gestor1@velotax.com.br"
    ],
    alertas: [
      "gabriel@velotax.com.br",
      "suporte@velotax.com.br"
    ]
  },
  
  // Configurações de relatórios
  REPORTS: {
    enabled: true,
    weeklySchedule: '0 9 * * 1', // Segunda às 9h
    monthlySchedule: '0 10 1 * *' // Primeira segunda do mês às 10h
  }
};

// ========================================
// FUNÇÕES DE PERGUNTAS FREQUENTES (EXISTENTES)
// ========================================

/**
 * Função principal para requisições HTTP (já existente)
 */
function doGet(e) {
  try {
    const action = e?.parameter?.action || 'default';
    
    if (action === 'getTop10FrequentQuestions') {
      // Executar cálculo das perguntas frequentes
      calcularTop10Perguntas();
      
      // Buscar dados da planilha
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheetFreq = ss.getSheetByName("Perguntas_Frequentes");
      
      if (!sheetFreq) {
        return ContentService
          .createTextOutput(JSON.stringify({error: 'Sheet not found'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Buscar JSON da coluna D
      const jsonString = sheetFreq.getRange("D2").getValue();
      
      if (!jsonString) {
        // Se não há dados, retornar perguntas de exemplo
        const exampleQuestions = [
          "Como fazer antecipação?",
          "Qual o prazo para declaração do IR?",
          "Como consultar o CPF?",
          "O que é consignado?",
          "Como acessar o sistema?",
          "Qual o horário de funcionamento?",
          "Como fazer login?",
          "Onde encontrar ajuda?",
          "Como recuperar senha?",
          "Quais documentos são necessários?"
        ];
        
        return ContentService
          .createTextOutput(JSON.stringify(exampleQuestions))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Converter para array de strings (apenas perguntas)
      const freqData = JSON.parse(jsonString);
      const questions = freqData.map(item => item.pergunta);
      
      // Garantir que sempre retorne 10 perguntas
      if (questions.length < 10) {
        // Adicionar perguntas de exemplo se necessário
        const exampleQuestions = [
          "Como fazer antecipação?",
          "Qual o prazo para declaração do IR?",
          "Como consultar o CPF?",
          "O que é consignado?",
          "Como acessar o sistema?",
          "Qual o horário de funcionamento?",
          "Como fazer login?",
          "Onde encontrar ajuda?",
          "Como recuperar senha?",
          "Quais documentos são necessários?"
        ];
        
        // Combinar perguntas reais com exemplos
        const combinedQuestions = [...questions];
        for (let i = questions.length; i < 10; i++) {
          combinedQuestions.push(exampleQuestions[i - questions.length]);
        }
        
        return ContentService
          .createTextOutput(JSON.stringify(combinedQuestions))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Retornar apenas as primeiras 10 perguntas
      return ContentService
        .createTextOutput(JSON.stringify(questions.slice(0, 10)))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({error: 'Action not found'}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Calcula as top 10 perguntas frequentes (já existente)
 */
function calcularTop10Perguntas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetPerguntas = ss.getSheetByName("LOGS");
  const sheetFreq = ss.getSheetByName("Perguntas_Frequentes") || ss.insertSheet("Perguntas_Frequentes");

  const lastRow = sheetPerguntas.getLastRow();
  if (lastRow < 2) {
    // Se não há perguntas, criar dados de exemplo
    const exampleData = [
      ["Como fazer antecipação?", 5],
      ["Qual o prazo para declaração do IR?", 4],
      ["Como consultar o CPF?", 3],
      ["O que é consignado?", 3],
      ["Como acessar o sistema?", 2],
      ["Qual o horário de funcionamento?", 2],
      ["Como fazer login?", 2],
      ["Onde encontrar ajuda?", 1],
      ["Como recuperar senha?", 1],
      ["Quais documentos são necessários?", 1]
    ];
    
    // Limpar e popular com dados de exemplo
    sheetFreq.getRange("A1:B12").clearContent();
    sheetFreq.getRange("D1:D12").clearContent();
    
    sheetFreq.getRange(1, 1).setValue("Pergunta");
    sheetFreq.getRange(1, 2).setValue("Frequência");
    sheetFreq.getRange(2, 1, exampleData.length, 2).setValues(exampleData);
    
    const jsonArray = exampleData.map(item => {
      return { pergunta: item[0], frequencia: item[1] };
    });
    const jsonString = JSON.stringify(jsonArray, null, 2);
    sheetFreq.getRange("D2").setValue(jsonString);
    
    return;
  }

  const perguntas = sheetPerguntas.getRange(2, 2, lastRow - 1, 1).getValues().flat();
  Logger.log("Total perguntas: " + perguntas.length);

  const freq = {};
  perguntas.forEach(p => {
    if (p) {
      freq[p] = (freq[p] || 0) + 1;
    }
  });

  const freqArray = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const top10 = freqArray.slice(0, 10);

  // Limpa só o intervalo necessário (colunas A, B e D, linhas 1 a 12)
  sheetFreq.getRange("A1:B12").clearContent();
  sheetFreq.getRange("D1:D12").clearContent();

  sheetFreq.getRange(1, 1).setValue("Pergunta");
  sheetFreq.getRange(1, 2).setValue("Frequência");
  if (top10.length > 0) {
    sheetFreq.getRange(2, 1, top10.length, 2).setValues(top10);
  }

  const jsonArray = top10.map(item => {
    return { pergunta: item[0], frequencia: item[1] };
  });
  const jsonString = JSON.stringify(jsonArray, null, 2);
  sheetFreq.getRange("D2").setValue(jsonString);
}

// ========================================
// FUNÇÕES DE RELATÓRIOS AUTOMÁTICOS
// ========================================

/**
 * Função principal para gerar e enviar relatório semanal
 * Esta função será chamada pelo trigger automático
 */
function gerarRelatorioSemanal() {
  try {
    console.log('📊 Iniciando geração de relatório semanal...');
    
    // Conectar à planilha
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const logSheet = spreadsheet.getSheetByName(CONFIG.LOG_SHEET_NAME);
    
    if (!logSheet) {
      throw new Error('Planilha de logs não encontrada');
    }
    
    // Gerar dados do relatório
    const reportData = gerarDadosRelatorio(logSheet);
    
    // Gerar HTML do email
    const emailHTML = gerarHTMLRelatorio(reportData);
    
    // Enviar email
    enviarEmailRelatorio(reportData, emailHTML, CONFIG.EMAIL_RECIPIENTS.semanal);
    
    console.log('✅ Relatório semanal enviado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao gerar relatório semanal:', error);
    
    // Enviar alerta de erro
    GmailApp.sendEmail(
      CONFIG.EMAIL_RECIPIENTS.alertas.join(','),
      '🚨 Erro no Sistema de Relatórios - VeloBot',
      `Erro ao gerar relatório semanal:\n\n${error.toString()}\n\nData: ${new Date().toLocaleString('pt-BR')}`
    );
  }
}

/**
 * Função para gerar relatório mensal
 */
function gerarRelatorioMensal() {
  try {
    console.log('📊 Iniciando geração de relatório mensal...');
    
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const logSheet = spreadsheet.getSheetByName(CONFIG.LOG_SHEET_NAME);
    
    if (!logSheet) {
      throw new Error('Planilha de logs não encontrada');
    }
    
    const reportData = gerarDadosRelatorio(logSheet, 'mensal');
    const emailHTML = gerarHTMLRelatorio(reportData);
    
    enviarEmailRelatorio(reportData, emailHTML, CONFIG.EMAIL_RECIPIENTS.mensal);
    
    console.log('✅ Relatório mensal enviado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao gerar relatório mensal:', error);
    
    GmailApp.sendEmail(
      CONFIG.EMAIL_RECIPIENTS.alertas.join(','),
      '🚨 Erro no Sistema de Relatórios - VeloBot',
      `Erro ao gerar relatório mensal:\n\n${error.toString()}\n\nData: ${new Date().toLocaleString('pt-BR')}`
    );
  }
}

// ========================================
// FUNÇÕES DE GERAÇÃO DE DADOS
// ========================================

/**
 * Gera os dados do relatório baseado em todas as abas da planilha
 */
function gerarDadosRelatorio(logSheet, tipo = 'semanal') {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  
  // Calcular período
  const hoje = new Date();
  let inicioPeriodo, fimPeriodo;
  
  if (tipo === 'semanal') {
    // Semana atual (segunda a domingo)
    inicioPeriodo = new Date(hoje);
    inicioPeriodo.setDate(hoje.getDate() - hoje.getDay() + 1);
    inicioPeriodo.setHours(0, 0, 0, 0);
    
    fimPeriodo = new Date(inicioPeriodo);
    fimPeriodo.setDate(inicioPeriodo.getDate() + 6);
    fimPeriodo.setHours(23, 59, 59, 999);
  } else {
    // Mês atual
    inicioPeriodo = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    fimPeriodo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    fimPeriodo.setHours(23, 59, 59, 999);
  }
  
  console.log(`Periodo: ${inicioPeriodo.toLocaleDateString('pt-BR')} a ${fimPeriodo.toLocaleDateString('pt-BR')}`);
  
  // Buscar dados de todas as abas relevantes
  const dadosCombinados = [];
  
  // Função auxiliar para detectar e corrigir estrutura de dados
  function corrigirEstruturaDados(row) {
    let email = row[1];
    let pergunta = row[2];
    
    // Detectar se as colunas estão trocadas
    if (row[2].toString().includes('@') && !row[1].toString().includes('@')) {
      // Colunas trocadas: pergunta está na coluna de email e vice-versa
      email = row[2];
      pergunta = row[1];
    }
    
    // Validar se é realmente um email e pergunta válida
    if (email.toString().includes('@') && pergunta.toString().length > 3) {
      return { email, pergunta, valido: true };
    }
    
    return { email: null, pergunta: null, valido: false };
  }

  // 1. Dados da aba LOGS (perguntas dos usuários)
  const logPerguntasSheet = spreadsheet.getSheetByName("LOGS");
  if (logPerguntasSheet) {
    const perguntasData = logPerguntasSheet.getDataRange().getValues();
    perguntasData.slice(1).forEach(row => {
      if (row[0] && row[1] && row[2]) { // Data, Email, Pergunta
        const dataRegistro = new Date(row[0]);
        if (dataRegistro >= inicioPeriodo && dataRegistro <= fimPeriodo) {
          const dadosCorrigidos = corrigirEstruturaDados(row);
          if (dadosCorrigidos.valido) {
            dadosCombinados.push({
              data: dataRegistro,
              email: dadosCorrigidos.email,
              pergunta: dadosCorrigidos.pergunta,
              resposta: row[3] || '',
              fonte: 'LOGS',
              tipo: 'pergunta'
            });
          }
        }
      }
    });
    console.log(`LOGS: ${dadosCombinados.filter(d => d.fonte === 'LOGS').length} registros`);
  }
  
  // 2. Dados da aba LOGS (feedback)
  const logFeedbackSheet = spreadsheet.getSheetByName("LOGS");
  if (logFeedbackSheet) {
    const feedbackData = logFeedbackSheet.getDataRange().getValues();
    feedbackData.slice(1).forEach(row => {
      if (row[0] && row[1] && row[2]) { // Data, Email, Pergunta
        const dataRegistro = new Date(row[0]);
        if (dataRegistro >= inicioPeriodo && dataRegistro <= fimPeriodo) {
          const dadosCorrigidos = corrigirEstruturaDados(row);
          if (dadosCorrigidos.valido) {
            dadosCombinados.push({
              data: dataRegistro,
              email: dadosCorrigidos.email,
              pergunta: dadosCorrigidos.pergunta,
              feedback: row[3] || '',
              rating: row[4] || 0,
              resposta: row[5] || '',
              fonte: row[6] || 'LOGS',
              tipo: 'feedback'
            });
          }
        }
      }
    });
    console.log(`LOGS: ${dadosCombinados.filter(d => d.tipo === 'feedback').length} registros`);
  }
  
  // Filtrar emails de teste (remover gabriel.araujo@velotax.com.br e joao.silva@velotax.com.br)
  const emailsTeste = ['gabriel.araujo@velotax.com.br', 'joao.silva@velotax.com.br'];
  const dadosFiltrados = dadosCombinados.filter(row => !emailsTeste.includes(row.email));
  
  console.log(`Registros filtrados: ${dadosCombinados.length} -> ${dadosFiltrados.length} (removidos ${dadosCombinados.length - dadosFiltrados.length} registros de teste)`);
  
  // Calcular estatísticas
  const totalRegistros = dadosFiltrados.length;
  const usuariosUnicos = [...new Set(dadosFiltrados.map(row => row.email))].length;
  
  // Contar feedbacks (considerando diferentes formatos)
  const feedbackPositivo = dadosFiltrados.filter(row => {
    const feedback = row.feedback || row.resposta || '';
    return feedback.toLowerCase().includes('positivo') || 
           feedback.toLowerCase().includes('bom') || 
           feedback.toLowerCase().includes('excelente') ||
           feedback.toLowerCase().includes('ótimo') ||
           feedback.toLowerCase().includes('otimo');
  }).length;
  
  const feedbackNegativo = dadosFiltrados.filter(row => {
    const feedback = row.feedback || row.resposta || '';
    return feedback.toLowerCase().includes('negativo') || 
           feedback.toLowerCase().includes('ruim') || 
           feedback.toLowerCase().includes('péssimo') ||
           feedback.toLowerCase().includes('pessimo') ||
           feedback.toLowerCase().includes('não') ||
           feedback.toLowerCase().includes('nao');
  }).length;
  
  // Calcular satisfação média (considerando diferentes campos de rating)
  const ratings = [];
  
  dadosFiltrados.forEach(row => {
    // Tentar diferentes campos que podem conter o rating
    const possibleRatings = [
      row.rating,
      row.avaliacao, 
      row.nota,
      row.score,
      row.resposta, // Pode conter um número
      row.feedback   // Pode conter um número
    ];
    
    possibleRatings.forEach(rating => {
      if (rating !== undefined && rating !== null && rating !== '') {
        // Tentar converter para número
        const numRating = parseFloat(rating);
        if (!isNaN(numRating) && numRating >= 0 && numRating <= 5) {
          ratings.push(numRating);
        }
        
        // Tentar extrair números de strings (ex: "4/5", "Nota: 4", etc.)
        const strRating = rating.toString();
        const numberMatch = strRating.match(/(\d+(?:\.\d+)?)/);
        if (numberMatch) {
          const extractedNum = parseFloat(numberMatch[1]);
          if (!isNaN(extractedNum) && extractedNum >= 0 && extractedNum <= 5) {
            ratings.push(extractedNum);
          }
        }
      }
    });
  });
  
  // Remover duplicatas e calcular média
  const uniqueRatings = [...new Set(ratings)];
  const satisfacaoMedia = uniqueRatings.length > 0 ? 
    Math.min(5, Math.max(0, (uniqueRatings.reduce((a, b) => a + b, 0) / uniqueRatings.length))).toFixed(1) : '0.0';
  
  // Top perguntas
  const perguntasCount = {};
  dadosFiltrados.forEach(row => {
    if (row.pergunta) {
      perguntasCount[row.pergunta] = (perguntasCount[row.pergunta] || 0) + 1;
    }
  });
  
  const topPerguntas = Object.entries(perguntasCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([pergunta, count]) => ({ pergunta, count }));
  
  // Usuários mais ativos
  const usuariosCount = {};
  dadosFiltrados.forEach(row => {
    if (row.email) {
      usuariosCount[row.email] = (usuariosCount[row.email] || 0) + 1;
    }
  });
  
  const usuariosAtivos = Object.entries(usuariosCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([email, perguntas]) => ({ email, perguntas }));
  
  // Usuários menos ativos (com apenas 1 pergunta)
  const usuariosMenosAtivos = Object.entries(usuariosCount)
    .filter(([,count]) => count === 1)
    .map(([email, perguntas]) => ({ email, perguntas }));
  
  // Gerar alertas
  const alertas = gerarAlertas(dadosFiltrados);
  
  // Gerar insights
  const insights = gerarInsights(dadosFiltrados);
  
  // Gerar recomendações
  const recomendacoes = gerarRecomendacoes(dadosFiltrados, topPerguntas);
  
  // Calcular taxa de sucesso (evitar NaN)
  const totalFeedbacks = feedbackPositivo + feedbackNegativo;
  const taxaSucesso = totalFeedbacks > 0 ? Math.round((feedbackPositivo / totalFeedbacks) * 100) : 0;
  
  // Debug dos dados processados
  console.log(`Estatisticas finais: ${totalRegistros} registros, ${usuariosUnicos} usuarios unicos`);
  console.log(`Feedbacks encontrados: ${feedbackPositivo} positivos, ${feedbackNegativo} negativos`);
  console.log(`Ratings encontrados: ${uniqueRatings.length} ratings únicos válidos`);
  console.log(`Valores dos ratings: [${uniqueRatings.join(', ')}]`);
  console.log(`Satisfacao media: ${satisfacaoMedia}`);
  
  // Debug dos primeiros registros para entender a estrutura
  if (dadosFiltrados.length > 0) {
    console.log('Primeiro registro de exemplo:');
    console.log(JSON.stringify(dadosFiltrados[0], null, 2));
    
    // Mostrar todos os campos que podem conter ratings
    console.log('Campos de rating no primeiro registro:');
    const firstRow = dadosFiltrados[0];
    ['rating', 'avaliacao', 'nota', 'score', 'resposta', 'feedback'].forEach(field => {
      if (firstRow[field] !== undefined) {
        console.log(`  ${field}: "${firstRow[field]}" (tipo: ${typeof firstRow[field]})`);
      }
    });
  }
  
  return {
    periodo: `${inicioPeriodo.toLocaleDateString('pt-BR')} a ${fimPeriodo.toLocaleDateString('pt-BR')}`,
    tipo: tipo,
    resumo: {
      totalUsuarios: usuariosUnicos,
      totalPerguntas: totalRegistros,
      satisfacaoMedia: satisfacaoMedia,
      taxaSucesso: `${taxaSucesso}%`,
      feedbackPositivo: feedbackPositivo,
      feedbackNegativo: feedbackNegativo
    },
    topPerguntas: topPerguntas,
    usuariosAtivos: usuariosAtivos,
    usuariosMenosAtivos: usuariosMenosAtivos,
    alertas: alertas,
    insights: insights,
    recomendacoes: recomendacoes
  };
}

/**
 * Gera alertas baseados nos dados
 */
function gerarAlertas(dados) {
  const alertas = [];
  
  // Usuários com feedback negativo
  const usuariosNegativos = {};
  dados.forEach(row => {
    if (row.feedback === 'Negativo') {
      const email = row.email;
      usuariosNegativos[email] = (usuariosNegativos[email] || 0) + 1;
    }
  });
  
  Object.entries(usuariosNegativos).forEach(([email, count]) => {
    if (count >= 1) {
      alertas.push(`Usuário ${email} com ${count} feedbacks negativos`);
    }
  });
  
  // Alertas de baixa atividade
  const usuariosMenosAtivos = dados.filter(row => row.tipo === 'pergunta').reduce((acc, row) => {
    acc[row.email] = (acc[row.email] || 0) + 1;
    return acc;
  }, {});
  
  const usuariosComPoucasPerguntas = Object.entries(usuariosMenosAtivos)
    .filter(([,count]) => count === 1)
    .slice(0, 3); // Top 3 usuários menos ativos
  
  usuariosComPoucasPerguntas.forEach(([email, count]) => {
    alertas.push(`Usuário ${email} com baixa atividade (${count} pergunta)`);
  });
  
  return alertas;
}

/**
 * Gera insights baseados nos dados
 */
function gerarInsights(dados) {
  const insights = [];
  
  // Horários de pico
  const horarios = {};
  dados.forEach(row => {
    const data = new Date(row.data);
    const hora = data.getHours();
    horarios[hora] = (horarios[hora] || 0) + 1;
  });
  
  const horariosPico = Object.entries(horarios)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3);
  
  horariosPico.forEach(([hora, count]) => {
    insights.push(`Horário de pico: ${hora}h com ${count} perguntas`);
  });
  
  // Análise de fontes
  const fontes = {};
  dados.forEach(row => {
    const fonte = row.fonte || 'Desconhecida';
    fontes[fonte] = (fontes[fonte] || 0) + 1;
  });
  
  const fontePrincipal = Object.entries(fontes)
    .sort(([,a], [,b]) => b - a)[0];
  
  if (fontePrincipal) {
    insights.push(`Fonte principal: ${fontePrincipal[0]} (${fontePrincipal[1]} registros)`);
  }
  
  // Análise de tipos
  const tipos = {};
  dados.forEach(row => {
    const tipo = row.tipo || 'pergunta';
    tipos[tipo] = (tipos[tipo] || 0) + 1;
  });
  
  Object.entries(tipos).forEach(([tipo, count]) => {
    insights.push(`${tipo === 'pergunta' ? 'Perguntas' : 'Feedbacks'}: ${count} registros`);
  });
  
  return insights;
}

/**
 * Gera recomendações baseadas nos dados
 */
function gerarRecomendacoes(dados, topPerguntas) {
  const recomendacoes = [];
  
  // Recomendações baseadas em perguntas frequentes
  topPerguntas.forEach(pergunta => {
    recomendacoes.push(`Considerar adicionar mais informações sobre "${pergunta.pergunta}" na base de conhecimento`);
  });
  
  // Recomendações baseadas em feedback negativo
  const feedbackNegativo = dados.filter(row => row.feedback === 'Negativo');
  const perguntasNegativas = {};
  
  feedbackNegativo.forEach(row => {
    const pergunta = row.pergunta;
    if (pergunta) {
      perguntasNegativas[pergunta] = (perguntasNegativas[pergunta] || 0) + 1;
    }
  });
  
  Object.entries(perguntasNegativas).forEach(([pergunta, count]) => {
    recomendacoes.push(`Revisar resposta para "${pergunta}" - ${count} feedbacks negativos`);
  });
  
  // Recomendações baseadas em baixa satisfação
  const ratingsBaixos = dados.filter(row => row.rating && row.rating <= 2);
  if (ratingsBaixos.length > 0) {
    recomendacoes.push(`Melhorar qualidade das respostas - ${ratingsBaixos.length} avaliações baixas (≤2)`);
  }
  
  // Recomendações baseadas em usuários menos ativos
  const usuariosMenosAtivos = dados.filter(row => row.tipo === 'pergunta').reduce((acc, row) => {
    acc[row.email] = (acc[row.email] || 0) + 1;
    return acc;
  }, {});
  
  const usuariosComPoucasPerguntas = Object.entries(usuariosMenosAtivos)
    .filter(([,count]) => count === 1).length;
  
  if (usuariosComPoucasPerguntas > 0) {
    recomendacoes.push(`Estratégia de engajamento para ${usuariosComPoucasPerguntas} usuários com baixa atividade`);
  }
  
  return recomendacoes;
}

// ========================================
// FUNÇÕES DE EMAIL
// ========================================

/**
 * Gera o HTML do relatório
 */
function gerarHTMLRelatorio(reportData) {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Relatório ${reportData.tipo === 'semanal' ? 'Semanal' : 'Mensal'} - VeloBot</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #2c3e50, #34495e); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .content { padding: 30px; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 30px 0; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; border: 1px solid #e9ecef; }
        .stat-number { font-size: 32px; font-weight: bold; color: #2c3e50; margin-bottom: 5px; }
        .stat-label { color: #6c757d; font-size: 14px; font-weight: 500; }
        .section { margin: 30px 0; }
        .section h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .alert { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #ffc107; }
        .insight { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #17a2b8; }
        .recommendation { background: #e2e3e5; border-left: 4px solid #6c757d; padding: 15px; margin: 10px 0; border-radius: 8px; }
        .list-item { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; border-top: 1px solid #e9ecef; }
        .highlight { background: #e3f2fd; padding: 2px 6px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Relatório ${reportData.tipo === 'semanal' ? 'Semanal' : 'Mensal'} - VeloBot</h1>
            <p><strong>Período:</strong> ${reportData.periodo}</p>
            <p>Relatório gerado automaticamente pelo sistema</p>
        </div>

        <div class="content">
            <div class="section">
                <h2>Resumo do Período</h2>
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-number">${reportData.resumo.totalUsuarios}</div>
                        <div class="stat-label">Usuários Únicos</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${reportData.resumo.totalPerguntas}</div>
                        <div class="stat-label">Total de Perguntas</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${reportData.resumo.taxaSucesso}</div>
                        <div class="stat-label">Taxa de Sucesso</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${reportData.resumo.satisfacaoMedia}/5</div>
                        <div class="stat-label">Satisfação Média</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${reportData.resumo.feedbackPositivo}</div>
                        <div class="stat-label">Feedback Positivo</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${reportData.resumo.feedbackNegativo}</div>
                        <div class="stat-label">Feedback Negativo</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>Top Perguntas</h2>
                <ol>
                    ${reportData.topPerguntas.map(p => `<li class="list-item"><strong>${p.pergunta}</strong> <span class="highlight">(${p.count} perguntas)</span></li>`).join('')}
                </ol>
            </div>

            <div class="section">
                <h2>Usuários Mais Ativos</h2>
                <ol>
                    ${reportData.usuariosAtivos.map(u => `<li class="list-item"><strong>${u.email}</strong> <span class="highlight">(${u.perguntas} perguntas)</span></li>`).join('')}
                </ol>
            </div>

            ${reportData.usuariosMenosAtivos.length > 0 ? `
            <div class="section">
                <h2>Usuários Menos Ativos</h2>
                <ol>
                    ${reportData.usuariosMenosAtivos.map(u => `<li class="list-item"><strong>${u.email}</strong> <span class="highlight">(${u.perguntas} pergunta)</span></li>`).join('')}
                </ol>
            </div>
            ` : ''}

            ${reportData.alertas.length > 0 ? `
            <div class="section">
                <h2>Alertas</h2>
                ${reportData.alertas.map(alerta => `<div class="alert">${alerta}</div>`).join('')}
            </div>
            ` : ''}

            ${reportData.insights.length > 0 ? `
            <div class="section">
                <h2>Insights</h2>
                ${reportData.insights.map(insight => `<div class="insight">${insight}</div>`).join('')}
            </div>
            ` : ''}

            ${reportData.recomendacoes.length > 0 ? `
            <div class="section">
                <h2>Recomendações</h2>
                ${reportData.recomendacoes.map(rec => `<div class="recommendation">${rec}</div>`).join('')}
            </div>
            ` : ''}
        </div>

        <div class="footer">
            <p><em>Relatório gerado automaticamente pelo sistema VeloBot</em></p>
            <p>Para mais informações, acesse o dashboard do sistema</p>
        </div>
    </div>
</body>
</html>
  `;
}

/**
 * Envia o relatório por email
 */
function enviarEmailRelatorio(reportData, emailHTML, recipients) {
  const subject = `Relatorio ${reportData.tipo === 'semanal' ? 'Semanal' : 'Mensal'} - VeloBot (${reportData.periodo})`;
  
  const textContent = `Relatorio ${reportData.tipo === 'semanal' ? 'Semanal' : 'Mensal'} VeloBot - ${reportData.periodo}

Resumo:
- Usuarios: ${reportData.resumo.totalUsuarios}
- Perguntas: ${reportData.resumo.totalPerguntas}
- Satisfacao: ${reportData.resumo.satisfacaoMedia}/5
- Taxa de Sucesso: ${reportData.resumo.taxaSucesso}

Top Perguntas:
${reportData.topPerguntas.map(p => `- ${p.pergunta} (${p.count} perguntas)`).join('\n')}

Usuarios Mais Ativos:
${reportData.usuariosAtivos.map(u => `- ${u.email} (${u.perguntas} perguntas)`).join('\n')}

Usuarios Menos Ativos:
${reportData.usuariosMenosAtivos.map(u => `- ${u.email} (${u.perguntas} perguntas)`).join('\n')}

Alertas:
${reportData.alertas.map(a => `- ${a}`).join('\n')}

Insights:
${reportData.insights.map(i => `- ${i}`).join('\n')}

Recomendacoes:
${reportData.recomendacoes.map(r => `- ${r}`).join('\n')}`;

  // Enviar para cada destinatário
  recipients.forEach(recipient => {
    GmailApp.sendEmail(
      recipient,
      subject,
      textContent,
      {
        htmlBody: emailHTML,
        name: 'VeloBot Sistema'
      }
    );
  });
  
  console.log(`Relatorio enviado para ${recipients.length} destinatarios`);
}

// ========================================
// FUNÇÕES DE CONFIGURAÇÃO
// ========================================

/**
 * Configura os triggers automáticos
 * Execute esta função uma vez para configurar os relatórios automáticos
 */
function configurarTriggers() {
  try {
    // Remover triggers existentes
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction().includes('Relatorio') || 
          trigger.getHandlerFunction().includes('calcularTop10Perguntas')) {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    // Criar trigger para relatório semanal (segunda-feira às 9h)
    ScriptApp.newTrigger('gerarRelatorioSemanal')
      .timeBased()
      .everyWeeks(1)
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(9)
      .create();
    
    // Criar trigger para relatório mensal (primeira segunda do mês às 10h)
    ScriptApp.newTrigger('gerarRelatorioMensal')
      .timeBased()
      .everyWeeks(4)
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(10)
      .create();
    
    // Nota: Perguntas frequentes são atualizadas manualmente via planilha
    // Não precisa de trigger automático
    
    console.log('✅ Triggers configurados com sucesso!');
    console.log('📅 Relatório semanal: Segunda-feira às 9h');
    console.log('📅 Relatório mensal: Primeira segunda do mês às 10h');
    console.log('📊 Perguntas frequentes: Atualização manual via planilha');
    
  } catch (error) {
    console.error('❌ Erro ao configurar triggers:', error);
  }
}

/**
 * Testa o sistema enviando um relatório de teste
 */
function testarSistema() {
  try {
    console.log('🧪 Iniciando teste do sistema...');
    
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const logSheet = spreadsheet.getSheetByName(CONFIG.LOG_SHEET_NAME);
    
    if (!logSheet) {
      throw new Error('Planilha de logs não encontrada');
    }
    
    // Gerar relatório de teste
    const reportData = gerarDadosRelatorio(logSheet, 'semanal');
    
    // Log dos dados para debug
    console.log('Dados do relatorio:', JSON.stringify(reportData, null, 2));
    
    const emailHTML = gerarHTMLRelatorio(reportData);
    
    // Enviar apenas para você como teste
    GmailApp.sendEmail(
      'gabriel@velotax.com.br',
      'TESTE - Relatorio Semanal - VeloBot',
      'Este e um email de teste do sistema de relatorios.',
      {
        htmlBody: emailHTML,
        name: 'VeloBot Sistema - Teste'
      }
    );
    
    console.log('Teste concluido! Verifique sua caixa de entrada.');
    
  } catch (error) {
    console.error('Erro no teste:', error);
  }
}

/**
 * Função para testar especificamente a detecção de ratings
 */
function testarDetecaoRatings() {
  try {
    console.log('Testando detecao de ratings...');
    
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const logSheet = spreadsheet.getSheetByName("LOGS");
    
    if (!logSheet) {
      console.log('Nenhuma aba de logs encontrada');
      return;
    }
    
    const data = logSheet.getDataRange().getValues();
    console.log('Total de linhas:', data.length);
    console.log('Headers:', data[0]);
    
    // Testar diferentes tipos de ratings
    const testValues = [
      '4', '5', '3.5', '2.0', '1',
      '4/5', 'Nota: 4', 'Avaliação: 5',
      'rating: 3', 'score: 4.5',
      'Excelente (5)', 'Bom (4)', 'Ruim (2)',
      'Positivo', 'Negativo', 'Bom', 'Ruim'
    ];
    
    console.log('\nTestando detecao de ratings:');
    testValues.forEach(value => {
      const numRating = parseFloat(value);
      const isDirectNumber = !isNaN(numRating) && numRating >= 0 && numRating <= 5;
      
      const strRating = value.toString();
      const numberMatch = strRating.match(/(\d+(?:\.\d+)?)/);
      const extractedNum = numberMatch ? parseFloat(numberMatch[1]) : null;
      const isStringNumber = extractedNum !== null && !isNaN(extractedNum) && extractedNum >= 0 && extractedNum <= 5;
      
      console.log(`"${value}" -> Numero direto: ${isDirectNumber} (${numRating}), String: ${isStringNumber} (${extractedNum})`);
    });
    
    // Analisar dados reais
    console.log('\nAnalisando dados reais:');
    for (let i = 1; i <= Math.min(10, data.length - 1); i++) {
      const row = data[i];
      console.log(`Linha ${i}:`, row);
      
      // Verificar cada coluna desta linha
      row.forEach((cell, colIndex) => {
        if (cell !== undefined && cell !== null && cell !== '') {
          const numRating = parseFloat(cell);
          const isDirectNumber = !isNaN(numRating) && numRating >= 0 && numRating <= 5;
          
          const strRating = cell.toString();
          const numberMatch = strRating.match(/(\d+(?:\.\d+)?)/);
          const extractedNum = numberMatch ? parseFloat(numberMatch[1]) : null;
          const isStringNumber = extractedNum !== null && !isNaN(extractedNum) && extractedNum >= 0 && extractedNum <= 5;
          
          if (isDirectNumber || isStringNumber) {
            console.log(`  Coluna ${colIndex} (${data[0][colIndex]}): "${cell}" -> Rating detectado: ${isDirectNumber ? numRating : extractedNum}`);
          }
        }
      });
    }
    
  } catch (error) {
    console.error('Erro no teste:', error);
  }
}

/**
 * Função para analisar a estrutura dos dados e identificar feedbacks
 */
function analisarEstruturaDados() {
  try {
    console.log('Analisando estrutura dos dados...');
    
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const logSheet = spreadsheet.getSheetByName("LOGS");
    
    if (!logSheet) {
      console.log('Nenhuma aba de logs encontrada');
      return;
    }
    
    const data = logSheet.getDataRange().getValues();
    console.log('Total de linhas:', data.length);
    console.log('Headers:', data[0]);
    
    // Analisar cada coluna para identificar onde estão os feedbacks
    const headers = data[0];
    console.log('\nAnalise das colunas:');
    
    for (let col = 0; col < headers.length; col++) {
      const header = headers[col];
      console.log(`\nColuna ${col} (${header}):`);
      
      // Pegar algumas amostras desta coluna
      const samples = [];
      for (let row = 1; row <= Math.min(10, data.length - 1); row++) {
        if (data[row][col]) {
          samples.push(data[row][col]);
        }
      }
      
      console.log('Amostras:', samples.slice(0, 5));
      
      // Verificar se contém feedbacks
      const feedbacks = samples.filter(sample => 
        sample.toString().toLowerCase().includes('positivo') ||
        sample.toString().toLowerCase().includes('negativo') ||
        sample.toString().toLowerCase().includes('bom') ||
        sample.toString().toLowerCase().includes('ruim')
      );
      
      if (feedbacks.length > 0) {
        console.log('FEEDBACKS ENCONTRADOS:', feedbacks);
      }
      
      // Verificar se contém números (ratings)
      const ratings = samples.filter(sample => {
        const num = parseFloat(sample);
        return !isNaN(num) && num >= 0 && num <= 5;
      });
      
      if (ratings.length > 0) {
        console.log('RATINGS ENCONTRADOS:', ratings);
      }
      
      // Verificar se contém números em strings (ex: "4/5", "Nota: 4")
      const stringRatings = samples.filter(sample => {
        const str = sample.toString();
        const numberMatch = str.match(/(\d+(?:\.\d+)?)/);
        if (numberMatch) {
          const num = parseFloat(numberMatch[1]);
          return !isNaN(num) && num >= 0 && num <= 5;
        }
        return false;
      });
      
      if (stringRatings.length > 0) {
        console.log('RATINGS EM STRINGS ENCONTRADOS:', stringRatings);
      }
    }
    
  } catch (error) {
    console.error('Erro na analise:', error);
  }
}

/**
 * Função para debugar os dados da planilha
 */
function debugarDados() {
  try {
    console.log('Iniciando debug dos dados...');
    
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheets = spreadsheet.getSheets();
    
    console.log('Abas disponiveis na planilha:');
    sheets.forEach(sheet => {
      console.log(`- ${sheet.getName()}`);
    });
    
    // Verificar cada aba relevante
    const abasRelevantes = ['LOGS', 'Perguntas_Frequentes'];
    
    abasRelevantes.forEach(nomeAba => {
      const sheet = spreadsheet.getSheetByName(nomeAba);
      if (sheet) {
        const data = sheet.getDataRange().getValues();
        console.log(`\nAba "${nomeAba}":`);
        console.log(`- Total de linhas: ${data.length}`);
        console.log(`- Headers: ${data[0]}`);
        
        if (data.length > 1) {
          console.log(`- Primeiras 2 linhas de dados:`);
          for (let i = 1; i <= Math.min(2, data.length - 1); i++) {
            console.log(`  Linha ${i}:`, data[i]);
          }
        }
      } else {
        console.log(`\nAba "${nomeAba}" nao encontrada`);
      }
    });
    
    // Testar correção de estrutura
    console.log('\nTestando correcao de estrutura de dados...');
    const logSheet = spreadsheet.getSheetByName("LOGS");
    if (logSheet) {
      const data = logSheet.getDataRange().getValues();
      console.log('Primeiras 5 linhas antes da correcao:');
      for (let i = 1; i <= Math.min(5, data.length - 1); i++) {
        console.log(`Linha ${i}: Email="${data[i][1]}", Pergunta="${data[i][2]}"`);
      }
      
      // Testar função de correção
      console.log('\nTestando correcao automatica:');
      for (let i = 1; i <= Math.min(3, data.length - 1); i++) {
        const row = data[i];
        if (row[1] && row[2]) {
          // Simular a função de correção
          let email = row[1];
          let pergunta = row[2];
          
          if (row[2].toString().includes('@') && !row[1].toString().includes('@')) {
            email = row[2];
            pergunta = row[1];
            console.log(`Linha ${i}: CORRIGIDO - Email="${email}", Pergunta="${pergunta}"`);
          } else {
            console.log(`Linha ${i}: OK - Email="${email}", Pergunta="${pergunta}"`);
          }
        }
      }
    }
    
    // Testar geração de relatório
    console.log('\nTestando geracao de relatorio...');
    if (logSheet) {
      const reportData = gerarDadosRelatorio(logSheet, 'semanal');
      console.log('Dados do relatorio gerado:');
      console.log(JSON.stringify(reportData, null, 2));
      
      // Debug adicional dos dados brutos
      console.log('\nDebug dos dados brutos:');
      const data = logSheet.getDataRange().getValues();
      console.log('Total de linhas na planilha:', data.length);
      console.log('Headers:', data[0]);
      
      // Mostrar algumas linhas de dados para entender a estrutura
      for (let i = 1; i <= Math.min(5, data.length - 1); i++) {
        console.log(`Linha ${i}:`, data[i]);
      }
    } else {
      console.log('Nenhuma aba de logs encontrada');
    }
    
  } catch (error) {
    console.error('Erro no debug:', error);
  }
}

// ========================================
// INSTRUÇÕES DE USO
// ========================================

/*
INSTRUÇÕES DE USO:

1. CONFIGURAÇÃO INICIAL:
   - Substitua o SPREADSHEET_ID pela ID da sua planilha
   - Configure os emails dos destinatários em CONFIG.EMAILS
   - Execute configurarTriggers() para configurar os triggers automáticos

2. FUNÇÕES PRINCIPAIS:
   - gerarRelatorioSemanal(): Gera relatório semanal
   - gerarRelatorioMensal(): Gera relatório mensal
   - testarSistema(): Testa o sistema enviando email de teste
   - debugarDados(): Debug dos dados da planilha
   - analisarEstruturaDados(): Analisa estrutura e identifica feedbacks
   - testarDetecaoRatings(): Testa especificamente a detecção de ratings

3. TRIGGERS AUTOMÁTICOS:
   - Relatório Semanal: Segundas-feiras às 8h
   - Relatório Mensal: Primeiro dia do mês às 8h
   - Perguntas Frequentes: Atualização manual via planilha

4. TESTE E DEBUG:
   - Execute testarDetecaoRatings() para testar a detecção de ratings
   - Execute analisarEstruturaDados() para entender a estrutura dos dados
   - Execute debugarDados() para ver a estrutura dos dados
   - Execute testarSistema() para verificar se está funcionando

5. ESTRUTURA DA PLANILHA:
   - Aba "LOGS": Todos os logs (Perguntas, Feedback, Acessos, etc.)
   - Aba "Perguntas_Frequentes": Pergunta, Resposta, Palavras-chave

6. CORREÇÕES AUTOMÁTICAS:
   - Detecta se as colunas estão trocadas (email na coluna de pergunta)
   - Filtra automaticamente emails de teste (gabriel.araujo@velotax.com.br, joao.silva@velotax.com.br)
   - Identifica feedbacks em diferentes formatos e campos
   - Calcula satisfação média considerando diferentes campos de rating

NOTA: Se os feedbacks não estão sendo contados corretamente, execute
analisarEstruturaDados() para identificar onde estão os dados de feedback.
*/
