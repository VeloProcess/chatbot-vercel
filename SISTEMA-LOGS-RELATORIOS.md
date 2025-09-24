# 📊 Sistema de Logs e Relatórios Automáticos - VeloBot

## 🎯 **VISÃO GERAL**

Este documento descreve a implementação de um sistema completo de logs e relatórios automáticos para o VeloBot, incluindo coleta de dados, análise, relatórios por email e dashboard em tempo real.

---

## 🔍 **SITUAÇÃO ATUAL**

### **Logs Existentes:**
- ✅ **`api/logQuestion.js`** - Logs de perguntas, erros e acessos
- ✅ **`api/feedback.js`** - Feedback positivo/negativo dos usuários
- ✅ **Google Sheets** como base de dados atual
- ✅ **3 tipos de log**: Perguntas, Erros, Acessos

### **Limitações Atuais:**
- ❌ **Sem relatórios automáticos**
- ❌ **Sem análise de tendências**
- ❌ **Sem alertas para gestores**
- ❌ **Sem dashboard em tempo real**

---

## 🚀 **PROPOSTA DE MELHORIA**

## **1. 📈 SISTEMA DE COLETA DE DADOS APRIMORADO**

### **A. Estrutura de Logs Expandida**

#### **Log de Acesso**
```javascript
{
  timestamp: "2024-01-15 10:30:00",
  email: "usuario@velotax.com.br",
  status: "login|logout|session_timeout",
  sessionId: "abc123",
  ip: "192.168.1.1",
  userAgent: "Chrome/120.0",
  duration: 1800, // segundos online
  source: "web|mobile|api"
}
```

#### **Log de Pergunta**
```javascript
{
  timestamp: "2024-01-15 10:35:00",
  email: "usuario@velotax.com.br",
  question: "Como funciona o crédito?",
  response: "Resposta gerada...",
  source: "IA Avançada|Cache Local|MongoDB Direto",
  sentiment: "NEUTRO|POSITIVO|NEGATIVO|FRUSTRADO",
  urgency: 1-5,
  responseTime: 1500, // milissegundos
  contextUsed: 3, // número de contextos encontrados
  suggestionsGenerated: 2
}
```

#### **Log de Feedback**
```javascript
{
  timestamp: "2024-01-15 10:40:00",
  email: "usuario@velotax.com.br",
  question: "Como funciona o crédito?",
  feedback: "Positivo|Negativo",
  rating: 5, // 1-5
  suggestion: "Poderia ser mais detalhado",
  sourceRow: 15, // linha da resposta original
  responseSource: "IA Avançada"
}
```

### **B. Integração com MongoDB**

#### **Coleções Propostas:**
```javascript
// logs_acessos
{
  _id: ObjectId,
  timestamp: Date,
  email: String,
  status: String,
  sessionId: String,
  ip: String,
  userAgent: String,
  duration: Number,
  source: String
}

// logs_perguntas
{
  _id: ObjectId,
  timestamp: Date,
  email: String,
  question: String,
  response: String,
  source: String,
  sentiment: String,
  urgency: Number,
  responseTime: Number,
  contextUsed: Number,
  suggestionsGenerated: Number
}

// logs_feedback
{
  _id: ObjectId,
  timestamp: Date,
  email: String,
  question: String,
  feedback: String,
  rating: Number,
  suggestion: String,
  sourceRow: Number,
  responseSource: String
}

// relatorios_enviados
{
  _id: ObjectId,
  tipo: "diario|semanal",
  data: Date,
  periodo: String,
  destinatarios: [String],
  status: "enviado|falhou",
  dados: Object
}
```

---

## **2. 📊 SISTEMA DE RELATÓRIOS AUTOMÁTICOS**

### **A. Relatório Diário (Enviado às 8h)**

