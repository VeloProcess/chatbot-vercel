# 🔐 Sistema de Login Melhorado - Controle de Acesso Hierárquico

## 🎯 **Objetivos das Melhorias**

1. **Controle de acesso por níveis** (Você e seu supervisor)
2. **Logs de auditoria detalhados**
3. **Sistema de permissões granular**
4. **Interface administrativa**
5. **Segurança aprimorada**

---

## 🏗️ **1. ESTRUTURA DE PERMISSÕES**

### **Níveis de Acesso:**
```javascript
const NIVEL_ACESSO = {
    SUPER_ADMIN: {
        nivel: 5,
        nome: 'Super Administrador',
        permissoes: ['tudo', 'gerenciar_usuarios', 'logs_completos', 'configuracoes']
    },
    ADMIN: {
        nivel: 4,
        nome: 'Administrador',
        permissoes: ['gerenciar_usuarios', 'logs_auditoria', 'relatorios', 'configuracoes_basicas']
    },
    SUPERVISOR: {
        nivel: 3,
        nome: 'Supervisor',
        permissoes: ['visualizar_usuarios', 'logs_auditoria', 'relatorios', 'dashboard']
    },
    GESTOR: {
        nivel: 2,
        nome: 'Gestor',
        permissoes: ['dashboard', 'relatorios_basicos']
    },
    ATENDENTE: {
        nivel: 1,
        nome: 'Atendente',
        permissoes: ['chat', 'perfil_proprio']
    }
};
```

---

## 📊 **2. PLANILHA DE USUÁRIOS MELHORADA**

### **Estrutura da Planilha `Usuarios!A:F`:**
```
| Email                    | Nome Completo    | Funcao      | Nivel | Ativo | UltimoAcesso        |
|--------------------------|------------------|-------------|-------|-------|---------------------|
| admin@velotax.com.br     | Admin Sistema    | Super Admin | 5     | SIM   | 2024-01-15 10:30:00 |
| supervisor@velotax.com.br| João Supervisor  | Supervisor  | 3     | SIM   | 2024-01-15 09:15:00 |
| gestor@velotax.com.br    | Maria Gestora    | Gestor      | 2     | SIM   | 2024-01-15 08:45:00 |
| atendente@velotax.com.br | Pedro Atendente  | Atendente   | 1     | SIM   | 2024-01-15 07:30:00 |
```

---

## ⚙️ **3. API DE PERFIL MELHORADA**

### **`api/getUserProfile.js` - Versão Aprimorada:**
```javascript
const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";

const auth = new google.auth.GoogleAuth({
  credentials: process.env.GOOGLE_CREDENTIALS ? JSON.parse(process.env.GOOGLE_CREDENTIALS) : {},
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

// Cache de usuários (5 minutos)
let userCache = { data: null, timestamp: null };
const CACHE_DURATION = 5 * 60 * 1000;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'E-mail não fornecido.' });
  }

  try {
    // Verificar cache
    const now = Date.now();
    if (userCache.data && userCache.timestamp && (now - userCache.timestamp) < CACHE_DURATION) {
      const user = userCache.data.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (user) {
        return res.status(200).json(user);
      }
    }

    // Buscar na planilha
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Usuarios!A:F',
    });

    const rows = response.data.values || [];
    const users = [];

    // Processar dados (pular cabeçalho)
    for (let i = 1; i < rows.length; i++) {
      const [userEmail, nomeCompleto, funcao, nivel, ativo, ultimoAcesso] = rows[i];
      
      if (userEmail && ativo && ativo.toUpperCase() === 'SIM') {
        users.push({
          email: userEmail,
          nome: nomeCompleto,
          funcao: funcao || 'Atendente',
          nivel: parseInt(nivel) || 1,
          ativo: ativo === 'SIM',
          ultimoAcesso: ultimoAcesso || new Date().toISOString(),
          permissoes: getPermissoesByNivel(parseInt(nivel) || 1)
        });
      }
    }

    // Atualizar cache
    userCache = { data: users, timestamp: now };

    // Encontrar usuário específico
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (user) {
      // Log de acesso
      await logUserAccess(user.email, 'profile_accessed');
      return res.status(200).json(user);
    } else {
      return res.status(404).json({ 
        error: 'Usuário não encontrado ou inativo.',
        email: email 
      });
    }

  } catch (error) {
    console.error("ERRO AO BUSCAR PERFIL DO USUÁRIO:", error);
    return res.status(500).json({ 
      error: 'Erro interno ao buscar perfil do usuário.',
      fallback: { email: email, funcao: 'Atendente', nivel: 1, permissoes: ['chat'] }
    });
  }
};

function getPermissoesByNivel(nivel) {
  const permissoes = {
    5: ['tudo', 'gerenciar_usuarios', 'logs_completos', 'configuracoes', 'dashboard', 'relatorios'],
    4: ['gerenciar_usuarios', 'logs_auditoria', 'relatorios', 'configuracoes_basicas', 'dashboard'],
    3: ['visualizar_usuarios', 'logs_auditoria', 'relatorios', 'dashboard'],
    2: ['dashboard', 'relatorios_basicos'],
    1: ['chat', 'perfil_proprio']
  };
  return permissoes[nivel] || ['chat'];
}

async function logUserAccess(email, action) {
  try {
    await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/logAccess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        action,
        timestamp: new Date().toISOString(),
        ip: 'system'
      })
    });
  } catch (error) {
    console.error('Erro ao logar acesso:', error);
  }
}
```

