// ==================== VARIÁVEIS GLOBAIS DE VOZ E CONVERSAÇÃO ====================
// VERSION: v4.6.0 | DATE: 2025-01-22 | AUTHOR: Assistant
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let currentAudio = null;
let currentStream = null; // Para gerenciar o stream de áudio
let isProcessingRecording = false; // Para evitar múltiplas chamadas simultâneas
let audioProcessed = false; // Para evitar processamento duplicado

// ==================== VARIÁVEIS DE CONVERSAÇÃO ====================
let conversationSession = null;
let isWaitingForBotResponse = false;
let pendingBotQuestion = null;

// ==================== VARIÁVEIS GLOBAIS DO SISTEMA ====================
let dadosAtendente = null;

// ==================== FUNÇÕES UTILITÁRIAS GLOBAIS ====================

// Função para formatar assinatura do usuário (escopo global)
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

// ==================== FUNÇÕES GLOBAIS DE VOZ ====================

// Função simplificada para adicionar mensagens (para uso nas funções de voz)
function addVoiceMessage(text, sender, options = null) {
    console.log('🎯 addVoiceMessage chamada:', { text, sender, options });
    
    const chatBox = document.getElementById('chat-box');
    console.log('🎯 chat-box encontrado:', !!chatBox);
    
    if (!chatBox) {
        console.error('❌ chat-box não encontrado!');
        return;
    }
    
    const messageContainer = document.createElement('div');
    messageContainer.className = `message-container ${sender}`;
    
    const avatar = document.createElement('div');
    avatar.className = `avatar ${sender}`;
    avatar.textContent = sender === 'user' ? '👤' : '🤖';
    
    const messageContentDiv = document.createElement('div');
    messageContentDiv.className = 'message-content';
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    // Processar texto com formatação markdown básica
    let processedText = text;
    
    // Converter **texto** para <strong>texto</strong>
    processedText = processedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Converter quebras de linha duplas para <br><br>
    processedText = processedText.replace(/\n\n/g, '<br><br>');
    
    // Converter quebras de linha simples para <br>
    processedText = processedText.replace(/\n/g, '<br>');
    
    messageDiv.innerHTML = processedText;
    
    messageContentDiv.appendChild(messageDiv);
    
    // Se há opções, criar lista igual à função addMessage original
    if (options && Array.isArray(options) && options.length > 0) {
        console.log('📋 Criando lista de opções:', options);
        
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'clarification-container';
        options.forEach(optionText => {
            const button = document.createElement('button');
            button.className = 'clarification-item';
            button.textContent = optionText;
            button.onclick = () => {
                console.log('🔘 Opção clicada:', optionText);
                addVoiceMessage(optionText, 'user');
                buscarResposta(optionText, true); // true = isClarification
            };
            optionsContainer.appendChild(button);
        });
        messageContentDiv.appendChild(optionsContainer);
    }
    
    messageContainer.appendChild(avatar);
    messageContainer.appendChild(messageContentDiv);
    chatBox.appendChild(messageContainer);
    
    // Mostrar controles de voz para respostas do bot (mesmo para entrada por voz)
    if (sender === 'bot') {
        showVoiceControls();
    }
    
    console.log('✅ Mensagem adicionada ao chat-box:', messageContainer);
    
    // Scroll para baixo
    chatBox.scrollTop = chatBox.scrollHeight;
    console.log('✅ Scroll executado');
}

// Mostrar controles de voz quando bot responde
function showVoiceControls() {
    const playBtn = document.getElementById('play-response');
    if (playBtn) {
        playBtn.classList.remove('hidden');
        console.log('🔊 Botão de play mostrado');
    }
}

// Gerar frase de conversação baseada na pergunta
function generateConversationPhrase(pergunta) {
    const frases = [
        "Ah sim, sobre",
        "Certo, sobre", 
        "Entendi, sobre",
        "Para fazer",
        "Sobre",
        "Bem, sobre",
        "Claro, sobre",
        "Perfeito, sobre"
    ];
    
    // Extrair palavras-chave da pergunta
    const palavrasChave = pergunta.toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove pontuação
        .split(' ')
        .filter(palavra => palavra.length > 3) // Palavras com mais de 3 caracteres
        .slice(0, 3); // Primeiras 3 palavras relevantes
    
    // Escolher frase aleatória
    const fraseEscolhida = frases[Math.floor(Math.random() * frases.length)];
    
    // Combinar frase com palavras-chave
    if (palavrasChave.length > 0) {
        const contexto = palavrasChave.join(' ');
        return `${fraseEscolhida} ${contexto}...`;
    }
    
    return `${fraseEscolhida} sua pergunta...`;
}

// ==================== FUNÇÕES DE CONVERSAÇÃO CONTÍNUA ====================

// Analisar intenção conversacional da mensagem do usuário
async function analyzeConversationalIntent(userMessage) {
    try {
        const userEmail = getUserEmail();
        
        const response = await fetch('/api/ask-mongodb?action=conversation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'analyze_intent',
                userEmail: userEmail,
                message: userMessage
            })
        });

        if (!response.ok) {
            throw new Error(`Erro na análise: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('❌ Erro ao analisar intenção conversacional:', error);
        return {
            success: false,
            intent: { requires_bot_response: true, should_ask_followup: false }
        };
    }
}

// Gerar pergunta de seguimento do bot
async function generateBotFollowupQuestion(userMessage) {
    try {
        const userEmail = getUserEmail();
        
        const response = await fetch('/api/ask-mongodb?action=conversation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'generate_followup',
                userEmail: userEmail,
                message: userMessage
            })
        });

        if (!response.ok) {
            throw new Error(`Erro na geração: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('❌ Erro ao gerar pergunta de seguimento:', error);
        return {
            success: false,
            followupQuestion: "Posso ajudar com mais alguma coisa?"
        };
    }
}

// Converter resposta base em resposta conversacional
async function makeResponseConversational(userMessage, baseResponse) {
    try {
        const userEmail = getUserEmail();
        
        const response = await fetch('/api/ask-mongodb?action=conversation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'conversational_response',
                userEmail: userEmail,
                message: userMessage,
                baseResponse: baseResponse
            })
        });

        if (!response.ok) {
            throw new Error(`Erro na conversão: ${response.status}`);
        }

        const data = await response.json();
        return data.conversationalResponse || baseResponse;
    } catch (error) {
        console.error('❌ Erro ao tornar resposta conversacional:', error);
        return baseResponse;
    }
}

