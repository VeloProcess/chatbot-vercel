document.addEventListener('DOMContentLoaded', () => {
    // >>> VARIÁVEIS DEFINIDAS NO FRONTEND <<<
    const CLIENT_ID = '827325386401-ahi2f9ume9i7lc28lau7j4qlviv5d22k.apps.googleusercontent.com';
    const DOMINIO_PERMITIDO = '@velotax.com.br';
    
    console.log('Configurações carregadas:', { CLIENT_ID, DOMINIO_PERMITIDO });

    // ================== VARIÁVEIS DE ESTADO ==================
    let ultimaPergunta = '';
    let ultimaLinhaDaFonte = null;
    let isTyping = false;
    let dadosAtendente = null;
    let tokenClient = null;
    let sessionId = generateUUID();

    // Função para gerar UUID
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Função para formatar assinatura
    function formatarAssinatura(nomeCompleto) {
        if (!nomeCompleto || typeof nomeCompleto !== 'string' || nomeCompleto.trim() === '') {
            return '';
        }
        const nomes = nomeCompleto.trim().split(' ');
        const primeiroNome = nomes[0];
        let assinaturaFormatada = primeiroNome;
        if (nomes.length > 1 && nomes[1]) {
            const inicialDoSegundoNome = nomes[1].charAt(0).toUpperCase();
            assinaturaFormatada += ` ${inicialDoSegundoNome}.`;
        }
        return assinaturaFormatada;
    }

    // Função addMessage movida para escopo global
    function addMessage(text, sender, { sourceRow = null, options = [], source = 'Planilha', tabulacoes = null } = {}) {
        const chatBox = document.getElementById('chat-box');

        // Container principal da mensagem
        const messageContainer = document.createElement('div');
        messageContainer.className = `message-container ${sender}`;

        // Avatar da mensagem
        const avatar = document.createElement('div');
        avatar.className = `avatar ${sender}`;
        if (sender === 'bot' && source === 'IA') {
            avatar.textContent = '✦';
            avatar.title = 'Resposta gerada por IA';
        } else {
            avatar.textContent = sender === 'user' ? formatarAssinatura(dadosAtendente.nome).charAt(0) : '🤖';
        }

        // Conteúdo da mensagem
        const messageContentDiv = document.createElement('div');
        messageContentDiv.className = 'message-content';

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';

        // Função para parse de botões inline
        const parseInlineButtons = (rawText) => {
            if (typeof rawText !== 'string') return '';
            return rawText.replace(/\[button:(.*?)\|(.*?)\]/g, (match, text, value) => {
                const escapedValue = value.trim().replace(/"/g, '&quot;');
                return `<button class="inline-chat-button" data-value="${escapedValue}">${text.trim()}</button>`;
            });
        };

        // Função para formatar texto com parágrafos e <br>
        const formatText = (rawText) => {
            let formatted = rawText.replace(/\n{2,}/g, "</p><p>");
            formatted = formatted.replace(/\n/g, "<br>");
            return `<p>${formatted}</p>`;
        };

        // Lógica para respostas complexas (accordion)
        let isComplexResponse = false;
        if (sender === 'bot' && text.trim().startsWith('[') && text.trim().endsWith(']')) {
            try {
                const items = JSON.parse(text);
                if (Array.isArray(items) && items.every(item => item.title && item.content)) {
                    isComplexResponse = true;
                    const accordionContainer = document.createElement('div');
                    accordionContainer.className = 'accordion-container';

                    items.forEach(item => {
                        const accordionItem = document.createElement('div');
                        accordionItem.className = 'accordion-item';

                        const titleDiv = document.createElement('div');
                        titleDiv.className = 'accordion-title';
                        titleDiv.innerHTML = `<span>${item.title}</span><span class="arrow">▶</span>`;

                        const contentDiv = document.createElement('div');
                        contentDiv.className = 'accordion-content';
                        contentDiv.innerHTML = marked.parse(item.content);

                        titleDiv.addEventListener('click', () => {
                            titleDiv.classList.toggle('active');
                            contentDiv.classList.toggle('visible');
                        });

                        accordionItem.appendChild(titleDiv);
                        accordionItem.appendChild(contentDiv);
                        accordionContainer.appendChild(accordionItem);
                    });

                    messageDiv.appendChild(accordionContainer);
                }
            } catch (e) { isComplexResponse = false; }
        }

        // Se não for resposta complexa, aplica formatação normal
        if (!isComplexResponse) {
            const textWithButtons = parseInlineButtons(formatText(text));
            messageDiv.innerHTML = marked.parse(textWithButtons);
        }

        messageContentDiv.appendChild(messageDiv);
        messageContainer.appendChild(avatar);
        messageContainer.appendChild(messageContentDiv);

        // Botões inline
        messageDiv.querySelectorAll('.inline-chat-button').forEach(button => {
            button.addEventListener('click', () => {
                const value = button.getAttribute('data-value');
                if (value) handleSendMessage(value);
            });
        });

        // Sugestões de tabulação
        if (sender === 'bot' && tabulacoes) {
            const sugestoes = tabulacoes.split(';').filter(s => s.trim() !== '');
            if (sugestoes.length > 0) {
                const tabulacaoTextContainer = document.createElement('div');
                tabulacaoTextContainer.className = 'tabulacao-info-text hidden';
                tabulacaoTextContainer.innerHTML = `<strong>Sugestão de Tabulação:</strong><br>${tabulacoes.replace(/;/g, '<br>')}`;

                const triggerButton = document.createElement('button');
                triggerButton.className = 'clarification-item';
                triggerButton.textContent = 'Veja as tabulações';
                triggerButton.style.marginTop = '10px';
                triggerButton.onclick = () => {
                    triggerButton.classList.add('hidden');
                    tabulacaoTextContainer.classList.remove('hidden');
                };

                messageContentDiv.appendChild(triggerButton);
                messageContentDiv.appendChild(tabulacaoTextContainer);
            }
        }

        // Feedback do bot
        if (sender === 'bot') {
            ultimaLinhaDaFonte = sourceRow;
            const feedbackContainer = document.createElement('div');
            feedbackContainer.className = 'feedback-container';

            const positiveBtn = document.createElement('button');
            positiveBtn.className = 'feedback-btn';
            positiveBtn.innerHTML = '👍';
            positiveBtn.title = 'Resposta útil';
            positiveBtn.onclick = () => enviarFeedback('logFeedbackPositivo', feedbackContainer);

            const negativeBtn = document.createElement('button');
            negativeBtn.className = 'feedback-btn';
            negativeBtn.innerHTML = '👎';
            negativeBtn.title = 'Resposta incorreta ou incompleta';
            negativeBtn.onclick = () => abrirModalFeedback(feedbackContainer);

            feedbackContainer.appendChild(positiveBtn);
            feedbackContainer.appendChild(negativeBtn);
            messageContentDiv.appendChild(feedbackContainer);
        }

        // Opções de esclarecimento
        if (sender === 'bot' && options.length > 0) {
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'clarification-container';
            options.forEach(optionText => {
                const button = document.createElement('button');
                button.className = 'clarification-item';
                button.textContent = optionText;
                button.onclick = () => handleSendMessage(optionText);
                optionsContainer.appendChild(button);
            });
            messageContentDiv.appendChild(optionsContainer);
        }

        chatBox.appendChild(messageContainer);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Função autônoma para definir o tema inicial
    function setInitialTheme() {
        const body = document.body;
        const themeSwitcher = document.getElementById('theme-switcher');
        const savedTheme = localStorage.getItem('theme');

        if (savedTheme === 'dark') {
            body.classList.add('dark-theme');
            if (themeSwitcher) themeSwitcher.innerHTML = ' ☾ ';
        } else {
            body.classList.remove('dark-theme');
            if (themeSwitcher) themeSwitcher.innerHTML = ' ☀︎ ';
        }
    }

    // Aplica o tema imediatamente ao carregar a página
    setInitialTheme();

    // Função para buscar resposta da IA com streaming
    async function buscarRespostaStreaming(pergunta) {
        const chatBox = document.getElementById("chat-box");
        const botMessage = document.createElement("div");
        botMessage.className = "message-container bot";
        botMessage.innerHTML = `<div class="message-content"><div class="message" id="bot-stream">...</div></div>`;
        chatBox.appendChild(botMessage);
        chatBox.scrollTop = chatBox.scrollHeight;

        const response = await fetch("/api/askOpenAI", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pergunta, email: dadosAtendente.email })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let textoCompleto = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            if (chunk.trim() === "[DONE]") break;
            textoCompleto += chunk;
            document.getElementById("bot-stream").textContent = textoCompleto;
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    }

    // Função para buscar resposta da IA normal (sem streaming)
    async function buscarRespostaAI(pergunta) {
        if (!pergunta || !pergunta.trim()) {
            addMessage("Por favor, digite uma pergunta antes de enviar.", "bot", { source: "IA" });
            return;
        }
        if (!dadosAtendente || !dadosAtendente.email) {
            addMessage("Erro: Email do atendente não definido.", "bot", { source: "IA" });
            return;
        }

        try {
            const response = await fetch("/api/askOpenAI", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pergunta, contextoPlanilha: "", email: dadosAtendente.email })
            });

            if (!response.ok) {
                const text = await response.text();
                console.error("Erro do backend:", response.status, text);
                addMessage("Erro ao processar a pergunta no backend. Tente novamente.", "bot", { source: "IA" });
                return;
            }

            const resposta = await response.text();

            if (resposta.trim()) {
                // Formata a resposta
                const respostaFormatada = resposta
                    .replace(/\n{2,}/g, "</p><p>") // quebras duplas viram parágrafo
                    .replace(/\n/g, "<br>");       // quebras simples viram <br>

                // Adiciona no chat usando addMessage
                addMessage(`<p>${respostaFormatada}</p>`, "bot", { source: "IA", html: true });

            } else {
                addMessage("Não consegui gerar uma resposta para essa pergunta.", "bot", { source: "IA" });
            }

        } catch (error) {
            console.error("Erro na requisição:", error);
            addMessage("Erro de conexão. Verifique sua internet ou tente novamente.", "bot", { source: "IA" });
        }
    }

    // Funções de scroll e typing
    function scrollToBottom() {
        const chatBox = document.getElementById('chat-box');
        chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
    }

    function showTyping() {
        document.getElementById('typing-indicator')?.classList.remove('hidden');
    }

    function hideTyping() {
        document.getElementById('typing-indicator')?.classList.add('hidden');
    }

    // ================== ELEMENTOS DO DOM ==================
    const identificacaoOverlay = document.getElementById('identificacao-overlay');
    const appWrapper = document.querySelector('.app-wrapper');
    const errorMsg = document.getElementById('identificacao-error');
    const userStatusContainer = document.getElementById('user-status-container');

    // Função para registrar status de login/logout no backend
    function logUserStatus(status) {
        if (!dadosAtendente?.email) return;
        
        const url = '/api/logQuestion';
        const data = JSON.stringify({
            type: 'access',
            payload: {
                email: dadosAtendente.email,
                status: status,
                sessionId: sessionId
            }
        });

        if (navigator.sendBeacon) {
            const blob = new Blob([data], { type: 'application/json' });
            navigator.sendBeacon(url, blob);
        } else {
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: data,
                keepalive: true
            }).catch(error => {
                console.error(`Erro ao registrar status ${status}:`, error);
            });
        }
    }

    // Função para consultar e exibir status/histórico de um usuário
    async function updateUserStatus(email) {
        if (!userStatusContainer || !email) return;
        try {
            const response = await fetch(`/api/logQuestion?email=${encodeURIComponent(email)}`, { method: 'GET' });
            const data = await response.json();
            if (data.status === 'sucesso' && data.user) {
                const { email, status, lastLogin, lastLogout, history } = data.user;
                userStatusContainer.innerHTML = `
                    <h3>Status do Usuário: ${email}</h3>
                    <p><strong>Status Atual:</strong> ${status === 'online' ? 'Online 🟢' : 'Offline 🔴'}</p>
                    <p><strong>Último Login:</strong> ${lastLogin}</p>
                    <p><strong>Último Logout:</strong> ${lastLogout}</p>
                    <h4>Histórico:</h4>
                    <ul>
                        ${history.length > 0 ? history.map(event => `
                            <li>${event.timestamp}: ${event.status === 'online' ? 'Entrou' : 'Saiu'} (Sessão: ${event.sessionId})</li>
                        `).join('') : '<li>Sem histórico recente</li>'}
                    </ul>
                `;
            } else {
                userStatusContainer.innerHTML = '<p>Erro ao carregar status do usuário</p>';
            }
        } catch (error) {
            console.error("Erro ao buscar status do usuário:", error);
            userStatusContainer.innerHTML = '<p>Erro ao carregar status do usuário</p>';
        }
    }

    // Função para consultar status do usuário atual
    function checkCurrentUserStatus() {
        if (dadosAtendente?.email) {
            updateUserStatus(dadosAtendente.email);
            setInterval(() => updateUserStatus(dadosAtendente.email), 30000);
        }
    }

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
                    reject(new Error('Falha ao carregar Google Identity Services.'));
                }
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

            if (user.email && user.email.endsWith(DOMINIO_PERMITIDO)) {
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

            } else {
                errorMsg.textContent = 'Acesso permitido apenas para e-mails corporativos!!';
                errorMsg.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Erro no fluxo de login:", error);
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

    window.addEventListener('beforeunload', () => {
        if (dadosAtendente) {
            logUserStatus('offline');
        }
    });

    function initGoogleSignIn() {
        waitForGoogleScript().then(accounts => {
            tokenClient = accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: 'profile email',
                callback: handleGoogleSignIn
            });
            document.getElementById('google-signin-button').addEventListener('click', () => tokenClient.requestAccessToken());
            verificarIdentificacao();
        }).catch(error => {
            console.error("Erro na inicialização do Google Sign-In:", error);
            errorMsg.textContent = 'Erro ao carregar autenticação do Google. Verifique sua conexão ou tente novamente mais tarde.';
            errorMsg.classList.remove('hidden');
        });
    }

    async function logQuestionOnSheet(question, email) {
        if (!question || !email) return;
        try {
            await fetch('/api/logQuestion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'question',
                    payload: {
                        question: question,
                        email: email
                    }
                })
            });
        } catch (error) {
            console.error("Erro ao registrar a pergunta na planilha:", error);
        }
    }

    document.getElementById('notification-button')?.addEventListener('click', () => verificarAtualizacao());

    // ================== FUNÇÃO PRINCIPAL DO BOT ==================
    function iniciarBot() {
        // Verificação de segurança
        if (!dadosAtendente || !dadosAtendente.nome) {
            console.error('dadosAtendente não está definido ou não tem nome');
            return;
        }

        const chatBox = document.getElementById('chat-box');
        const userInput = document.getElementById('user-input');
        const sendButton = document.getElementById('send-button');
        const themeSwitcher = document.getElementById('theme-switcher');
        const body = document.body;
        const questionSearch = document.getElementById('question-search');
        const logoutButton = document.getElementById('logout-button');
        const expandableHeader = document.getElementById('expandable-faq-header');
        const moreQuestions = document.getElementById('more-questions');
        
        if (expandableHeader && moreQuestions) {
            expandableHeader.addEventListener('click', () => {
                moreQuestions.classList.toggle('hidden');
                expandableHeader.classList.toggle('expanded');
            });
        }
        document.addEventListener('visibilitychange', () => {
            if (!dadosAtendente) return;
            if (document.visibilityState === 'visible') {
                logUserStatus('online');
            } else if (document.visibilityState === 'hidden') {
                logUserStatus('offline');
            }
        });

        async function carregarNoticias() {
            const newsListContainer = document.getElementById('news-list');
            try {
                const response = await fetch('/api/getNews');
                if (!response.ok) throw new Error('Falha ao buscar notícias da API.');
                const data = await response.json();
                newsListContainer.innerHTML = '';
                if (!data.news || data.news.length === 0) {
                    newsListContainer.innerHTML = '<p>Nenhuma notícia ou alerta no momento.</p>';
                    return;
                }
                data.news.forEach(item => {
                    const newsItemDiv = document.createElement('div');
                    newsItemDiv.className = `news-item ${item.tipo.toLowerCase().trim()}-alert`;
                    newsItemDiv.innerHTML = `<h2>${item.titulo}</h2><small>Publicado em: ${item.publicadoEm}</small><p>${item.conteudo}</p>`;
                    newsListContainer.appendChild(newsItemDiv);
                });
            } catch (error) {
                console.error("Erro ao carregar notícias:", error);
                newsListContainer.innerHTML = '<p>Não foi possível carregar as notícias. Verifique a conexão.</p>';
            }
        }

        async function carregarStatusProdutos() {
            const container = document.getElementById('product-status-container');
            try {
                const response = await fetch('/api/getProductStatus');
                if (!response.ok) throw new Error('API falhou');
                const data = await response.json();
                const productList = document.createElement('ul');
                productList.style.padding = '0';
                data.products.forEach(p => {
                    const listItem = document.createElement('li');
                    listItem.className = 'product-status-item';
                    const statusSpan = document.createElement('span');
                    statusSpan.className = 'status';
                    statusSpan.textContent = p.status;
                    if (p.status === 'Disponível') {
                        statusSpan.classList.add('status-disponivel');
                    } else {
                        statusSpan.classList.add('status-indisponivel');
                    }
                    listItem.textContent = `${p.produto} `;
                    listItem.appendChild(statusSpan);
                    productList.appendChild(listItem);
                });
                container.innerHTML = '';
                container.appendChild(productList);
            } catch (error) {
                container.textContent = 'Erro ao carregar status.';
                console.error("Erro ao carregar status dos produtos:", error);
            }
        }

        if (dadosAtendente && dadosAtendente.funcao === 'Gestor') {
            const dashboardLink = document.getElementById('manager-dashboard-link');
            if (dashboardLink) {
                dashboardLink.classList.remove('hidden');
            }
        }

        function showTypingIndicator() {
            if (isTyping) return;
            isTyping = true;
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

        async function enviarFeedback(action, container, sugestao = null) {
            if (!ultimaPergunta || !ultimaLinhaDaFonte) {
                console.error("FALHA: Feedback não enviado.");
                return;
            }
            container.textContent = 'Obrigado pelo feedback!';
            container.className = 'feedback-thanks';

            console.log("Enviando para a API de Feedback:", { action, question: ultimaPergunta, sourceRow: ultimaLinhaDaFonte, email: dadosAtendente.email, sugestao });
            try {
                await fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: action,
                        question: ultimaPergunta,
                        sourceRow: ultimaLinhaDaFonte,
                        email: dadosAtendente.email,
                        sugestao: sugestao
                    })
                });
            } catch (error) {
                console.error("ERRO DE REDE ao enviar feedback:", error);
            }
        }

        async function buscarResposta(textoDaPergunta) {
            ultimaPergunta = textoDaPergunta;
            ultimaLinhaDaFonte = null;
            if (!textoDaPergunta.trim()) return;
            showTypingIndicator();
            try {
                const url = `/api/ask?pergunta=${encodeURIComponent(textoDaPergunta)}&email=${encodeURIComponent(dadosAtendente.email)}`;
                const response = await fetch(url);
                hideTypingIndicator();
                if (!response.ok) throw new Error(`Erro de rede ou API: ${response.status}`);
                const data = await response.json();

                // Bloco corrigido para repassar TODAS as informações para addMessage
                if (data.status === 'sucesso' || data.status === 'sucesso_ia') {
                    addMessage(data.resposta, 'bot', { 
                        sourceRow: data.sourceRow, // sourceRow pode ser um número ou 'Resposta da IA'
                        source: data.source, 
                        tabulacoes: data.tabulacoes
                    });
                } else if (data.status === 'clarification_needed') {
                    addMessage(data.resposta, 'bot', { 
                        options: data.options, 
                        source: data.source,
                        sourceRow: data.sourceRow // sourceRow será 'Pergunta de Esclarecimento'
                    });
                } else {
                    addMessage(data.resposta, 'bot', {
                        sourceRow: 'Erro do Bot' // Adiciona uma referência para erros
                    });
                }
            } catch (error) {
                hideTypingIndicator();
                addMessage("Erro de conexão com o backend. Aguarde um instante que estamos verificando o ocorrido", 'bot', { sourceRow: 'Erro de Conexão' });
                console.error("Detalhes do erro:", error);
            }
        }

        function handleSendMessage(text) {
            const trimmedText = text.trim();
            if (!trimmedText) return;
            addMessage(trimmedText, 'user');
            logQuestionOnSheet(trimmedText, dadosAtendente.email);
            buscarRespostaAI(trimmedText); // <- use a versão sem streaming
            userInput.value = '';
        }

        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage(userInput.value);
            }
        });
        sendButton.addEventListener('click', () => handleSendMessage(userInput.value));

        document.querySelectorAll('#sidebar li[data-question]').forEach(item => {
            item.addEventListener('click', (e) => handleSendMessage(e.currentTarget.getAttribute('data-question')));
        });

        const feedbackOverlay = document.getElementById('feedback-overlay');
        const feedbackSendBtn = document.getElementById('feedback-send');
        const feedbackCancelBtn = document.getElementById('feedback-cancel');
        const feedbackText = document.getElementById('feedback-comment');
        let activeFeedbackContainer = null;

        function abrirModalFeedback(container) {
            activeFeedbackContainer = container;
            feedbackOverlay.classList.remove('hidden');
            if (feedbackText) feedbackText.focus();
        }

        function fecharModalFeedback() {
            feedbackOverlay.classList.add('hidden');
            if (feedbackText) feedbackText.value = '';
            activeFeedbackContainer = null;
        }

        if (feedbackCancelBtn) {
            feedbackCancelBtn.addEventListener('click', fecharModalFeedback);
        }

        if (feedbackSendBtn) {
            feedbackSendBtn.addEventListener('click', () => {
                const sugestao = feedbackText ? feedbackText.value.trim() : '';
                if (activeFeedbackContainer) {
                    enviarFeedback('logFeedbackNegativo', activeFeedbackContainer, sugestao || null);
                    fecharModalFeedback();
                } else {
                    console.error("FALHA: Nenhum 'activeFeedbackContainer' encontrado.");
                }
            });
        }

        function setInitialTheme() {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'dark') {
                body.classList.add('dark-theme');
                themeSwitcher.innerHTML = ' ☾ ';
            } else {
                body.classList.remove('dark-theme');
                themeSwitcher.innerHTML = ' ☀︎ ';
            }
        }

        async function handleLogout() {
            await logUserStatus('offline');
            localStorage.removeItem('dadosAtendenteChatbot');
            dadosAtendente = null;
            location.reload();
        }

        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
        }

        // REMOVIDO: Botão do Gemini conforme solicitado
        // const geminiButton = document.getElementById('gemini-button');
        // if (geminiButton) {
        //     geminiButton.addEventListener('click', () => window.open('https://gemini.google.com/app?hl=pt-BR', '_blank'));
        // }

        if (themeSwitcher) {
            themeSwitcher.addEventListener('click', () => {
                body.classList.toggle('dark-theme');
                const isDark = body.classList.contains('dark-theme');
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
                themeSwitcher.innerHTML = isDark ? '☾' : '☀︎';
            });
        }

        const primeiroNome = dadosAtendente.nome.split(' ')[0];
        addMessage(`Olá, ${primeiroNome}! Como posso te ajudar hoje?`, 'bot');
        setInitialTheme();
        carregarNoticias();
        carregarStatusProdutos();
    }

    // Inicia diretamente o Google Sign-In
    initGoogleSignIn();
});