---

## 📝 **4. API DE LOGS DE AUDITORIA**

### **`api/logAccess.js` - Novo arquivo:**
```javascript
const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";
const LOGS_SHEET_NAME = "LogsAuditoria!A:E";

const auth = new google.auth.GoogleAuth({
  credentials: process.env.GOOGLE_CREDENTIALS ? JSON.parse(process.env.GOOGLE_CREDENTIALS) : {},
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { email, action, timestamp, ip, details } = req.body;

    if (!email || !action) {
      return res.status(400).json({ error: 'Email e ação são obrigatórios' });
    }

    // Adicionar log na planilha
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: LOGS_SHEET_NAME,
      valueInputOption: 'RAW',
      resource: {
        values: [[
          timestamp || new Date().toISOString(),
          email,
          action,
          ip || 'unknown',
          JSON.stringify(details || {})
        ]]
      }
    });

    console.log(`Log registrado: ${email} - ${action}`);
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("ERRO AO REGISTRAR LOG:", error);
    return res.status(500).json({ error: 'Erro interno ao registrar log' });
  }
};
```

---

## 🎨 **5. INTERFACE ADMINISTRATIVA**

### **HTML - Painel Admin:**
```html
<!-- Adicionar no index.html -->
<div id="admin-panel" class="admin-panel hidden">
    <div class="admin-header">
        <h2>🔧 Painel Administrativo</h2>
        <button id="close-admin-panel" class="close-btn">×</button>
    </div>
    
    <div class="admin-tabs">
        <button class="tab-btn active" data-tab="users">👥 Usuários</button>
        <button class="tab-btn" data-tab="logs">📊 Logs</button>
        <button class="tab-btn" data-tab="stats">📈 Estatísticas</button>
    </div>
    
    <div class="admin-content">
        <!-- Aba Usuários -->
        <div id="tab-users" class="tab-content active">
            <div class="users-controls">
                <input type="text" id="user-search" placeholder="Buscar usuário...">
                <button id="refresh-users">🔄 Atualizar</button>
            </div>
            <div id="users-list" class="users-list"></div>
        </div>
        
        <!-- Aba Logs -->
        <div id="tab-logs" class="tab-content">
            <div class="logs-controls">
                <input type="date" id="log-date-from">
                <input type="date" id="log-date-to">
                <select id="log-user-filter">
                    <option value="">Todos os usuários</option>
                </select>
                <button id="filter-logs">🔍 Filtrar</button>
            </div>
            <div id="logs-list" class="logs-list"></div>
        </div>
        
        <!-- Aba Estatísticas -->
        <div id="tab-stats" class="tab-content">
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>Usuários Ativos</h3>
                    <span id="active-users-count">-</span>
                </div>
                <div class="stat-card">
                    <h3>Logins Hoje</h3>
                    <span id="logins-today">-</span>
                </div>
                <div class="stat-card">
                    <h3>Perguntas Hoje</h3>
                    <span id="questions-today">-</span>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Botão para abrir painel admin (só para admins) -->
<button id="admin-panel-btn" class="admin-btn hidden">🔧 Admin</button>
```