// Obter email do usuário de forma segura
function getUserEmail() {
    let userEmail = 'usuario@velotax.com.br'; // Fallback padrão
    
    if (typeof dadosAtendente !== 'undefined' && dadosAtendente?.email) {
        userEmail = dadosAtendente.email;
    } else if (typeof window !== 'undefined' && window.dadosAtendente?.email) {
        userEmail = window.dadosAtendente.email;
    } else {
        try {
            const savedData = localStorage.getItem('dadosAtendenteChatbot');
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                if (parsedData?.email) {
                    userEmail = parsedData.email;
                }
            }
        } catch (e) {
            console.log('⚠️ Não foi possível obter email do localStorage');
        }
    }
    
    return userEmail;
}

// Adicionar botão de resposta rápida
function addQuickResponseButton(text, onClick) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    const quickResponseContainer = document.createElement('div');
    quickResponseContainer.className = 'quick-response-container';
    
    const button = document.createElement('button');
    button.className = 'quick-response-btn';
    button.textContent = text;
    button.onclick = () => {
        onClick();
        quickResponseContainer.remove();
    };
    
    quickResponseContainer.appendChild(button);
    chatBox.appendChild(quickResponseContainer);
    
    // Scroll para baixo
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Função para adicionar mensagens ao chat (escopo global)
function addMessage(text, sender, { sourceRow = null, options = [], source = 'Planilha', tabulacoes = null, html = false } = {}) {
    // Verificação de segurança para evitar erro de trim em undefined
    if (!text || typeof text !== 'string') {
        text = "Mensagem não disponível";
    }
    
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) {
        console.error('❌ chat-box não encontrado!');
        return;
    }
    
    const messageContainer = document.createElement('div');
    messageContainer.className = `message-container ${sender}`;
    const avatar = document.createElement('div');
    avatar.className = `avatar ${sender}`;
    if (sender === 'bot' && source === 'IA') {
        avatar.textContent = '✦';
        avatar.title = 'Resposta gerada por IA';
    } else {
        avatar.textContent = sender === 'user' ? (dadosAtendente?.nome ? formatarAssinatura(dadosAtendente.nome).charAt(0) : '👤') : '🤖';
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
        positiveBtn.className = 'feedback-btn positive';
        positiveBtn.textContent = '👍';
        positiveBtn.title = 'Resposta útil e correta';
        positiveBtn.onclick = () => abrirModalFeedback(feedbackContainer);
        const negativeBtn = document.createElement('button');
        negativeBtn.className = 'feedback-btn negative';
        negativeBtn.textContent = '👎';
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

// Reproduzir última resposta
async function playLastResponse(text = null) {
    try {
        let textToConvert = text;
        
        if (!textToConvert) {
            const lastBotMessage = document.querySelector('.message-container.bot:last-child .message-content');
            if (!lastBotMessage) {
                addMessage('❌ Nenhuma resposta do bot encontrada para reproduzir', 'bot');
                return;
            }
            textToConvert = lastBotMessage.textContent;
        }

        const voiceId = 'pNInz6obpgDQGcFmaJgB'; // Voice ID padrão
        const speed = 1.0; // Velocidade fixa
        
        console.log('🔊 Texto para converter:', textToConvert);
        console.log('🔊 Voice ID:', voiceId);
        console.log('🔊 Velocidade:', speed);
        addMessage('🔊 Convertendo resposta para áudio...', 'bot');

        const response = await fetch('/api/voice?action=text-to-speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: textToConvert, voiceId, speed })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro na API: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('🔊 Resultado da conversão:', result);

        if (result.success) {
            console.log('🔊 Criando áudio com formato:', result.format);
            console.log('🔊 Tamanho do áudio base64:', result.audio ? result.audio.length : 'undefined');
            
            let audio;
            let audioUrl;
            
            try {
                // Criar um ID único para este áudio
                const audioId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                
                // Primeiro, enviar dados de áudio para criar um endpoint temporário
                const uploadResponse = await fetch('/api/voice?action=audio', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        audioData: result.audio,
                        format: result.format,
                        audioId: audioId
                    })
                });
                
                if (!uploadResponse.ok) {
                    throw new Error(`Erro ao enviar áudio: ${uploadResponse.status}`);
                }
                
                // Usar URL direta do endpoint (sem Blob)
                audioUrl = `/api/voice?action=audio&id=${audioId}`;
                
                console.log('🔊 Usando URL direta de áudio:', audioUrl);
                
                // Criar áudio com URL direta
                audio = new Audio(audioUrl);
                currentAudio = audio;
                
                // Aplicar velocidade do áudio
                const audioSpeed = 1.0; // Velocidade fixa
                audio.playbackRate = audioSpeed;
                console.log('🔊 Velocidade do áudio aplicada:', audioSpeed + 'x');
                
                // Configurar eventos
                audio.onended = () => {
                    const playBtn = document.getElementById('play-response');
                    const stopBtn = document.getElementById('stop-audio');
                    if (playBtn) playBtn.classList.add('hidden');
                    if (stopBtn) stopBtn.classList.add('hidden');
                    console.log('🔊 Áudio finalizado');
                };
                
                // Logs de debug para o áudio
                audio.onloadstart = () => console.log('🔊 Áudio iniciando carregamento...');
                audio.oncanplay = () => console.log('🔊 Áudio pronto para reprodução');
                audio.oncanplaythrough = () => console.log('🔊 Áudio totalmente carregado');
                audio.onerror = (e) => {
                    console.error('❌ Erro no áudio:', e);
                    console.error('❌ Detalhes do erro:', audio.error);
                    addMessage('❌ Erro ao reproduzir áudio', 'bot');
                };

                await audio.play();
                const playBtn = document.getElementById('play-response');
                const stopBtn = document.getElementById('stop-audio');
                if (playBtn) playBtn.classList.add('hidden');
                if (stopBtn) stopBtn.classList.remove('hidden');
                
                addMessage('🔊 Reproduzindo resposta...', 'bot');
                
            } catch (error) {
                console.error('❌ Erro ao criar Blob:', error);
                if (audioUrl) URL.revokeObjectURL(audioUrl);
                throw new Error('Erro ao processar áudio: ' + error.message);
            }
        } else {
            // Verificar se é erro de créditos esgotados
            if (result.error && result.error.includes('Limite de requisições excedido na API ElevenLabs')) {
                addMessage('Ops! Parece que seus créditos acabaram por enquanto😓. Fala com o nosso suporte pra gente poder continuar te ajudando com os próximos passos.', 'bot');
            } else {
                addMessage(`❌ Erro ao converter para áudio: ${result.error}`, 'bot');
            }
        }

    } catch (error) {
        console.error('❌ Erro ao reproduzir áudio:', error);
        
        // Verificar se é erro de créditos esgotados
        if (error.message && error.message.includes('429')) {
            addMessage('Ops! Parece que seus créditos acabaram por enquanto😓. Fala com o nosso suporte pra gente poder continuar te ajudando com os próximos passos.', 'bot');
        } else {
            addMessage(`❌ Erro ao reproduzir áudio: ${error.message}`, 'bot');
        }
    }
}

