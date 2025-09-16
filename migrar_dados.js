// migrar_dados_ultra_inteligente.js
const fs = require('fs');
const path = require('path');

// Mapeamento ultra-específico de tópicos para categorias
const mapeamentoTopicos = {
    // ABERTURA E GESTÃO DE CONTA
    'abertura de conta celcoin': 'contas_cadastros',
    'alteração de conta ou chave pix': 'contas_cadastros',
    'app - alteração de número de telefone': 'app_tecnico',
    'app - atualizar dados': 'app_tecnico',
    'app - atualizar situação': 'app_tecnico',
    'app - cancelamento de conta celcoin': 'app_tecnico',
    'app - cancelar procuração': 'app_tecnico',
    'app - como acessar a conta': 'app_tecnico',
    'app - excluir conta velotax': 'app_tecnico',
    'app - reativar conta': 'app_tecnico',
    'conta - bloqueio judicial': 'contas_cadastros',
    'conta - saldo insuficiente': 'contas_cadastros',
    
    // ANTECIPAÇÃO DA RESTITUIÇÃO
    'antecipação da restituição': 'antecipacao',
    'antecipação - bloqueio de conta': 'antecipacao',
    'antecipação - cliente não concorda com o débito do valor': 'antecipacao',
    'antecipação - como os juros são calculados?': 'antecipacao',
    'antecipação - como quitar': 'antecipacao',
    'antecipação - como saber quando o cliente recebe': 'antecipacao',
    'antecipação - disponibilidade': 'antecipacao',
    'antecipação - documentação': 'antecipacao',
    'antecipação - erro na abertura de conta': 'antecipacao',
    'antecipação - erro na finalização': 'antecipacao',
    'antecipação - liquidação': 'antecipacao',
    'antecipação - negativa': 'antecipacao',
    'antecipação - por que o valor oferecido foi baixo?': 'antecipacao',
    'antecipação - posso contratar com cpf irregular?': 'antecipacao',
    'antecipação - quitação antecipada': 'antecipacao',
    'antecipação - validação de documento': 'antecipacao',
    'antecipação - valores': 'antecipacao',
    'antecipação contratação': 'antecipacao',
    'antecipação critérios': 'antecipacao',
    'como são calculados os juros cobrados na antecipação da restituição?': 'antecipacao',
    'divergência em valores de antecipação': 'antecipacao',
    'indisponibilidade de antecipação': 'antecipacao',
    'métodos de pagamento da antecipação': 'antecipacao',
    'quais são as taxas de antecipação?': 'antecipacao',
    
    // CRÉDITO DO TRABALHADOR
    'crédito do trabalhador': 'credito_trabalhador',
    'crédito do trabalhador - contratação': 'credito_trabalhador',
    'crédito do trabalhador - como é descontado?': 'credito_trabalhador',
    'crédito do trabalhador - como é feito o desconto das parcelas?': 'credito_trabalhador',
    'crédito do trabalhador - como funciona': 'credito_trabalhador',
    'crédito do trabalhador - como quitar': 'credito_trabalhador',
    'crédito do trabalhador - liberação do valor': 'credito_trabalhador',
    'crédito do trabalhador - limite de idade': 'credito_trabalhador',
    'crédito do trabalhador - limite de margem': 'credito_trabalhador',
    'crédito do trabalhador - o que acontece se eu for demitido?': 'credito_trabalhador',
    'crédito do trabalhador - parcelas': 'credito_trabalhador',
    'crédito do trabalhador - posso cancelar o empréstimo?': 'credito_trabalhador',
    'crédito do trabalhador - posso usar o fgts como garantia?': 'credito_trabalhador',
    'crédito do trabalhador - prazo para cancelamento': 'credito_trabalhador',
    'crédito do trabalhador - qual a margem consignável?': 'credito_trabalhador',
    'crédito do trabalhador - qual o prazo para pagamento?': 'credito_trabalhador',
    'crédito do trabalhador - quando é o desconto': 'credito_trabalhador',
    'crédito do trabalhador - quanto tempo leva para o dinheiro cair na conta?': 'credito_trabalhador',
    'crédito do trabalhador - quem pode solicitar': 'credito_trabalhador',
    
    // CRÉDITO PESSOAL
    'crédito pessoal': 'credito_pessoal',
    'crédito pessoal - como contratar': 'credito_pessoal',
    'crédito pessoal - como é feito o pagamento das parcelas?': 'credito_pessoal',
    'crédito pessoal - como quitar': 'credito_pessoal',
    'crédito pessoal - crédito após aprovação': 'credito_pessoal',
    'crédito pessoal - critérios': 'credito_pessoal',
    'crédito pessoal - empresa de conexão': 'credito_pessoal',
    'crédito pessoal - fiz uma simulação e não consigo mais contratar, o que houve?': 'credito_pessoal',
    'crédito pessoal - limite de idade': 'credito_pessoal',
    'crédito pessoal - o consentimento do open finance é obrigatório?': 'credito_pessoal',
    'crédito pessoal - o dinheiro pode cair em uma conta diferente da que usei no open finance?': 'credito_pessoal',
    'crédito pessoal - o que acontece se eu atrasar o pagamento?': 'credito_pessoal',
    'crédito pessoal - o seguro prestamista é obrigatório?': 'credito_pessoal',
    'crédito pessoal - posso alterar a data de vencimento da parcela?': 'credito_pessoal',
    'crédito pessoal - posso contratar se estiver negativado?': 'credito_pessoal',
    'crédito pessoal - posso contratar tendo outros produtos?': 'credito_pessoal',
    'crédito pessoal - posso pagar com cartão de crédito?': 'credito_pessoal',
    'crédito pessoal - preciso de garantia para contratar?': 'credito_pessoal',
    'crédito pessoal - quais bancos são aceitos para a análise?': 'credito_pessoal',
    'crédito pessoal - quais documentos são necessários para contratação?': 'credito_pessoal',
    'crédito pessoal - quais são as taxas de juros?': 'credito_pessoal',
    'crédito pessoal - qual a validade da proposta após a aprovação?': 'credito_pessoal',
    'crédito pessoal - qual o prazo para pagar?': 'credito_pessoal',
    'crédito pessoal - qual o valor mínimo e máximo que posso solicitar?': 'credito_pessoal',
    'crédito pessoal - quanto tempo demora para receber o dinheiro?': 'credito_pessoal',
    'crédito pessoal - resultado negativo': 'credito_pessoal',
    'crédito pessoal - se eu quitar antes, tenho desconto?': 'credito_pessoal',
    'crédito pessoal - tempo de análise': 'credito_pessoal',
    'empréstimo pessoal - erros': 'credito_pessoal',
    
    // DECLARAÇÃO DE IMPOSTO DE RENDA (IRPF)
    'declaração de imposto de renda (irpf)': 'irpf',
    'acompanhamento de malha fina': 'irpf',
    'declaração/irpf - 31/10/2025': 'irpf',
    'declaração/irpf - como consultar pendências': 'irpf',
    'declaração/irpf - erro no plano irpf plus': 'irpf',
    'declaração/irpf - malha fina': 'irpf',
    'declaração/irpf - numero de lotes': 'irpf',
    'declaração/irpf - omisso': 'irpf',
    'declaração/irpf - retificar': 'irpf',
    'declaração/irpf - taxa de acompanhamento': 'irpf',
    'declaração/irpf - cancelamento': 'irpf',
    'erro no envio de declaração': 'irpf',
    'imposto de renda?': 'irpf',
    'recibo de declaração': 'irpf',
    'status de declaração': 'irpf',
    'valor de entrega da declaração': 'irpf',
    
    // RESTITUIÇÃO DO IRPF
    'restituição do irpf': 'restituicao',
    'resgate de restituição': 'restituicao',
    'restituição - banco do brasil': 'restituicao',
    'restituição - como trocar conta para recebimento de restituição': 'restituicao',
    'restituição - consulta': 'restituicao',
    'restituição - data dos lotes': 'restituicao',
    'restituição - em fila': 'restituicao',
    'restituição - não creditada': 'restituicao',
    'restituição - não está no lote': 'restituicao',
    'restituição - no lote': 'restituicao',
    'restituição - retida': 'restituicao',
    'terceiro lote !!!': 'restituicao',
    
    // VELOPRIME E INVESTIMENTOS
    'veloprime e investimentos': 'veloprime',
    'veloprime - ações no exterior': 'veloprime',
    'veloprime - bolsa de valores (b3)': 'veloprime',
    'veloprime - cancelamento': 'veloprime',
    'veloprime - como cancelar a recorrência': 'veloprime',
    'veloprime - darf exterior': 'veloprime',
    'veloprime - escalar para n2': 'veloprime',
    'veloprime - fundos imobiliários (fiis)': 'veloprime',
    'veloprime - gratuito': 'veloprime',
    'veloprime - não reconhece a cobrança': 'veloprime',
    'veloprime - opções': 'veloprime',
    'veloprime - o que é velopro': 'veloprime',
    'veloprime - pagamento': 'veloprime',
    'veloprime - planos': 'veloprime',
    'veloprime - tributação apostas': 'veloprime',
    'o veloprime é do velotax?': 'veloprime',
    'o que são ativos no exterior?': 'veloprime',
    'para que serve a calculadora de investimentos?': 'veloprime',
    'possuímos integração com a b3?': 'veloprime',
    'relatório de investimentos no exterior': 'veloprime',
    'trabalhamos com mercado forex?': 'veloprime',
    'quais corretoras parceiras a veloprime possui?': 'veloprime',
    'ainda temos parceria com a xp?': 'veloprime',
    
    // CONCEITOS DE INVESTIMENTOS
    'conceitos de investimentos': 'investimentos',
    'o que é renda fixa?': 'investimentos',
    'o que é renda variável?': 'investimentos',
    'o que é lci?': 'investimentos',
    'o que é lca?': 'investimentos',
    'o que é cdb?': 'investimentos',
    'o que é tesouro direto?': 'investimentos',
    'o que é tesouro selic?': 'investimentos',
    'o que é tesouro ipca+?': 'investimentos',
    'o que é tesouro prefixado?': 'investimentos',
    'qual a diferença prática entre cdb, lci e lca?': 'investimentos',
    'qual a diferença entre tesouro selic, prefixado e ipca?': 'investimentos',
    'o que são fundos de investimento?': 'investimentos',
    'como funciona a tributação em fundos de longo prazo?': 'investimentos',
    'multimercados realmente diversificam, ou só replicam bolsa e juros?': 'investimentos',
    'o que é um etf?': 'investimentos',
    'como funciona a tributação para etfs de bolsa americana comprados aqui?': 'investimentos',
    'operação em bolsa com prejuízo compensam automaticamente no ir?': 'investimentos',
    'o que acontece se eu esquecer de declarar uma aplicação pequena?': 'investimentos',
    'o que é liquidez?': 'investimentos',
    'o que é diversificação?': 'investimentos',
    'o que significa perfil de investidor?': 'investimentos',
    'o que é reserva de emergência?': 'investimentos',
    'como funciona a inflação nos investimentos?': 'investimentos',
    'o que são juros compostos?': 'investimentos',
    'qual a diferença entre curto, médio e longo prazo?': 'investimentos',
    'o que é cdi?': 'investimentos',
    'qual a diferença entre selic e cdi?': 'investimentos',
    'o que é ibovespa?': 'investimentos',
    'o que é um fii?': 'investimentos',
    'o que é alocação de ativos?': 'investimentos',
    'o que são dividendos ou proventos?': 'investimentos',
    'o que é day trade?': 'investimentos',
    'o que é swing trade?': 'investimentos',
    'o que é buy and hold?': 'investimentos',
    'o que é carteira recomendada?': 'investimentos',
    'o que é mercado futuro?': 'investimentos',
    'o que é mercado primário e secundário?': 'investimentos',
    'o que é ipo?': 'investimentos',
    'o que é debênture?': 'investimentos',
    'o que é private equity?': 'investimentos',
    'o que é câmbio?': 'investimentos',
    'o que é hedge?': 'investimentos',
    'o que é índice s&p 500?': 'investimentos',
    'o que é benchmark?': 'investimentos',
    'o que é taxa de administração?': 'investimentos',
    'o que é taxa de performance?': 'investimentos',
    'o que é custódia?': 'investimentos',
    'o que é home broker?': 'investimentos',
    'o que é taxa selic?': 'investimentos',
    'o que é mercado de capitais?': 'investimentos',
    'o que é volatilidade?': 'investimentos',
    'o que é liquidez diária?': 'investimentos',
    'o que é patrimônio líquido de um fundo?': 'investimentos',
    'o que é rentabilidade nominal e real?': 'investimentos',
    'o que é correlação entre ativos?': 'investimentos',
    'o que é capitalização?': 'investimentos',
    'o que é duration em renda fixa?': 'investimentos',
    'o que é margem de garantia?': 'investimentos',
    'o que é spread bancário?': 'investimentos',
    'o que é governança corporativa?': 'investimentos',
    'o que são informes de rendimento?': 'investimentos',
    'o que é uma corretora?': 'investimentos',
    'o que são relatórios anuais e auxiliares?': 'investimentos',
    'o que é custo de compra e venda?': 'investimentos',
    'o que são prejuízos a compensar?': 'investimentos',
    'como declarar doações e herança?': 'investimentos',
    'o que é subscrição e incorporação?': 'investimentos',
    'o que é ipca?': 'investimentos',
    
    // PAGAMENTOS E COBRANÇAS
    'pagamentos e cobranças (darf, pix, etc.)': 'pagamentos',
    'ccb - cédula de crédito bancário o que é?': 'pagamentos',
    'ccb clausulas': 'pagamentos',
    'cobrança duplicada': 'pagamentos',
    'cobrança indevida em plano gratuito': 'pagamentos',
    'divergência em cobrança': 'pagamentos',
    'o que é darf?': 'pagamentos',
    'pagamento de darf': 'pagamentos',
    'quando é necessário emitir o darf?': 'pagamentos',
    'posso calcular darf de anos anteriores?': 'pagamentos',
    'pix - cadastro na celcoin': 'pagamentos',
    'pix - como fazer portabilidade': 'pagamentos',
    'pix - envio por engano': 'pagamentos',
    'pix - limite': 'pagamentos',
    'pix - o cliente se compromete a manter a chave pix cpf vinculada até a quitação?': 'pagamentos',
    'pix - retirada com dívida em aberto': 'pagamentos',
    'problemas com pix na caixa': 'pagamentos',
    
    // SUPORTE E ATENDIMENTO
    'suporte e atendimento ao cliente': 'suporte',
    'agradecimentos': 'suporte',
    'ausência de ativo': 'suporte',
    'boas vindas': 'suporte',
    'como escalar para casos especiais': 'suporte',
    'como limpar o cachê ou os dados': 'suporte',
    'código de defesa do consumidor': 'suporte',
    'e se o cliente entrar em atrito?': 'suporte',
    'e se o cliente entrou em chargedback?': 'suporte',
    'e-mail da procuração, e-mail da procuração': 'suporte',
    'encerramento positivo': 'suporte',
    'erro no aplicativo': 'suporte',
    'estorno negado': 'suporte',
    'ferramentas do gov.br': 'suporte',
    'frases de apoio e encerramento': 'suporte',
    'indicação e promoções': 'suporte',
    'número de contato velotax': 'suporte',
    'o que é a octadesk?': 'suporte',
    'onde vejo se o cliente está devendo?': 'suporte',
    
    // TÓPICOS GERAIS E OUTROS
    'tópicos gerais e outros': 'geral',
    'app - cobrança exibida': 'app_tecnico',
    'app - consulta de contrato': 'app_tecnico',
    'app - falha na contratação': 'app_tecnico',
    'app - o que fazer em caso de erro ou instabilidade?': 'app_tecnico',
    'app - problemas de login': 'app_tecnico',
    'desconto proporcional': 'geral',
    'dinheiro de bet': 'geral',
    'htmltest': 'geral',
    'validação de selfie e documento': 'documentacao'
};