---

## 🎨 **6. CSS PARA PAINEL ADMIN**

```css
/* Painel Administrativo */
.admin-panel {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    z-index: 10000;
    display: flex;
    flex-direction: column;
}

.admin-header {
    background: #2c3e50;
    color: white;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.close-btn {
    background: #e74c3c;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 5px;
    cursor: pointer;
    font-size: 1.2rem;
}

.admin-tabs {
    background: #34495e;
    display: flex;
    padding: 0;
    margin: 0;
}

.tab-btn {
    background: transparent;
    color: white;
    border: none;
    padding: 1rem 2rem;
    cursor: pointer;
    border-bottom: 3px solid transparent;
    transition: all 0.3s;
}

.tab-btn.active {
    background: #3498db;
    border-bottom-color: #2980b9;
}

.admin-content {
    flex: 1;
    background: white;
    padding: 2rem;
    overflow-y: auto;
}

.tab-content {
    display: none;
}

.tab-content.active {
    display: block;
}

.users-controls, .logs-controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
}

.users-controls input, .logs-controls input, .logs-controls select {
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 5px;
    flex: 1;
    min-width: 200px;
}

.users-list, .logs-list {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid #ddd;
    border-radius: 5px;
}

.user-item, .log-item {
    padding: 1rem;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.user-item:hover, .log-item:hover {
    background: #f8f9fa;
}

.user-info, .log-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.user-email, .log-email {
    font-weight: bold;
    color: #2c3e50;
}

.user-role, .log-action {
    color: #7f8c8d;
    font-size: 0.9rem;
}

.user-status {
    padding: 0.25rem 0.5rem;
    border-radius: 15px;
    font-size: 0.8rem;
    font-weight: bold;
}

.status-online {
    background: #d4edda;
    color: #155724;
}

.status-offline {
    background: #f8d7da;
    color: #721c24;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
}

.stat-card {
    background: #f8f9fa;
    padding: 2rem;
    border-radius: 10px;
    text-align: center;
    border-left: 4px solid #3498db;
}

.stat-card h3 {
    margin: 0 0 1rem 0;
    color: #2c3e50;
}

.stat-card span {
    font-size: 2rem;
    font-weight: bold;
    color: #3498db;
}

.admin-btn {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #e74c3c;
    color: white;
    border: none;
    padding: 0.75rem 1rem;
    border-radius: 50px;
    cursor: pointer;
    font-size: 1.1rem;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    transition: all 0.3s;
}

.admin-btn:hover {
    background: #c0392b;
    transform: translateY(-2px);
}
```

---

## ⚙️ **7. JAVASCRIPT MELHORADO**

