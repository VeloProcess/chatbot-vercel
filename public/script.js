document.addEventListener('DOMContentLoaded', () => {
    // ================== CONFIGURAÇÕES GLOBAIS ==================
    const DOMINIO_PERMITIDO = "@velotax.com.br";
    const CLIENT_ID = '827325386401-ahi2f9ume9i7lc28lau7j4qlviv5d22k.apps.googleusercontent.com';

    // ================== ELEMENTOS DO DOM ==================
    const identificacaoOverlay = document.getElementById('identificacao-overlay');
    const appWrapper = document.querySelector('.app-wrapper');
    const errorMsg = document.getElementById('identificacao-error');

    // ================== VARIÁVEIS DE ESTADO ==================
    let ultimaPergunta = '';
    let ultimaResposta = '';
    let ultimaLinhaDaFonte = null;
    let isTyping = false;
    let dadosAtendente = null;
    let tokenClient = null;

    // ================== FUNÇÃO DE CATEGORIZAÇÃO AUTOMÁTICA ==================
    function categorizarPergunta(pergunta) {
        if (!pergunta || typeof pergunta !== 'string') return 'Outros';
        
        const texto = pergunta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        // Categorias e palavras-chave
        const categorias = {
            'Pagamento/Parcelamento': [
                'pagamento', 'pagar', 'parcela', 'parcelamento', 'parcelar', 'dividir',
                'forma de pagamento', 'como pagar', 'boleto', 'pix', 'cartao', 'cartão',
                'transferencia', 'transferência', 'deposito', 'depósito'
            ],
            'Negociação/Desconto': [
                'negociar', 'negociação', 'negociacao', 'desconto', 'desconto',
                'renegociar', 'renegociação', 'renegociacao', 'quitar', 'liquidação',
                'liquidacao', 'acordo', 'proposta', 'condições', 'condicoes'
            ],
            'Dúvidas sobre Valores': [
                'valor', 'quanto', 'quanto custa', 'preço', 'preco', 'total',
                'juros', 'multa', 'taxa', 'desconto no valor', 'valor da parcela',
                'valor total', 'quanto devo', 'quanto está', 'quanto fica'
            ],
            'Problemas Técnicos': [
                'erro', 'não funciona', 'nao funciona', 'problema', 'bug',
                'travou', 'travado', 'não carrega', 'nao carrega', 'lento',
                'app', 'aplicativo', 'sistema', 'site', 'plataforma'
            ],
            'Status de Pagamento': [
                'status', 'situação', 'situacao', 'estado', 'onde está', 'onde esta',
                'foi pago', 'pagou', 'confirmado', 'confirmacao', 'confirmação',
                'processando', 'pendente', 'atrasado', 'vencido'
            ],
            'Contato/Suporte': [
                'contato', 'telefone', 'email', 'whatsapp', 'falar com', 'atendimento',
                'suporte', 'ajuda', 'como entrar em contato', 'canal de atendimento'
            ]
        };
        
        // Contar ocorrências de cada categoria
        let melhorCategoria = 'Outros';
        let maiorScore = 0;
        
        for (const [categoria, palavras] of Object.entries(categorias)) {
            let score = 0;
            for (const palavra of palavras) {
                if (texto.includes(palavra)) {
                    score++;
                }
            }
            if (score > maiorScore) {
                maiorScore = score;
                melhorCategoria = categoria;
            }
        }
        
        return melhorCategoria;
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
            errorMsg.textContent = 'Erro ao carregar autenticação do Google. Verifique sua conexão ou tente novamente mais tarde.';
            errorMsg.classList.remove('hidden');
        });
    }

    function handleGoogleSignIn(response) {
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${response.access_token}` }
        })
        .then(res => res.json())
        .then(user => {
            if (user.email && user.email.endsWith(DOMINIO_PERMITIDO)) {
                dadosAtendente = { nome: user.name, email: user.email, timestamp: Date.now() };
                localStorage.setItem('dadosAtendenteChatbot', JSON.stringify(dadosAtendente));
                hideOverlay();
                iniciarBot();
            } else {
                errorMsg.textContent = 'Acesso permitido apenas para e-mails @velotax.com.br!';
                errorMsg.classList.remove('hidden');
            }
        })
        .catch(() => {
            errorMsg.textContent = 'Erro ao verificar login. Tente novamente.';
            errorMsg.classList.remove('hidden');
        });
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
            hideOverlay();
            iniciarBot();
        } else {
            localStorage.removeItem('dadosAtendenteChatbot');
            showOverlay();
        }
    }

    // Nova função para registrar a pergunta na planilha
    async function logQuestionOnSheet(question, email, achou = false, resposta = '') {
        if (!question || !email) {
            console.warn('⚠️ logQuestionOnSheet: question ou email vazio', { question, email });
            return;
        }
        
        // Categorizar pergunta automaticamente
        const categoria = categorizarPergunta(question);

        console.log('📝 ========== REGISTRANDO LOG DE PERGUNTA ==========');
        console.log('📝 Pergunta:', question);
        console.log('📝 Email:', email);
        console.log('📝 Achou:', achou ? 'Sim' : 'Não');
        console.log('📝 Categoria:', categoria);
        console.log('📝 Resposta:', resposta ? resposta.substring(0, 100) + '...' : '(vazia)');
        console.log('📝 ================================================');

        try {
            const payload = {
                    type: 'question',
                    payload: {
                        question: question,
                    email: email,
                    achou: achou ? 'Sim' : 'Não',
                    resposta: resposta || '',
                    categoria: categoria
                }
            };
            
            console.log('📤 Enviando requisição para /api/logQuestion:', payload);

            const response = await fetch('/api/logQuestion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            console.log('📥 Resposta recebida:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { error: 'Erro desconhecido', details: 'Não foi possível ler a resposta JSON' };
                }
                console.error("❌ ========== ERRO AO REGISTRAR LOG ==========");
                console.error("❌ Status:", response.status, response.statusText);
                console.error("❌ Erro:", errorData.error);
                console.error("❌ Detalhes:", errorData.details);
                console.error("❌ Tipo:", errorData.errorType);
                console.error("❌ Erro da API:", errorData.apiError);
                console.error("❌ Status Code:", errorData.statusCode);
                console.error("❌ Dados completos:", errorData);
                console.error("❌ ==========================================");
                // Não interromper o fluxo - apenas logar o erro
                        } else {
                const result = await response.json();
                console.log("✅ ========== LOG REGISTRADO COM SUCESSO ==========");
                console.log("✅ Status:", result.status);
                console.log("✅ Mensagem:", result.message);
                console.log("✅ Detalhes:", result.details);
                console.log("✅ ==============================================");
            }
                } catch (error) {
            console.error("❌ ========== ERRO DE REDE AO REGISTRAR LOG ==========");
            console.error("❌ Erro:", error.message);
            console.error("❌ Stack:", error.stack);
            console.error("❌ ==================================================");
        }
    }

    // ================== FUNÇÃO PRINCIPAL DO BOT ==================
    function iniciarBot() {
        const chatBox = document.getElementById('chat-box');
        const userInput = document.getElementById('user-input');
        const sendButton = document.getElementById('send-button');
        const themeSelector = document.getElementById('theme-selector');
        const body = document.body;
        // Sidebar de perguntas frequentes removida - código relacionado removido
        const feedbackOverlay = document.getElementById('feedback-overlay');
        const feedbackSendBtn = document.getElementById('feedback-send');
        const feedbackCancelBtn = document.getElementById('feedback-cancel');
        let activeFeedbackContainer = null;

        document.getElementById('gemini-button').addEventListener('click', () => window.open('https://gemini.google.com/app?hl=pt-BR', '_blank'));

        // Código de busca de perguntas removido (sidebar removida)

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

        // Função formatMessage removida - as respostas já vêm formatadas da planilha
        // Não aplicar nenhuma formatação adicional para não interferir na resposta

        function addMessage(message, sender, options = {}) {
            const { sourceRow = null } = options;
            const messageContainer = document.createElement('div');
            messageContainer.classList.add('message-container', sender);
            const avatarDiv = `<div class="avatar ${sender === 'user' ? 'user' : 'bot'}">${sender === 'user' ? '👤' : '🤖'}</div>`;
            
            // Usar mensagem diretamente sem formatação (já vem formatada da planilha)
            // Apenas converter quebras de linha para mensagens do usuário
            const formattedMessage = sender === 'bot' ? message : message.replace(/\n/g, '<br>');
            const messageContentDiv = `<div class="message-content"><div class="message">${formattedMessage}</div></div>`;
            messageContainer.innerHTML = sender === 'user' ? messageContentDiv + avatarDiv : avatarDiv + messageContentDiv;
            chatBox.appendChild(messageContainer);

            if (sender === 'bot' && sourceRow) {
                const messageBox = messageContainer.querySelector('.message-content');
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
                messageBox.appendChild(feedbackContainer);
            }
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        async function enviarFeedback(action, container, sugestao = null) {
            console.log('📝 ========== ENVIANDO FEEDBACK ==========');
            console.log('📝 Action:', action);
            console.log('📝 Pergunta:', ultimaPergunta);
            console.log('📝 Resposta:', ultimaResposta ? ultimaResposta.substring(0, 100) + '...' : '(vazia)');
            console.log('📝 Email:', dadosAtendente?.email);
            console.log('📝 Sugestão:', sugestao || '(nenhuma)');
            console.log('📝 ======================================');

            if (!ultimaPergunta) {
                console.error("❌ FALHA: Feedback não enviado. 'ultimaPergunta' está vazio ou nulo.");
                return;
            }
            if (!dadosAtendente || !dadosAtendente.email) {
                console.error("❌ FALHA: Feedback não enviado. Email do atendente não encontrado.");
                return;
            }
            
            if (container) {
                container.textContent = 'Enviando...';
                container.className = 'feedback-sending';
            }
            
            try {
                const payload = {
                    action: action,
                    pergunta: ultimaPergunta,
                    resposta: ultimaResposta || '',
                    email: dadosAtendente.email,
                    sugestao: sugestao || ''
                };
                
                console.log('📤 Enviando requisição para /api/feedback:', payload);

                const response = await fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                console.log('📥 Resposta recebida:', {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error("❌ ========== ERRO AO ENVIAR FEEDBACK ==========");
                    console.error("❌ Status:", response.status, response.statusText);
                    console.error("❌ Erro:", errorData.error);
                    console.error("❌ Detalhes:", errorData.details);
                    console.error("❌ Dados completos:", errorData);
                    console.error("❌ ============================================");
                    throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
                }

            const result = await response.json();
                console.log("✅ ========== FEEDBACK ENVIADO COM SUCESSO ==========");
                console.log("✅ Status:", result.status);
                console.log("✅ Mensagem:", result.message);
                console.log("✅ =================================================");
                
                if (container) {
                    container.textContent = 'Obrigado pelo feedback!';
                    container.className = 'feedback-thanks';
                }
        } catch (error) {
                console.error("❌ ========== ERRO AO ENVIAR FEEDBACK ==========");
                console.error("❌ Erro:", error.message);
                console.error("❌ Stack:", error.stack);
                console.error("❌ ============================================");
                if (container) {
                    container.textContent = 'Erro ao enviar. Tente novamente.';
                    container.className = 'feedback-error';
                    // Voltar ao estado normal após 3 segundos
                    setTimeout(() => {
                        if (container) {
                            container.textContent = '';
                            container.className = 'feedback-container';
                        }
                    }, 3000);
                }
            }
        }

        async function buscarResposta(textoDaPergunta, isFromOption = false) {
            console.log('🔍 ========== BUSCANDO RESPOSTA ==========');
            console.log('🔍 Pergunta:', textoDaPergunta);
            console.log('🔍 É de opção?', isFromOption);
            console.log('🔍 ======================================');

            ultimaPergunta = textoDaPergunta;
            ultimaLinhaDaFonte = null;
            if (!textoDaPergunta.trim()) return;
            showTypingIndicator();
            try {
                // Adicionar parâmetro para indicar que é uma seleção de opção
                const url = `/api/ask?pergunta=${encodeURIComponent(textoDaPergunta)}${isFromOption ? '&isFromOption=true' : ''}`;
                console.log('📤 Fazendo requisição para:', url);
                const response = await fetch(url);
                console.log('📥 Resposta recebida:', {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok
                });
                
                if (!response.ok) {
                    // Tentar ler a resposta JSON mesmo em caso de erro
                    let errorData;
                    try {
                        errorData = await response.json();
                    } catch (e) {
                        errorData = { resposta: `Erro ${response.status}: ${response.statusText}` };
                    }
                    throw new Error(errorData.resposta || errorData.error || `Erro de rede ou API: ${response.status}`);
                }
                
            const data = await response.json();
                hideTypingIndicator();
                
                // Aceitar múltiplos status de sucesso
                if (data.status === 'sucesso' || 
                    data.status === 'sucesso_offline' || 
                    data.status === 'sucesso_sheets' ||
                    data.status === 'sucesso_local') {
                    ultimaLinhaDaFonte = data.sourceRow;
                    addMessage(data.resposta, 'bot', { sourceRow: data.sourceRow });
                    // Log: encontrou resposta
                    if (dadosAtendente && dadosAtendente.email) {
                        logQuestionOnSheet(textoDaPergunta, dadosAtendente.email, true, data.resposta);
                    }
                } else if (data.status === 'clarification_needed' || 
                           data.status === 'clarification_needed_offline') {
                    // Se veio de uma opção clicada, não mostrar nova lista (evitar loop)
                    if (isFromOption) {
                        ultimaResposta = '';
                        addMessage(`Não encontrei uma resposta específica para "${textoDaPergunta}". Por favor, reformule sua pergunta de forma mais detalhada.`, 'bot');
                        // Log: não encontrou após clicar em opção
                        if (dadosAtendente && dadosAtendente.email) {
                            logQuestionOnSheet(textoDaPergunta, dadosAtendente.email, false, '');
                        }
                    } else {
                        // Mostrar opções de esclarecimento apenas se não veio de uma opção
                        ultimaLinhaDaFonte = data.sourceRow;
                        ultimaResposta = data.resposta || '';
                        addMessage(data.resposta, 'bot', { sourceRow: data.sourceRow });
                        if (data.options && data.options.length > 0) {
                            // Criar container de opções
                            const optionsContainer = document.createElement('div');
                            optionsContainer.className = 'options-container';
                            
                            // Criar botões para cada opção
                            data.options.forEach((opt, idx) => {
                                const button = document.createElement('button');
                                button.className = 'option-btn';
                                button.textContent = opt;
                                button.setAttribute('data-option-index', idx);
                                button.onclick = () => {
                                    handleOptionClick(opt);
                                };
                                optionsContainer.appendChild(button);
                            });
                            
                            // Adicionar container ao chat
                            const messageContainer = document.createElement('div');
                            messageContainer.classList.add('message-container', 'bot');
                            const avatarDiv = `<div class="avatar bot">🤖</div>`;
                            messageContainer.innerHTML = avatarDiv;
                            messageContainer.querySelector('.avatar').after(optionsContainer);
                            chatBox.appendChild(messageContainer);
                            chatBox.scrollTop = chatBox.scrollHeight;
                        }
                    }
                } else if (data.status === 'sem_correspondencia') {
                    // Quando não há correspondências encontradas
                    addMessage(data.resposta, 'bot');
                    // Log: não encontrou resposta
                    if (dadosAtendente && dadosAtendente.email) {
                        logQuestionOnSheet(textoDaPergunta, dadosAtendente.email, false, '');
                    }
                } else if (data.resposta) {
                    // Se tem resposta mesmo com status de erro, mostrar
                    addMessage(data.resposta || "Ocorreu um erro ao processar sua pergunta.", 'bot');
                    // Log: tentou mas pode não ter encontrado
                    if (dadosAtendente && dadosAtendente.email) {
                        logQuestionOnSheet(textoDaPergunta, dadosAtendente.email, false, '');
                    }
            } else {
                    addMessage("Ocorreu um erro ao processar sua pergunta. Tente novamente.", 'bot');
                    console.error("Resposta da API:", data);
                    // Log: erro ao processar
                    if (dadosAtendente && dadosAtendente.email) {
                        logQuestionOnSheet(textoDaPergunta, dadosAtendente.email, false, '');
                    }
            }
        } catch (error) {
                hideTypingIndicator();
                const errorMessage = error.message || "Erro de conexão com o backend.";
                addMessage(`Erro: ${errorMessage}. Verifique o console (F12) para mais detalhes.`, 'bot');
                console.error("Detalhes do erro de fetch:", error);
                // Log: erro ao buscar resposta
                if (dadosAtendente && dadosAtendente.email) {
                    logQuestionOnSheet(textoDaPergunta, dadosAtendente.email, false, '');
                }
            }
        }

        // Função global para lidar com cliques nos botões de opção
        window.handleOptionClick = function(pergunta) {
            if (!pergunta || !pergunta.trim()) {
                console.error('Pergunta vazia ao clicar na opção');
            return;
        }
            // Adicionar a pergunta selecionada como mensagem do usuário
            addMessage(pergunta, 'user');
            // Buscar resposta para a pergunta selecionada (marcar como vinda de opção)
            buscarResposta(pergunta, true);
        };

        // CORREÇÃO: Função de envio de mensagem restaurada
        function handleSendMessage(text) {
            const trimmedText = text.trim();
            if (!trimmedText) return;
            addMessage(trimmedText, 'user');
            // Não logar aqui ainda - será logado após receber a resposta
            // logQuestionOnSheet será chamado em buscarResposta após saber se achou ou não
            buscarResposta(trimmedText);
            userInput.value = '';
        }

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSendMessage(userInput.value);
        }
    });
    sendButton.addEventListener('click', () => handleSendMessage(userInput.value));

        // Sidebar de perguntas frequentes removida

        // Função para aplicar tema
        function applyTheme(themeName) {
            // Remover todas as classes de tema
            body.classList.remove('dark-theme', 'theme-mint', 'theme-rose');
            
            // Aplicar tema selecionado
            if (themeName === 'dark') {
                body.classList.add('dark-theme');
            } else if (themeName === 'mint') {
                body.classList.add('theme-mint');
            } else if (themeName === 'rose') {
                body.classList.add('theme-rose');
            }
            // 'light' é o padrão (sem classe adicional)
            
            // Salvar no localStorage
            localStorage.setItem('theme', themeName);
            
            // Atualizar seletor
            if (themeSelector) {
                themeSelector.value = themeName;
            }
        }

        // Event listener para o seletor de temas
        if (themeSelector) {
            themeSelector.addEventListener('change', (e) => {
                const selectedTheme = e.target.value;
                applyTheme(selectedTheme);
            });
        }

    function abrirModalFeedback(container) {
            const feedbackText = document.getElementById('feedback-comment');
        activeFeedbackContainer = container;
        feedbackOverlay.classList.remove('hidden');
        if (feedbackText) feedbackText.focus();
    }

    function fecharModalFeedback() {
            const feedbackText = document.getElementById('feedback-comment');
        feedbackOverlay.classList.add('hidden');
            if(feedbackText) feedbackText.value = '';
        activeFeedbackContainer = null;
    }

        feedbackCancelBtn.addEventListener('click', fecharModalFeedback);

        // CORREÇÃO: Lógica de envio de feedback substituída pela versão mais segura
        feedbackSendBtn.addEventListener('click', async (e) => {
            e.preventDefault(); // Prevenir qualquer comportamento padrão
            e.stopPropagation(); // Parar propagação do evento
            
            const commentTextarea = document.getElementById('feedback-comment');
            if (!commentTextarea) {
                console.error("ERRO: A caixa de texto com o ID 'feedback-comment' não foi encontrada no HTML.");
                return;
            }
            const sugestao = commentTextarea.value.trim();

            if (activeFeedbackContainer) {
                await enviarFeedback('logFeedbackNegativo', activeFeedbackContainer, sugestao);
                fecharModalFeedback();
            } else {
                console.error("ALERTA: 'activeFeedbackContainer' não foi encontrado, mas tentando enviar o feedback mesmo assim.");
                await enviarFeedback('logFeedbackNegativo', null, sugestao);
                fecharModalFeedback();
            }
        });

        // Prevenir submit do form caso ainda exista
        const feedbackForm = document.getElementById('feedback-form');
        if (feedbackForm && feedbackForm.tagName === 'FORM') {
            feedbackForm.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
        });
    }

    function setInitialTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        const themeSelector = document.getElementById('theme-selector');
        
        // Aplicar tema salvo
        if (savedTheme === 'dark') {
            body.classList.add('dark-theme');
        } else if (savedTheme === 'mint') {
            body.classList.add('theme-mint');
        } else if (savedTheme === 'rose') {
            body.classList.add('theme-rose');
        }
        // 'light' é o padrão (sem classe adicional)
        
        // Atualizar seletor se existir
        if (themeSelector) {
            themeSelector.value = savedTheme;
        }
    }

        const primeiroNome = dadosAtendente.nome.split(' ')[0];
        addMessage(`Olá, ${primeiroNome}! Como posso te ajudar hoje?`, 'bot');
    setInitialTheme();
    }

    initGoogleSignIn();
});
