document.addEventListener('DOMContentLoaded', () => {
    const btnAllow = document.getElementById('btnAllow');
    const statusMsg = document.getElementById('status');

    btnAllow.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Para as trilhas de áudio após obter permissão
            stream.getTracks().forEach(track => track.stop());
            
            // Esconde botão e mostra sucesso
            btnAllow.style.display = 'none';
            statusMsg.style.display = 'block';
        } catch (err) {
            console.error(err);
            alert("A permissão foi negada. Por favor, clique no ícone de cadeado/microfone na barra de endereços (lá em cima) e permita o acesso ao microfone.");
        }
    });
});
