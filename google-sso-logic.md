# 🔐 Lógica Completa do SSO Google

## 📋 **Visão Geral**
Sistema de autenticação Google OAuth 2.0 com validação de domínio corporativo e persistência de sessão.

---

## 🏗️ **1. ESTRUTURA HTML**

### **HTML Base**
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- CSP para permitir Google APIs -->
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'self';
                   script-src 'self' https://accounts.google.com https://www.gstatic.com;
                   frame-src https://accounts.google.com;
                   connect-src 'self' https://www.googleapis.com https://accounts.google.com;">
    
    <!-- Google Identity Services -->
    <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
    <!-- Overlay de Login -->
    <div id="identificacao-overlay" class="hidden">
        <div id="identificacao-box">
            <h2>Bem-vindo(a) ao Painel</h2>
            <p>Por favor, faça login com sua conta Google corporativa (@seu-dominio.com).</p>
            <div id="google-signin-button" class="google-signin-btn">
                <img src="https://www.google.com/favicon.ico" alt="Google Icon">
                Entrar com Google
            </div>
            <p id="identificacao-error" class="identificacao-error hidden">
                Acesso permitido apenas para e-mails corporativos
            </p>
        </div>
    </div>

    <!-- Conteúdo Principal -->
    <div class="app-wrapper hidden">
        <!-- Seu conteúdo aqui -->
    </div>
</body>
</html>
```

---

## 🎨 **2. CSS BÁSICO**

```css
/* Overlay de Login */
#identificacao-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
}

#identificacao-box {
    background: white;
    padding: 2rem;
    border-radius: 10px;
    text-align: center;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    max-width: 400px;
    width: 90%;
}

.google-signin-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: #4285f4;
    color: white;
    padding: 12px 24px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
    margin: 20px 0;
    transition: background 0.3s;
}

.google-signin-btn:hover {
    background: #3367d6;
}

.identificacao-error {
    color: #d32f2f;
    font-size: 14px;
    margin-top: 10px;
}

.hidden {
    display: none !important;
}
```

---

## ⚙️ **3. JAVASCRIPT COMPLETO**

```javascript
// ================== CONFIGURAÇÕES ==================
const DOMINIO_PERMITIDO = "@seu-dominio.com"; // Altere para seu domínio
const CLIENT_ID = 'SEU_CLIENT_ID_AQUI'; // Obtenha no Google Cloud Console

// ================== ELEMENTOS DO DOM ==================
const identificacaoOverlay = document.getElementById('identificacao-overlay');
const appWrapper = document.querySelector('.app-wrapper');
const errorMsg = document.getElementById('identificacao-error');

// ================== VARIÁVEIS DE ESTADO ==================
let dadosUsuario = null;
let tokenClient = null;

// ================== FUNÇÕES DE CONTROLE DE UI ==================
function showOverlay() {
    identificacaoOverlay.classList.remove('hidden');
    appWrapper.classList.add('hidden');
}

function hideOverlay() {
    identificacaoOverlay.classList.add('hidden');
    appWrapper.classList.remove('hidden');
}

// ================== LÓGICA DE AUTENTICAÇÃO ==================
function waitForGoogleScript() {
    return new Promise((resolve, reject) => {
        const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
        if (!script) {
            return reject(new Error('Script Google Identity Services não encontrado no HTML.'));
        }
        
        if (window.google && window.google.accounts) {
            return resolve(window.google.accounts);
        }
        
        script.onload = () => {
            if (window.google && window.google.accounts) {
                resolve(window.google.accounts);
            } else {
                reject(new Error('Google Identity Services não carregou corretamente.'));
            }
        };
        
        script.onerror = () => reject(new Error('Erro ao carregar o script Google Identity Services.'));
    });
}

