// Variáveis globais
let dadosAtendente = null;

// Função formatarAssinatura no escopo global
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

// Função addMessage no escopo global
function addMessage(text, sender, { sourceRow = null, options = [], source = 'Planilha', tabulacoes = null, html = false } = {}) {
    console.log(`📝 Adicionando mensagem: ${sender} - ${text.substring(0, 50)}...`);
    const chatBox = document.getElementById('chat-box');
    
    if (!chatBox) {
        console.error('❌ Chat box não encontrado!');
        console.log('🔍 Elementos disponíveis:', document.querySelectorAll('[id*="chat"]'));
        return;
    }
    
    console.log('✅ Chat box encontrado:', chatBox);

        // Container principal da mensagem
        const messageContainer = document.createElement('div');
        messageContainer.className = `message-container ${sender}`;

        // Avatar da mensagem
        const avatar = document.createElement('div');
        avatar.className = `avatar ${sender}`;
        if (sender === 'bot' && source === 'IA') {
            avatar.textContent = '✦';
            avatar.title = 'Resposta gerada por IA';
        } else if (sender === 'bot' && source === 'Base Local') {
            avatar.textContent = '🤖';
            avatar.title = 'Resposta da base de dados local';
        } else {
        avatar.textContent = sender === 'user' ? formatarAssinatura(dadosAtendente?.nome || 'Usuário').charAt(0) : '🤖';
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
            if (html) {
                const textWithButtons = parseInlineButtons(text);
                messageDiv.innerHTML = textWithButtons;
            } else {
                const textWithButtons = parseInlineButtons(formatText(text));
                messageDiv.innerHTML = marked.parse(textWithButtons);
            }
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

        // Feedback do bot com sistema inteligente
if (sender === 'bot') {
    ultimaLinhaDaFonte = sourceRow;
    const feedbackContainer = document.createElement('div');
    feedbackContainer.className = 'feedback-container';

    const positiveBtn = document.createElement('button');
    positiveBtn.className = 'feedback-btn';
    positiveBtn.innerHTML = '👍';
    positiveBtn.title = 'Resposta útil';
    positiveBtn.onclick = () => {
        enviarFeedback('logFeedbackPositivo', ultimaPergunta, sourceRow);
        positiveBtn.textContent = 'Obrigado!';
        positiveBtn.disabled = true;
    };

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
    console.log(`✅ Mensagem adicionada com sucesso. Total de mensagens: ${chatBox.children.length}`);
    console.log('🔍 Elemento da mensagem:', messageContainer);
    console.log('🔍 Conteúdo da mensagem:', messageContainer.innerHTML);
}

document.addEventListener('DOMContentLoaded', () => {
    // >>> VARIÁVEIS DEFINIDAS NO FRONTEND <<<
    const CLIENT_ID = '827325386401-ahi2f9ume9i7lc28lau7j4qlviv5d22k.apps.googleusercontent.com';
    const DOMINIO_PERMITIDO = '@velotax.com.br';
    
    // ================== VARIÁVEIS DE ESTADO ==================
    let ultimaPergunta = '';
    let ultimaLinhaDaFonte = null;
    let isTyping = false;
    let tokenClient = null;
    let sessionId = generateUUID();

    // Função para gerar UUID
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }


    // === SISTEMA DE FEEDBACK INTELIGENTE ===
    
    // Função para enviar feedback com análise ML
async function enviarFeedback(action, question, sourceRow, sugestao = '') {
    try {
        const feedbackData = {
            action: action,
            email: dadosAtendente?.email || 'anônimo',
            question: question || ultimaPergunta || 'N/A', // Garante que sempre tenha uma pergunta
            sourceRow: sourceRow,
            sugestao: sugestao
        };

        console.log('Enviando feedback:', feedbackData);

        const response = await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(feedbackData)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Feedback enviado com sucesso:', result);
            
            // Análise ML interna (só para logs)
            if (action === 'logFeedbackNegativo') {
                console.log('🔍 ANÁLISE ML: Feedback negativo detectado');
                console.log('📊 Pergunta problemática:', question);
                console.log(' Fonte:', sourceRow);
                console.log('📊 Sugestão do usuário:', sugestao);
            }
        } else {
            const errorText = await response.text();
            console.error('❌ Erro ao enviar feedback:', response.status, errorText);
        }
    } catch (error) {
        console.error('❌ Erro na requisição de feedback:', error);
    }
}

    // Função para abrir modal de feedback negativo
    function abrirModalFeedback(container) {
        // Armazena a referência do container ativo
        window.activeFeedbackContainer = container;
        
        const feedbackOverlay = document.getElementById('feedback-overlay');
        const feedbackText = document.getElementById('feedback-comment');
        
        if (feedbackOverlay) {
            feedbackOverlay.classList.remove('hidden');
            if (feedbackText) feedbackText.focus();
        }
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

    // Função para buscar resposta da IA com debug
    async function buscarRespostaAI(pergunta) {
        // Esconder indicador de "digitando..." apenas se estiver ativo
        if (isTyping) {
            hideTypingIndicator();
        }
        
        if (!pergunta || !pergunta.trim()) {
            addMessage("Por favor, digite uma pergunta antes de enviar.", "bot", { source: "IA" });
            return;
        }

        if (!dadosAtendente || !dadosAtendente.email) {
            addMessage("Erro: Email do atendente não definido.", "bot", { source: "IA" });
            return;
        }

        try {
            console.log('=== INICIANDO BUSCA ===');
            console.log('Pergunta:', pergunta);
            
            // Verificar se deve mostrar sugestões PRIMEIRO
            const sugestoes = verificarSugestoes(pergunta);
            if (sugestoes) {
                console.log('💡 Mostrando sugestões para:', pergunta);
                mostrarSugestoes(sugestoes);
                return;
            }
            
            console.log('🔍 Prosseguindo com busca normal...');
            
            // Primeiro tenta buscar na base local
            console.log('🔍 Buscando na base local...');
            const baseResponse = await fetch('/api/base');
            console.log('Status da resposta da API:', baseResponse.status);
            
            if (baseResponse.ok) {
                const baseData = await baseResponse.json();
                console.log('✅ Base carregada com sucesso');
                console.log('Tipo de dados:', typeof baseData);
                console.log('Estrutura:', Object.keys(baseData));
                
                if (baseData.base && Array.isArray(baseData.base)) {
                    console.log('📊 Total de itens na base:', baseData.base.length);
                    console.log(' Primeiros 3 títulos:', baseData.base.slice(0, 3).map(item => item.title));
                    
                    const respostaLocal = buscarNaBaseLocal(pergunta, baseData.base);
                    if (respostaLocal) {
                        console.log('✅ Resposta encontrada na base local');
                        addMessage(respostaLocal, "bot", { source: "Base Local" });
                        return;
                    } else {
                        console.log('❌ Nenhuma resposta encontrada na base local');
                    }
                } else {
                    console.log('❌ Estrutura da base inválida:', baseData);
                }
            } else {
                console.log('❌ Erro ao carregar base:', baseResponse.status);
            }

            console.log('🌐 Buscando em sites externos...');
            // Se não encontrou na base local, busca em sites externos
            const sitesAutorizados = [
                "https://www.gov.br/receitafederal/pt-br",
                "https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda",
                "https://velotax.com.br/"
            ];
            
            const contextoExterno = `Consulte as seguintes fontes oficiais para responder à pergunta: ${sitesAutorizados.join(', ')}`;
            
            const response = await fetch("/api/askOpenAI", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    pergunta, 
                    contextoPlanilha: contextoExterno, 
                    email: dadosAtendente.email 
                })
            });

            if (!response.ok) {
                const text = await response.text();
                console.error("Erro do backend:", response.status, text);
                addMessage("Erro ao processar a pergunta no backend. Tente novamente.", "bot", { source: "IA" });
                return;
            }

            const resposta = await response.text();
            console.log("Resposta bruta da API:", resposta);
            
            if (resposta.trim()) {
                try {
                    const respostaJson = JSON.parse(resposta);
                    if (respostaJson.resposta) {
                        addMessage(respostaJson.resposta, "bot", { source: "Sites Externos" });
                    } else {
                        addMessage(resposta, "bot", { source: "Sites Externos" });
                    }
                } catch (e) {
                    addMessage(resposta, "bot", { source: "Sites Externos" });
                }
            } else {
                addMessage("Desculpe, não consegui encontrar uma resposta adequada para sua pergunta.", "bot", { source: "IA" });
            }
        } catch (err) {
            console.error("Erro na requisição:", err);
            addMessage("Erro ao processar sua pergunta. Tente novamente.", "bot", { source: "IA" });
        }
    }
    
    // Função para limpar palavras de apoio (stop words)