#### **Estrutura do Relatório:**
```javascript
{
  data: "2024-01-15",
  resumo: {
    totalUsuarios: 45,
    totalPerguntas: 127,
    totalAcessos: 89,
    feedbackPositivo: 23,
    feedbackNegativo: 3,
    tempoMedioResposta: "1.2s",
    taxaSucesso: "96%",
    satisfacaoMedia: 4.2,
    usuariosOnline: 12
  },
  topPerguntas: [
    { 
      pergunta: "Como funciona o crédito?", 
      count: 15,
      satisfacao: 4.5
    },
    { 
      pergunta: "Quais documentos preciso?", 
      count: 12,
      satisfacao: 4.2
    }
  ],
  usuariosAtivos: [
    { 
      email: "usuario1@velotax.com.br", 
      perguntas: 8, 
      tempoOnline: "2h30m",
      satisfacao: 5.0
    }
  ],
  alertas: [
    "Usuário usuario3@velotax.com.br com 3 feedbacks negativos",
    "Pergunta sobre 'DARF' não encontrada na base",
    "Tempo de resposta acima de 3s em 5% das perguntas"
  ],
  insights: [
    "Aumento de 15% em perguntas sobre PIX",
    "Usuários mais ativos entre 10h-11h",
    "Taxa de satisfação aumentou 2%"
  ]
}
```

### **B. Relatório Semanal (Enviado às 9h de segunda-feira)**

#### **Estrutura do Relatório:**
```javascript
{
  periodo: "2024-01-08 a 2024-01-14",
  resumo: {
    totalUsuarios: 312,
    totalPerguntas: 847,
    crescimentoUsuarios: "+15%",
    crescimentoPerguntas: "+23%",
    satisfacaoMedia: 4.2,
    tempoMedioResposta: "1.1s",
    taxaSucesso: "97%"
  },
  tendencias: {
    perguntasMaisFrequentes: [
      { pergunta: "Como funciona o crédito?", count: 89, crescimento: "+12%" },
      { pergunta: "Quais documentos preciso?", count: 67, crescimento: "+8%" }
    ],
    horariosPico: [
      { horario: "10h-11h", perguntas: 156, percentual: "18%" },
      { horario: "14h-15h", perguntas: 134, percentual: "16%" }
    ],
    diasMaisAtivos: [
      { dia: "Terça", perguntas: 142, percentual: "17%" },
      { dia: "Quarta", perguntas: 138, percentual: "16%" }
    ],
    categoriasMaisConsultadas: [
      { categoria: "Crédito", perguntas: 234, percentual: "28%" },
      { categoria: "Antecipação", perguntas: 189, percentual: "22%" }
    ]
  },
  insights: [
    "Aumento de 30% em perguntas sobre PIX",
    "Usuários mais ativos entre 10h-11h",
    "Taxa de satisfação aumentou 5%",
    "Redução de 20% no tempo médio de resposta"
  ],
  recomendacoes: [
    "Adicionar mais informações sobre PIX na base",
    "Otimizar respostas sobre crédito pessoal",
    "Considerar horário de pico para manutenção",
    "Implementar cache para perguntas frequentes"
  ],
  comparativo: {
    semanaAnterior: {
      usuarios: 271,
      perguntas: 689,
      satisfacao: 4.0
    },
    variacao: {
      usuarios: "+15%",
      perguntas: "+23%",
      satisfacao: "+5%"
    }
  }
}
```

---

## **3. 📧 SISTEMA DE ENVIO DE EMAILS**

### **A. Configuração de Destinatários**

#### **Lista de Emails:**
```javascript
const EMAIL_RECIPIENTS = {
  diario: [
    "gabriel@velotax.com.br",
    "gestor1@velotax.com.br",
    "gestor2@velotax.com.br"
  ],
  semanal: [
    "gabriel@velotax.com.br",
    "diretor@velotax.com.br",
    "gestor1@velotax.com.br"
  ],
  alertas: [
    "gabriel@velotax.com.br",
    "suporte@velotax.com.br"
  ]
};
```

### **B. Templates de Email**

