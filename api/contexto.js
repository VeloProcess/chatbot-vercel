import fs from "fs/promises";
import fetch from "node-fetch";
import { ARQUIVOS_AUTORIZADOS, SITES_AUTORIZADOS } from "./config.js";

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