// Mapeamento de subcategorias específicas
const mapeamentoSubcategorias = {
    'contas_cadastros': {
        'abertura': 'abertura_conta',
        'alteração': 'alteracao_dados',
        'bloqueio': 'bloqueio_conta',
        'cancelamento': 'cancelamento_conta',
        'reativação': 'reativacao_conta'
    },
    'antecipacao': {
        'contratação': 'contratacao',
        'pagamento': 'pagamento',
        'juros': 'juros_taxas',
        'bloqueio': 'bloqueio_conta',
        'quitação': 'quitacao',
        'validação': 'validacao_documentos',
        'erro': 'erros_gerais'
    },
    'credito_trabalhador': {
        'contratação': 'contratacao',
        'desconto': 'desconto_folha',
        'pagamento': 'pagamento',
        'cancelamento': 'cancelamento',
        'critérios': 'criterios_elegibilidade'
    },
    'credito_pessoal': {
        'contratação': 'contratacao',
        'pagamento': 'pagamento',
        'erro': 'erros_gerais',
        'critérios': 'criterios_elegibilidade',
        'documentação': 'documentacao_necessaria'
    },
    'irpf': {
        'declaração': 'declaracao',
        'malha fina': 'malha_fina',
        'pendências': 'pendencias',
        'retificação': 'retificacao',
        'cancelamento': 'cancelamento'
    },
    'restituicao': {
        'consulta': 'consulta_status',
        'lotes': 'lotes_restituicao',
        'banco': 'banco_recebimento',
        'troca conta': 'troca_conta'
    },
    'veloprime': {
        'contratação': 'contratacao',
        'investimentos': 'investimentos',
        'pagamento': 'pagamento',
        'cancelamento': 'cancelamento',
        'darf': 'darf_exterior'
    },
    'investimentos': {
        'conceitos': 'conceitos_basicos',
        'renda fixa': 'renda_fixa',
        'renda variável': 'renda_variavel',
        'fundos': 'fundos_investimento',
        'tributação': 'tributacao'
    },
    'pagamentos': {
        'pix': 'pix',
        'darf': 'darf',
        'ccb': 'ccb',
        'cobrança': 'cobranca',
        'divergência': 'divergencia_valores'
    },
    'suporte': {
        'atendimento': 'atendimento_cliente',
        'escalação': 'escalacao_casos',
        'ferramentas': 'ferramentas_governo',
        'contato': 'contato_velotax'
    },
    'app_tecnico': {
        'erro': 'erros_gerais',
        'login': 'problemas_login',
        'navegação': 'navegacao',
        'atualização': 'atualizacao_dados'
    },
    'documentacao': {
        'validação': 'validacao_identidade',
        'selfie': 'validacao_selfie',
        'documentos': 'documentos_necessarios'
    }
};
// Função para detectar categoria ultra-específica
function detectarCategoriaUltraEspecifica(title) {
    const tituloLower = title.toLowerCase().trim();
    
    // Busca exata primeiro
    if (mapeamentoTopicos[tituloLower]) {
        return mapeamentoTopicos[tituloLower];
    }
    
    // Busca por palavras-chave específicas
    for (const [topico, categoria] of Object.entries(mapeamentoTopicos)) {
        if (tituloLower.includes(topico) || topico.includes(tituloLower)) {
            return categoria;
        }
    }
    
    // Busca por palavras-chave gerais
    if (tituloLower.includes('antecipação')) return 'antecipacao';
    if (tituloLower.includes('crédito do trabalhador')) return 'credito_trabalhador';
    if (tituloLower.includes('crédito pessoal')) return 'credito_pessoal';
    if (tituloLower.includes('irpf') || tituloLower.includes('imposto de renda')) return 'irpf';
    if (tituloLower.includes('restituição')) return 'restituicao';
    if (tituloLower.includes('veloprime')) return 'veloprime';
    if (tituloLower.includes('investimento')) return 'investimentos';
    if (tituloLower.includes('pix') || tituloLower.includes('darf')) return 'pagamentos';
    if (tituloLower.includes('app -')) return 'app_tecnico';
    if (tituloLower.includes('conta') && tituloLower.includes('celcoin')) return 'contas_cadastros';
    if (tituloLower.includes('suporte') || tituloLower.includes('atendimento')) return 'suporte';
    
    return 'geral';
}

