// testar-api.js
import fs from 'fs';
import path from 'path';

console.log('=== TESTANDO CARREGAMENTO DA BASE ===');

try {
    // Testa base_otimizada.json
    const baseOtimizadaPath = path.join(process.cwd(), 'data', 'base_otimizada.json');
    if (fs.existsSync(baseOtimizadaPath)) {
        console.log('✅ base_otimizada.json existe');
        const data = JSON.parse(fs.readFileSync(baseOtimizadaPath, 'utf8'));
        console.log('Total de itens:', data.length);
        console.log('Primeiro item:', data[0]);
    } else {
        console.log('❌ base_otimizada.json não existe');
    }
    
    // Testa base.json
    const basePath = path.join(process.cwd(), 'data', 'base.json');
    if (fs.existsSync(basePath)) {
        console.log('✅ base.json existe');
        const data = JSON.parse(fs.readFileSync(basePath, 'utf8'));
        console.log('Total de itens:', data.length);
        console.log('Primeiro item:', data[0]);
    } else {
        console.log('❌ base.json não existe');
    }
    
} catch (error) {
    console.error('❌ Erro:', error);
}