function limparPalavrasApoio(texto) {
    const stopWords = [
        'como', 'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
        'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos',
        'para', 'por', 'com', 'sem', 'sobre', 'sob', 'entre', 'durante',
        'quando', 'onde', 'quem', 'que', 'qual', 'quais', 'cujo', 'cuja',
        'meu', 'minha', 'meus', 'minhas', 'seu', 'sua', 'seus', 'suas',
        'nosso', 'nossa', 'nossos', 'nossas', 'teu', 'tua', 'teus', 'tuas',
        'ele', 'ela', 'eles', 'elas', 'nós', 'você', 'vocês', 'eu', 'tu',
        'este', 'esta', 'estes', 'estas', 'esse', 'essa', 'esses', 'essas',
        'aquele', 'aquela', 'aqueles', 'aquelas', 'isto', 'isso', 'aquilo',
        'cliente', 'pessoa', 'usuário', 'atendente', 'funcionário',
        'é', 'são', 'foi', 'foram', 'será', 'serão', 'está', 'estão',
        'estava', 'estavam', 'estiver', 'estiverem', 'tem', 'têm',
        'tinha', 'tinham', 'terá', 'terão', 'tiver', 'tiverem',
        'pode', 'podem', 'podia', 'podiam', 'poderá', 'poderão',
        'poder', 'poderiam', 'deve', 'devem', 'devia', 'deviam',
        'deverá', 'deverão', 'dever', 'deveriam', 'quer', 'querem',
        'queria', 'queriam', 'quererá', 'quererão', 'querer', 'quereriam',
        'vai', 'vão', 'ia', 'iam', 'irá', 'irão', 'ir', 'iriam',
        'faz', 'fazem', 'fazia', 'faziam', 'fará', 'farão', 'fazer', 'fariam',
        'diz', 'dizem', 'dizia', 'diziam', 'dirá', 'dirão', 'dizer', 'diriam',
        'vem', 'vêm', 'vinha', 'vinham', 'virá', 'virão', 'vir', 'viriam',
        'vê', 'veem', 'via', 'viam', 'verá', 'verão', 'ver', 'veriam',
        'sabe', 'sabem', 'sabia', 'sabiam', 'saberá', 'saberão', 'saber', 'saberiam',
        'conhece', 'conhecem', 'conhecia', 'conheciam', 'conhecerá', 'conhecerão', 'conhecer', 'conheceriam',
        'tem', 'têm', 'tinha', 'tinham', 'terá', 'terão', 'ter', 'teriam',
        'há', 'havia', 'haviam', 'haverá', 'haverão', 'haver', 'haveriam',
        'existe', 'existem', 'existia', 'existiam', 'existirá', 'existirão', 'existir', 'existiriam',
        'aparece', 'aparecem', 'aparecia', 'apareciam', 'aparecerá', 'aparecerão', 'aparecer', 'apareceriam',
        'acontece', 'acontecem', 'acontecia', 'aconteciam', 'acontecerá', 'acontecerão', 'acontecer', 'aconteceriam',
        'sempre', 'nunca', 'jamais', 'também', 'ainda', 'já', 'agora', 'hoje', 'ontem', 'amanhã',
        'aqui', 'ali', 'lá', 'aí', 'cá', 'acolá', 'onde', 'aonde', 'donde', 'adonde',
        'muito', 'pouco', 'bastante', 'demais', 'mais', 'menos', 'tanto', 'quanto',
        'bem', 'mal', 'melhor', 'pior', 'grande', 'pequeno', 'alto', 'baixo',
        'novo', 'velho', 'jovem', 'antigo', 'moderno', 'atual', 'recente',
        'primeiro', 'último', 'segundo', 'terceiro', 'quarto', 'quinto',
        'tudo', 'nada', 'algo', 'algum', 'alguma', 'alguns', 'algumas',
        'nenhum', 'nenhuma', 'nenhuns', 'nenhumas', 'todo', 'toda', 'todos', 'todas',
        'cada', 'qualquer', 'quaisquer', 'outro', 'outra', 'outros', 'outras',
        'mesmo', 'mesma', 'mesmos', 'mesmas', 'próprio', 'própria', 'próprios', 'próprias',
        'tal', 'tais', 'tanto', 'tanta', 'tantos', 'tantas', 'quanto', 'quanta', 'quantos', 'quantas',
        'vário', 'vária', 'vários', 'várias', 'diverso', 'diversa', 'diversos', 'diversas',
        'certo', 'certa', 'certos', 'certas', 'errado', 'errada', 'errados', 'erradas',
        'verdadeiro', 'verdadeira', 'verdadeiros', 'verdadeiras', 'falso', 'falsa', 'falsos', 'falsas',
        'sim', 'não', 'talvez', 'provavelmente', 'possivelmente', 'certamente', 'obviamente',
        'realmente', 'verdadeiramente', 'efetivamente', 'de fato', 'na verdade',
        'então', 'assim', 'dessa forma', 'desse modo', 'dessa maneira',
        'portanto', 'logo', 'consequentemente', 'por isso', 'por causa disso',
        'mas', 'porém', 'contudo', 'todavia', 'entretanto', 'no entanto',
        'e', 'ou', 'nem', 'mas também', 'bem como', 'assim como',
        'se', 'caso', 'quando', 'enquanto', 'durante', 'até', 'desde',
        'porque', 'pois', 'já que', 'visto que', 'uma vez que',
        'embora', 'ainda que', 'mesmo que', 'mesmo se', 'por mais que',
        'a fim de', 'para que', 'de modo que', 'de forma que',
        'sem que', 'a menos que', 'salvo se', 'exceto se',
        'além de', 'além disso', 'ademais', 'também', 'igualmente',
        'por outro lado', 'por sua vez', 'por sua parte',
        'primeiro', 'segundo', 'terceiro', 'por último', 'finalmente',
        'em primeiro lugar', 'em segundo lugar', 'em terceiro lugar',
        'inicialmente', 'depois', 'em seguida', 'posteriormente',
        'anteriormente', 'antes', 'previamente', 'primeiramente'
    ];
    
    return texto
        .toLowerCase()
        .split(/\s+/)
        .filter(palavra => palavra.length > 2 && !stopWords.includes(palavra))
        .join(' ');
}