// Função para detectar subcategoria ultra-específica
function detectarSubcategoriaUltraEspecifica(title, categoria) {
    const tituloLower = title.toLowerCase();
    const subcategorias = mapeamentoSubcategorias[categoria] || {};
    
    for (const [palavra, subcategoria] of Object.entries(subcategorias)) {
        if (tituloLower.includes(palavra)) {
            return subcategoria;
        }
    }
    
    return 'geral';
}

// Função para extrair tags ultra-específicas
function extrairTagsUltraEspecificas(title, content) {
    const texto = `${title} ${content}`.toLowerCase();
    const tags = [];
    
    // Tags por produto/serviço
    if (texto.includes('celcoin')) tags.push('celcoin');
    if (texto.includes('antecipação')) tags.push('antecipação');
    if (texto.includes('crédito do trabalhador')) tags.push('crédito-trabalhador');
    if (texto.includes('crédito pessoal')) tags.push('crédito-pessoal');
    if (texto.includes('irpf') || texto.includes('imposto de renda')) tags.push('irpf');
    if (texto.includes('restituição')) tags.push('restituição');
    if (texto.includes('veloprime')) tags.push('veloprime');
    if (texto.includes('investimento')) tags.push('investimentos');
    if (texto.includes('pix')) tags.push('pix');
    if (texto.includes('darf')) tags.push('darf');
    if (texto.includes('ccb')) tags.push('ccb');
    
    // Tags por tipo de operação
    if (texto.includes('abrir') || texto.includes('abertura')) tags.push('abertura');
    if (texto.includes('alterar') || texto.includes('alteração')) tags.push('alteração');
    if (texto.includes('contratar') || texto.includes('contratação')) tags.push('contratação');
    if (texto.includes('pagar') || texto.includes('pagamento')) tags.push('pagamento');
    if (texto.includes('quitar') || texto.includes('quitação')) tags.push('quitação');
    if (texto.includes('cancelar') || texto.includes('cancelamento')) tags.push('cancelamento');
    if (texto.includes('consultar') || texto.includes('consulta')) tags.push('consulta');
    if (texto.includes('retificar') || texto.includes('retificação')) tags.push('retificação');
    
    // Tags por tipo de problema
    if (texto.includes('erro')) tags.push('erro');
    if (texto.includes('bloqueio')) tags.push('bloqueio');
    if (texto.includes('problema')) tags.push('problema');
    if (texto.includes('não funciona')) tags.push('não-funciona');
    if (texto.includes('urgente')) tags.push('urgente');
    if (texto.includes('divergência')) tags.push('divergência');
    if (texto.includes('cobrança')) tags.push('cobrança');
    
    // Tags por documento/validação
    if (texto.includes('documento')) tags.push('documento');
    if (texto.includes('selfie')) tags.push('selfie');
    if (texto.includes('termos')) tags.push('termos');
    if (texto.includes('contrato')) tags.push('contrato');
    if (texto.includes('validação')) tags.push('validação');
    if (texto.includes('procuração')) tags.push('procuração');
    
    // Tags por processo específico
    if (texto.includes('malha fina')) tags.push('malha-fina');
    if (texto.includes('lote')) tags.push('lote');
    if (texto.includes('banco do brasil')) tags.push('banco-brasil');
    if (texto.includes('receita federal')) tags.push('receita-federal');
    if (texto.includes('open finance')) tags.push('open-finance');
    if (texto.includes('fgts')) tags.push('fgts');
    if (texto.includes('consignado')) tags.push('consignado');
    
    return [...new Set(tags)]; // Remove duplicatas
}

