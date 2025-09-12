import fs from 'fs';
import pdf from 'pdf-parse';

// Lê os PDFs
const pdfBuffer1 = fs.readFileSync('./docs/document1.pdf'); // coloque os PDFs na pasta /docs
const pdfBuffer2 = fs.readFileSync('./docs/document2.pdf');

async function extractText(buffer) {
    const data = await pdf(buffer);
    return data.text;
}

export async function getDocumentChunks(chunkSize = 500) {
    const text1 = await extractText(pdfBuffer1);
    const text2 = await extractText(pdfBuffer2);
    const fullText = text1 + '\n\n' + text2;

    const chunks = [];
    let start = 0;
    while (start < fullText.length) {
        const chunk = fullText.slice(start, start + chunkSize);
        chunks.push(chunk);
        start += chunkSize; // use chunkSize/2 se quiser sobreposição
    }
    return chunks;
}