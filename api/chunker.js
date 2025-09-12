// chunker.js
import fs from "fs/promises";
import path from "path";
import pdf from "pdf-parse";

// Função para ler um PDF e retornar o texto
async function lerPDF(caminho) {
  try {
    const buffer = await fs.readFile(caminho);
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    console.error(`Erro ao ler PDF ${caminho}:`, error.message);
    return "";
  }
}

// Função para dividir texto em chunks
function chunkText(text, size = 500) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + size));
    start += size; // ou size / 2 se quiser sobreposição
  }
  return chunks;
}

// Gera e exporta os chunks no momento em que o arquivo é importado
export async function getDocumentChunks() {
  try {
    const regrasInternas = await lerPDF(path.join(process.cwd(), "data/regras-internas.pdf"));
    const produtos = await lerPDF(path.join(process.cwd(), "data/produtos.pdf"));

    const documentText = regrasInternas + "\n\n" + produtos;
    return chunkText(documentText, 500);
  } catch (error) {
    console.error("Erro ao gerar chunks:", error);
    return [];
  }
}
