// api/base.js
import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    try {
        console.log('=== API BASE - CARREGANDO ===');
        
        // Carrega todos os arquivos otimizados
        const basePath = path.join(process.cwd(), 'data', 'base_otimizada.json');
        const categoriasPath = path.join(process.cwd(), 'data', 'categorias.json');
        const tagsPath = path.join(process.cwd(), 'data', 'tags.json');
        
        const baseData = JSON.parse(fs.readFileSync(basePath, 'utf8'));
        const categorias = JSON.parse(fs.readFileSync(categoriasPath, 'utf8'));
        const tags = JSON.parse(fs.readFileSync(tagsPath, 'utf8'));
        
        console.log(`✅ Base carregada: ${baseData.length} itens`);
        console.log(`✅ Categorias: ${Object.keys(categorias).length}`);
        console.log(`✅ Tags: ${Object.keys(tags.tags_contexto).length}`);
        
        res.status(200).json({
            base: baseData,
            categorias: categorias,
            tags: tags
        });
    } catch (error) {
        console.error('❌ Erro ao carregar base otimizada:', error);
        res.status(500).json({ error: 'Erro ao carregar base de dados' });
    }
}