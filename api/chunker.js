import fs from "fs/promises";
import path from "path";

export function carregarBase() {
  try {
    // Caminho do JSON
    const jsonPath = path.join(process.cwd(), "data/base.json");
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

    // Concatena todos os valores em um único texto
    const fullText = Object.values(jsonData).join("\n\n");

    // Cria chunks de 500 caracteres (pode ajustar)
    const chunkSize = 500;
    const chunks = [];
    let start = 0;

    while (start < fullText.length) {
      const chunk = fullText.slice(start, start + chunkSize);
      chunks.push(chunk);
      start += chunkSize; // ou chunkSize / 2 para sobreposição
    }

    return { json: jsonData, chunks };
  } catch (err) {
    console.error("Erro ao carregar base.json:", err.message);
    return { json: {}, chunks: [] };
  }
}