### **Sistema de Permissões:**
```javascript
// ================== SISTEMA DE PERMISSÕES ==================
const PERMISSOES = {
    TUDO: 'tudo',
    GERENCIAR_USUARIOS: 'gerenciar_usuarios',
    LOGS_COMPLETOS: 'logs_completos',
    LOGS_AUDITORIA: 'logs_auditoria',
    CONFIGURACOES: 'configuracoes',
    DASHBOARD: 'dashboard',
    RELATORIOS: 'relatorios',
    VISUALIZAR_USUARIOS: 'visualizar_usuarios'
};

function temPermissao(permissao) {
    if (!dadosAtendente || !dadosAtendente.permissoes) return false;
    
    return dadosAtendente.permissoes.includes(PERMISSOES.TUDO) || 
           dadosAtendente.permissoes.includes(permissao);
}

function mostrarElementosPorPermissao() {
    // Mostrar botão admin apenas para quem tem permissão
    const adminBtn = document.getElementById('admin-panel-btn');
    if (adminBtn) {
        if (temPermissao(PERMISSOES.GERENCIAR_USUARIOS)) {
            adminBtn.classList.remove('hidden');
        } else {
            adminBtn.classList.add('hidden');
        }
    }
    
    // Mostrar dashboard apenas para gestores+
    const dashboardLink = document.getElementById('manager-dashboard-link');
    if (dashboardLink) {
        if (temPermissao(PERMISSOES.DASHBOARD)) {
            dashboardLink.classList.remove('hidden');
        } else {
            dashboardLink.classList.add('hidden');
        }
    }
}

// ================== PAINEL ADMINISTRATIVO ==================
let adminPanel = null;
let currentTab = 'users';

function initAdminPanel() {
    adminPanel = document.getElementById('admin-panel');
    if (!adminPanel) return;
    
    // Configurar botões
    document.getElementById('admin-panel-btn')?.addEventListener('click', () => {
        adminPanel.classList.remove('hidden');
        loadUsers();
    });
    
    document.getElementById('close-admin-panel')?.addEventListener('click', () => {
        adminPanel.classList.add('hidden');
    });
    
    // Configurar abas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
    
    // Configurar controles
    document.getElementById('refresh-users')?.addEventListener('click', loadUsers);
    document.getElementById('filter-logs')?.addEventListener('click', loadLogs);
}

function switchTab(tabName) {
    // Atualizar botões
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Atualizar conteúdo
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
    
    currentTab = tabName;
    
    // Carregar dados da aba
    switch(tabName) {
        case 'users': loadUsers(); break;
        case 'logs': loadLogs(); break;
        case 'stats': loadStats(); break;
    }
}

async function loadUsers() {
    if (!temPermissao(PERMISSOES.VISUALIZAR_USUARIOS)) {
        alert('Você não tem permissão para visualizar usuários');
        return;
    }
    
    try {
        const response = await fetch('/api/getAllUsers');
        const users = await response.json();
        
        const usersList = document.getElementById('users-list');
        usersList.innerHTML = users.map(user => `
            <div class="user-item">
                <div class="user-info">
                    <div class="user-email">${user.email}</div>
                    <div class="user-role">${user.funcao} (Nível ${user.nivel})</div>
                    <div class="user-last-access">Último acesso: ${new Date(user.ultimoAcesso).toLocaleString()}</div>
                </div>
                <div class="user-actions">
                    <span class="user-status ${user.ativo ? 'status-online' : 'status-offline'}">
                        ${user.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        alert('Erro ao carregar usuários');
    }
}

async function loadLogs() {
    if (!temPermissao(PERMISSOES.LOGS_AUDITORIA)) {
        alert('Você não tem permissão para visualizar logs');
        return;
    }
    
    try {
        const dateFrom = document.getElementById('log-date-from').value;
        const dateTo = document.getElementById('log-date-to').value;
        const userFilter = document.getElementById('log-user-filter').value;
        
        const params = new URLSearchParams();
        if (dateFrom) params.append('dateFrom', dateFrom);
        if (dateTo) params.append('dateTo', dateTo);
        if (userFilter) params.append('user', userFilter);
        
        const response = await fetch(`/api/getLogs?${params}`);
        const logs = await response.json();
        
        const logsList = document.getElementById('logs-list');
        logsList.innerHTML = logs.map(log => `
            <div class="log-item">
                <div class="log-info">
                    <div class="log-email">${log.email}</div>
                    <div class="log-action">${log.action}</div>
                    <div class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</div>
                </div>
                <div class="log-details">
                    <span class="log-ip">IP: ${log.ip}</span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao carregar logs:', error);
        alert('Erro ao carregar logs');
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/getStats');
        const stats = await response.json();
        
        document.getElementById('active-users-count').textContent = stats.activeUsers || 0;
        document.getElementById('logins-today').textContent = stats.loginsToday || 0;
        document.getElementById('questions-today').textContent = stats.questionsToday || 0;
        
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

// ================== FUNÇÃO DE LOGIN MELHORADA ==================
async function handleGoogleSignIn(response) {
    try {
        const googleResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${response.access_token}` }
        });
        const user = await googleResponse.json();

        if (user.email && user.email.endsWith(DOMINIO_PERMITIDO)) {
            const profileResponse = await fetch(`/api/getUserProfile?email=${encodeURIComponent(user.email)}`);
            
            if (!profileResponse.ok) {
                throw new Error('Usuário não encontrado ou inativo');
            }
            
            const userProfile = await profileResponse.json();

            dadosAtendente = {
                nome: user.name,
                email: user.email,
                foto: user.picture,
                timestamp: Date.now(),
                funcao: userProfile.funcao,
                nivel: userProfile.nivel,
                permissoes: userProfile.permissoes,
                ativo: userProfile.ativo
            };

            localStorage.setItem('dadosAtendenteChatbot', JSON.stringify(dadosAtendente));
            
            // Log de login
            await logUserAccess('login', { 
                nivel: userProfile.nivel,
                funcao: userProfile.funcao 
            });
            
            hideOverlay();
            iniciarBot();
            mostrarElementosPorPermissao(); // Mostrar elementos baseado em permissões
            checkCurrentUserStatus();
            
        } else {
            errorMsg.textContent = `Acesso permitido apenas para e-mails ${DOMINIO_PERMITIDO}!`;
            errorMsg.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error("Erro no fluxo de login:", error);
        errorMsg.textContent = 'Erro ao verificar login ou permissões. Tente novamente.';
        errorMsg.classList.remove('hidden');
    }
}