// Função para gerar perguntas frequentes ultra-específicas
function gerarPerguntasFrequentesUltraEspecificas(item) {
    const perguntas = [];
    const titulo = item.title.toLowerCase();
    
    // Pergunta baseada no título
    const perguntaBase = item.title.replace(/^[A-Z]/, (match) => match.toLowerCase());
    perguntas.push({
        pergunta: perguntaBase,
        variacoes: [
            item.title,
            perguntaBase.replace('?', ''),
            `Como ${perguntaBase.toLowerCase()}`,
            `Preciso ${perguntaBase.toLowerCase()}`,
            `Problema com ${perguntaBase.toLowerCase()}`
        ],
        resposta_curta: item.content.split('.')[0] + '.',
        resposta_completa: item.content
    });
    
    // Perguntas específicas por produto
    if (titulo.includes('antecipação')) {
        perguntas.push({
            pergunta: "Como fazer antecipação da restituição?",
            variacoes: [
                "Quero antecipar restituição",
                "Como antecipar IR",
                "Antecipação PIX",
                "Problema na antecipação"
            ],
            resposta_curta: item.content.split('.')[0] + '.',
            resposta_completa: item.content
        });
    }
    
    if (titulo.includes('crédito do trabalhador')) {
        perguntas.push({
            pergunta: "Como contratar crédito do trabalhador?",
            variacoes: [
                "Quero crédito do trabalhador",
                "Como funciona crédito consignado",
                "Crédito no salário",
                "Problema com crédito trabalhador"
            ],
            resposta_curta: item.content.split('.')[0] + '.',
            resposta_completa: item.content
        });
    }
    
    if (titulo.includes('crédito pessoal')) {
        perguntas.push({
            pergunta: "Como contratar crédito pessoal?",
            variacoes: [
                "Quero crédito pessoal",
                "Como fazer empréstimo pessoal",
                "Crédito pessoal Velotax",
                "Problema com crédito pessoal"
            ],
            resposta_curta: item.content.split('.')[0] + '.',
            resposta_completa: item.content
        });
    }
    
    if (titulo.includes('veloprime')) {
        perguntas.push({
            pergunta: "Como contratar VeloPrime?",
            variacoes: [
                "Quero VeloPrime",
                "Como investir com Velotax",
                "VeloPrime investimentos",
                "Problema com VeloPrime"
            ],
            resposta_curta: item.content.split('.')[0] + '.',
            resposta_completa: item.content
        });
    }
    
    if (titulo.includes('irpf') || titulo.includes('imposto de renda')) {
        perguntas.push({
            pergunta: "Como declarar Imposto de Renda?",
            variacoes: [
                "Quero declarar IR",
                "Como fazer declaração",
                "Declaração IRPF",
                "Problema na declaração"
            ],
            resposta_curta: item.content.split('.')[0] + '.',
            resposta_completa: item.content
        });
    }
    
    return perguntas.slice(0, 3); // Máximo 3 perguntas por item
}