// Função para buscar na base local com limpeza de palavras de apoio
function buscarNaBaseLocal(pergunta, baseData) {
    const perguntaOriginal = pergunta;
    const perguntaLimpa = limparPalavrasApoio(pergunta);
    
    console.log('=== BUSCA NA BASE LOCAL ===');
    console.log('Pergunta original:', perguntaOriginal);
    console.log('Pergunta limpa:', perguntaLimpa);
    console.log('Base data type:', typeof baseData);
    console.log('É array?', Array.isArray(baseData));
    console.log('Total de itens:', baseData ? baseData.length : 'UNDEFINED');
    
    if (!baseData || !Array.isArray(baseData)) {
        console.log('❌ ERRO: baseData inválido');
        return null;
    }
    
    const resultados = [];
    
    // 1. BUSCA EXATA NO TÍTULO (com pergunta original)
    for (const item of baseData) {
        if (item.title && item.title.toLowerCase().trim() === perguntaOriginal.toLowerCase().trim()) {
            console.log('✅ TÍTULO EXATO:', item.title);
            return item.content;
        }
    }
    
    // 2. BUSCA EXATA NO TÍTULO (com pergunta limpa)
    for (const item of baseData) {
        if (item.title && limparPalavrasApoio(item.title) === perguntaLimpa) {
            console.log('✅ TÍTULO EXATO (limpo):', item.title);
            return item.content;
        }
    }
    
    // 3. BUSCA POR PALAVRAS-CHAVE (com pergunta limpa)
    for (const item of baseData) {
        if (item.keywords && Array.isArray(item.keywords)) {
            for (const keyword of item.keywords) {
                if (keyword) {
                    const keywordLimpo = limparPalavrasApoio(keyword);
                    if (keywordLimpo.includes(perguntaLimpa) || perguntaLimpa.includes(keywordLimpo)) {
                        console.log('✅ KEYWORD encontrado (limpo):', keyword);
                        resultados.push({ item, score: 0.9, source: 'Keyword Limpo' });
                    }
                }
            }
        }
    }
    
    // 4. BUSCA POR SINÔNIMOS (com pergunta limpa)
    for (const item of baseData) {
        if (item.sinonimos && Array.isArray(item.sinonimos)) {
            for (const sinonimo of item.sinonimos) {
                if (sinonimo) {
                    const sinonimoLimpo = limparPalavrasApoio(sinonimo);
                    if (sinonimoLimpo.includes(perguntaLimpa) || perguntaLimpa.includes(sinonimoLimpo)) {
                        console.log('✅ SINÔNIMO encontrado (limpo):', sinonimo);
                        resultados.push({ item, score: 0.8, source: 'Sinônimo Limpo' });
                    }
                }
            }
        }
    }
    
    // 5. BUSCA POR PALAVRAS INDIVIDUAIS (com pergunta limpa)
    const palavrasPergunta = perguntaLimpa.split(/\s+/).filter(p => p.length > 2);
    console.log('Palavras da pergunta limpa:', palavrasPergunta);
    
    for (const item of baseData) {
        let score = 0;
        let palavrasEncontradas = 0;
        
        // Verifica no título (limpo)
        if (item.title) {
            const tituloLimpo = limparPalavrasApoio(item.title);
            for (const palavra of palavrasPergunta) {
                if (tituloLimpo.includes(palavra)) {
                    score += 0.4; // Aumenta a pontuação para palavras limpas
                    palavrasEncontradas++;
                    console.log(`✅ Palavra "${palavra}" no título limpo:`, item.title);
                }
            }
        }
        
        // Verifica nas keywords (limpas)
        if (item.keywords && Array.isArray(item.keywords)) {
            for (const keyword of item.keywords) {
                if (keyword) {
                    const keywordLimpo = limparPalavrasApoio(keyword);
                    for (const palavra of palavrasPergunta) {
                        if (keywordLimpo.includes(palavra)) {
                            score += 0.3; // Aumenta a pontuação para keywords limpas
                            palavrasEncontradas++;
                            console.log(`✅ Palavra "${palavra}" na keyword limpa:`, keyword);
                        }
                    }
                }
            }
        }
        
        // Verifica nos sinônimos (limpos)
        if (item.sinonimos && Array.isArray(item.sinonimos)) {
            for (const sinonimo of item.sinonimos) {
                if (sinonimo) {
                    const sinonimoLimpo = limparPalavrasApoio(sinonimo);
                    for (const palavra of palavrasPergunta) {
                        if (sinonimoLimpo.includes(palavra)) {
                            score += 0.2; // Aumenta a pontuação para sinônimos limpos
                            palavrasEncontradas++;
                            console.log(`✅ Palavra "${palavra}" no sinônimo limpo:`, sinonimo);
                        }
                    }
                }
            }
        }
        
        if (score > 0.3) {
            resultados.push({ item, score, source: 'Palavras Limpas', match: `${palavrasEncontradas} palavras` });
        }
    }
    
    // Ordena por pontuação
    resultados.sort((a, b) => b.score - a.score);
    
    console.log('Resultados encontrados:', resultados.length);
    resultados.forEach((r, i) => {
        console.log(`${i + 1}. ${r.item.title} (${r.score.toFixed(2)}) - ${r.source}`);
    });
    
    if (resultados.length > 0) {
        const melhor = resultados[0];
        console.log('✅ MELHOR RESULTADO:', melhor.item.title);
        return melhor.item.content;
    }
    
    console.log('❌ Nenhum resultado encontrado');
    return null;
}

    // Função para calcular similaridade entre strings (tolerante a erros)
    function calcularSimilaridade(str1, str2) {
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();
        
        if (s1 === s2) return 1.0;
        if (s1.length === 0) return s2.length === 0 ? 1.0 : 0.0;
        if (s2.length === 0) return 0.0;
        
        const matrix = [];
        for (let i = 0; i <= s2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= s1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= s2.length; i++) {
            for (let j = 1; j <= s1.length; j++) {
                if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return 1 - (matrix[s2.length][s1.length] / Math.max(s1.length, s2.length));
    }

    // Função para calcular distância de Levenshtein
    function levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
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
        if (!dadosAtendente?.email) {
            console.error('❌ ERRO: dadosAtendente.email não definido');
            return;
        }
        
        const url = '/api/logQuestion';
        const data = {
            type: 'access',
            payload: {
                email: dadosAtendente.email,
                status: status,
                sessionId: sessionId,
                timestamp: new Date().toLocaleString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                })
            }
        };

        console.log('=== LOG USER STATUS ===');
        console.log('Status:', status);
        console.log('Email:', dadosAtendente.email);
        console.log('SessionId:', sessionId);
        console.log('Timestamp:', data.payload.timestamp);

        fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
            keepalive: true
        })
        .then(response => {
            console.log('Response status:', response.status);
            return response.json();
        })
        .then(json => {
            console.log('Response JSON:', json);
            if (json.status === 'sucesso') {
                console.log(`✅ Status ${status} registrado com sucesso`);
            } else {
                console.error('❌ Erro na resposta da API:', json);
            }
        })
        .catch(error => {
            console.error(`❌ ERRO ao registrar status ${status}:`, error);
        });
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
                
                // LOG DE LOGIN - GARANTE QUE SEJA CHAMADO
                console.log('Usuário logado, registrando status online...');
                logUserStatus('online');
                
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
            
            // LOG DE LOGIN AUTOMÁTICO
            console.log('Usuário reautenticado automaticamente, registrando status online...');
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

    // Função para verificar atualizações (placeholder)
    function verificarAtualizacao() {
        console.log('Verificando atualizações...');
        // Implementar lógica de verificação de atualizações
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

        function handleSendMessage(text) {
            console.log(`📤 Enviando mensagem: ${text}`);
            const trimmedText = text.trim();
            if (!trimmedText) {
                console.log('❌ Mensagem vazia, ignorando');
                return;
            }
            addMessage(trimmedText, 'user');
            logQuestionOnSheet(trimmedText, dadosAtendente.email);
            
            // Mostrar indicador de "digitando..."
            showTypingIndicator();
            
            // Buscar resposta com delay para mostrar o indicador
            setTimeout(() => {
            buscarRespostaAI(trimmedText);
            }, 500);
            
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

        // Sistema de feedback com modal corrigido
const feedbackOverlay = document.getElementById('feedback-overlay');
const feedbackSendBtn = document.getElementById('feedback-send');
const feedbackCancelBtn = document.getElementById('feedback-cancel');
const feedbackText = document.getElementById('feedback-comment');

function fecharModalFeedback() {
    if (feedbackOverlay) {
        feedbackOverlay.classList.add('hidden');
        if (feedbackText) feedbackText.value = '';
    }
    window.activeFeedbackContainer = null;
}

if (feedbackCancelBtn) {
    feedbackCancelBtn.addEventListener('click', fecharModalFeedback);
}

if (feedbackSendBtn) {
    feedbackSendBtn.addEventListener('click', () => {
        const sugestao = feedbackText ? feedbackText.value.trim() : '';
        // Garante que a pergunta seja enviada
        const perguntaParaEnviar = ultimaPergunta || 'Pergunta não identificada';
        enviarFeedback('logFeedbackNegativo', perguntaParaEnviar, ultimaLinhaDaFonte, sugestao || null);
        fecharModalFeedback();
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
            console.log('Usuário fazendo logout, registrando status offline...');
            logUserStatus('offline');
            localStorage.removeItem('dadosAtendenteChatbot');
            dadosAtendente = null;
            location.reload();
        }

        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
        }

        if (themeSwitcher) {
            themeSwitcher.addEventListener('click', () => {
                body.classList.toggle('dark-theme');
                const isDark = body.classList.contains('dark-theme');
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
                themeSwitcher.innerHTML = isDark ? '☾' : '☀︎';
            });
        }

        addMessage(
            `Olá! Temos novidades: a nova plataforma de cursos <strong>Velo Academy</strong> já está disponível!`,
            'bot'
        );

        const lastMessage = chatBox.lastElementChild;
        if (lastMessage) {
            const button = document.createElement('button');
            button.textContent = 'Acessar Velo Academy';
            button.onclick = () => window.open('https://veloacademy.vercel.app/cursos.html', '_blank');
            lastMessage.querySelector('.message-content')?.appendChild(button);
        }
        
        setInitialTheme();
        carregarNoticias();
        carregarStatusProdutos();
    }

    // Inicia diretamente o Google Sign-In
    initGoogleSignIn();
});

