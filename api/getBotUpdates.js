async function checarAtualizacao() {
    try {
        const response = await fetch('/api/getBotUpdates');
        if (!response.ok) throw new Error('Falha ao buscar atualizações');
        const data = await response.json();
        if (!data.temAtualizacao || !data.ultimaAtualizacao) return;

        const ultimaExibida = localStorage.getItem('ultimaAtualizacaoExibida');
        if (ultimaExibida !== data.ultimaAtualizacao) {
            // Mostrar pop-up
            mostrarPopUpAtualizacao(data.ultimaAtualizacao);
            // Registrar que já exibimos
            localStorage.setItem('ultimaAtualizacaoExibida', data.ultimaAtualizacao);
        }
    } catch (error) {
        console.error('Erro ao verificar atualizações:', error);
    }
}

function mostrarPopUpAtualizacao(texto) {
    const popUp = document.createElement('div');
    popUp.className = 'bot-update-popup';
    popUp.innerHTML = `
        <div class="popup-content">
            <span>${texto}</span>
            <button id="fechar-popup">Fechar</button>
        </div>
    `;
    document.body.appendChild(popUp);
    document.getElementById('fechar-popup').addEventListener('click', () => popUp.remove());
}

// Chamar ao iniciar o bot ou carregar a página
checarAtualizacao();