#### **Relatório Diário:**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>📊 Relatório Diário - VeloBot</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 24px; font-weight: bold; color: #2c3e50; }
        .alert { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 10px 0; }
        .insight { background: #d1ecf1; border: 1px solid #bee5eb; padding: 10px; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Relatório Diário - VeloBot</h1>
        <p><strong>Data:</strong> {{data}}</p>
    </div>

    <h2>📈 Resumo do Dia</h2>
    <div class="stats">
        <div class="stat-card">
            <div class="stat-number">{{totalUsuarios}}</div>
            <div>👥 Usuários Únicos</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">{{totalPerguntas}}</div>
            <div>❓ Total de Perguntas</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">{{taxaSucesso}}</div>
            <div>✅ Taxa de Sucesso</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">{{tempoMedioResposta}}</div>
            <div>⏱️ Tempo Médio</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">{{satisfacaoMedia}}/5</div>
            <div>⭐ Satisfação</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">{{usuariosOnline}}</div>
            <div>🟢 Usuários Online</div>
        </div>
    </div>

    <h2>🔥 Top 5 Perguntas</h2>
    <ol>
        {{#each topPerguntas}}
        <li><strong>{{pergunta}}</strong> ({{count}} perguntas) - ⭐ {{satisfacao}}</li>
        {{/each}}
    </ol>

    <h2>⚠️ Alertas</h2>
    {{#each alertas}}
    <div class="alert">⚠️ {{this}}</div>
    {{/each}}

    <h2>💡 Insights</h2>
    {{#each insights}}
    <div class="insight">💡 {{this}}</div>
    {{/each}}

    <hr>
    <p><em>Relatório gerado automaticamente pelo sistema VeloBot</em></p>
</body>
</html>
```

#### **Relatório Semanal:**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>📊 Relatório Semanal - VeloBot</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; }
        .comparison { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
        .comparison-card { background: #f8f9fa; padding: 15px; border-radius: 8px; }
        .trend-up { color: #28a745; }
        .trend-down { color: #dc3545; }
        .recommendation { background: #e2e3e5; border-left: 4px solid #6c757d; padding: 10px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Relatório Semanal - VeloBot</h1>
        <p><strong>Período:</strong> {{periodo}}</p>
    </div>

    <h2>📈 Resumo da Semana</h2>
    <div class="comparison">
        <div class="comparison-card">
            <h3>📊 Métricas Principais</h3>
            <ul>
                <li>👥 Usuários únicos: {{totalUsuarios}} <span class="trend-up">({{crescimentoUsuarios}})</span></li>
                <li>❓ Total de perguntas: {{totalPerguntas}} <span class="trend-up">({{crescimentoPerguntas}})</span></li>
                <li>⭐ Satisfação média: {{satisfacaoMedia}}/5</li>
                <li>⏱️ Tempo médio: {{tempoMedioResposta}}</li>
                <li>✅ Taxa de sucesso: {{taxaSucesso}}</li>
            </ul>
        </div>
        <div class="comparison-card">
            <h3>📅 Comparativo</h3>
            <ul>
                <li>Semana anterior: {{comparativo.semanaAnterior.usuarios}} usuários</li>
                <li>Variação: <span class="trend-up">{{comparativo.variacao.usuarios}}</span></li>
                <li>Perguntas: <span class="trend-up">{{comparativo.variacao.perguntas}}</span></li>
                <li>Satisfação: <span class="trend-up">{{comparativo.variacao.satisfacao}}</span></li>
            </ul>
        </div>
    </div>

    <h2>📊 Tendências</h2>
    <h3>🔥 Perguntas Mais Frequentes</h3>
    <ol>
        {{#each tendencias.perguntasMaisFrequentes}}
        <li><strong>{{pergunta}}</strong> ({{count}} perguntas) <span class="trend-up">{{crescimento}}</span></li>
        {{/each}}
    </ol>

    <h3>⏰ Horários de Pico</h3>
    <ul>
        {{#each tendencias.horariosPico}}
        <li><strong>{{horario}}</strong>: {{perguntas}} perguntas ({{percentual}})</li>
        {{/each}}
    </ul>

    <h2>💡 Insights</h2>
    {{#each insights}}
    <div class="insight">💡 {{this}}</div>
    {{/each}}

    <h2>🎯 Recomendações</h2>
    {{#each recomendacoes}}
    <div class="recommendation">🎯 {{this}}</div>
    {{/each}}

    <hr>
    <p><em>Relatório gerado automaticamente pelo sistema VeloBot</em></p>
</body>
</html>
```

---

## **4. 🔧 IMPLEMENTAÇÃO TÉCNICA**

### **A. Nova API de Relatórios**

#### **`api/reports.js` - Nova Serverless Function:**
```javascript
const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');

const MONGODB_URI = "mongodb+srv://gabrielaraujo:sGoeqQgbxlsIwnjc@velohubcentral.od7vwts.mongodb.net/";
const DB_NAME = "console_conteudo";

// Configuração de email
const EMAIL_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
};

const EMAIL_RECIPIENTS = {
  diario: [
    "gabriel@velotax.com.br",
    "gestor1@velotax.com.br"
  ],
  semanal: [
    "gabriel@velotax.com.br",
    "diretor@velotax.com.br"
  ]
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, action, period } = req.query;
  
  try {
    switch (action) {
      case 'generate':
        return await generateReport(type, period);
      case 'send':
        return await sendReport(type, period);
      case 'status':
        return await getReportStatus(type, period);
      default:
        return res.status(400).json({
          error: 'Ação não reconhecida',
          availableActions: ['generate', 'send', 'status']
        });
    }
  } catch (error) {
    console.error('❌ Erro no reports:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
};

async function generateReport(type, period) {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  
  try {
    let reportData;
    
    if (type === 'daily') {
      reportData = await generateDailyReport(db, period);
    } else if (type === 'weekly') {
      reportData = await generateWeeklyReport(db, period);
    }
    
    // Salvar relatório no MongoDB
    await db.collection('reports').insertOne({
      tipo: type,
      data: new Date(),
      periodo: period,
      dados: reportData,
      status: 'gerado'
    });
    
    return { status: 'success', data: reportData };
  } finally {
    await client.close();
  }
}

async function sendReport(type, period) {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  
  try {
    // Buscar relatório gerado
    const report = await db.collection('reports').findOne({
      tipo: type,
      periodo: period,
      status: 'gerado'
    });
    
    if (!report) {
      throw new Error('Relatório não encontrado');
    }
    
    // Enviar email
    const transporter = nodemailer.createTransporter(EMAIL_CONFIG);
    const recipients = EMAIL_RECIPIENTS[type];
    
    for (const recipient of recipients) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: recipient,
        subject: `📊 Relatório ${type === 'daily' ? 'Diário' : 'Semanal'} - VeloBot`,
        html: generateEmailHTML(type, report.dados)
      });
    }
    
    // Atualizar status
    await db.collection('reports').updateOne(
      { _id: report._id },
      { $set: { status: 'enviado', enviadoEm: new Date() } }
    );
    
    return { status: 'success', message: 'Relatório enviado com sucesso' };
  } finally {
    await client.close();
  }
}
```

### **B. Sistema de Agendamento**

#### **`vercel.json` - Configuração de Cron Jobs:**
```json
{
  "crons": [
    {
      "path": "/api/reports?type=daily&action=send",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/reports?type=weekly&action=send",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

### **C. Integração com Sistema Existente**

#### **Modificações no `AskOpenai.js`:**
```javascript
// Adicionar função de log detalhado
async function logDetailedQuestion(email, pergunta, resposta, metadata) {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    await db.collection('logs_perguntas').insertOne({
      timestamp: new Date(),
      email: email,
      question: pergunta,
      response: resposta,
      source: metadata.source,
      sentiment: metadata.sentiment,
      urgency: metadata.urgency,
      responseTime: metadata.responseTime,
      contextUsed: metadata.contextUsed,
      suggestionsGenerated: metadata.suggestionsGenerated
    });
    
    await client.close();
  } catch (error) {
    console.error('❌ Erro ao logar pergunta:', error);
  }
}

// Modificar função principal para incluir logs
async function processarComIAComFallback(pergunta, email, historico = []) {
  const startTime = Date.now();
  
  // ... código existente ...
  
  const endTime = Date.now();
  const responseTime = endTime - startTime;
  
  // Log detalhado
  await logDetailedQuestion(email, pergunta, resposta, {
    source: resultado.source,
    sentiment: resultado.sentimento,
    urgency: resultado.urgencia,
    responseTime: responseTime,
    contextUsed: resultado.contexto_usado,
    suggestionsGenerated: resultado.sugestoes_proativas?.length || 0
  });
  
  return resultado;
}
```

---

## **5. 📱 DASHBOARD EM TEMPO REAL**

### **A. Página de Monitoramento**

#### **`public/dashboard.html` - Nova página:**
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - VeloBot</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .dashboard { max-width: 1200px; margin: 0 auto; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .stat-number { font-size: 28px; font-weight: bold; color: #2c3e50; margin-bottom: 5px; }
        .stat-label { color: #666; font-size: 14px; }
        .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .chart-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .alerts { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .alert-item { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .alert-warning { background: #fff3cd; border: 1px solid #ffeaa7; }
        .alert-danger { background: #f8d7da; border: 1px solid #f5c6cb; }
        .alert-success { background: #d4edda; border: 1px solid #c3e6cb; }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>📊 Dashboard - VeloBot</h1>
            <p>Monitoramento em tempo real</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number" id="usuarios-online">-</div>
                <div class="stat-label">👥 Usuários Online</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="perguntas-hoje">-</div>
                <div class="stat-label">❓ Perguntas Hoje</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="satisfacao-media">-</div>
                <div class="stat-label">⭐ Satisfação Média</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="tempo-resposta">-</div>
                <div class="stat-label">⏱️ Tempo Médio</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="taxa-sucesso">-</div>
                <div class="stat-label">✅ Taxa de Sucesso</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="feedback-positivo">-</div>
                <div class="stat-label">👍 Feedback Positivo</div>
            </div>
        </div>

        <div class="charts">
            <div class="chart-container">
                <h3>📈 Perguntas por Hora</h3>
                <canvas id="questionsChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>👥 Usuários Únicos</h3>
                <canvas id="usersChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>⭐ Satisfação</h3>
                <canvas id="satisfactionChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>🔥 Top Perguntas</h3>
                <canvas id="topQuestionsChart"></canvas>
            </div>
        </div>

        <div class="alerts">
            <h3>⚠️ Alertas</h3>
            <div id="alerts-list">
                <!-- Alertas serão carregados aqui -->
            </div>
        </div>
    </div>

    <script>
        // Atualizar dados a cada 30 segundos
        setInterval(updateDashboard, 30000);
        
        // Carregar dados iniciais
        updateDashboard();
        
        async function updateDashboard() {
            try {
                const response = await fetch('/api/dashboard?action=stats');
                const data = await response.json();
                
                // Atualizar estatísticas
                document.getElementById('usuarios-online').textContent = data.usuariosOnline || 0;
                document.getElementById('perguntas-hoje').textContent = data.perguntasHoje || 0;
                document.getElementById('satisfacao-media').textContent = data.satisfacaoMedia || '0.0';
                document.getElementById('tempo-resposta').textContent = data.tempoResposta || '0s';
                document.getElementById('taxa-sucesso').textContent = data.taxaSucesso || '0%';
                document.getElementById('feedback-positivo').textContent = data.feedbackPositivo || 0;
                
                // Atualizar gráficos
                updateCharts(data.charts);
                
                // Atualizar alertas
                updateAlerts(data.alertas);
                
            } catch (error) {
                console.error('Erro ao atualizar dashboard:', error);
            }
        }
        
        function updateCharts(chartData) {
            // Implementar atualização dos gráficos
            // Usar Chart.js para renderizar os dados
        }
        
        function updateAlerts(alertas) {
            const alertsList = document.getElementById('alerts-list');
            alertsList.innerHTML = alertas.map(alerta => `
                <div class="alert-item alert-${alerta.tipo}">
                    <strong>${alerta.titulo}</strong><br>
                    ${alerta.descricao}
                </div>
            `).join('');
        }
    </script>
</body>
</html>
```

### **B. API do Dashboard**

#### **`api/dashboard.js` - Nova Serverless Function:**
```javascript
const { MongoClient } = require('mongodb');

const MONGODB_URI = "mongodb+srv://gabrielaraujo:sGoeqQgbxlsIwnjc@velohubcentral.od7vwts.mongodb.net/";
const DB_NAME = "console_conteudo";

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;
  
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    let result;
    
    switch (action) {
      case 'stats':
        result = await getDashboardStats(db);
        break;
      case 'charts':
        result = await getDashboardCharts(db);
        break;
      case 'alerts':
        result = await getDashboardAlerts(db);
        break;
      default:
        return res.status(400).json({
          error: 'Ação não reconhecida',
          availableActions: ['stats', 'charts', 'alerts']
        });
    }
    
    await client.close();
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('❌ Erro no dashboard:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
};

async function getDashboardStats(db) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  
  // Estatísticas do dia
  const perguntasHoje = await db.collection('logs_perguntas').countDocuments({
    timestamp: { $gte: hoje, $lt: amanha }
  });
  
  const usuariosHoje = await db.collection('logs_perguntas').distinct('email', {
    timestamp: { $gte: hoje, $lt: amanha }
  });
  
  const feedbackPositivo = await db.collection('logs_feedback').countDocuments({
    timestamp: { $gte: hoje, $lt: amanha },
    feedback: 'Positivo'
  });
  
  const feedbackNegativo = await db.collection('logs_feedback').countDocuments({
    timestamp: { $gte: hoje, $lt: amanha },
    feedback: 'Negativo'
  });
  
  // Calcular satisfação média
  const satisfacaoData = await db.collection('logs_feedback').aggregate([
    { $match: { timestamp: { $gte: hoje, $lt: amanha } } },
    { $group: { _id: null, avgRating: { $avg: '$rating' } } }
  ]).toArray();
  
  const satisfacaoMedia = satisfacaoData.length > 0 ? satisfacaoData[0].avgRating.toFixed(1) : '0.0';
  
  // Calcular tempo médio de resposta
  const tempoData = await db.collection('logs_perguntas').aggregate([
    { $match: { timestamp: { $gte: hoje, $lt: amanha } } },
    { $group: { _id: null, avgTime: { $avg: '$responseTime' } } }
  ]).toArray();
  
  const tempoResposta = tempoData.length > 0 ? `${(tempoData[0].avgTime / 1000).toFixed(1)}s` : '0s';
  
  // Usuários online (últimos 5 minutos)
  const cincoMinutosAtras = new Date(Date.now() - 5 * 60 * 1000);
  const usuariosOnline = await db.collection('logs_acessos').distinct('email', {
    timestamp: { $gte: cincoMinutosAtras },
    status: 'login'
  });
  
  return {
    usuariosOnline: usuariosOnline.length,
    perguntasHoje: perguntasHoje,
    satisfacaoMedia: satisfacaoMedia,
    tempoResposta: tempoResposta,
    taxaSucesso: `${Math.round((feedbackPositivo / (feedbackPositivo + feedbackNegativo)) * 100)}%`,
    feedbackPositivo: feedbackPositivo
  };
}
```

---

## **6. 🎯 BENEFÍCIOS DO SISTEMA**

### **A. Para Gestores**
- ✅ **Visibilidade completa** do uso do bot
- ✅ **Relatórios automáticos** por email diário e semanal
- ✅ **Alertas em tempo real** para problemas críticos
- ✅ **Métricas de performance** e satisfação do usuário
- ✅ **Dashboard em tempo real** para monitoramento
- ✅ **Tendências e insights** para tomada de decisão

### **B. Para Desenvolvimento**
- ✅ **Dados detalhados** para melhorias do bot
- ✅ **Identificação de gaps** na base de conhecimento
- ✅ **Monitoramento de performance** da IA
- ✅ **Feedback estruturado** dos usuários
- ✅ **Métricas de tempo de resposta** e eficiência
- ✅ **Análise de sentimento** e urgência

### **C. Para Negócio**
- ✅ **ROI do bot** mensurável e visível
- ✅ **Tendências de uso** identificáveis
- ✅ **Oportunidades de melhoria** claras
- ✅ **Satisfação do cliente** monitorada continuamente
- ✅ **Relatórios executivos** automáticos
- ✅ **Alertas proativos** para problemas

---

## **7. 📅 CRONOGRAMA DE IMPLEMENTAÇÃO**

### **Fase 1: Coleta de Dados (1-2 dias)**
- [ ] Expandir logs existentes no `AskOpenai.js`
- [ ] Integrar com MongoDB para logs detalhados
- [ ] Criar estrutura de dados para relatórios
- [ ] Implementar função de log detalhado

### **Fase 2: Relatórios (2-3 dias)**
- [ ] Criar API de relatórios (`api/reports.js`)
- [ ] Implementar geração de relatórios diários e semanais
- [ ] Criar templates de email HTML
- [ ] Configurar sistema de envio de emails
- [ ] Implementar agendamento com Vercel Cron Jobs

### **Fase 3: Dashboard (2-3 dias)**
- [ ] Criar interface de dashboard (`public/dashboard.html`)
- [ ] Implementar API do dashboard (`api/dashboard.js`)
- [ ] Integrar gráficos com Chart.js
- [ ] Implementar atualização em tempo real
- [ ] Criar sistema de alertas visuais

### **Fase 4: Testes e Deploy (1 dia)**
- [ ] Testes de envio de email
- [ ] Validação de relatórios
- [ ] Testes de dashboard
- [ ] Deploy em produção
- [ ] Configuração de destinatários

---

## **8. 💰 CUSTOS ESTIMADOS**

### **Recursos Necessários:**
- **Vercel Cron Jobs**: Gratuito (até 2 execuções/dia)
- **MongoDB**: ~$5-10/mês (dependendo do volume de logs)
- **Email**: Gratuito (usando serviço existente)
- **Chart.js**: Gratuito (CDN)
- **Total**: ~$5-10/mês

### **Economia de Tempo:**
- **Relatórios manuais**: ~2h/semana → **0h** (automático)
- **Análise de dados**: ~1h/dia → **0h** (dashboard)
- **Monitoramento**: ~30min/dia → **0h** (alertas automáticos)
- **Total economizado**: ~4h/semana

---

## **9. 🔧 CONFIGURAÇÃO INICIAL**

### **A. Variáveis de Ambiente**
```env
# MongoDB (já configurado)
MONGODB_URI=mongodb+srv://gabrielaraujo:sGoeqQgbxlsIwnjc@velohubcentral.od7vwts.mongodb.net/

# Email
EMAIL_USER=seu-email@gmail.com
EMAIL_PASS=sua-senha-app

# OpenAI (já configurado)
OPENAI_API_KEY=sk-...
```

### **B. Lista de Destinatários**
```javascript
// Configurar em api/reports.js
const EMAIL_RECIPIENTS = {
  diario: [
    "gabriel@velotax.com.br",
    "gestor1@velotax.com.br",
    "gestor2@velotax.com.br"
  ],
  semanal: [
    "gabriel@velotax.com.br",
    "diretor@velotax.com.br",
    "gestor1@velotax.com.br"
  ]
};
```

### **C. Agendamento**
```json
// Configurar em vercel.json
{
  "crons": [
    {
      "path": "/api/reports?type=daily&action=send",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/reports?type=weekly&action=send",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

---

## **10. 📞 SUPORTE E MANUTENÇÃO**

### **A. Monitoramento**
- ✅ **Logs automáticos** de todas as operações
- ✅ **Alertas por email** para falhas
- ✅ **Dashboard em tempo real** para status
- ✅ **Relatórios de erro** automáticos

### **B. Manutenção**
- ✅ **Backup automático** dos dados
- ✅ **Limpeza automática** de logs antigos
- ✅ **Otimização automática** de queries
- ✅ **Atualização automática** de métricas

---

## **11. 🚀 PRÓXIMOS PASSOS**

1. **Aprovação da proposta** pelo gestor
2. **Configuração das variáveis** de ambiente
3. **Implementação da Fase 1** (Coleta de Dados)
4. **Testes iniciais** com dados reais
5. **Implementação das demais fases** sequencialmente
6. **Deploy em produção** e configuração final
7. **Treinamento dos gestores** no uso do dashboard
8. **Monitoramento inicial** e ajustes finos

---

## **12. 📋 CHECKLIST DE IMPLEMENTAÇÃO**

### **Fase 1: Coleta de Dados**
- [ ] Modificar `AskOpenai.js` para logs detalhados
- [ ] Criar coleções no MongoDB
- [ ] Implementar função de log de acesso
- [ ] Implementar função de log de pergunta
- [ ] Implementar função de log de feedback
- [ ] Testar logs com dados reais

### **Fase 2: Relatórios**
- [ ] Criar `api/reports.js`
- [ ] Implementar geração de relatório diário
- [ ] Implementar geração de relatório semanal
- [ ] Criar templates de email HTML
- [ ] Configurar envio de emails
- [ ] Configurar Vercel Cron Jobs
- [ ] Testar envio de relatórios

### **Fase 3: Dashboard**
- [ ] Criar `public/dashboard.html`
- [ ] Criar `api/dashboard.js`
- [ ] Implementar estatísticas em tempo real
- [ ] Implementar gráficos com Chart.js
- [ ] Implementar sistema de alertas
- [ ] Testar dashboard completo

### **Fase 4: Deploy**
- [ ] Configurar variáveis de ambiente
- [ ] Configurar destinatários de email
- [ ] Deploy em produção
- [ ] Testes finais
- [ ] Treinamento dos usuários
- [ ] Documentação final

---

**Este sistema transformará o VeloBot de um simples chatbot para uma ferramenta de negócio completa com monitoramento, relatórios e insights automáticos!** 🚀

**Pronto para começar a implementação?** 🤔