// === MELHORIAS DE INTERFACE DO CHAT ===

function scrollToBottom() {
    const chatBox = document.getElementById('chat-box');
    if (chatBox) {
        chatBox.scrollTo({
            top: chatBox.scrollHeight,
            behavior: 'smooth'
        });
    }
}

function showTypingIndicator() {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message-container bot typing-indicator';
    typingDiv.id = 'typing-indicator';
    
    typingDiv.innerHTML = `
        <div class="avatar bot">🤖</div>
        <div class="message-content">
            <div class="message">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <span class="typing-text">Digitando...</span>
            </div>
        </div>
    `;
    
    chatBox.appendChild(typingDiv);
    scrollToBottom();
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function addTimestampToMessage(messageContainer) {
    const timestamp = new Date().toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'message-timestamp';
    timestampDiv.textContent = timestamp;
    messageContainer.appendChild(timestampDiv);
}

function addClearChatButton() {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;
    
    const clearButton = document.createElement('button');
    clearButton.id = 'clear-chat-btn';
    clearButton.className = 'clear-chat-button';
    clearButton.innerHTML = '🗑️ Limpar Conversa';
    clearButton.onclick = clearChat;
    
    // Adicionar botão no topo do chat
    chatBox.parentNode.insertBefore(clearButton, chatBox);
}

function clearChat() {
    console.log('🗑️ Limpando conversa...');
    const chatBox = document.getElementById('chat-box');
    if (chatBox) {
        chatBox.innerHTML = '';
        // Adicionar mensagem de boas-vindas usando a função correta
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message-container bot';
        
        const avatar = document.createElement('div');
        avatar.className = 'avatar bot';
        avatar.textContent = '🤖';
        
        const messageContentDiv = document.createElement('div');
        messageContentDiv.className = 'message-content';
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.innerHTML = '<p>Conversa limpa! Como posso ajudá-lo hoje?</p>';
        
        messageContentDiv.appendChild(messageDiv);
        messageContainer.appendChild(avatar);
        messageContainer.appendChild(messageContentDiv);
        
        chatBox.appendChild(messageContainer);
        scrollToBottom();
    }
}

function addKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl + Enter para enviar mensagem
        if (e.ctrlKey && e.key === 'Enter') {
            const sendButton = document.getElementById('sendButton');
            if (sendButton) {
                sendButton.click();
            }
        }
        
        // Ctrl + L para limpar chat
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            clearChat();
        }
        
        // Ctrl + K para focar no input
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.focus();
            }
        }
    });
}

