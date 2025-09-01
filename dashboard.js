// dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    // Segurança: Protege a página
    const dadosAtendente = JSON.parse(localStorage.getItem('dadosAtendenteChatbot'));
    if (!dadosAtendente || dadosAtendente.funcao !== 'Gestor') {
        alert('Acesso negado. Apenas gestores podem ver esta página.');
        window.location.href = '/index.html'; // Redireciona para a página principal
        return;
    }
    
    // Define os elementos do DOM
    const userActivityList = document.getElementById('user-activity-list');
    const frequentQuestionsList = document.getElementById('frequent-questions-list');
    const feedbackSummary = document.getElementById('feedback-summary');
    const iaQuestionsList = document.getElementById('ia-questions-list');

    // Função para buscar e renderizar os dados
    async function loadDashboardData() {
        try {
            const response = await fetch('/api/getDashboardData');
            if (!response.ok) throw new Error('Falha ao buscar dados da API');
            
            const data = await response.json();

            // Renderiza cada card com os dados recebidos
            renderUserActivity(data.userActivity);
            renderFrequentQuestions(data.frequentQuestions);
            renderFeedbackSummary(data.feedbackSummary);
            renderIaQuestions(data.iaQuestions);

        } catch (error) {
            console.error('Erro ao carregar o dashboard:', error);
            document.querySelector('.dashboard-grid').innerHTML = '<p>Não foi possível carregar os dados do dashboard.</p>';
        }
    }

    // Funções de renderização
    function renderUserActivity(activity) {
        userActivityList.innerHTML = '<ul>' +
            Object.entries(activity).map(([email, data]) => 
                `<li><strong>${email}:</strong> ${data.status === 'online' ? 'Online 🟢' : 'Offline 🔴'} (visto em: ${new Date(data.lastTimestamp).toLocaleString('pt-BR')})</li>`
            ).join('') + '</ul>';
    }

    function renderFrequentQuestions(questions) {
        frequentQuestionsList.innerHTML = questions.map(q => 
            `<li>${q.question} <strong>(${q.count} vezes)</strong></li>`
        ).join('');
    }

    function renderFeedbackSummary(summary) {
        const total = summary.positive + summary.negative;
        const positivePercentage = total > 0 ? ((summary.positive / total) * 100).toFixed(1) : 0;
        feedbackSummary.innerHTML = `
            <p><strong>Positivos:</strong> ${summary.positive} 👍</p>
            <p><strong>Negativos:</strong> ${summary.negative} 👎</p>
            <p><strong>Taxa de Aprovação:</strong> ${positivePercentage}%</p>
        `;
    }

    function renderIaQuestions(questions) {
        iaQuestionsList.innerHTML = questions.map(q => 
            `<li><em>"${q.question}"</em> (por: ${q.email})</li>`
        ).join('');
    }

    // Carrega os dados ao iniciar a página
    loadDashboardData();
});