async function toggleRecording() {
    console.log('🎤 Toggle recording chamado, isRecording:', isRecording, 'isProcessingRecording:', isProcessingRecording);
    
    // Evitar múltiplas chamadas simultâneas
    if (isProcessingRecording) {
        console.log('⚠️ Já processando gravação, ignorando...');
        return;
    }
    
    // Marcar como processando para evitar duplo clique
    isProcessingRecording = true;
    
    try {
        if (isRecording) {
            console.log('🎤 Parando gravação...');
            stopRecording();
        } else {
            console.log('🎤 Iniciando gravação...');
            await startRecording();
        }
    } finally {
        // Liberar o controle após um pequeno delay para evitar duplo clique
        setTimeout(() => {
            isProcessingRecording = false;
            console.log('✅ Controle de gravação liberado');
        }, 1000); // Aumentar para 1 segundo para evitar cliques muito rápidos
    }
}

// Iniciar gravação
async function startRecording() {
    try {
        console.log('🎤 Iniciando gravação...');
        
        // Verificar se já está gravando
        if (isRecording) {
            console.log('⚠️ Já está gravando, ignorando...');
            return;
        }
        
        // Limpar qualquer gravação anterior
        if (mediaRecorder) {
            console.log('🧹 Limpando MediaRecorder anterior...');
            try {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
            } catch (e) {
                console.log('⚠️ Erro ao limpar MediaRecorder anterior:', e);
            }
            mediaRecorder = null;
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        currentStream = stream; // Armazenar referência do stream
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            console.log('🎤 Dados de áudio recebidos:', event.data);
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            console.log('🎤 Evento onstop disparado, chunks:', audioChunks.length);
            
            // Evitar processamento duplicado
            if (audioProcessed) {
                console.log('⚠️ Áudio já foi processado, ignorando onstop');
                return;
            }
            
            // Processar áudio independentemente do estado de isRecording
            // pois o evento onstop pode ser disparado após isRecording ser false
            if (audioChunks.length > 0) {
                audioProcessed = true; // Marcar como processado
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                console.log('🎤 Blob criado:', audioBlob);
                await processAudioToText(audioBlob);
            } else {
                addVoiceMessage('❌ Nenhum áudio foi gravado', 'bot');
            }
        };

        mediaRecorder.start(1000); // Coletar dados a cada 1 segundo
        isRecording = true;
        audioProcessed = false; // Resetar flag de processamento
        
        // Buscar elementos dinamicamente
        const voiceBtn = document.getElementById('voice-button');
        const recordingInd = document.getElementById('recording-indicator');
        
        // Indicador visual de gravação
        if (voiceBtn) {
            voiceBtn.innerHTML = '⏹️';
            voiceBtn.style.background = 'linear-gradient(135deg, #ff4757, #c44569)';
            voiceBtn.classList.add('recording');
            voiceBtn.style.animation = 'pulse 1s infinite';
        }
        
        // Mostrar indicador de gravação
        if (recordingInd) {
            recordingInd.classList.remove('hidden');
        }
        
        // Mostrar mensagem de gravação
        addVoiceMessage('🎤 Gravando... Fale agora!', 'bot');
        
        console.log('✅ Gravação iniciada');

    } catch (error) {
        console.error('❌ Erro ao iniciar gravação:', error);
        addVoiceMessage('Erro ao acessar o microfone. Verifique as permissões.', 'bot');
    }
}

// Parar gravação
function stopRecording() {
    console.log('⏹️ stopRecording chamado, isRecording:', isRecording, 'mediaRecorder:', !!mediaRecorder);
    
    // SEMPRE parar, independente do estado
    isRecording = false;
    
    // Parar o MediaRecorder primeiro
    if (mediaRecorder) {
        console.log('⏹️ Parando MediaRecorder...');
        try {
            if (mediaRecorder.state === 'recording') {
                console.log('⏹️ MediaRecorder está gravando, parando...');
                mediaRecorder.stop();
                
                // Fallback: processar áudio após um pequeno delay se onstop não funcionar
                setTimeout(async () => {
                    if (audioChunks.length > 0 && !audioProcessed) {
                        console.log('🔄 Fallback: processando áudio após timeout');
                        audioProcessed = true; // Marcar como processado
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        await processAudioToText(audioBlob);
                    }
                }, 2000); // 2 segundos de timeout
            } else {
                console.log('⏹️ MediaRecorder não está gravando, estado:', mediaRecorder.state);
            }
        } catch (error) {
            console.error('❌ Erro ao parar MediaRecorder:', error);
        }
        
        // Limpar referência imediatamente
        mediaRecorder = null;
    }
    
    // Parar o stream de áudio
    if (currentStream) {
        try {
            currentStream.getTracks().forEach(track => {
                track.stop();
                console.log('🎤 Track parada:', track.kind);
            });
        } catch (error) {
            console.error('❌ Erro ao parar tracks:', error);
        }
        currentStream = null;
    }
    
    // Limpar chunks
    audioChunks = [];
    
    // Buscar elementos dinamicamente
    const voiceBtn = document.getElementById('voice-button');
    const recordingInd = document.getElementById('recording-indicator');
    
    // Restaurar botão
    if (voiceBtn) {
        voiceBtn.innerHTML = '🎤';
        voiceBtn.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a24)';
        voiceBtn.classList.remove('recording');
        voiceBtn.style.animation = 'none';
        voiceBtn.style.border = 'none';
    }
    
    // Esconder indicador de gravação
    if (recordingInd) {
        recordingInd.classList.add('hidden');
    }
    
    // Mostrar mensagem de processamento
    addVoiceMessage('🔄 Processando áudio...', 'bot');
    
    console.log('✅ Gravação parada completamente');
}

