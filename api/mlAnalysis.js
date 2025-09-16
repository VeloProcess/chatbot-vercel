// api/mlAnalysis.js (SÓ PARA VOCÊ - NÃO EXPORTA PARA ATENDENTES)
import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    // Proteção: só você pode acessar
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.ML_ANALYSIS_KEY}`) {
        return res.status(401).json({ error: 'Acesso negado' });
    }

    try {
        const analisePath = path.join(process.cwd(), 'data', 'ml_analysis.json');
        
        if (!fs.existsSync(analisePath)) {
            return res.status(404).json({ 
                error: 'Nenhuma análise ML encontrada',
                sugestoes: []
            });
        }

        const analises = JSON.parse(fs.readFileSync(analisePath, 'utf8'));
        
        // Análise ML completa
        const relatorioML = {
            total: analises.length,
            porTipo: {},
            perguntasProblema: {},
            sugestoesFrequentes: {},
            tendencias: {},
            recomendacoes: []
        };

        // Processa análises ML
        analises.forEach(analise => {
            // Conta por tipo
            relatorioML.porTipo[analise.tipo] = (relatorioML.porTipo[analise.tipo] || 0) + 1;
            
            // Conta perguntas problemáticas
            const perguntaKey = analise.question.toLowerCase();
            relatorioML.perguntasProblema[perguntaKey] = (relatorioML.perguntasProblema[perguntaKey] || 0) + 1;
            
            // Conta sugestões
            analise.sugestoes.forEach(sugestao => {
                relatorioML.sugestoesFrequentes[sugestao] = (relatorioML.sugestoesFrequentes[sugestao] || 0) + 1;
            });
        });

        // Top problemas
        relatorioML.topProblemas = Object.entries(relatorioML.porTipo)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        // Top perguntas problemáticas
        relatorioML.topPerguntas = Object.entries(relatorioML.perguntasProblema)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        // Top sugestões
        relatorioML.topSugestoes = Object.entries(relatorioML.sugestoesFrequentes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        // Gera recomendações automáticas
        relatorioML.recomendacoes = gerarRecomendacoesML(relatorioML);

        res.status(200).json(relatorioML);

    } catch (error) {
        console.error('Erro na análise ML:', error);
        res.status(500).json({ 
            error: 'Erro interno na análise ML',
            details: error.message
        });
    }
}

function gerarRecomendacoesML(relatorio) {
    const recomendacoes = [];

    // Se há muitos problemas de "incompleta"
    if (relatorio.porTipo.incompleta > relatorio.total * 0.3) {
        recomendacoes.push({
            prioridade: 'ALTA',
            categoria: 'Conteúdo',
            acao: 'Expandir respostas com mais detalhes',
            impacto: 'Reduzir feedbacks negativos em 40%'
        });
    }

    // Se há muitos problemas de "incorreta"
    if (relatorio.porTipo.incorreta > relatorio.total * 0.2) {
        recomendacoes.push({
            prioridade: 'CRÍTICA',
            categoria: 'Precisão',
            acao: 'Revisar e validar base de dados',
            impacto: 'Melhorar confiabilidade das respostas'
        });
    }

    // Se há muitas perguntas problemáticas
    if (relatorio.topPerguntas.length > 0) {
        recomendacoes.push({
            prioridade: 'MÉDIA',
            categoria: 'Foco',
            acao: `Melhorar respostas para: ${relatorio.topPerguntas[0][0]}`,
            impacto: 'Resolver problema mais frequente'
        });
    }

    return recomendacoes;
}