document.addEventListener('DOMContentLoaded', () => {
    // >>> INÍCIO DA CORREÇÃO <<<
    // Função autônoma para definir o tema inicial
    function setInitialTheme() {
        const body = document.body;
        const themeSwitcher = document.getElementById('theme-switcher');
        const savedTheme = localStorage.getItem('theme');

        if (savedTheme === 'dark') {
            body.classList.add('dark-theme');
            if (themeSwitcher) { // Verifica se o botão existe na página atual
                themeSwitcher.innerHTML = ' ☾ ';
            }
        } else {
            body.classList.remove('dark-theme');
            if (themeSwitcher) { // Verifica se o botão existe na página atual
                themeSwitcher.innerHTML = ' ☀︎ ';
            }
        }
    }

    // Aplica o tema imediatamente ao carregar a página
    setInitialTheme();
    // >>> FIM DA CORREÇÃO <<<

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

    // Função para gerar UUID
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

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
                errorMsg.textContent = 'Acesso permitido apenas para e-mails @velotax.com.br!';
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


    document.getElementById('notification-button')?.addEventListener('click', () => verificarAtualizacao());

    // ================== FUNÇÃO PRINCIPAL DO BOT ==================
    function iniciarBot() {
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

        function scrollToBottom() {
        const chatBox = document.getElementById('chat-box');
        chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
    }

    function showTyping() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) typingIndicator.classList.remove('hidden');
    }

    function hideTyping() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) typingIndicator.classList.add('hidden');
    }

        function addMessage(text, sender, { sourceRow = null, options = [], source = 'Planilha', tabulacoes = null, html = false } = {}) {
            const messageContainer = document.createElement('div');
            messageContainer.className = `message-container ${sender}`;
            const avatar = document.createElement('div');
            avatar.className = `avatar ${sender}`;
            if (sender === 'bot' && source === 'IA') {
                avatar.textContent = '✦';
                avatar.title = 'Resposta gerada por IA';
            } else {
                avatar.textContent = sender === 'user' ? formatarAssinatura(dadosAtendente.nome).charAt(0) : '🤖';
            }
            const messageContentDiv = document.createElement('div');
            messageContentDiv.className = 'message-content';
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message';
            let isComplexResponse = false;
            if (sender === 'bot' && text.trim().startsWith('[') && text.trim().endsWith(']')) {
                try {
                    const items = JSON.parse(text);
                    if (Array.isArray(items) && items.length > 0 && items.every(item => item.title && item.content)) {
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
                        messageDiv.innerHTML = '';
                        messageDiv.appendChild(accordionContainer);
                    }
                } catch (e) { isComplexResponse = false; }
            }
            if (!isComplexResponse) {
                if (html) {
                    // Se for HTML, inserir diretamente
                    messageDiv.innerHTML = text;
                } else {
                    const parseInlineButtons = (rawText) => {
                        if (typeof rawText !== 'string') return '';
                        const buttonRegex = /\[button:(.*?)\|(.*?)\]/g;
                        return rawText.replace(buttonRegex, (match, text, value) => {
                            const escapedValue = value.trim().replace(/"/g, '&quot;');
                            return `<button class="inline-chat-button" data-value="${escapedValue}">${text.trim()}</button>`;
                        });
                    };
                    const textWithButtons = parseInlineButtons(text);
                    messageDiv.innerHTML = marked.parse(textWithButtons);
                }
            }
            messageContentDiv.appendChild(messageDiv);
            messageContainer.appendChild(avatar);
            messageContainer.appendChild(messageContentDiv);
            messageDiv.querySelectorAll('.inline-chat-button').forEach(button => {
                button.addEventListener('click', () => {
                    const value = button.getAttribute('data-value');
                    if (value) { handleSendMessage(value); }
                });
            });

            if (sender === 'bot' && tabulacoes) {
                const sugestoes = tabulacoes.split(';').filter(s => s.trim() !== '');
                if (sugestoes.length > 0) {
                    const tabulacaoTextContainer = document.createElement('div');
                    tabulacaoTextContainer.className = 'tabulacao-info-text hidden';
                    const textoFormatado = tabulacoes.replace(/;/g, '<br>');
                    tabulacaoTextContainer.innerHTML = `<strong>Sugestão de Tabulação:</strong><br>${textoFormatado}`;
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

             if (sender === 'bot') { // <-- CONDIÇÃO ALTERADA AQUI
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

            // Mostrar controles de voz para respostas do bot
            if (sender === 'bot') {
                showVoiceControls();
            }
            chatBox.appendChild(messageContainer);
            chatBox.scrollTop = chatBox.scrollHeight;
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
                const url = `/api/ask?pergunta=${encodeURIComponent(textoDaPergunta)}&email=${encodeURIComponent(dadosAtendente.email)}&usar_ia_avancada=true`;
                const response = await fetch(url);
                hideTypingIndicator();
                if (!response.ok) throw new Error(`Erro de rede ou API: ${response.status}`);
                const data = await response.json();

                console.log('🤖 Resposta da IA:', data);

                // Processar resposta da IA Avançada
                if (data.status === 'sucesso_ia_avancada') {
                    addMessage(data.resposta, 'bot', { 
                        sourceRow: data.sourceRow || 'IA Avançada',
                        source: data.source || 'IA Avançada',
                        intencao: data.intencao,
                        urgencia: data.urgencia,
                        sentimento: data.sentimento,
                        confianca: data.confianca
                    });
                    
                    // Mostrar follow-ups se disponíveis
                    if (data.followups && data.followups.length > 0) {
                        mostrarFollowUps(data.followups);
                    }
                    
                    // Mostrar sugestões proativas se disponíveis
                    if (data.sugestoes_proativas && data.sugestoes_proativas.length > 0) {
                        mostrarSugestoesProativas(data.sugestoes_proativas);
                    }
                    
                    // Mostrar sugestões relacionadas se disponíveis
                    if (data.sugestoes_relacionadas && data.sugestoes_relacionadas.length > 0) {
                        mostrarSugestoesRelacionadas(data.sugestoes_relacionadas);
                    }
                    
                } else if (data.status === 'sucesso' || data.status === 'sucesso_ia') {
                    // Resposta tradicional
                    addMessage(data.resposta, 'bot', { 
                        sourceRow: data.sourceRow,
                        source: data.source, 
                        tabulacoes: data.tabulacoes
                    });
                } else if (data.status === 'clarification_needed') {
                    addMessage(data.resposta, 'bot', { 
                        options: data.options, 
                        source: data.source,
                        sourceRow: data.sourceRow
                    });
                } else {
                    addMessage(data.resposta, 'bot', {
                        sourceRow: 'Erro do Bot'
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
            buscarResposta(trimmedText);
            userInput.value = '';
        }

        // ==================== FUNÇÕES DA IA AVANÇADA ====================

        function mostrarFollowUps(followups) {
            if (!followups || followups.length === 0) return;
            
            const followUpHTML = `
                <div class="followups-container">
                    <h4>💡 Perguntas relacionadas:</h4>
                    <div class="followups-lista">
                        ${followups.map(followup => `
                            <div class="followup-item" onclick="handleFollowUp('${followup.replace(/'/g, "\\'")}')">
                                <span class="followup-texto">${followup}</span>
                                <span class="followup-arrow">→</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            
            addMessage(followUpHTML, "bot", { source: "IA Avançada", html: true });
        }

        function mostrarSugestoesProativas(sugestoes) {
            if (!sugestoes || sugestoes.length === 0) return;
            
            const sugestoesHTML = `
                <div class="sugestoes-proativas-container">
                    <h4>🔍 Informações adicionais:</h4>
                    <div class="sugestoes-proativas-lista">
                        ${sugestoes.map(sugestao => `
                            <div class="sugestao-proativa-item">
                                <span class="sugestao-tipo">${getTipoIcon(sugestao.tipo)}</span>
                                <div class="sugestao-conteudo">
                                    <strong>${sugestao.titulo}</strong>
                                    <p>${sugestao.conteudo}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            
            addMessage(sugestoesHTML, "bot", { source: "IA Avançada", html: true });
        }

        function mostrarSugestoesRelacionadas(sugestoes) {
            if (!sugestoes || sugestoes.length === 0) return;
            
            const sugestoesHTML = `
                <div class="sugestoes-relacionadas-container">
                    <h4>🔗 Tópicos relacionados:</h4>
                    <div class="sugestoes-relacionadas-lista">
                        ${sugestoes.map(sugestao => `
                            <div class="sugestao-relacionada-item" onclick="handleSugestaoRelacionada('${sugestao.replace(/'/g, "\\'")}')">
                                <span class="sugestao-relacionada-texto">${sugestao}</span>
                                <span class="sugestao-relacionada-arrow">→</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            
            addMessage(sugestoesHTML, "bot", { source: "IA Avançada", html: true });
        }

        function getTipoIcon(tipo) {
            const icons = {
                'INFO': 'ℹ️',
                'AVISO': '⚠️',
                'LINK': '🔗',
                'PROCEDIMENTO': '📋'
            };
            return icons[tipo] || 'ℹ️';
        }

        function handleFollowUp(followup) {
            addMessage(followup, 'user');
            buscarResposta(followup);
        }

        function handleSugestaoRelacionada(sugestao) {
            addMessage(sugestao, 'user');
            buscarResposta(sugestao);
        }

        // Tornar funções globais para onclick
        window.handleFollowUp = handleFollowUp;
        window.handleSugestaoRelacionada = handleSugestaoRelacionada;

        // ==================== FUNCIONALIDADES DE VOZ ====================

        let isRecording = false;
        let mediaRecorder = null;
        let audioChunks = [];
        let currentAudio = null;

        // Elementos de voz
        const voiceButton = document.getElementById('voice-button');
        const playResponseButton = document.getElementById('play-response');
        const stopAudioButton = document.getElementById('stop-audio');
        const voiceSelector = document.getElementById('voice-selector');

        // Inicializar funcionalidades de voz
        function initVoiceFeatures() {
            console.log('🎤 Inicializando funcionalidades de voz...');
            console.log('Voice button:', voiceButton);
            console.log('Play button:', playResponseButton);
            console.log('Stop button:', stopAudioButton);
            console.log('Voice selector:', voiceSelector);
            
            if (voiceButton) {
                voiceButton.addEventListener('click', toggleRecording);
                console.log('✅ Event listener adicionado ao botão de voz');
            } else {
                console.error('❌ Botão de voz não encontrado');
            }
            
            if (playResponseButton) {
                playResponseButton.addEventListener('click', playLastResponse);
                console.log('✅ Event listener adicionado ao botão de play');
            } else {
                console.error('❌ Botão de play não encontrado');
            }
            
            if (stopAudioButton) {
                stopAudioButton.addEventListener('click', stopAudio);
                console.log('✅ Event listener adicionado ao botão de stop');
            } else {
                console.error('❌ Botão de stop não encontrado');
            }
            
            // Carregar vozes disponíveis
            loadAvailableVoices();
        }

        // Alternar gravação de voz
        async function toggleRecording() {
            if (isRecording) {
                stopRecording();
            } else {
                await startRecording();
            }
        }

        // Iniciar gravação
        async function startRecording() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                mediaRecorder.ondataavailable = (event) => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    await processAudioToText(audioBlob);
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorder.start();
                isRecording = true;
                voiceButton.textContent = '⏹️';
                voiceButton.classList.add('recording');
                console.log('🎤 Gravação iniciada');

            } catch (error) {
                console.error('❌ Erro ao iniciar gravação:', error);
                addMessage('Erro ao acessar o microfone. Verifique as permissões.', 'bot');
            }
        }

        // Parar gravação
        function stopRecording() {
            if (mediaRecorder && isRecording) {
                mediaRecorder.stop();
                isRecording = false;
                voiceButton.textContent = '🎤';
                voiceButton.classList.remove('recording');
                console.log('⏹️ Gravação parada');
            }
        }

        // Processar áudio para texto
        async function processAudioToText(audioBlob) {
            try {
                addMessage('🎤 Processando áudio...', 'bot');
                
                const formData = new FormData();
                formData.append('audio', audioBlob);

                const response = await fetch('/api/voice?action=speech-to-text', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    addMessage(`🎤 Você disse: "${result.text}"`, 'user');
                    buscarResposta(result.text);
                } else {
                    addMessage('❌ Erro ao processar áudio. Tente novamente.', 'bot');
                }

            } catch (error) {
                console.error('❌ Erro ao processar áudio:', error);
                addMessage('❌ Erro ao processar áudio. Tente novamente.', 'bot');
            }
        }

        // Reproduzir última resposta
        async function playLastResponse() {
            try {
                const lastBotMessage = document.querySelector('.message-container.bot:last-child .message-content');
                if (!lastBotMessage) {
                    addMessage('Nenhuma resposta para reproduzir.', 'bot');
                    return;
                }

                const text = lastBotMessage.textContent;
                const voiceId = voiceSelector.value;

                addMessage('🔊 Gerando áudio...', 'bot');

                const response = await fetch('/api/voice?action=text-to-speech', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ text, voiceId })
                });

                const result = await response.json();

                if (result.success) {
                    const audio = new Audio(`data:audio/mpeg;base64,${result.audio}`);
                    currentAudio = audio;
                    
                    audio.onended = () => {
                        playResponseButton.classList.add('hidden');
                        stopAudioButton.classList.add('hidden');
                    };

                    audio.play();
                    playResponseButton.classList.add('hidden');
                    stopAudioButton.classList.remove('hidden');
                    
                    addMessage('🔊 Reproduzindo áudio...', 'bot');
                } else {
                    addMessage('❌ Erro ao gerar áudio. Tente novamente.', 'bot');
                }

            } catch (error) {
                console.error('❌ Erro ao reproduzir áudio:', error);
                addMessage('❌ Erro ao reproduzir áudio. Tente novamente.', 'bot');
            }
        }

        // Parar áudio
        function stopAudio() {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
                currentAudio = null;
                playResponseButton.classList.remove('hidden');
                stopAudioButton.classList.add('hidden');
            }
        }

        // Carregar vozes disponíveis
        async function loadAvailableVoices() {
            try {
                const response = await fetch('/api/voice?action=voices');
                const result = await response.json();

                if (result.success && result.voices.length > 0) {
                    voiceSelector.innerHTML = '';
                    result.voices.forEach(voice => {
                        const option = document.createElement('option');
                        option.value = voice.id;
                        option.textContent = voice.name;
                        voiceSelector.appendChild(option);
                    });
                    voiceSelector.classList.remove('hidden');
                }

            } catch (error) {
                console.error('❌ Erro ao carregar vozes:', error);
            }
        }

        // Mostrar controles de voz quando bot responde
        function showVoiceControls() {
            playResponseButton.classList.remove('hidden');
        }

        // Inicializar funcionalidades de voz quando DOM carregar
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                initVoiceFeatures();
            }, 1000); // Aguardar 1 segundo para garantir que tudo carregou
        });

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

        const geminiButton = document.getElementById('gemini-button');
        if (geminiButton) {
            geminiButton.addEventListener('click', () => window.open('https://gemini.google.com/app?hl=pt-BR', '_blank'));
        }

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

    // Inicia todo o processo de autenticação
    initGoogleSignIn();
});