// Função para gerar contexto ultra-específico
function gerarContextoUltraEspecifico(item) {
    const titulo = item.title.toLowerCase();
    
    if (titulo.includes('abertura de conta celcoin')) {
        return 'O cliente quer abrir uma conta na Celcoin';
    }
    if (titulo.includes('antecipação')) {
        return 'O cliente quer fazer antecipação da restituição do IR';
    }
    if (titulo.includes('crédito do trabalhador')) {
        return 'O cliente quer contratar crédito do trabalhador (consignado)';
    }
    if (titulo.includes('crédito pessoal')) {
        return 'O cliente quer contratar crédito pessoal';
    }
    if (titulo.includes('veloprime')) {
        return 'O cliente quer contratar VeloPrime para investimentos';
    }
    if (titulo.includes('irpf') || titulo.includes('imposto de renda')) {
        return 'O cliente precisa de ajuda com declaração de IR';
    }
    if (titulo.includes('restituição')) {
        return 'O cliente quer consultar ou receber restituição do IR';
    }
    if (titulo.includes('pix')) {
        return 'O cliente tem problema com PIX';
    }
    if (titulo.includes('darf')) {
        return 'O cliente precisa de ajuda com DARF';
    }
    if (titulo.includes('app -')) {
        return 'O cliente tem problema no aplicativo';
    }
    if (titulo.includes('bloqueio')) {
        return 'O cliente está com conta bloqueada';
    }
    if (titulo.includes('erro')) {
        return 'O cliente está com erro no sistema';
    }
    
    return 'O cliente precisa de orientação';
}