// === SISTEMA DE SUGESTÕES INTELIGENTES ===

function verificarSugestoes(pergunta) {
    const perguntaLower = pergunta.toLowerCase().trim();
    
    // Mapeamento de palavras-chave para categorias
    const mapeamentoSugestoes = {
        'credito': 'credito',
        'crédito': 'credito',
        'antecipacao': 'antecipacao',
        'antecipação': 'antecipacao',
        'antecipar': 'antecipacao',
        'restituicao': 'antecipacao',
        'restituição': 'antecipacao',
        'trabalhador': 'credito_trabalhador',
        'pessoal': 'credito_pessoal',
        'emprestimo': 'credito_pessoal',
        'empréstimo': 'credito_pessoal',
        'lote': 'lotes',
        'lotes': 'lotes',
        'data': 'lotes',
        'pix': 'pix',
        'conta': 'conta',
        'app': 'app',
        'declaracao': 'declaracao',
        'declaração': 'declaracao',
        'irpf': 'declaracao',
        'imposto': 'declaracao',
        'veloprime': 'veloprime',
        'investimento': 'veloprime',
        'investir': 'veloprime'
    };
    
    // Verificar se a pergunta contém palavras-chave para sugestões
    for (const [palavra, categoria] of Object.entries(mapeamentoSugestoes)) {
        if (perguntaLower.includes(palavra)) {
            console.log(`🎯 Palavra-chave detectada: "${palavra}" → categoria: ${categoria}`);
            return categoria;
        }
    }
    
    return null;
}

