document.addEventListener('DOMContentLoaded', () => {
    // ================== CONFIGURAÇÕES GLOBAIS ==================
    const DOMINIO_PERMITIDO = "@velotax.com.br"; //
    const CLIENT_ID = '827325386401-ahi2f9ume9i7lc28lau7j4qlviv5d22k.apps.googleusercontent.com'; //

    // ================== ELEMENTOS DO DOM ==================
    const identificacaoOverlay = document.getElementById('identificacao-overlay'); //
    const appWrapper = document.querySelector('.app-wrapper'); //
    const errorMsg = document.getElementById('identificacao-error'); //
    const userStatusContainer = document.getElementById('user-status-container'); //

    // ================== VARIÁVEIS DE ESTADO ==================
    let ultimaPergunta = ''; //
    let ultimaLinhaDaFonte = null; //
    let isTyping = false; //
    let dadosAtendente = null; //
    let tokenClient = null; //
    let sessionId = generateUUID(); //

    // Função para gerar UUID
    function generateUUID() { //
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Função para registrar status de login/logout no backend
    async function logUserStatus(status) { //
        if (!dadosAtendente?.email) return; //
        try {
            await fetch('/api/logQuestion', { //
                method: 'POST', //
                headers: { 'Content-Type': 'application/json' }, //
                body: JSON.stringify({ //
                    type: 'access', //
                    payload: { //
                        email: dadosAtendente.email, //
                        status: status, //
                        sessionId: sessionId //
                    }
                })
            });
        } catch (error) {
            console.error(`Erro ao registrar status ${status}:`, error); //
        }
    }

    // Função para consultar e exibir status/histórico de um usuário
    async function updateUserStatus(email) { //
        if (!userStatusContainer || !email) return; //
        try {
            const response = await fetch(`/api/logQuestion?email=${encodeURIComponent(email)}`, { method: 'GET' }); //
            const data = await response.json(); //
            if (data.status === 'sucesso' && data.user) { //
                const { email, status, lastLogin, lastLogout, history } = data.user; //
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
                `; //
            } else {
                userStatusContainer.innerHTML = '<p>Erro ao carregar status do usuário</p>'; //
            }
        } catch (error) {
            console.error("Erro ao buscar status do usuário:", error); //
            userStatusContainer.innerHTML = '<p>Erro ao carregar status do usuário</p>'; //
        }
    }

    // Função para consultar status do usuário atual
    function checkCurrentUserStatus() { //
        if (dadosAtendente?.email) { //
            updateUserStatus(dadosAtendente.email); //
            setInterval(() => updateUserStatus(dadosAtendente.email), 30000); //
        }
    }

    // ================== FUNÇÕES DE CONTROLE DE UI ==================
    function showOverlay() { //
        identificacaoOverlay.classList.remove('hidden'); //
        appWrapper.classList.add('hidden'); //
    }

    function hideOverlay() { //
        identificacaoOverlay.classList.add('hidden'); //
        appWrapper.classList.remove('hidden'); //
    }

    // ================== LÓGICA DE AUTENTICAÇÃO ==================
    function waitForGoogleScript() { //
        return new Promise((resolve, reject) => {
            const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]'); //
            if (!script) { //
                return reject(new Error('Script Google Identity Services não encontrado no HTML.')); //
            }
            if (window.google && window.google.accounts) { //
                return resolve(window.google.accounts); //
            }
            script.onload = () => { //
                if (window.google && window.google.accounts) { //
                    resolve(window.google.accounts); //
                } else {
                    reject(new Error('Falha ao carregar Google Identity Services.')); //
                }
            };
            script.onerror = () => reject(new Error('Erro ao carregar o script Google Identity Services.')); //
        });
    }

    async function handleGoogleSignIn(response) { //
        try {
            const googleResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { //
                headers: { Authorization: `Bearer ${response.access_token}` } //
            });
            const user = await googleResponse.json(); //

            if (user.email && user.email.endsWith(DOMINIO_PERMITIDO)) { //
                // Busca a função (Gestor/Atendente) do usuário no backend
                const profileResponse = await fetch(`/api/getUserProfile?email=${encodeURIComponent(user.email)}`); //
                if (!profileResponse.ok) throw new Error('Falha ao buscar perfil do usuário.'); //
                
                const userProfile = await profileResponse.json(); //

                // Combina os dados e salva no localStorage
                dadosAtendente = { //
                    nome: user.name, //
                    email: user.email, //
                    timestamp: Date.now(), //
                    funcao: userProfile.funcao // Salva a função (ex: "Gestor") //
                };

                localStorage.setItem('dadosAtendenteChatbot', JSON.stringify(dadosAtendente)); //
                
                await logUserStatus('online'); //
                hideOverlay(); //
                iniciarBot(); //
                checkCurrentUserStatus(); //

            } else {
                errorMsg.textContent = 'Acesso permitido apenas para e-mails @velotax.com.br!'; //
                errorMsg.classList.remove('hidden'); //
            }
        } catch (error) {
            console.error("Erro no fluxo de login:", error); //
            errorMsg.textContent = 'Erro ao verificar login ou permissões. Tente novamente.'; //
            errorMsg.classList.remove('hidden'); //
        }
    }

    function verificarIdentificacao() { //
        const umDiaEmMs = 24 * 60 * 60 * 1000; //
        let dadosSalvos = null; //
        try {
            const dadosSalvosString = localStorage.getItem('dadosAtendenteChatbot'); //
            if (dadosSalvosString) dadosSalvos = JSON.parse(dadosSalvosString); //
        } catch (e) {
            localStorage.removeItem('dadosAtendenteChatbot'); //
        }

        if (dadosSalvos && dadosSalvos.email && dadosSalvos.email.endsWith(DOMINIO_PERMITIDO) && (Date.now() - dadosSalvos.timestamp < umDiaEmMs)) { //
            dadosAtendente = dadosSalvos; //
            logUserStatus('online'); //
            hideOverlay(); //
            iniciarBot(); //
            checkCurrentUserStatus(); //
        } else {
            localStorage.removeItem('dadosAtendenteChatbot'); //
            showOverlay(); //
        }
    }

    // Registrar logout ao fechar janela (fallback)
    window.addEventListener('beforeunload', () => { //
        if (dadosAtendente) { //
            logUserStatus('offline'); //
        }
    });

    function initGoogleSignIn() { //
        waitForGoogleScript().then(accounts => { //
            tokenClient = accounts.oauth2.initTokenClient({ //
                client_id: CLIENT_ID, //
                scope: 'profile email', //
                callback: handleGoogleSignIn //
            });
            document.getElementById('google-signin-button').addEventListener('click', () => tokenClient.requestAccessToken()); //
            verificarIdentificacao(); //
        }).catch(error => { //
            console.error("Erro na inicialização do Google Sign-In:", error); //
            errorMsg.textContent = 'Erro ao carregar autenticação do Google. Verifique sua conexão ou tente novamente mais tarde.'; //
            errorMsg.classList.remove('hidden'); //
        });
    }

    // Função para registrar pergunta na planilha
    async function logQuestionOnSheet(question, email) { //
        if (!question || !email) return; //
        try {
            await fetch('/api/logQuestion', { //
                method: 'POST', //
                headers: { 'Content-Type': 'application/json' }, //
                body: JSON.stringify({ //
                    type: 'question', //
                    payload: { //
                        question: question, //
                        email: email //
                    }
                })
            });
        } catch (error) {
            console.error("Erro ao registrar a pergunta na planilha:", error); //
        }
    }

    // Função para formatar assinatura
    function formatarAssinatura(nomeCompleto) { //
        if (!nomeCompleto || typeof nomeCompleto !== 'string' || nomeCompleto.trim() === '') { //
            return ''; //
        }
        const nomes = nomeCompleto.trim().split(' '); //
        const primeiroNome = nomes[0]; //
        let assinaturaFormatada = primeiroNome; //
        if (nomes.length > 1 && nomes[1]) { //
            const inicialDoSegundoNome = nomes[1].charAt(0).toUpperCase(); //
            assinaturaFormatada += ` ${inicialDoSegundoNome}.`; //
        }
        return assinaturaFormatada; //
    }

    // ================== FUNÇÃO PRINCIPAL DO BOT ==================
    function iniciarBot() { //
        // Elementos do DOM específicos do bot
        const chatBox = document.getElementById('chat-box'); //
        const userInput = document.getElementById('user-input'); //
        const sendButton = document.getElementById('send-button'); //
        const themeSwitcher = document.getElementById('theme-switcher'); //
        const body = document.body; //
        const questionSearch = document.getElementById('question-search'); //
        const logoutButton = document.getElementById('logout-button'); //
        // Dentro da sua função iniciarBot(), adicione este bloco:

// --- LÓGICA PARA O MENU EXPANSÍVEL DE PERGUNTAS ---
        const expandableHeader = document.getElementById('expandable-faq-header');
        const moreQuestions = document.getElementById('more-questions');

                if (expandableHeader && moreQuestions) {
                    expandableHeader.addEventListener('click', () => {
        // Alterna a visibilidade do conteúdo das perguntas
        moreQuestions.classList.toggle('hidden');

        // Adiciona ou remove a classe 'expanded' no cabeçalho para girar a seta
        expandableHeader.classList.toggle('expanded');
    });
}
        // LÓGICA DE STATUS ONLINE/OFFLINE AUTOMÁTICO
        document.addEventListener('visibilitychange', () => { //
            if (!dadosAtendente) return; //
            if (document.visibilityState === 'visible') { //
                logUserStatus('online'); //
            } else if (document.visibilityState === 'hidden') { //
                logUserStatus('offline'); //
            }
        });

        async function carregarNoticias() {
    const newsListContainer = document.getElementById('news-list');

    try {
        const response = await fetch('/api/getNews');
        if (!response.ok) {
            throw new Error('Falha ao buscar notícias da API.');
        }

        const data = await response.json();

        // Limpa a mensagem "Carregando..."
        newsListContainer.innerHTML = '';

        if (!data.news || data.news.length === 0) {
            newsListContainer.innerHTML = '<p>Nenhuma notícia ou alerta no momento.</p>';
            return;
        }

        // Para cada notícia recebida, cria o elemento HTML
        data.news.forEach(item => {
            const newsItemDiv = document.createElement('div');

            // A mágica acontece aqui: a classe é definida pelo "Tipo" da planilha
            newsItemDiv.className = `news-item ${item.tipo}-alert`;

            newsItemDiv.innerHTML = `
                <h2>${item.titulo}</h2>
                <small>Publicado em: ${item.publicadoEm}</small>
                <p>${item.conteudo}</p>
            `;

            newsListContainer.appendChild(newsItemDiv);
        });

    } catch (error) {
        console.error("Erro ao carregar notícias:", error);
        newsListContainer.innerHTML = '<p>Não foi possível carregar as notícias. Verifique a conexão.</p>';
    }
}
        // LÓGICA DE EXIBIÇÃO PARA GESTOR
        if (dadosAtendente.funcao === 'Gestor') { //
            const managerButton = document.getElementById('manager-panel-button');
            const managerDashboard = document.getElementById('manager-dashboard');
            const onlineUsersList = document.getElementById('online-users-list');

            if (managerButton && managerDashboard && onlineUsersList) { //
                managerButton.classList.remove('hidden'); //

                const fetchAndDisplayUsers = async () => { //
                    managerDashboard.classList.toggle('hidden'); //
                    if (managerDashboard.classList.contains('hidden')) { //
                        return; // Se escondeu o painel, não busca os dados //
                    }
                    onlineUsersList.innerHTML = '<li>Carregando...</li>'; //

                    try {
                        const response = await fetch('/api/getOnlineUsers'); //
                        if (!response.ok) throw new Error('Falha na resposta da rede'); //
                        
                        const data = await response.json(); //
                        onlineUsersList.innerHTML = ''; //

                        if (data.users && data.users.length > 0) { //
                            data.users.sort((a, b) => a.status.localeCompare(b.status)); //

                            data.users.forEach(user => { //
                                const listItem = document.createElement('li'); //
                                listItem.className = `user-status-${user.status.toLowerCase()}`; //
                                listItem.innerHTML = `<span class="status-dot"></span> ${user.email}`; //
                                onlineUsersList.appendChild(listItem); //
                            });
                        } else {
                            onlineUsersList.innerHTML = '<li>Nenhum usuário encontrado.</li>'; //
                        }
                    } catch (error) {
                        console.error('Erro ao buscar usuários:', error); //
                        onlineUsersList.innerHTML = '<li>Erro ao carregar a lista.</li>'; //
                    }
                };
                managerButton.addEventListener('click', fetchAndDisplayUsers); //
            }
        }

        document.getElementById('gemini-button').addEventListener('click', () => window.open('https://gemini.google.com/app?hl=pt-BR', '_blank')); //

        questionSearch.addEventListener('input', (e) => { //
            const searchTerm = e.target.value.toLowerCase(); //
            const questions = document.querySelectorAll('#quick-questions-list li, #more-questions-list-financeiro li, #more-questions-list-tecnico li'); //
            questions.forEach(question => { //
                const text = question.textContent.toLowerCase(); //
                question.classList.toggle('hidden', !text.includes(searchTerm)); //
            });
        });

        function showTypingIndicator() { //
            if (isTyping) return; //
            isTyping = true; //
            const typingContainer = document.createElement('div'); //
            typingContainer.className = 'message-container bot typing-indicator'; //
            typingContainer.id = 'typing-indicator'; //
            typingContainer.innerHTML = `<div class="avatar bot">🤖</div><div class="message-content"><div class="message"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`; //
            chatBox.appendChild(typingContainer); //
            chatBox.scrollTop = chatBox.scrollHeight; //
        }

        function hideTypingIndicator() { //
            isTyping = false; //
            const typingIndicator = document.getElementById('typing-indicator'); //
            if (typingIndicator) typingIndicator.remove(); //
        }

function addMessage(text, sender, { sourceRow = null, options = [], source = 'Planilha' } = {}) {
    const messageContainer = document.createElement('div');
    messageContainer.className = `message-container ${sender}`;
    const avatar = document.createElement('div');
    avatar.className = `avatar ${sender}`;

    // LÓGICA PARA MUDAR O ÍCONE (IA vs Bot Padrão)
    if (sender === 'bot' && source === 'IA') {
        avatar.textContent = '✦'; // Ícone para respostas da IA
        avatar.title = 'Resposta gerada por IA';
    } else {
        avatar.textContent = sender === 'user' ? formatarAssinatura(dadosAtendente.nome).charAt(0) : '🤖';
    }

    const messageContentDiv = document.createElement('div');
    messageContentDiv.className = 'message-content';
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';

    // --- LÓGICA INTELIGENTE PARA RESPOSTAS COMPLEXAS ---
    let isComplexResponse = false;

    // 1. Tenta interpretar o texto como um MENU EXPANSÍVEL (JSON)
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
                    contentDiv.innerHTML = marked.parse(item.content); // Permite Markdown dentro do conteúdo

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
        } catch (e) {
            isComplexResponse = false; // Falhou, então não é um JSON válido.
        }
    }

    // 2. Se não for um menu, processa como texto normal (Markdown + BOTÕES)
    if (!isComplexResponse) {
        // Função interna para transformar a sintaxe [button:...] em HTML
        const parseInlineButtons = (rawText) => {
            if (typeof rawText !== 'string') return '';
            const buttonRegex = /\[button:(.*?)\|(.*?)\]/g;
            return rawText.replace(buttonRegex, (match, text, value) => {
                // Escapa as aspas no atributo data-value para evitar quebra do HTML
                const escapedValue = value.trim().replace(/"/g, '&quot;');
                return `<button class="inline-chat-button" data-value="${escapedValue}">${text.trim()}</button>`;
            });
        };

        const textWithButtons = parseInlineButtons(text);
        messageDiv.innerHTML = marked.parse(textWithButtons);
    }
    // --- FIM DA LÓGICA INTELIGENTE ---

    messageContentDiv.appendChild(messageDiv);
    messageContainer.appendChild(avatar);
    messageContainer.appendChild(messageContentDiv);

    // 3. Adiciona a funcionalidade de clique aos BOTÕES recém-criados
    messageDiv.querySelectorAll('.inline-chat-button').forEach(button => {
        button.addEventListener('click', () => {
            const value = button.getAttribute('data-value');
            if (value) {
                handleSendMessage(value);
            }
        });
    });

    // O código abaixo para feedback e opções continua o mesmo
    if (sender === 'bot' && sourceRow) {
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

    chatBox.appendChild(messageContainer);
    chatBox.scrollTop = chatBox.scrollHeight;
}

        async function enviarFeedback(action, container, sugestao = null) { //
            if (!ultimaPergunta || !ultimaLinhaDaFonte) { //
                console.error("FALHA: Feedback não enviado. 'ultimaPergunta' ou 'ultimaLinhaDaFonte' está vazio ou nulo."); //
                return; //
            }
            container.textContent = 'Obrigado pelo feedback!'; //
            container.className = 'feedback-thanks'; //
            try {
                await fetch('/api/feedback', { //
                    method: 'POST', //
                    headers: { 'Content-Type': 'application/json' }, //
                    body: JSON.stringify({ //
                        action: action, //
                        question: ultimaPergunta, //
                        sourceRow: ultimaLinhaDaFonte, //
                        email: dadosAtendente.email, //
                        sugestao: sugestao //
                    })
                });
            } catch (error) {
                console.error("ERRO DE REDE ao enviar feedback:", error); //
            }
        }

        async function buscarResposta(textoDaPergunta) { //
            ultimaPergunta = textoDaPergunta; //
            ultimaLinhaDaFonte = null; //
            if (!textoDaPergunta.trim()) return; //
            showTypingIndicator(); //
            try {
                const url = `/api/ask?pergunta=${encodeURIComponent(textoDaPergunta)}&email=${encodeURIComponent(dadosAtendente.email)}`; //
                const response = await fetch(url); //
                hideTypingIndicator(); //
                if (!response.ok) throw new Error(`Erro de rede ou API: ${response.status}`); //
                const data = await response.json(); //

                // Passa o parâmetro 'source' que veio da API
                if (data.status === 'sucesso' || data.status === 'sucesso_ia') { //
                    addMessage(data.resposta, 'bot', { sourceRow: data.sourceRow, source: data.source }); //
                } else if (data.status === 'clarification_needed') { //
                    addMessage(data.resposta, 'bot', { options: data.options, source: data.source }); //
                } else {
                    addMessage(data.resposta, 'bot'); // Respostas de erro, etc. //
                }
            } catch (error) {
                hideTypingIndicator(); //
                addMessage("Erro de conexão com o backend. Aguarde um instante que estamos verificando o ocorrido", 'bot'); //
                console.error("Detalhes do erro:", error); //
            }
        }

        function handleSendMessage(text) { //
            const trimmedText = text.trim(); //
            if (!trimmedText) return; //
            addMessage(trimmedText, 'user'); //
            logQuestionOnSheet(trimmedText, dadosAtendente.email); //
            buscarResposta(trimmedText); //
            userInput.value = ''; //
        }

        userInput.addEventListener('keydown', (e) => { //
            if (e.key === 'Enter') { //
                e.preventDefault(); //
                handleSendMessage(userInput.value); //
            }
        });
        sendButton.addEventListener('click', () => handleSendMessage(userInput.value)); //

        document.querySelectorAll('#sidebar li[data-question]').forEach(item => {
            item.addEventListener('click', (e) => handleSendMessage(e.currentTarget.getAttribute('data-question')));
        });

        themeSwitcher.addEventListener('click', () => { //
            body.classList.toggle('dark-theme'); //
            const isDark = body.classList.contains('dark-theme'); //
            localStorage.setItem('theme', isDark ? 'dark' : 'light'); //
            themeSwitcher.innerHTML = isDark ? '☾' : '☀︎'; //
        });

        const feedbackOverlay = document.getElementById('feedback-overlay'); //
        const feedbackSendBtn = document.getElementById('feedback-send'); //
        const feedbackCancelBtn = document.getElementById('feedback-cancel'); //
        const feedbackText = document.getElementById('feedback-comment'); // CORREÇÃO DO BUG //
        let activeFeedbackContainer = null; //

        function abrirModalFeedback(container) { //
            activeFeedbackContainer = container; //
            feedbackOverlay.classList.remove('hidden'); //
            if (feedbackText) feedbackText.focus(); //
        }

        function fecharModalFeedback() { //
            feedbackOverlay.classList.add('hidden'); //
            if (feedbackText) feedbackText.value = ''; //
            activeFeedbackContainer = null; //
        }

        if (feedbackCancelBtn) feedbackCancelBtn.addEventListener('click', fecharModalFeedback); //

        if (feedbackSendBtn) feedbackSendBtn.addEventListener('click', () => { //
            const sugestao = feedbackText ? feedbackText.value.trim() : ''; //
            if (activeFeedbackContainer) { //
                enviarFeedback('logFeedbackNegativo', activeFeedbackContainer, sugestao || null); //
                fecharModalFeedback(); //
            } else {
                console.error("FALHA: Nenhum 'activeFeedbackContainer' encontrado."); //
            }
        });

        function setInitialTheme() { //
            const savedTheme = localStorage.getItem('theme'); //
            if (savedTheme === 'dark') { //
                body.classList.add('dark-theme'); //
                themeSwitcher.innerHTML = ' ☾ '; //
            } else {
                body.classList.remove('dark-theme'); //
                themeSwitcher.innerHTML = ' ☀︎ '; //
            }
        }

        async function handleLogout() { //
            await logUserStatus('offline'); //
            localStorage.removeItem('dadosAtendenteChatbot'); //
            dadosAtendente = null; //
            location.reload(); //
        }

        logoutButton.addEventListener('click', handleLogout); //

        const primeiroNome = dadosAtendente.nome.split(' ')[0]; //
        addMessage(`Olá, ${primeiroNome}! Como posso te ajudar hoje?`, 'bot'); //
        setInitialTheme(); //
<<<<<<< HEAD
        carregarNoticias(); // <-- ADICIONE ESTA LINHA
=======
>>>>>>> 28e7d43d1b03223dfc2fd044e55698d96c1adaf1
    }

    // Inicia todo o processo de autenticação
    initGoogleSignIn(); //
});