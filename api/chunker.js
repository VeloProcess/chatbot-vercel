import fs from "fs/promises";
import path from "path";

let documentChunks = [];

module.exports = { loadDocuments, searchInChunks };

export async function loadDocuments() {
    try {
        const regrasInternas = JSON.parse(await fs.readFile(path.join(process.cwd(), "data/regras-internas.json"), "utf8"));
        const produtos = JSON.parse(await fs.readFile(path.join(process.cwd(), "data/produtos.json"), "utf8"));

        // Combine os textos em um único array de strings (chunks)
        const combinedText = [...regrasInternas, ...produtos].join("\n\n");

        // Cria chunks de 500 caracteres
        const chunkSize = 500;
        let start = 0;
        documentChunks = [];
        while (start < combinedText.length) {
            documentChunks.push(combinedText.slice(start, start + chunkSize));
            start += chunkSize; // ou chunkSize/2 se quiser sobreposição
        }
        console.log("Documentos carregados e chunkados:", documentChunks.length);
    } catch (err) {
        console.error("Erro ao carregar documentos:", err);
    }
}

export function searchInChunks(pergunta) {
    const lowerQuestion = pergunta.toLowerCase();
    return documentChunks.filter(chunk => chunk.toLowerCase().includes(lowerQuestion));
}