// Processar áudio para texto
async function processAudioToText(audioBlob) {
    try {
        addVoiceMessage('🎤 Processando áudio...', 'bot');
        
        // Mostrar indicador de progresso mais detalhado
        const progressMessage = addVoiceMessage('⏳ Enviando áudio para transcrição...', 'bot');
        
        console.log('🎤 Tipo do audioBlob:', typeof audioBlob);
        console.log('🎤 audioBlob:', audioBlob);
        
        // Verificar se é um Blob válido
        if (!audioBlob || typeof audioBlob.arrayBuffer !== 'function') {
            throw new Error('AudioBlob inválido ou não é um Blob');
        }
        
        // Converter blob para base64
        const arrayBuffer = await audioBlob.arrayBuffer();
        console.log('🎤 ArrayBuffer criado, tamanho:', arrayBuffer.byteLength);
        
        // Atualizar mensagem de progresso
        updateVoiceMessage(progressMessage, '🔄 Convertendo áudio para texto...');
        
        // Converter para base64 de forma mais segura
        const uint8Array = new Uint8Array(arrayBuffer);
        let binaryString = '';
        const chunkSize = 8192; // Processar em pedaços para evitar stack overflow
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.slice(i, i + chunkSize);
            binaryString += String.fromCharCode.apply(null, chunk);
        }
        
        const base64Audio = btoa(binaryString);
        console.log('🎤 Base64 criado, tamanho:', base64Audio.length);
        
        // Atualizar mensagem de progresso
        updateVoiceMessage(progressMessage, '🚀 Enviando para OpenAI Whisper...');
        
        const response = await fetch('/api/voice?action=speech-to-text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                audio: base64Audio
            })
        });

        console.log('🎤 Status da resposta:', response.status);
        console.log('🎤 Headers da resposta:', response.headers);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Erro na API:', response.status, errorText);
            throw new Error(`Erro na API: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('🎤 Resultado da API:', result);

        if (result.success) {
            updateVoiceMessage(progressMessage, '✅ Transcrição concluída!');
            
            // Pequeno delay para mostrar a mensagem de sucesso
            setTimeout(() => {
                addVoiceMessage(`🎤 Você disse: "${result.text}"`, 'user');
                // Chamar buscarResposta se estiver disponível
                if (typeof buscarResposta === 'function') {
                    buscarResposta(result.text);
                } else {
                    addVoiceMessage('❌ Função buscarResposta não disponível', 'bot');
                }
            }, 500);
        } else {
            updateVoiceMessage(progressMessage, `❌ Erro ao processar áudio: ${result.error}`);
        }

    } catch (error) {
        console.error('❌ Erro ao processar áudio:', error);
        addVoiceMessage(`❌ Erro ao processar áudio: ${error.message}`, 'bot');
    }
}

// Função auxiliar para atualizar mensagens de voz
function updateVoiceMessage(messageElement, newText) {
    if (messageElement && messageElement.querySelector('.message-content')) {
        messageElement.querySelector('.message-content').textContent = newText;
    }
}

// Função global para buscar respostas com sistema de conversação
async function buscarResposta(textoDaPergunta, isClarification = false) {
    // Verificar se as variáveis necessárias estão disponíveis
    if (typeof ultimaPergunta !== 'undefined') {
        ultimaPergunta = textoDaPergunta;
    }
    if (typeof ultimaLinhaDaFonte !== 'undefined') {
        ultimaLinhaDaFonte = null;
    }
    
    if (!textoDaPergunta.trim()) return;
    
    
    // Mostrar indicador de digitação se a função estiver disponível
    if (typeof showTypingIndicator === 'function') {
        showTypingIndicator();
    }
    
    try {
        // ==================== ANÁLISE CONVERSACIONAL ====================
        console.log('🤖 Analisando intenção conversacional...');
        const intentAnalysis = await analyzeConversationalIntent(textoDaPergunta);
        
        if (!intentAnalysis.success) {
            console.log('⚠️ Análise de intenção falhou, continuando com fluxo normal');
        }
        
        const userEmail = getUserEmail();
        console.log('📧 Email usado para busca:', userEmail);
        
        // Usar MongoDB endpoint como principal
        let url = `/api/ask-mongodb?pergunta=${encodeURIComponent(textoDaPergunta)}&email=${encodeURIComponent(userEmail)}`;
        
        // Se é pergunta de esclarecimento, adicionar parâmetro
        if (isClarification) {
            url += '&isClarification=true';
            console.log('📋 Pergunta de esclarecimento detectada');
        }
        
        console.log('🔍 Buscando resposta:', url);
        const response = await fetch(url);
        
        if (typeof hideTypingIndicator === 'function') {
            hideTypingIndicator();
        }
        
        if (!response.ok) throw new Error(`Erro de rede ou API: ${response.status}`);
        const data = await response.json();

        console.log('🤖 Resposta da IA:', data);
        
        // Processar resposta baseada no status
        let respostaFinal = '';
        
        if (data.status === 'sucesso' || data.status === 'sucesso_ia' || data.status === 'sucesso_ia_avancada') {
            // Verificar se a resposta é um JSON array
            if (data.resposta && data.resposta.trim().startsWith('[') && data.resposta.trim().endsWith(']')) {
                try {
                    const items = JSON.parse(data.resposta);
                    if (Array.isArray(items) && items.length > 0) {
                        // Processar array de itens
                        respostaFinal = items.map(item => {
                            if (item.title && item.content) {
                                return `**${item.title}**\n${item.content}`;
                            } else if (item.title) {
                                return item.title;
                            } else if (item.content) {
                                return item.content;
                            }
                            return JSON.stringify(item);
                        }).join('\n\n');
                    } else {
                        respostaFinal = data.resposta;
                    }
                } catch (e) {
                    console.log('⚠️ Erro ao processar JSON da resposta:', e);
                    respostaFinal = data.resposta;
                }
            } else {
                respostaFinal = data.resposta;
            }
        } else if (data.status === 'clarification_needed' || data.status === 'clarification_needed_offline') {
            // Se há opções, usar addVoiceMessage com opções
            if (data.options && data.options.length > 0) {
                console.log('📋 Criando lista de opções:', data.options);
                addVoiceMessage(data.resposta, 'bot', data.options);
                return; // Sair da função para não duplicar a mensagem
            } else {
                respostaFinal = data.resposta;
            }
        } else if (data.status === 'resposta_padrao' || data.status === 'sucesso_offline') {
            respostaFinal = data.resposta;
        } else {
            respostaFinal = data.resposta || data.error || "Resposta não disponível";
        }
        
        // ==================== PROCESSAMENTO CONVERSACIONAL ====================
        console.log('💬 Tornando resposta conversacional...');
        const respostaConversacional = await makeResponseConversational(textoDaPergunta, respostaFinal);
        
        // Gerar frase de conversação
        const fraseConversacao = generateConversationPhrase(textoDaPergunta);
        console.log('🗣️ Frase de conversação gerada:', fraseConversacao);
        
        // Combinar frase de conversação com resposta conversacional
        const respostaCompleta = `${fraseConversacao}\n\n${respostaConversacional}`;
        
        console.log('📝 Resposta final processada:', respostaCompleta);
        console.log('📝 Chamando addVoiceMessage...');
        addVoiceMessage(respostaCompleta, 'bot');
        console.log('✅ addVoiceMessage chamada com sucesso');
        
        // Reproduzir áudio automaticamente para entrada por voz
        console.log('🔊 Iniciando reprodução automática de áudio...');
        setTimeout(async () => {
            try {
                await playLastResponse(respostaCompleta);
                console.log('✅ Reprodução automática de áudio concluída');
            } catch (error) {
                console.error('❌ Erro na reprodução automática:', error);
            }
        }, 1000); // Aguardar 1 segundo para garantir que a mensagem foi exibida
    } catch (error) {
        if (typeof hideTypingIndicator === 'function') {
            hideTypingIndicator();
        }
        
        addVoiceMessage("Erro de conexão com o backend. Aguarde um instante que estamos verificando o ocorrido", 'bot');
        console.error("Detalhes do erro:", error);
    }
}


document.addEventListener('DOMContentLoaded', () => {
    // >>> INÍCIO DA CORREÇÃO - v2.0 <<<
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
    let tokenClient = null;
    let sessionId = generateUUID();
    let connectivityStatus = 'online'; // online, offline, weak-signal, no-connection

    // Função para gerar UUID
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // ================== FUNÇÕES DE CONECTIVIDADE ==================
    
    function updateConnectivityIndicator(status, data = null) {
        const indicator = document.getElementById('connectivity-indicator');
        const wifiIcon = document.getElementById('wifi-icon');
        const connectivityText = document.getElementById('connectivity-text');
        
        if (!indicator || !wifiIcon || !connectivityText) return;
        
        // Remover classes anteriores
        indicator.className = 'connectivity-indicator';
        
        // Determinar status baseado na resposta da API
        let newStatus = 'online';
        let iconClass = 'bx-wifi';
        let text = 'Conectado';
        
        if (data) {
            // Verificar se a resposta indica modo offline
            if (data.modo === 'offline' || data.nivel === 2 || data.nivel === 3) {
                if (data.nivel === 3) {
                    newStatus = 'no-connection';
                    iconClass = 'bx-wifi-slash';
                    text = 'Sem conexão';
                } else if (data.nivel === 2) {
                    newStatus = 'offline';
                    iconClass = 'bx-wifi-1';
                    text = 'Modo offline';
                }
            } else if (data.modo === 'online' && data.nivel === 1) {
                newStatus = 'online';
                iconClass = 'bx-wifi';
                text = 'Conectado';
            }
        } else if (status === 'error' || status === 'timeout') {
            newStatus = 'weak-signal';
            iconClass = 'bx-wifi-2';
            text = 'Conexão instável';
        } else if (status === 'offline') {
            newStatus = 'offline';
            iconClass = 'bx-wifi-1';
            text = 'Modo offline';
        } else if (status === 'no-connection') {
            newStatus = 'no-connection';
            iconClass = 'bx-wifi-slash';
            text = 'Sem conexão';
        }
        
        // Atualizar elementos
        indicator.classList.add(newStatus);
        wifiIcon.className = `bx ${iconClass}`;
        connectivityText.textContent = text;
        
        // Atualizar status global
        connectivityStatus = newStatus;
        
        console.log(`📶 Status de conectividade atualizado: ${newStatus} (${text})`);
    }

    // Função para verificar conectividade periodicamente
    async function checkConnectivity() {
        try {
            // Usar endpoint de debug do voice para teste de conectividade
            const response = await fetch('/api/voice?action=debug', {
                method: 'GET',
                signal: AbortSignal.timeout(3000) // 3 segundos de timeout
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Teste de conectividade funcionou:', data);
                updateConnectivityIndicator('online');
            } else {
                console.log('❌ Teste simples falhou:', response.status);
                updateConnectivityIndicator('weak-signal');
            }
        } catch (error) {
            console.log('❌ Erro no teste simples:', error);
            if (error.name === 'TimeoutError') {
                updateConnectivityIndicator('timeout');
            } else {
                updateConnectivityIndicator('no-connection');
            }
        }
    }

    // Inicializar indicador de conectividade
    function initializeConnectivityIndicator() {
        // Verificar conectividade inicial
        checkConnectivity();
        
        // Verificar conectividade a cada 30 segundos
        setInterval(checkConnectivity, 30000);
        
        // Verificar conectividade quando a janela ganha foco
        window.addEventListener('focus', checkConnectivity);
        
        // Verificar conectividade quando a conexão é restaurada
        window.addEventListener('online', () => {
            updateConnectivityIndicator('online');
            checkConnectivity();
        });
        
        // Verificar conectividade quando a conexão é perdida
        window.addEventListener('offline', () => {
            updateConnectivityIndicator('no-connection');
        });
    }

    // Função para registrar status de login/logout no backend
    async function logUserStatus(status) {
        if (!dadosAtendente?.email) return;
        
        const url = '/api/logQuestion';
        const data = {
            type: 'access',
            payload: {
                email: dadosAtendente.email,
                status: status,
                sessionId: sessionId
            }
        };

        try {
            console.log(`📝 Registrando status ${status} para ${dadosAtendente.email}...`);
            
            const response = await fetch(url, {
            method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Status ${status} registrado com sucesso:`, result);
            } else {
                console.error(`❌ Erro ao registrar status ${status}:`, response.status);
            }
        } catch (error) {
            console.error(`❌ Erro ao registrar status ${status}:`, error);
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
                const profileResponse = await fetch(`/api/admin?action=getUserProfile&email=${encodeURIComponent(user.email)}`);
                if (!profileResponse.ok) throw new Error('Falha ao buscar perfil do usuário.');
                
                const userProfile = await profileResponse.json();
                console.log('🔍 Perfil do usuário obtido:', userProfile);

                dadosAtendente = {
                    nome: user.name,
                    email: user.email,
                    timestamp: Date.now(),
                    funcao: userProfile.funcao
                };
                console.log('🔍 dadosAtendente definido:', dadosAtendente);

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

    // Cache para evitar logs duplicados
    const loggedQuestions = new Set();
    
    async function logQuestionOnSheet(question, email) {
        if (!question || !email) return;
        
        // Criar uma chave única para a pergunta
        const questionKey = `${email}-${question.trim()}`;
        
        // Verificar se já foi logada recentemente (evitar duplicatas)
        if (loggedQuestions.has(questionKey)) {
            console.log('⚠️ Pergunta já foi logada, evitando duplicata:', question);
            return;
        }
        
        // Adicionar ao cache
        loggedQuestions.add(questionKey);
        console.log('📝 Adicionando pergunta ao cache:', questionKey);
        
        // Limpar cache após 30 segundos para permitir nova gravação da mesma pergunta
        setTimeout(() => {
            loggedQuestions.delete(questionKey);
            console.log('🗑️ Removendo pergunta do cache:', questionKey);
        }, 30 * 1000); // Reduzido para 30 segundos
        
        try {
            console.log('📝 Registrando pergunta na planilha:', question);
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
            console.log('✅ Pergunta registrada com sucesso');
        } catch (error) {
            console.error("Erro ao registrar a pergunta na planilha:", error);
            // Remover do cache em caso de erro para permitir nova tentativa
            loggedQuestions.delete(questionKey);
        }
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
                    const tipo = item.tipo || 'info'; // Fallback para 'info' se tipo for undefined
                    newsItemDiv.className = `news-item ${tipo.toLowerCase().trim()}-alert`;
                    newsItemDiv.innerHTML = `<h2>${item.titulo || 'Sem título'}</h2><small>Publicado em: ${item.publicadoEm || 'Data não disponível'}</small><p>${item.conteudo || 'Conteúdo não disponível'}</p>`;
                    newsListContainer.appendChild(newsItemDiv);
                });
            } catch (error) {
                console.error("Erro ao carregar notícias:", error);
                newsListContainer.innerHTML = '<p>Não foi possível carregar as notícias. Verifique a conexão.</p>';
            }
        }

        async function carregarStatusProdutos() {
            // Carregar produtos na sidebar (mantido para compatibilidade)
            const container = document.getElementById('product-status-container');
            if (container) {
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
            
            // Carregar produtos no header
            carregarStatusProdutosHeader();
        }

        async function carregarStatusProdutosHeader() {
            const container = document.getElementById('product-status-container-header');
            if (!container) return;
            
            try {
                const response = await fetch('/api/getProductStatus');
                if (!response.ok) throw new Error('API falhou');
                const data = await response.json();
                
                container.innerHTML = '';
                data.products.forEach(p => {
                    const productItem = document.createElement('button');
                    productItem.className = 'product-status-item-header product-button';
                    productItem.setAttribute('data-product', p.produto);
                    
                    // Adicionar classe baseada no status
                    if (p.status === 'Disponível') {
                        productItem.classList.add('status-disponivel');
                    } else {
                        productItem.classList.add('status-indisponivel');
                    }
                    
                    // Determinar emoji baseado no status
                    const emoji = p.status === 'Disponível' ? '🟢' : '🔴';
                    
                    productItem.innerHTML = `
                        <span class="product-name">${p.produto}</span>
                        <span class="product-emoji">${emoji}</span>
                    `;
                    
                    // Adicionar evento de clique
                    productItem.addEventListener('click', () => {
                        handleProductClick(p.produto);
                    });
                    
                    container.appendChild(productItem);
                });
            } catch (error) {
                console.error("Erro ao carregar status dos produtos no header:", error);
                container.innerHTML = '<p>Não foi possível carregar o status dos produtos.</p>';
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


        async function enviarFeedback(action, container, sugestao = null) {
            if (!ultimaPergunta || !ultimaLinhaDaFonte) {
                console.error("FALHA: Feedback não enviado.");
                return;
            }
            container.textContent = 'Obrigado pelo feedback!';
            container.className = 'feedback-thanks';

                console.log("Enviando para a API de Feedback:", { action, question: ultimaPergunta, sourceRow: ultimaLinhaDaFonte, email: dadosAtendente.email, sugestao });
            try {
                const response = await fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: action,
                        email: dadosAtendente.email,
                        pergunta: ultimaPergunta,
                        resposta: ultimaLinhaDaFonte,
                        sugestao: sugestao
                    })
                });
                
                if (response.ok) {
                    console.log("✅ Feedback enviado com sucesso!");
                } else {
                    console.error("❌ Erro ao enviar feedback:", await response.text());
                }
            } catch (error) {
                console.error("ERRO DE REDE ao enviar feedback:", error);
            }
        }


        function handleSendMessage(text) {
            const trimmedText = text.trim();
            if (!trimmedText) return;
            
            console.log('📤 handleSendMessage chamado com:', trimmedText);
            
            // Remover mensagem de boas-vindas se ainda estiver visível
            const welcomeMessage = document.querySelector('.welcome-message');
            if (welcomeMessage) {
                welcomeMessage.remove();
            }
            
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

        // ==================== ABAS LATERAIS EXPANSÍVEIS ====================
        
        // Configurar abas laterais expansíveis
        function setupExpandableSidebars() {
            const leftSidebar = document.getElementById('sidebar');
            const rightSidebar = document.getElementById('news-panel');
            const expandLeftBtn = document.getElementById('expand-left-sidebar');
            const expandRightBtn = document.getElementById('expand-right-sidebar');
            const collapseLeftBtn = document.getElementById('collapse-left-sidebar');
            const collapseRightBtn = document.getElementById('collapse-right-sidebar');

            // Função toggle para sidebar esquerda
            function toggleLeftSidebar() {
                if (leftSidebar.classList.contains('sidebar-collapsed')) {
                    leftSidebar.classList.remove('sidebar-collapsed');
                    leftSidebar.classList.add('sidebar-expanded');
                    console.log('📂 Sidebar esquerda expandida');
                } else {
                    leftSidebar.classList.remove('sidebar-expanded');
                    leftSidebar.classList.add('sidebar-collapsed');
                    console.log('📁 Sidebar esquerda colapsada');
                }
            }

            // Função toggle para sidebar direita
            function toggleRightSidebar() {
                if (rightSidebar.classList.contains('sidebar-collapsed')) {
                    rightSidebar.classList.remove('sidebar-collapsed');
                    rightSidebar.classList.add('sidebar-expanded');
                    console.log('📂 Sidebar direita expandida');
                } else {
                    rightSidebar.classList.remove('sidebar-expanded');
                    rightSidebar.classList.add('sidebar-collapsed');
                    console.log('📁 Sidebar direita colapsada');
                }
            }

            // Botão de expansão esquerda - toggle
            if (expandLeftBtn && leftSidebar) {
                expandLeftBtn.addEventListener('click', toggleLeftSidebar);
            }

            // Botão de colapso esquerda - toggle
            if (collapseLeftBtn && leftSidebar) {
                collapseLeftBtn.addEventListener('click', toggleLeftSidebar);
            }

            // Botão de expansão direita - toggle
            if (expandRightBtn && rightSidebar) {
                expandRightBtn.addEventListener('click', toggleRightSidebar);
            }

            // Botão de colapso direita - toggle
            if (collapseRightBtn && rightSidebar) {
                collapseRightBtn.addEventListener('click', toggleRightSidebar);
            }

            console.log('✅ Abas laterais expansíveis configuradas - Toggle completo implementado');
        }

        // ==================== FUNÇÃO DE CLIQUE EM PRODUTOS ====================
        
        function handleProductClick(productName) {
            console.log(`🛍️ Produto clicado: ${productName}`);
            
            // Mapear produtos para comandos específicos
            const productCommands = {
                'Antecipação': 'antecipação',
                'Crédito pessoal': 'crédito pessoal',
                'Crédito do trabalhador': 'crédito do trabalhador',
                'Liquidação antecipada': 'liquidação antecipada'
            };
            
            const command = productCommands[productName] || productName.toLowerCase();
            
            // Adicionar mensagem do usuário simulando a pergunta
            addMessage(`Informações sobre ${productName}`, 'user');
            
            // Buscar resposta sobre o produto
            buscarResposta(command);
            
            // Scroll para baixo para mostrar a resposta
            setTimeout(() => {
                scrollToBottom();
            }, 100);
        }

        // ==================== FUNCIONALIDADES DE VOZ ====================

        // Elementos de voz
        const voiceButton = document.getElementById('voice-button');
        const playResponseButton = document.getElementById('play-response');
        const stopAudioButton = document.getElementById('stop-audio');
        const voiceSelector = document.getElementById('voice-selector');
        const recordingIndicator = document.getElementById('recording-indicator');

        // Inicializar funcionalidades de voz
        function initVoiceFeatures() {
            console.log('🎤 Inicializando funcionalidades de voz...');
            
            // Buscar elementos dinamicamente
            const voiceBtn = document.getElementById('voice-button');
            const playBtn = document.getElementById('play-response');
            const stopBtn = document.getElementById('stop-audio');
            const voiceSel = document.getElementById('voice-selector');
            const recordingInd = document.getElementById('recording-indicator');
            
            console.log('Elementos encontrados:');
            console.log('- Voice button:', voiceBtn);
            console.log('- Play button:', playBtn);
            console.log('- Stop button:', stopBtn);
            console.log('- Voice selector:', voiceSel);
            console.log('- Recording indicator:', recordingInd);
            
            // Configurar botão de voz
            if (voiceBtn) {
                // Remover listeners existentes
                voiceBtn.removeEventListener('click', toggleRecording);
                // Adicionar novo listener
                voiceBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log('🎤 Botão de voz clicado!');
                    toggleRecording();
                });
                console.log('✅ Event listener adicionado ao botão de voz');
            } else {
                console.error('❌ Botão de voz não encontrado');
            }
            
            // Configurar botão de play
            if (playBtn) {
                playBtn.removeEventListener('click', playLastResponse);
                playBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log('🔊 Botão de play clicado!');
                    playLastResponse();
                });
                console.log('✅ Event listener adicionado ao botão de play');
            } else {
                console.error('❌ Botão de play não encontrado');
            }
            
            // Configurar botão de stop
            if (stopBtn) {
                stopBtn.removeEventListener('click', stopAudio);
                stopBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log('⏹️ Botão de stop clicado!');
                    stopAudio();
                });
                console.log('✅ Event listener adicionado ao botão de stop');
            } else {
                console.error('❌ Botão de stop não encontrado');
            }
            
            
        // Carregar vozes disponíveis
        loadAvailableVoices();
        
        // Teste de funcionalidade
        console.log('🧪 Testando funcionalidade dos botões...');
        setTimeout(() => {
            const voiceBtn = document.getElementById('voice-button');
            if (voiceBtn) {
                console.log('✅ Botão de voz encontrado e configurado');
                // Adicionar um teste visual
                voiceBtn.style.border = '2px solid #00ff00';
                setTimeout(() => {
                    voiceBtn.style.border = 'none';
                }, 2000);
            } else {
                console.error('❌ Botão de voz ainda não encontrado');
            }
        }, 1000);
    }


        // Funções removidas - movidas para escopo global

        // Função removida - movida para escopo global


        // Parar áudio
        function stopAudio() {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
                currentAudio = null;
                
                const playBtn = document.getElementById('play-response');
                const stopBtn = document.getElementById('stop-audio');
                
                if (playBtn) playBtn.classList.remove('hidden');
                if (stopBtn) stopBtn.classList.add('hidden');
            }
        }

        // Carregar vozes disponíveis
        async function loadAvailableVoices() {
            try {
                const response = await fetch('/api/voice?action=voices');
                const result = await response.json();

                if (result.success && result.voices.length > 0) {
                    console.log('🎵 Vozes carregadas:', result.voices.length);
                    // Se houver um seletor de voz no futuro, podemos usar aqui
                } else {
                    console.log('⚠️ Nenhuma voz disponível ou erro ao carregar');
                }

            } catch (error) {
                console.error('❌ Erro ao carregar vozes:', error);
            }
        }


        // ==================== SISTEMA DE ADMINISTRAÇÃO ====================
        
        // Verificar se usuário é admin
        function isAdmin() {
            if (!dadosAtendente) {
                console.log('❌ dadosAtendente não encontrado');
                return false;
            }
            
            const adminRoles = ['Admin', 'Supervisor', 'Diretor'];
            const userRole = dadosAtendente.funcao;
            
            // Fallback: verificar se o email é de admin baseado no domínio e nome
            const isAdminEmail = dadosAtendente.email.includes('gabriel.araujo') || 
                               dadosAtendente.email.includes('admin') || 
                               dadosAtendente.email.includes('diretor') || 
                               dadosAtendente.email.includes('velotax');
            
            const isAdminUser = adminRoles.includes(userRole) || isAdminEmail;
            
            console.log('🔍 Verificação de admin:', {
                email: dadosAtendente.email,
                funcao: userRole,
                adminRoles: adminRoles,
                isAdminEmail: isAdminEmail,
                isAdmin: isAdminUser
            });
            
            return isAdminUser;
        }

        // Função removida - botão de admin desabilitado temporariamente

        // Função removida - painel administrativo desabilitado temporariamente

        // Carregar usuários online
        async function loadOnlineUsers() {
            try {
                console.log('🔄 Carregando usuários online...');
                const response = await fetch('/api/admin?action=getOnlineUsers');
                const data = await response.json();

                if (data.success) {
                    displayOnlineUsers(data.onlineUsers);
                    updateUsersCount(data.total);
                } else {
                    console.error('Erro ao carregar usuários:', data.error);
                    alert('Erro ao carregar usuários online');
                }
            } catch (error) {
                console.error('Erro ao carregar usuários online:', error);
                alert('Erro de conexão ao carregar usuários');
            }
        }

        // Exibir usuários online
        function displayOnlineUsers(users) {
            const usersList = document.getElementById('users-list');
            if (!usersList) return;

            if (users.length === 0) {
                usersList.innerHTML = '<div class="user-item"><div class="user-info">Nenhum usuário online no momento</div></div>';
                return;
            }

            usersList.innerHTML = users.map(user => `
                <div class="user-item">
                    <div class="user-info">
                        <div class="user-email">${user.email}</div>
                        <div class="user-name">${user.nome}</div>
                        <div class="user-role">${user.cargo}</div>
                    </div>
                    <div class="user-actions">
                        <span class="user-status">Online</span>
                        <button class="admin-button danger" onclick="forceLogoutUserByEmail('${user.email}')">
                            🚪 Deslogar
                        </button>
                    </div>
                </div>
            `).join('');
        }

        // Atualizar contador de usuários
        function updateUsersCount(count) {
            const countElement = document.getElementById('users-count');
            if (countElement) {
                countElement.textContent = `${count} usuário${count !== 1 ? 's' : ''} online`;
            }
        }

        // Forçar logout de usuário específico
        async function forceLogoutUserByEmail(email) {
            if (!confirm(`Tem certeza que deseja deslogar o usuário ${email}?`)) {
                return;
            }

            try {
                console.log(`🔴 Deslogando usuário: ${email}`);
                const response = await fetch(`/api/admin?action=forceLogout&email=${encodeURIComponent(email)}&adminEmail=${encodeURIComponent(dadosAtendente.email)}`);
                const data = await response.json();

                if (data.success) {
                    alert(`Usuário ${email} foi deslogado com sucesso!`);
                    loadOnlineUsers(); // Recarregar lista
                } else {
                    alert(`Erro ao deslogar usuário: ${data.error}`);
                }
            } catch (error) {
                console.error('Erro ao deslogar usuário:', error);
                alert('Erro de conexão ao deslogar usuário');
            }
        }

        // Forçar logout via input
        async function forceLogoutUser() {
            const emailInput = document.getElementById('force-logout-email');
            const email = emailInput.value.trim();

            if (!email) {
                alert('Por favor, digite o email do usuário');
                return;
            }

            if (!email.includes('@velotax.com.br')) {
                alert('Email deve ser do domínio @velotax.com.br');
                return;
            }

            await forceLogoutUserByEmail(email);
            emailInput.value = ''; // Limpar input
        }

        // Inicialização simples e direta
        document.addEventListener('DOMContentLoaded', () => {
            console.log('🚀 DOM carregado, configurando botões...');
            
            // Configurar todos os botões
            setupVoiceButton();
            setupPlayButton();
            setupStopButton();
            
            // Painel administrativo desabilitado temporariamente
            
            // Carregar vozes
            loadAvailableVoices();
        });

        // Também tentar quando a janela carregar
        window.addEventListener('load', () => {
            console.log('🌐 Janela carregada, verificando botões...');
            setTimeout(() => {
            setupVoiceButton();
            setupPlayButton();
            setupStopButton();
            setupExpandableSidebars();
        }, 1000);
    });


        // Configurar botão de voz - FUNCIONALIDADE ATIVADA
        function setupVoiceButton() {
            const voiceBtn = document.getElementById('voice-button');
            // O botão de voz já foi configurado na função initVoiceFeatures()
            // Não precisamos configurar novamente aqui
        }

        // Configurar botão de play
        function setupPlayButton() {
            const playBtn = document.getElementById('play-response');
            if (playBtn) {
                // Configurar botão de play - ATIVADO
                playBtn.innerHTML = '🔊';
                playBtn.classList.remove('voice-btn-disabled');
                playBtn.onclick = function() {
                    console.log('🔊 Botão de play ativado!');
                    playLastResponse();
                };
                console.log('✅ Botão de play configurado e ATIVADO');
            }
        }

        // Configurar botão de stop
        function setupStopButton() {
            const stopBtn = document.getElementById('stop-audio');
            if (stopBtn) {
                stopBtn.addEventListener('click', function() {
                    console.log('⏹️ Botão de stop clicado!');
                    stopAudio();
                });
                console.log('✅ Botão de stop configurado');
            }
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

        setInitialTheme();
        carregarNoticias();
        carregarStatusProdutos();
        
        // Botão de admin desabilitado temporariamente
        
        // Inicializar funcionalidades de voz
        initVoiceFeatures();
        
        // Inicializar indicador de conectividade
        initializeConnectivityIndicator();
    }