async function mostrarSugestoes(categoria) {
    try {
        console.log(`🔍 Buscando sugestões para categoria: ${categoria}`);
        
        const response = await fetch(`/api/sugestoes?categoria=${categoria}`);
        const data = await response.json();
        
        if (data.status === 'sucesso') {
            const sugestaoHTML = criarHTMLSugestoes(data);
            addMessage(sugestaoHTML, "bot", { source: "Sugestões Inteligentes", html: true });
        } else {
            console.log('❌ Erro ao carregar sugestões:', data.error);
            addMessage("Desculpe, não consegui carregar as sugestões no momento. Tente novamente.", "bot", { source: "Sistema" });
        }
    } catch (error) {
        console.error('❌ Erro ao buscar sugestões:', error);
        addMessage("Desculpe, ocorreu um erro ao carregar as sugestões. Tente novamente.", "bot", { source: "Sistema" });
    }
}

function criarHTMLSugestoes(data) {
    let html = `
        <div class="sugestoes-container">
            <h4>${data.titulo}</h4>
            <div class="sugestoes-lista">
    `;
    
    data.opcoes.forEach((opcao, index) => {
        const temResposta = opcao.resposta && opcao.resposta.length > 0;
        const classeItem = temResposta ? 'sugestao-item com-resposta' : 'sugestao-item';
        
        html += `
            <div class="${classeItem}" onclick="selecionarSugestao('${opcao.texto}', '${opcao.pergunta || ''}', '${opcao.resposta || ''}')">
                <span class="sugestao-texto">${opcao.texto}</span>
                ${temResposta ? '<span class="sugestao-indicador">✓</span>' : ''}
            </div>
        `;
    });
    
    html += `
            </div>
            <div class="sugestoes-info">
                <small>Clique em uma opção para obter mais informações</small>
            </div>
        </div>
    `;
    
    return html;
}

function selecionarSugestao(texto, pergunta, resposta) {
    if (resposta && resposta.length > 0) {
        // Se tem resposta direta, mostrar
        addMessage(resposta, "bot", { source: "Base de Dados" });
    } else if (pergunta) {
        // Se tem pergunta específica, fazer nova busca
        handleSendMessage(pergunta);
    } else {
        // Se é uma subcategoria, mostrar sugestões da subcategoria
        mostrarSugestoes(texto.toLowerCase().replace(/\s+/g, '_'));
    }
}

// Inicializar melhorias de interface quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 DOM carregado, inicializando melhorias...');
    // Aguardar um pouco para garantir que todos os elementos estejam carregados
    setTimeout(() => {
        console.log('🔧 Adicionando botão de limpar conversa...');
        addClearChatButton();
        console.log('⌨️ Adicionando atalhos de teclado...');
        addKeyboardShortcuts();
        
        
        
        console.log('✅ Melhorias inicializadas com sucesso');
    }, 1000);
});