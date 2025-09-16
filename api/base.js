// api/base.js
import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    try {
        console.log('=== API BASE - INICIANDO ===');
        
        // Tenta carregar base_otimizada.json primeiro
        let basePath = path.join(process.cwd(), 'data', 'base_otimizada.json');
        let baseData = null;
        let categorias = {};
        let tags = {};
        
        console.log('Tentando carregar base_otimizada.json...');
        
        if (fs.existsSync(basePath)) {
            console.log('✅ base_otimizada.json encontrado');
            baseData = JSON.parse(fs.readFileSync(basePath, 'utf8'));
            console.log('Total de itens na base otimizada:', baseData.length);
        } else {
            console.log('❌ base_otimizada.json não encontrado, carregando base.json...');
            // Fallback para base.json
            basePath = path.join(process.cwd(), 'data', 'base.json');
            if (fs.existsSync(basePath)) {
                baseData = JSON.parse(fs.readFileSync(basePath, 'utf8'));
                console.log('Total de itens na base original:', baseData.length);
            } else {
                console.log('❌ base.json também não encontrado');
                return res.status(404).json({ 
                    error: 'Arquivo de base de dados não encontrado',
                    details: 'Nem base_otimizada.json nem base.json foram encontrados'
                });
            }
        }
        
        // Tenta carregar categorias.json
        const categoriasPath = path.join(process.cwd(), 'data', 'categorias.json');
        if (fs.existsSync(categoriasPath)) {
            console.log('✅ categorias.json encontrado');
            categorias = JSON.parse(fs.readFileSync(categoriasPath, 'utf8'));
        } else {
            console.log('⚠️ categorias.json não encontrado, usando objeto vazio');
        }
        
        // Tenta carregar tags.json
        const tagsPath = path.join(process.cwd(), 'data', 'tags.json');
        if (fs.existsSync(tagsPath)) {
            console.log('✅ tags.json encontrado');
            tags = JSON.parse(fs.readFileSync(tagsPath, 'utf8'));
        } else {
            console.log('⚠️ tags.json não encontrado, usando objeto vazio');
        }
        
        console.log('=== API BASE - SUCESSO ===');
        console.log('Enviando resposta com', baseData.length, 'itens');
        
        res.status(200).json({
            base: baseData,
            categorias: categorias,
            tags: tags
        });
        
    } catch (error) {
        console.error('❌ Erro na API base:', error);
        console.error('Stack trace:', error.stack);
        
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}