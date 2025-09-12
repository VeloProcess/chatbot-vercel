export async function tocarAudioElevenLabs(texto) {
    try {
        const response = await fetch("/api/elevenLabs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texto })
        });

        if (!response.ok) throw new Error("Erro ao gerar áudio");

        const audioBlob = await response.blob();
        const audioURL = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioURL);
        audio.play();
    } catch (err) {
        console.error("Erro ElevenLabs:", err);
    }
}