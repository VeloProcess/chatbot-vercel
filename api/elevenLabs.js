import fetch from "node-fetch";

export default async function handler(req, res) {
    try {
        const { audioBase64 } = req.body; // áudio enviado do frontend (base64)
        if (!audioBase64) return res.status(400).json({ error: "Áudio não fornecido" });

        const response = await fetch("https://api.elevenlabs.io/agent11/respond-audio", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "xi-api-key": process.env.ELEVENLABS_API_KEY
            },
            body: JSON.stringify({ audio: audioBase64 })
        });

        const data = await response.json();

        res.status(200).json({
            respostaTexto: data.text,
            respostaAudioUrl: data.audioUrl // URL do áudio gerado
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao chamar ElevenLabs Agent11" });
    }
}