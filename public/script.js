document.addEventListener('DOMContentLoaded', () => {
    // ================== CONFIGURAÇÕES GLOBAIS ==================
    // ⚠️ ATENÇÃO: Verifique se esta URL é a URL da sua ÚLTIMA implantação do Google Apps Script.
    const BACKEND_URL = "https://script.google.com/macros/s/AKfycbw8n95lQr5-RbxG9qYG7O_3ZEOVkVQ3K50C3iFM9JViLyEsa8hiDuRuCzlgy_YPoI43/exec";
    
    const DOMINIO_PERMITIDO = "@velotax.com.br";

    // ================== ELEMENTOS DO DOM ==================
    const identificacaoOverlay = document.getElementById('identificacao-overlay');
    const identificacaoForm = document.getElementById('identificacao-form');
    const appWrapper = document.querySelector('.app-wrapper');
    const errorMsg = document.getElementById('identificacao-error');

    // ================== VARIÁVEIS DE ESTADO ==================
    let ultimaPergunta = '';
    let ultimaResposta = '';
    let ultimaLinhaDaFonte = null;
    let isTyping = false;
    let dadosAtendente = null;

    // ================== LÓGICA DE AUTENTICAÇÃO ==================
    function verificarIdentificacao() {
        const umDiaEmMs = 24 * 60 * 60 * 1000;
        let dadosSalvos = null;
        try {
            const dadosSalvosString = localStorage.getItem('dadosAtendenteChatbot');
            if (dadosSalvosString) dadosSalvos = JSON.parse(dadosSalvosString);
        } catch (e) {
            localStorage.removeItem('dadosAtendenteChatbot');
        }
        
        if (!dadosSalvos || (Date.now() - dadosSalvos.timestamp > umDiaEmMs) || !dadosSalvos.email.endsWith(DOMINIO_PERMITIDO)) {
            identificacaoOverlay.style.display = 'flex';
            appWrapper.style.visibility = 'hidden';
        } else {
            identificacaoOverlay.style.display = 'none';
            appWrapper.style.visibility = 'visible';
            iniciarBot(dadosSalvos);
        }
    }

    identificacaoForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const nome = document.getElementById('nome-input').value.trim();
        const email = document.getElementById('email-input').value.trim().toLowerCase();

        if (nome && email && email.endsWith(DOMINIO_PERMITIDO)) {
            const dadosAtendenteParaSalvar = { nome, email, timestamp: Date.now() };
            localStorage.setItem('dadosAtendenteChatbot', JSON.stringify(dadosAtendenteParaSalvar));
            identificacaoOverlay.style.display = 'none';
            appWrapper.style.visibility = 'visible';
            iniciarBot(dadosAtendenteParaSalvar);
        } else {
            errorMsg.style.display = 'block';
        }
    });

    // ================== FUNÇÃO PRINCIPAL DO BOT ==================
    function iniciarBot(dadosDoAtendente) {
        dadosAtendente = dadosDoAtendente;

        // --- Referências aos elementos do painel ---
        const chatBox = document.getElementById('chat-box');
        const userInput = document.getElementById('user-input');
        const sendButton = document.getElementById('send-button');
        const themeSwitcher = document.getElementById('theme-switcher');
        const body = document.body;
        const questionSearch = document.getElementById('question-search');
        const expandableHeader = document.getElementById('expandable-faq-header');
        const moreQuestions = document.getElementById('more-questions');
        const allQuestionItems = document.querySelectorAll('#quick-questions-list li, #more-questions-list li');
        const feedbackOverlay = document.getElementById('feedback-overlay');
        const feedbackForm = document.getElementById('feedback-form');
        const feedbackCancelBtn = document.getElementById('feedback-cancel');
        const feedbackComment = document.getElementById('feedback-comment');
        let activeFeedbackContainer = null;

        // --- FUNÇÕES AUXILIARES ---

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

        function showTypingIndicator() {
            if (isTyping) return;
            isTyping = true;
            const typingContainer = document.createElement('div');
            typingContainer.id = 'typing-indicator';
            typingContainer.className = 'message-container bot typing-indicator';
            typingContainer.innerHTML = `
                <div class="avatar bot">🤖</div>
                <div class="message-content">
                    <div class="message">
                        <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
                    </div>
                </div>`;
            chatBox.appendChild(typingContainer);
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        function hideTypingIndicator() {
            isTyping = false;
            const typingIndicator = document.getElementById('typing-indicator');
            if (typingIndicator) typingIndicator.remove();
        }
        
        function addMessage(message, sender, options = {}) {
            let mensagemFinal = message;

            if (sender === 'bot' && dadosAtendente && typeof mensagemFinal === 'string' && mensagemFinal.includes('{{ASSINATURA_ATENDENTE}}')) {
                const assinatura = formatarAssinatura(dadosAtendente.nome);
                mensagemFinal = mensagemFinal.replace(/{{ASSINATURA_ATENDENTE}}/g, assinatura);
            }

            const { sourceRow = null } = options;
            const messageContainer = document.createElement('div');
            messageContainer.classList.add('message-container', sender);

            const avatar = document.createElement('div');
            avatar.className = `avatar ${sender}`;
            avatar.innerHTML = sender === 'user' ? '👤' : '🤖';

            const messageContent = document.createElement('div');
            messageContent.className = 'message-content';

            const messageElement = document.createElement('div');
            messageElement.classList.add('message');
            messageElement.innerHTML = mensagemFinal.replace(/\n/g, '<br>');

            if (sender === 'bot') {
                ultimaResposta = messageElement.textContent.trim();
            }
            
            messageContent.appendChild(messageElement);
            
            const timeElement = document.createElement('div');
            timeElement.className = 'message-time';
            timeElement.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            messageContent.appendChild(timeElement);

            if (sender === 'user') {
                messageContainer.appendChild(messageContent);
                messageContainer.appendChild(avatar);
            } else {
                messageContainer.appendChild(avatar);
                messageContainer.appendChild(messageContent);
            }

            chatBox.appendChild(messageContainer);

            if (sender === 'bot' && sourceRow) {
                ultimaLinhaDaFonte = sourceRow;
                
                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-btn';
                copyBtn.innerHTML = '📋';
                copyBtn.title = 'Copiar resposta';
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(messageElement.textContent.trim()).then(() => {
                        copyBtn.classList.add('copied');
                        setTimeout(() => copyBtn.classList.remove('copied'), 2000);
                    });
                };
                messageContainer.appendChild(copyBtn);

                const feedbackContainer = document.createElement('div');
                feedbackContainer.className = 'feedback-container';
                const positiveBtn = document.createElement('button');
                positiveBtn.className = 'feedback-btn';
                positiveBtn.innerHTML = '👍';
                positiveBtn.title = 'Resposta útil';
                positiveBtn.onclick = () => {
                    positiveBtn.classList.add('active', 'positive');
                    negativeBtn.classList.remove('active', 'negative');
                    enviarFeedback('logFeedbackPositivo', feedbackContainer);
                };

                const negativeBtn = document.createElement('button');
                negativeBtn.className = 'feedback-btn';
                negativeBtn.innerHTML = '👎';
                negativeBtn.title = 'Resposta incorreta';
                negativeBtn.onclick = () => {
                    negativeBtn.classList.add('active', 'negative');
                    positiveBtn.classList.remove('active', 'positive');
                    abrirModalFeedback(feedbackContainer);
                };
                
                feedbackContainer.appendChild(positiveBtn);
                feedbackContainer.appendChild(negativeBtn);
                messageContent.appendChild(feedbackContainer);
            }
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        function abrirModalFeedback(container) {
            activeFeedbackContainer = container;
            feedbackComment.value = '';
            feedbackOverlay.classList.remove('hidden');
            feedbackComment.focus();
        }

        function fecharModalFeedback() {
            feedbackOverlay.classList.add('hidden');
        }

        async function enviarFeedback(action, container, comment = null) {
            if (!ultimaPergunta || !ultimaLinhaDaFonte) return;
            
            if (container) {
                container.innerHTML = `<span class="feedback-thanks">Obrigado!</span>`;
            }

            try {
                await fetch(BACKEND_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    body: JSON.stringify({
                        action: action === 'registrar_curadoria' ? action : 'logFeedbackPositivo',
                        question: ultimaPergunta,
                        botResponse: ultimaResposta,
                        comment: comment,
                        sourceRow: ultimaLinhaDaFonte,
                        email: dadosAtendente.email
                    })
                });
            } catch (error) {
                console.error("Erro ao enviar feedback:", error);
            }
        }

        async function buscarResposta(textoDaPergunta) {
            ultimaPergunta = textoDaPergunta;
            if (!textoDaPergunta.trim()) return;
            showTypingIndicator();
            try {
                const url = `${BACKEND_URL}?pergunta=${encodeURIComponent(textoDaPergunta)}&email=${encodeURIComponent(dadosAtendente.email)}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Erro de rede: ${response.status}`);
                const data = await response.json();
                hideTypingIndicator();
                
                if (data.status === 'sucesso') {
                    addMessage(data.resposta, 'bot', { sourceRow: data.sourceRow });
                } else {
                    addMessage(data.mensagem || "Ocorreu um erro.", 'bot');
                }
            } catch (error) {
                hideTypingIndicator();
                addMessage("Erro de conexão. Verifique o console (F12).", 'bot');
                console.error("Detalhes do erro de fetch:", error);
            }
        }

        function handleSendMessage(text) {
            const trimmedText = text.trim();
            if (!trimmedText) return;
            addMessage(trimmedText, 'user');
            buscarResposta(trimmedText);
            userInput.value = '';
        }
        
        // --- INICIALIZAÇÃO E EVENT LISTENERS ---
        sendButton.addEventListener('click', () => handleSendMessage(userInput.value));
        userInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendMessage(userInput.value); } });
        
        allQuestionItems.forEach(item => {
            item.addEventListener('click', (e) => handleSendMessage(e.currentTarget.getAttribute('data-question')));
        });

        expandableHeader.addEventListener('click', (e) => {
            const arrow = e.currentTarget.querySelector('.arrow');
            e.currentTarget.classList.toggle('expanded');
            moreQuestions.classList.toggle('hidden');
            arrow.classList.toggle('expanded');
        });

        questionSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            allQuestionItems.forEach(question => {
                const text = question.getAttribute('data-question').toLowerCase();
                question.classList.toggle('hidden', !text.includes(searchTerm));
            });
        });

        feedbackCancelBtn.addEventListener('click', fecharModalFeedback);
        feedbackForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const comentario = feedbackComment.value.trim();
            if (comentario) {
                enviarFeedback('registrar_curadoria', activeFeedbackContainer, comentario);
                fecharModalFeedback();
            }
        });

        function setInitialTheme() {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'dark') {
                body.classList.add('dark-theme');
                themeSwitcher.innerHTML = '🌙';
            } else {
                body.classList.remove('dark-theme');
                themeSwitcher.innerHTML = '☀️';
            }
        }
        
        themeSwitcher.addEventListener('click', () => {
            body.classList.toggle('dark-theme');
            const isDark = body.classList.contains('dark-theme');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            themeSwitcher.innerHTML = isDark ? '🌙' : '☀️';
        });

        // Saudação inicial e tema
        const primeiroNome = dadosAtendente.nome.split(' ')[0];
        const hora = new Date().getHours();
        let saudacao = (hora >= 5 && hora < 12) ? 'Bom dia' : (hora >= 12 && hora < 18) ? 'Boa tarde' : 'Boa noite';
        addMessage(`${saudacao}, ${primeiroNome}! Como posso ajudar?`, 'bot');
        setInitialTheme();
    }
    
    verificarIdentificacao();
});