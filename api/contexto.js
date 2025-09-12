import fs from "fs/promises";
import fetch from "node-fetch";
import { ARQUIVOS_AUTORIZADOS, SITES_AUTORIZADOS } from "./config.js";
import { extractTextFromPDF } from './extractPDF.js';
import { splitTextIntoChunks } from './chunker.js';


export async function prepararContexto() {
    let contexto = "";

    // Ler arquivos autorizados
    for (const arquivo of ARQUIVOS_AUTORIZADOS) {
        try {
            const conteudo = await fs.readFile(arquivo, "utf-8");
            contexto += `\nConteúdo do arquivo ${arquivo}: ${conteudo}`;
        } catch (err) {
            console.error("Erro ao ler arquivo:", arquivo, err);
        }
    }

let documentChunks = [];

async function loadDocuments() {
    const pdf1 = await extractTextFromPDF('./docs/document1.pdf');
    const pdf2 = await extractTextFromPDF('./docs/document2.pdf');

    documentChunks = [
        ...splitTextIntoChunks(pdf1, 500),
        ...splitTextIntoChunks(pdf2, 500),
    ];
}

await loadDocuments(); // garante que os chunks estão carregado
    // Buscar sites autorizados
    for (const site of SITES_AUTORIZADOS) {
        try {
            const res = await fetch(site);
            if (res.ok) {
                const texto = await res.text();
                contexto += `\nConteúdo do site ${site}: ${texto}`;
            }
        } catch (err) {
            console.error("Erro ao acessar site:", site, err);
        }
    }

    return contexto || "Nenhum contexto disponível";
}
