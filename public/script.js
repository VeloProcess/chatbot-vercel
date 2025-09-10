document.addEventListener('DOMContentLoaded', () => {
    // ================== CONFIGURAÇÕES GLOBAIS ==================
    const DOMINIO_PERMITIDO = "@velotax.com.br";
    const CLIENT_ID = '827325386401-ahi2f9ume9i7lc28lau7j4qlviv5d22k.apps.googleusercontent.com';

    // ================== ELEMENTOS DO DOM ==================
    const identificacaoOverlay = document.getElementById('identificacao-overlay');
    const appWrapper = document.querySelector('.app-wrapper');
    const errorMsg = document.getElementById('identificacao-error');
    const userStatusContainer = document.getElementById('user-status-container');

    // ================== VARIÁVEIS DE ESTADO ==================
    let ultimaPergunta = '';
    let ultimaLinhaDaFonte = null;
    let isTyping = false;
    let dadosAtendente = null;
    let tokenClient = null;
    let sessionId = generateUUID();

    // ================== FUNÇÕES GERAIS ==================
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function showOverlay() {
        identificacaoOverlay.classList.remove('hidden');
        appWrapper.classList.add('hidden');
    }

    function hideOverlay() {
        identificacaoOverlay.classList.add('hidden');
        appWrapper.classList.remove('hidden');
    }

    function formatarAssinatura(nomeCompleto) {
        if (!nomeCompleto) return '';
        const nomes = nomeCompleto.trim().split(' ');
        const primeiroNome = nomes[0];
        let assinatura = primeiroNome;
        if (nomes.length > 1 && nomes[1]) {
            assinatura += ' ' + nomes[1].charAt(0).toUpperCase() + '.';
        }
        return assinatura;
    }

    // ================== LOGIN E AUTENTICAÇÃO ==================
    function waitForGoogleScript() {
        return new Promise((resolve, reject) => {
            const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
            if (!script) return reject(new Error('Script Google Identity Services não encontrado.'));
            if (window.google && window.google.accounts) return resolve(window.google.accounts);
            script.onload = () => {
                if (window.google && window.google.accounts) resolve(window.google.accounts);
                else reject(new Error('Falha ao carregar Google Identity Services.'));
            };
            script.onerror = () => reject(new Error('Erro ao carregar o script Google Identity Services.'));
        });
    }

    async function handleGoogleSignIn(response) {
        try {
            const googleResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${response.access_token}` }
            });
            const user = await googleResponse.json();
            if (!user.email || !user.email.endsWith(DOMINIO_PERMITIDO)) {
                errorMsg.textContent = 'Acesso permitido apenas para e-mails @velotax.com.br!';
                errorMsg.classList.remove('hidden');
                return;
            }
            const profileResponse = await fetch(`/api/getUserProfile?email=${encodeURIComponent(user.email)}`);
            if (!profileResponse.ok) throw new Error('Falha ao buscar perfil do usuário.');
            const userProfile = await profileResponse.json();
            dadosAtendente = {
                nome: user.name,
                email: user.email,
                timestamp: Date.now(),
                funcao: userProfile.funcao
            };
            localStorage.setItem('dadosAtendenteChatbot', JSON.stringify(dadosAtendente));
            await logUserStatus('online');
            hideOverlay();
            iniciarBot();
            checkCurrentUserStatus();
        } catch (error) {
            console.error("Erro no login Google:", error);
            errorMsg.textContent = 'Erro ao verificar login ou permissões. Tente novamente.';
            errorMsg.classList.remove('hidden');
        }
    }

    function verificarIdentificacao() {
        const umDiaEmMs = 24 * 60 * 60 * 1000;
        let dadosSalvos = null;
        try {
            const dadosSalvosString = localStorage.getItem('dadosAtendenteChatbot');
            if (dadosSalvosString) dadosSalvos = JSON.parse(dadosSalvosString);
        } catch (e) {
            localStorage.removeItem('dadosAtendenteChatbot');
        }
        if (dadosSalvos && dadosSalvos.email && dadosSalvos.email.endsWith(DOMINIO_PERMITIDO) && (Date.now() - dadosSalvos.timestamp < umDiaEmMs)) {
            dadosAtendente = dadosSalvos;
            logUserStatus('online');
            hideOverlay();
            iniciarBot();
            checkCurrentUserStatus();
        } else {
            localStorage.removeItem('dadosAtendenteChatbot');
            showOverlay();
        }
    }

    function initGoogleSignIn() {
        waitForGoogleScript()
        .then(accounts => {
            tokenClient = accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: 'profile email',
                callback: handleGoogleSignIn
            });
            const googleBtn = document.getElementById('google-signin-button');
            if (googleBtn) googleBtn.addEventListener('click', () => tokenClient.requestAccessToken());
            verificarIdentificacao();
        })
        .catch(error => {
            console.error("Erro na inicialização do Google Sign-In:", error);
            errorMsg.textContent = 'Erro ao carregar autenticação do Google. Verifique sua conexão ou tente novamente.';
            errorMsg.classList.remove('hidden');
        });
    }

    // ================== LOG DE STATUS ==================
    function logUserStatus(status) {
        if (!dadosAtendente?.email) return;
        const url = '/api/logQuestion';
        const data = JSON.stringify({
            type: 'access',
            payload: { email: dadosAtendente.email, status, sessionId }
        });
        if (navigator.sendBeacon) {
            const blob = new Blob([data], { type: 'application/json' });
            navigator.sendBeacon(url, blob);
        } else {
            fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data, keepalive: true })
            .catch(error => console.error(`Erro ao registrar status ${status}:`, error));
        }
    }

    async function updateUserStatus(email) {
        if (!userStatusContainer || !email) return;
        try {
            const response = await fetch(`/api/logQuestion?email=${encodeURIComponent(email)}`);
            const contentType = response.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) data = await response.json();
            else { console.error('Resposta inesperada:', await response.text()); return; }
            if (data.status === 'sucesso' && data.user) {
                const { email, status, lastLogin, lastLogout, history } = data.user;
                userStatusContainer.innerHTML = `<h3>Status do Usuário: ${email}</h3>
                    <p><strong>Status Atual:</strong> ${status === 'online' ? 'Online 🟢' : 'Offline 🔴'}</p>
                    <p><strong>Último Login:</strong> ${lastLogin}</p>
                    <p><strong>Último Logout:</strong> ${lastLogout}</p>
                    <h4>Histórico:</h4>
                    <ul>${history.length > 0 ? history.map(event => `<li>${event.timestamp}: ${event.status === 'online' ? 'Entrou' : 'Saiu'} (Sessão: ${event.sessionId})</li>`).join('') : '<li>Sem histórico recente</li>'}</ul>`;
            }
        } catch (error) { console.error("Erro ao buscar status do usuário:", error); }
    }

    function checkCurrentUserStatus() {
        if (dadosAtendente?.email) {
            updateUserStatus(dadosAtendente.email);
            setInterval(() => updateUserStatus(dadosAtendente.email), 30000);
        }
    }

    // ================== FUNÇÕES DE MENSAGEM / BOT ==================
    async function logQuestionOnSheet(question, email) {
        if (!question || !email) return;
        try {
            await fetch('/api/logQuestion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'question', payload: { question, email } })
            });
        } catch (error) { console.error("Erro ao registrar pergunta:", error); }
    }

    function showTypingIndicator() {
        if (isTyping) return;
        isTyping = true;
        const chatBox = document.getElementById('chat-box');
        const typingContainer = document.createElement('div');
        typingContainer.className = 'message-container bot typing-indicator';
        typingContainer.id = 'typing-indicator';
        typingContainer.innerHTML = `<div class="avatar bot">🤖</div><div class="message-content"><div class="message"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
        chatBox.appendChild(typingContainer);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function hideTypingIndicator() {
        isTyping = false;
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) typingIndicator.remove();
    }

    function addMessage(text, sender, { sourceRow = null, options = [], source = 'Planilha', tabulacoes = null } = {}) {
        const chatBox = document.getElementById('chat-box');
        const messageContainer = document.createElement('div');
        messageContainer.className = `message-container ${sender}`;
        const avatar = document.createElement('div');
        avatar.className = `avatar ${sender}`;
        avatar.textContent = sender === 'user' ? formatarAssinatura(dadosAtendente.nome).charAt(0) : '🤖';
        const messageContentDiv = document.createElement('div');
        messageContentDiv.className = 'message-content';
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.innerHTML = text; // Para simplificar
        messageContentDiv.appendChild(messageDiv);
        messageContainer.appendChild(avatar);
        messageContainer.appendChild(messageContentDiv);
        chatBox.appendChild(messageContainer);
        chatBox.scrollTop = chatBox.scrollHeight;
        ultimaLinhaDaFonte = sourceRow;
    }

    async function buscarResposta(textoDaPergunta) {
        ultimaPergunta = textoDaPergunta;
        ultimaLinhaDaFonte = null;
        if (!textoDaPergunta.trim()) return;
        showTypingIndicator();
        try {
            const response = await fetch(`/api/ask?pergunta=${encodeURIComponent(textoDaPergunta)}&email=${encodeURIComponent(dadosAtendente.email)}`);
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Erro ${response.status}: ${text}`);
            }
            const contentType = response.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) data = await response.json();
            else {
                const text = await response.text();
                console.error('Resposta inesperada do servidor:', text);
                addMessage('Erro: resposta do servidor não é JSON.', 'bot');
                hideTypingIndicator();
                return;
            }
            hideTypingIndicator();
            addMessage(data.resposta || 'Sem resposta', 'bot', { sourceRow: data.sourceRow, options: data.options, source: data.source, tabulacoes: data.tabulacoes });
        } catch (error) {
            hideTypingIndicator();
            console.error("Erro ao obter resposta do bot:", error);
            addMessage("Erro de conexão com o backend. Aguarde um instante que estamos verificando o ocorrido", 'bot', { sourceRow: 'Erro de Conexão' });
        }
    }

    function handleSendMessage(text) {
        const trimmedText = text.trim();
        if (!trimmedText) return;
        addMessage(trimmedText, 'user');
        logQuestionOnSheet(trimmedText, dadosAtendente.email);
        buscarResposta(trimmedText);
        const userInput = document.getElementById('user-input');
        if (userInput) userInput.value = '';
    }

    // ================== INICIALIZAÇÃO ==================
    window.addEventListener('beforeunload', () => { if (dadosAtendente) logUserStatus('offline'); });
    initGoogleSignIn();

});