// ================== INICIALIZAÇÃO ==================
document.addEventListener('DOMContentLoaded', () => {
    initGoogleSignIn();
    initAdminPanel();
});
```

---

## 📊 **8. APIS ADICIONAIS NECESSÁRIAS**

### **`api/getAllUsers.js`:**
```javascript
const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";

const auth = new google.auth.GoogleAuth({
  credentials: process.env.GOOGLE_CREDENTIALS ? JSON.parse(process.env.GOOGLE_CREDENTIALS) : {},
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Usuarios!A:F',
    });

    const rows = response.data.values || [];
    const users = [];

    for (let i = 1; i < rows.length; i++) {
      const [email, nome, funcao, nivel, ativo, ultimoAcesso] = rows[i];
      
      if (email) {
        users.push({
          email,
          nome: nome || 'Nome não informado',
          funcao: funcao || 'Atendente',
          nivel: parseInt(nivel) || 1,
          ativo: ativo === 'SIM',
          ultimoAcesso: ultimoAcesso || new Date().toISOString()
        });
      }
    }

    return res.status(200).json(users);

  } catch (error) {
    console.error("ERRO AO BUSCAR USUÁRIOS:", error);
    return res.status(500).json({ error: 'Erro interno ao buscar usuários' });
  }
};
```

### **`api/getLogs.js`:**
```javascript
const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";

const auth = new google.auth.GoogleAuth({
  credentials: process.env.GOOGLE_CREDENTIALS ? JSON.parse(process.env.GOOGLE_CREDENTIALS) : {},
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { dateFrom, dateTo, user } = req.query;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'LogsAuditoria!A:E',
    });

    const rows = response.data.values || [];
    let logs = [];

    for (let i = 1; i < rows.length; i++) {
      const [timestamp, email, action, ip, details] = rows[i];
      
      if (timestamp) {
        const logDate = new Date(timestamp);
        
        // Filtrar por data
        if (dateFrom && logDate < new Date(dateFrom)) continue;
        if (dateTo && logDate > new Date(dateTo)) continue;
        
        // Filtrar por usuário
        if (user && email !== user) continue;
        
        logs.push({
          timestamp,
          email,
          action,
          ip,
          details: details ? JSON.parse(details) : {}
        });
      }
    }

    // Ordenar por timestamp (mais recente primeiro)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.status(200).json(logs);

  } catch (error) {
    console.error("ERRO AO BUSCAR LOGS:", error);
    return res.status(500).json({ error: 'Erro interno ao buscar logs' });
  }
};
```

### **`api/getStats.js`:**
```javascript
const { google } = require('googleapis');

const SPREADSHEET_ID = "1tnWusrOW-UXHFM8GT3o0Du93QDwv5G3Ylvgebof9wfQ";