// ==========================================================================
// SISTEMA DE NOTIFICAÇÃO ÚNICA POR COMMIT
// ==========================================================================

// Configuração da notificação atual
const CURRENT_COMMIT_HASH = '6662a07'; // Hash do commit atual
const NOTIFICATION_CONFIG = {
    title: '🚀 Atualização Disponível!',
    content: 'O Veloprocess foi atualizado com melhorias e correções. Recarregue a página para ter a melhor experiência!',
    showDuration: 8000, // 8 segundos
    autoHide: true
};

// Função para verificar se deve mostrar a notificação
function shouldShowNotification() {
    const lastSeenCommit = localStorage.getItem('lastSeenCommit');
    return lastSeenCommit !== CURRENT_COMMIT_HASH;
}

// Função para marcar commit como visto
function markCommitAsSeen() {
    localStorage.setItem('lastSeenCommit', CURRENT_COMMIT_HASH);
}

// Função para criar e mostrar a notificação
function showCommitNotification() {
    if (!shouldShowNotification()) {
        return;
    }

    // Criar elemento da notificação
    const notification = document.createElement('div');
    notification.className = 'commit-notification';
    notification.innerHTML = `
        <div class="commit-notification-header">
            <div class="commit-notification-title">
                <span>${NOTIFICATION_CONFIG.title}</span>
            </div>
            <button class="commit-notification-close" onclick="hideCommitNotification()">×</button>
        </div>
        <div class="commit-notification-content">
            ${NOTIFICATION_CONFIG.content}
        </div>
        <div class="commit-notification-actions">
            <button class="commit-notification-btn" onclick="hideCommitNotification()">Mais tarde</button>
            <button class="commit-notification-btn primary" onclick="reloadPage()">Recarregar</button>
        </div>
    `;

    // Adicionar ao body
    document.body.appendChild(notification);

    // Mostrar com animação
    setTimeout(() => {
        notification.classList.add('show');
        notification.classList.add('pulse');
    }, 100);

    // Auto-hide se configurado
    if (NOTIFICATION_CONFIG.autoHide) {
        setTimeout(() => {
            hideCommitNotification();
        }, NOTIFICATION_CONFIG.showDuration);
    }

    // Marcar como visto
    markCommitAsSeen();
}

// Função para esconder a notificação
function hideCommitNotification() {
    const notification = document.querySelector('.commit-notification');
    if (notification) {
        notification.classList.remove('show');
        notification.classList.add('hide');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 400);
    }
}

// Função para recarregar a página
function reloadPage() {
    window.location.reload();
}

// Inicializar notificação quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar um pouco para garantir que tudo carregou
    setTimeout(() => {
        showCommitNotification();
    }, 2000);
});

// ==========================================================================
// FIM DO SISTEMA DE NOTIFICAÇÃO
// ==========================================================================

    // Inicia todo o processo de autenticação
    initGoogleSignIn();
});