// Função para gerar ações necessárias ultra-específicas
function gerarAcoesUltraEspecificas(item) {
    const acoes = [];
    const titulo = item.title.toLowerCase();
    const conteudo = item.content.toLowerCase();
    
    // Ações por produto específico
    if (titulo.includes('abertura de conta celcoin')) {
        acoes.push('Verificar documentação enviada');
        acoes.push('Confirmar aceite dos termos');
        acoes.push('Explicar processo de abertura');
        acoes.push('Orientar sobre contratação de antecipação');
    }
    
    if (titulo.includes('antecipação')) {
        acoes.push('Verificar chave PIX CPF');
        acoes.push('Explicar regras da Receita Federal');
        acoes.push('Orientar sobre processo de antecipação');
        acoes.push('Verificar elegibilidade do cliente');
    }
    
    if (titulo.includes('crédito do trabalhador')) {
        acoes.push('Verificar elegibilidade do cliente');
        acoes.push('Explicar critérios de margem consignável');
        acoes.push('Orientar sobre desconto em folha');
        acoes.push('Verificar documentação necessária');
    }
    
    if (titulo.includes('crédito pessoal')) {
        acoes.push('Verificar elegibilidade do cliente');
        acoes.push('Explicar critérios de aprovação');
        acoes.push('Orientar sobre Open Finance');
        acoes.push('Verificar documentação necessária');
    }
    
    if (titulo.includes('veloprime')) {
        acoes.push('Explicar planos disponíveis');
        acoes.push('Orientar sobre investimentos');
        acoes.push('Verificar elegibilidade');
        acoes.push('Explicar tributação');
    }
    
    if (titulo.includes('irpf') || titulo.includes('imposto de renda')) {
        acoes.push('Orientar sobre declaração');
        acoes.push('Explicar prazos');
        acoes.push('Verificar pendências');
        acoes.push('Orientar sobre retificação');
    }
    
    if (titulo.includes('restituição')) {
        acoes.push('Consultar status da restituição');
        acoes.push('Verificar lote');
        acoes.push('Orientar sobre recebimento');
        acoes.push('Verificar conta bancária');
    }
    
    if (titulo.includes('pix')) {
        acoes.push('Verificar chave PIX');
        acoes.push('Orientar sobre tipo de chave');
        acoes.push('Verificar limites');
        acoes.push('Orientar sobre portabilidade');
    }
    
    if (titulo.includes('darf')) {
        acoes.push('Explicar o que é DARF');
        acoes.push('Orientar sobre emissão');
        acoes.push('Verificar valores');
        acoes.push('Orientar sobre pagamento');
    }
    
    if (titulo.includes('app -')) {
        acoes.push('Identificar problema no app');
        acoes.push('Orientar sobre solução');
        acoes.push('Verificar atualizações');
        acoes.push('Escalar se necessário');
    }
    
    // Ações por tipo de problema
    if (titulo.includes('bloqueio') || titulo.includes('erro')) {
        acoes.push('Identificar causa do problema');
        acoes.push('Verificar dados do cliente');
        acoes.push('Orientar sobre solução');
        acoes.push('Escalar se necessário');
    }
    
    if (conteudo.includes('documento') || conteudo.includes('selfie')) {
        acoes.push('Verificar documentos necessários');
        acoes.push('Orientar sobre envio');
        acoes.push('Explicar processo de validação');
    }
    
    return acoes.length > 0 ? acoes : ['Orientar o cliente', 'Verificar informações'];
}