const auth = new google.auth.GoogleAuth({
  credentials: process.env.GOOGLE_CREDENTIALS ? JSON.parse(process.env.GOOGLE_CREDENTIALS) : {},
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // Buscar usuários ativos
    const usersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Usuarios!A:E',
    });

    const usersRows = usersResponse.data.values || [];
    const activeUsers = usersRows.filter((row, index) => 
      index > 0 && row[4] === 'SIM'
    ).length;

    // Buscar logs de hoje
    const logsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'LogsAuditoria!A:C',
    });

    const logsRows = logsResponse.data.values || [];
    const today = new Date().toISOString().split('T')[0];
    
    const loginsToday = logsRows.filter((row, index) => 
      index > 0 && 
      row[0] && 
      row[0].startsWith(today) && 
      row[2] === 'login'
    ).length;

    const questionsToday = logsRows.filter((row, index) => 
      index > 0 && 
      row[0] && 
      row[0].startsWith(today) && 
      row[2] === 'question'
    ).length;

    return res.status(200).json({
      activeUsers,
      loginsToday,
      questionsToday
    });

  } catch (error) {
    console.error("ERRO AO BUSCAR ESTATÍSTICAS:", error);
    return res.status(500).json({ error: 'Erro interno ao buscar estatísticas' });
  }
};
```

---

## 🚀 **9. IMPLEMENTAÇÃO GRADUAL**

### **Fase 1 - Estrutura Básica:**
1. ✅ Atualizar planilha com colunas de nível e ativo
2. ✅ Implementar API de perfil melhorada
3. ✅ Adicionar sistema de permissões básico

### **Fase 2 - Logs e Auditoria:**
1. ✅ Criar API de logs
2. ✅ Implementar logs de acesso
3. ✅ Adicionar logs de ações importantes

### **Fase 3 - Interface Admin:**
1. ✅ Criar painel administrativo
2. ✅ Implementar visualização de usuários
3. ✅ Adicionar filtros de logs

### **Fase 4 - Funcionalidades Avançadas:**
1. ✅ Estatísticas em tempo real
2. ✅ Notificações de segurança
3. ✅ Relatórios automáticos

---

## 🔒 **10. SEGURANÇA APRIMORADA**

### **Validações Adicionais:**
```javascript
// Validar nível mínimo para ações
function validarNivelMinimo(nivelMinimo) {
    return dadosAtendente && dadosAtendente.nivel >= nivelMinimo;
}

// Rate limiting para APIs sensíveis
const rateLimits = new Map();

function verificarRateLimit(email, action, maxAttempts = 10, windowMs = 60000) {
    const key = `${email}-${action}`;
    const now = Date.now();
    const attempts = rateLimits.get(key) || [];
    
    // Remover tentativas antigas
    const recentAttempts = attempts.filter(time => now - time < windowMs);
    
    if (recentAttempts.length >= maxAttempts) {
        throw new Error('Muitas tentativas. Tente novamente em alguns minutos.');
    }
    
    recentAttempts.push(now);
    rateLimits.set(key, recentAttempts);
}

// Log de tentativas suspeitas
function logSuspiciousActivity(email, action, details) {
    console.warn(`ATIVIDADE SUSPEITA: ${email} - ${action}`, details);
    // Enviar alerta para administradores
}
```

---

## 📋 **11. CHECKLIST DE IMPLEMENTAÇÃO**

- [ ] **Planilha de Usuários:**
  - [ ] Adicionar colunas: Nivel, Ativo, UltimoAcesso
  - [ ] Configurar usuários de teste
  - [ ] Definir níveis de acesso

- [ ] **APIs:**
  - [ ] Atualizar getUserProfile.js
  - [ ] Criar logAccess.js
  - [ ] Criar getAllUsers.js
  - [ ] Criar getLogs.js
  - [ ] Criar getStats.js

- [ ] **Frontend:**
  - [ ] Adicionar sistema de permissões
  - [ ] Criar painel administrativo
  - [ ] Implementar controles de acesso
  - [ ] Adicionar logs de auditoria

- [ ] **Segurança:**
  - [ ] Implementar rate limiting
  - [ ] Adicionar validações de nível
  - [ ] Configurar logs de segurança
  - [ ] Testar cenários de acesso

- [ ] **Testes:**
  - [ ] Testar login com diferentes níveis
  - [ ] Verificar permissões
  - [ ] Validar logs de auditoria
  - [ ] Testar interface administrativa

---

**🎯 Com essas melhorias, você terá um sistema de login robusto com controle de acesso hierárquico, logs de auditoria completos e interface administrativa para gerenciar usuários e monitorar atividades!**