async function handleGoogleSignIn(response) {
    try {
        // 1. Buscar dados do usuário na API do Google
        const googleResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${response.access_token}` }
        });
        const user = await googleResponse.json();

        // 2. Validar domínio corporativo
        if (user.email && user.email.endsWith(DOMINIO_PERMITIDO)) {
            // 3. Buscar perfil adicional (opcional)
            const profileResponse = await fetch(`/api/getUserProfile?email=${encodeURIComponent(user.email)}`);
            let userProfile = {};
            
            if (profileResponse.ok) {
                userProfile = await profileResponse.json();
            }

            // 4. Salvar dados do usuário
            dadosUsuario = {
                nome: user.name,
                email: user.email,
                foto: user.picture,
                timestamp: Date.now(),
                funcao: userProfile.funcao || 'Usuário'
            };

            // 5. Persistir no localStorage
            localStorage.setItem('dadosUsuario', JSON.stringify(dadosUsuario));
            
            // 6. Log de acesso (opcional)
            await logUserAccess('online');
            
            // 7. Iniciar aplicação
            hideOverlay();
            iniciarAplicacao();
            
        } else {
            // Domínio não permitido
            errorMsg.textContent = `Acesso permitido apenas para e-mails ${DOMINIO_PERMITIDO}!`;
            errorMsg.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error("Erro no fluxo de login:", error);
        errorMsg.textContent = 'Erro ao verificar login ou permissões. Tente novamente.';
        errorMsg.classList.remove('hidden');
    }
}

function verificarIdentificacao() {
    const umDiaEmMs = 24 * 60 * 60 * 1000; // 24 horas
    let dadosSalvos = null;
    
    try {
        const dadosSalvosString = localStorage.getItem('dadosUsuario');
        if (dadosSalvosString) {
            dadosSalvos = JSON.parse(dadosSalvosString);
        }
    } catch (e) {
        localStorage.removeItem('dadosUsuario');
    }

    // Verificar se há dados válidos e não expirados
    if (dadosSalvos && 
        dadosSalvos.email && 
        dadosSalvos.email.endsWith(DOMINIO_PERMITIDO) && 
        (Date.now() - dadosSalvos.timestamp < umDiaEmMs)) {
        
        dadosUsuario = dadosSalvos;
        logUserAccess('online');
        hideOverlay();
        iniciarAplicacao();
        
    } else {
        // Dados inválidos ou expirados
        localStorage.removeItem('dadosUsuario');
        showOverlay();
    }
}

function initGoogleSignIn() {
    waitForGoogleScript().then(accounts => {
        // Configurar cliente OAuth
        tokenClient = accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: 'profile email',
            callback: handleGoogleSignIn
        });
        
        // Configurar botão de login
        document.getElementById('google-signin-button').addEventListener('click', () => {
            tokenClient.requestAccessToken();
        });
        
        // Verificar se já está logado
        verificarIdentificacao();
        
    }).catch(error => {
        console.error("Erro na inicialização do Google Sign-In:", error);
        errorMsg.textContent = 'Erro ao carregar autenticação do Google. Verifique sua conexão.';
        errorMsg.classList.remove('hidden');
    });
}

// ================== FUNÇÕES AUXILIARES ==================
async function logUserAccess(status) {
    if (!dadosUsuario?.email) return;
    
    try {
        await fetch('/api/logAccess', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: dadosUsuario.email,
                status: status,
                timestamp: Date.now()
            })
        });
    } catch (error) {
        console.error("Erro ao registrar acesso:", error);
    }
}

function logout() {
    // Limpar dados locais
    localStorage.removeItem('dadosUsuario');
    dadosUsuario = null;
    
    // Log de logout
    logUserAccess('offline');
    
    // Mostrar overlay de login
    showOverlay();
    
    // Limpar interface
    // ... sua lógica de limpeza aqui
}

// ================== INICIALIZAÇÃO ==================
document.addEventListener('DOMContentLoaded', () => {
    initGoogleSignIn();
});

// Logout ao fechar a página
window.addEventListener('beforeunload', () => {
    if (dadosUsuario) {
        logUserAccess('offline');
    }
});

// ================== FUNÇÃO PRINCIPAL DA APLICAÇÃO ==================
function iniciarAplicacao() {
    // Sua lógica de inicialização da aplicação aqui
    console.log('Usuário logado:', dadosUsuario);
    
    // Exemplo: mostrar nome do usuário
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
        userInfo.textContent = `Olá, ${dadosUsuario.nome}!`;
    }
    
    // Exemplo: configurar botão de logout
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}
```

---

## 🔧 **4. CONFIGURAÇÃO NO GOOGLE CLOUD CONSOLE**

### **Passos para configurar:**

1. **Acesse:** [Google Cloud Console](https://console.cloud.google.com/)
2. **Crie um projeto** ou selecione um existente
3. **Ative a API:** Google Identity Services
4. **Vá em:** APIs & Services > Credentials
5. **Crie:** OAuth 2.0 Client ID
6. **Configure:**
   - **Application type:** Web application
   - **Authorized JavaScript origins:** `https://seu-dominio.com`
   - **Authorized redirect URIs:** `https://seu-dominio.com`

### **Variáveis de ambiente necessárias:**
```env
GOOGLE_CLIENT_ID=seu_client_id_aqui
GOOGLE_CLIENT_SECRET=seu_client_secret_aqui
```

---

## 🚀 **5. API DE BACKEND (OPCIONAL)**

### **Node.js/Express exemplo:**
```javascript
// api/getUserProfile.js
const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

module.exports = async function handler(req, res) {
    const { email } = req.query;
    
    try {
        // Buscar perfil do usuário na planilha
        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: 'SUA_PLANILHA_ID',
            range: 'Usuarios!A:D',
        });
        
        const rows = response.data.values || [];
        const user = rows.find(row => row[1] === email);
        
        if (user) {
            res.json({
                funcao: user[2] || 'Usuário',
                departamento: user[3] || 'Geral'
            });
        } else {
            res.json({ funcao: 'Usuário' });
        }
        
    } catch (error) {
        console.error('Erro ao buscar perfil:', error);
        res.json({ funcao: 'Usuário' });
    }
};
```

---

## 📱 **6. RECURSOS AVANÇADOS**

### **Validação de permissões:**
```javascript
function verificarPermissao(permissao) {
    if (!dadosUsuario) return false;
    
    const permissoes = {
        'admin': ['admin', 'gerente'],
        'relatorios': ['admin', 'gerente', 'analista'],
        'editar': ['admin', 'gerente']
    };
    
    return permissoes[permissao]?.includes(dadosUsuario.funcao) || false;
}
```

### **Renovação automática de token:**
```javascript
function verificarExpiracao() {
    if (!dadosUsuario) return;
    
    const tempoExpiracao = 23 * 60 * 60 * 1000; // 23 horas
    if (Date.now() - dadosUsuario.timestamp > tempoExpiracao) {
        logout();
    }
}

// Verificar a cada hora
setInterval(verificarExpiracao, 60 * 60 * 1000);
```

---

## ✅ **7. CHECKLIST DE IMPLEMENTAÇÃO**

- [ ] Configurar Google Cloud Console
- [ ] Adicionar script do Google Identity Services
- [ ] Configurar CSP no HTML
- [ ] Implementar funções de autenticação
- [ ] Configurar validação de domínio
- [ ] Implementar persistência no localStorage
- [ ] Adicionar tratamento de erros
- [ ] Configurar logout
- [ ] Testar fluxo completo
- [ ] Implementar API de perfil (opcional)

---

## 🔒 **8. SEGURANÇA**

### **Boas práticas:**
- ✅ Sempre validar domínio no frontend E backend
- ✅ Usar HTTPS em produção
- ✅ Implementar CSP adequado
- ✅ Validar tokens no backend
- ✅ Limitar escopo das permissões
- ✅ Implementar rate limiting
- ✅ Logs de auditoria

### **Validação no backend:**
```javascript
// Verificar token no backend
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(CLIENT_ID);

async function verificarToken(token) {
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: CLIENT_ID,
        });
        const payload = ticket.getPayload();
        return payload;
    } catch (error) {
        throw new Error('Token inválido');
    }
}
```

---

## 🎯 **9. EXEMPLO DE USO COMPLETO**

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
    <div id="login-overlay">
        <button id="google-signin-button">Entrar com Google</button>
    </div>
    
    <div id="app" class="hidden">
        <h1>Bem-vindo!</h1>
        <button id="logout-button">Sair</button>
    </div>
    
    <script>
        // Cole todo o código JavaScript aqui
    </script>
</body>
</html>
```

---

**🚀 Pronto! Agora você tem uma implementação completa e robusta do SSO Google que pode ser usada em qualquer projeto!**