// Função para determinar prioridade ultra-específica
function determinarPrioridadeUltraEspecifica(item) {
    const titulo = item.title.toLowerCase();
    const conteudo = item.content.toLowerCase();
    
    // Prioridade crítica
    if (titulo.includes('bloqueio') || titulo.includes('erro') || conteudo.includes('não funciona')) {
        return 'critica';
    }
    
    // Prioridade alta
    if (titulo.includes('antecipação') || titulo.includes('crédito') || titulo.includes('abertura')) {
        return 'alta';
    }
    
    // Prioridade média
    if (titulo.includes('app -') || titulo.includes('técnico') || titulo.includes('irpf')) {
        return 'media';
    }
    
    // Prioridade baixa
    if (titulo.includes('agradecimento') || titulo.includes('boas vindas')) {
        return 'baixa';
    }
    
    return 'media';
}
function migrarDadosUltraInteligente() {
    try {
        // Lê a base atual
        const baseAtualPath = path.join(__dirname, 'data', 'base.json');
        const baseAtual = JSON.parse(fs.readFileSync(baseAtualPath, 'utf8'));
        
        console.log(`🚀 Migrando ${baseAtual.length} itens da base atual...`);
        console.log('🔍 Detectando tópicos específicos: Abertura de Conta, Antecipação, Crédito do Trabalhador, Crédito Pessoal, VeloPrime, IRPF, etc...');
        
        // Migra cada item
        const baseOtimizada = baseAtual.map((item, index) => {
            const id = `00${index + 1}`.slice(-3);
            
            const categoria = detectarCategoriaUltraEspecifica(item.title);
            const subcategoria = detectarSubcategoriaUltraEspecifica(item.title, categoria);
            
            return {
                id: id,
                title: item.title,
                content: item.content,
                keywords: item.keywords || [],
                sinonimos: item.sinonimos || [],
                tags: extrairTagsUltraEspecificas(item.title, item.content),
                categoria: categoria,
                subcategoria: subcategoria,
                prioridade: determinarPrioridadeUltraEspecifica(item),
                perguntas_frequentes: gerarPerguntasFrequentesUltraEspecificas(item),
                contexto: gerarContextoUltraEspecifico(item),
                acoes_necessarias: gerarAcoesUltraEspecificas(item),
                documentos_necessarios: [],
                tempo_estimado: "5-10 minutos",
                dificuldade: "fácil",
                status: "ativo",
                ultima_atualizacao: new Date().toISOString().split('T')[0],
                versao: "1.0"
            };
        });
        
        // Salva a base otimizada
        const baseOtimizadaPath = path.join(__dirname, 'data', 'base_otimizada.json');
        fs.writeFileSync(baseOtimizadaPath, JSON.stringify(baseOtimizada, null, 2));
        
        console.log('✅ Migração ultra-inteligente concluída!');
        console.log(`📁 Base otimizada salva em: ${baseOtimizadaPath}`);
        console.log(`📊 Total de itens migrados: ${baseOtimizada.length}`);
        
        // Estatísticas detalhadas
        const categorias = {};
        const prioridades = {};
        const assuntos = {};
        
        baseOtimizada.forEach(item => {
            categorias[item.categoria] = (categorias[item.categoria] || 0) + 1;
            prioridades[item.prioridade] = (prioridades[item.prioridade] || 0) + 1;
            
            // Conta assuntos específicos
            item.tags.forEach(tag => {
                assuntos[tag] = (assuntos[tag] || 0) + 1;
            });
        });
        
        console.log('\n📈 Estatísticas por Categoria:');
        Object.entries(categorias).forEach(([cat, count]) => {
            console.log(`  ${cat}: ${count} itens`);
        });
        
        console.log('\n Estatísticas por Prioridade:');
        Object.entries(prioridades).forEach(([pri, count]) => {
            console.log(`  ${pri}: ${count} itens`);
        });
        
        console.log('\n Assuntos mais frequentes:');
        Object.entries(assuntos)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 15)
            .forEach(([assunto, count]) => {
                console.log(`  ${assunto}: ${count} itens`);
            });
        
        return baseOtimizada;
        
    } catch (error) {
        console.error('❌ Erro na migração:', error);
        return null;
    }
}

// Executa a migração
if (require.main === module) {
    migrarDadosUltraInteligente();
}

module.exports = { migrarDadosUltraInteligente };