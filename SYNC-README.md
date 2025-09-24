# 🔄 Sistema de Sincronização Automática JSON → MongoDB

Este sistema permite que você atualize um arquivo JSON e ele seja automaticamente sincronizado com o MongoDB.

## 📁 Arquivos Criados

- `api/AskOpenai.js` - Sistema integrado de IA + Sincronização
- `faq-data.json` - Arquivo de dados FAQ
- `sync-config.json` - Configurações do sistema
- `SYNC-README.md` - Este arquivo de documentação

## 🚀 Integração Otimizada

**Sistema integrado no `AskOpenai.js` para economizar serverless functions do Vercel (limite de 12)**

## 🚀 Como Usar

### 1. **Atualizar Dados**
Simplesmente edite o arquivo `faq-data.json` e salve. O sistema detectará a mudança e sincronizará automaticamente.

### 2. **Endpoints Disponíveis**

#### **Sincronização Manual**
```
POST /api/AskOpenai?action=sync
Content-Type: application/json
Body: [array de dados FAQ]
```

#### **Verificar Status**
```
GET /api/AskOpenai?action=status
```

#### **Limpar Cache**
```
GET /api/AskOpenai?action=clear-cache
```

#### **Forçar Sincronização**
```
GET /api/AskOpenai?action=force-sync
```

#### **Processar Pergunta (Uso Normal)**
```
GET /api/AskOpenai?pergunta=Como funciona o crédito?&email=usuario@velotax.com.br
```

### 3. **Estrutura do Arquivo JSON**

```json
[
  {
    "Pergunta": "O que é DARF?",
    "Resposta": "O que é: Documento de Arrecadação de Receitas Federais, usado para pagamento de impostos federais como IR, CSLL, PIS, COFINS e outros tributos.",
    "Palavras-chave": "darf, O que é, O que é DARF?",
    "Tabulacoes": "Empréstimos > Pessoal > Produtos de Crédito > Critérios",
    "Sinonimos": "imposto darf,pagamento darf,emissao darf"
  }
]
```

### 4. **Campos Obrigatórios**
- `Pergunta` - A pergunta do FAQ
- `Resposta` - A resposta correspondente

### 5. **Campos Opcionais**
- `Palavras-chave` - Palavras-chave para busca
- `Tabulacoes` - Categoria para organização (ex: "Empréstimos > Pessoal > Produtos de Crédito")
- `Sinonimos` - Sinônimos separados por vírgula

## ⚙️ Configurações

### **Configuração MongoDB**
```javascript
// Já configurado no AskOpenai.js
const MONGODB_URI = "mongodb+srv://gabrielaraujo:sGoeqQgbxlsIwnjc@velohubcentral.od7vwts.mongodb.net/";
const DB_NAME = "console_conteudo";
const FAQ_COLLECTION = "Bot_perguntas";
```

### **Variáveis de Ambiente**
```env
OPENAI_API_KEY=sk-...
```

### **Configurações do Sistema**
Edite `sync-config.json` para personalizar:

```json
{
  "sync": {
    "autoSync": true,        // Sincronização automática
    "syncInterval": 30000,   // Intervalo em ms (30s)
    "watchFile": true,       // Monitorar arquivo
    "backupOnSync": true,    // Criar backup
    "validateData": true     // Validar dados
  }
}
```

## 🔄 Como Funciona

### **Fluxo de Sincronização**
1. **Monitoramento** - Sistema monitora o arquivo JSON
2. **Detecção** - Detecta mudanças no arquivo
3. **Validação** - Valida a estrutura dos dados
4. **Backup** - Cria backup dos dados atuais
5. **Sincronização** - Atualiza o MongoDB
6. **Confirmação** - Registra sucesso/erro

### **Sistema de Fallback**
- **Cache Local** - Mantém dados em cache
- **Backup Automático** - Cria backups antes de sincronizar
- **Validação** - Verifica estrutura antes de sincronizar
- **Logs Detalhados** - Registra todas as operações

## 📊 Monitoramento

### **Status da Sincronização**
```json
{
  "lastSync": "2024-01-15T10:30:00Z",
  "fileHash": "abc123...",
  "syncInProgress": false,
  "config": { ... },
  "filePath": "./faq-data.json"
}
```

### **Logs do Sistema**
- ✅ Sincronização concluída
- ⚠️ Arquivo não alterado
- ❌ Erro na sincronização
- 📝 Arquivo alterado detectado
- 💾 Backup criado

## 🛠️ Manutenção

### **Limpar Cache**
```javascript
// No código
const { clearCache } = require('./api/syncJsonToMongo');
clearCache();
```

### **Forçar Sincronização**
```javascript
// No código
const { syncJsonToMongoDB } = require('./api/syncJsonToMongo');
await syncJsonToMongoDB();
```

### **Verificar Conexão MongoDB**
```javascript
// No código
const { connectToMongoDB } = require('./api/syncJsonToMongo');
await connectToMongoDB();
```

## 🚨 Troubleshooting

### **Problemas Comuns**

1. **Arquivo não encontrado**
   - Use `action=create-example` para criar arquivo

2. **Erro de conexão MongoDB**
   - Verifique `MONGODB_URI` nas variáveis de ambiente

3. **Dados inválidos**
   - Verifique estrutura do JSON
   - Use `validateData: true` para validação

4. **Sincronização não funciona**
   - Verifique logs do sistema
   - Use `action=status` para verificar status

### **Logs Importantes**
- `🔄 Iniciando sincronização JSON → MongoDB...`
- `✅ X documentos inseridos`
- `❌ Erro na sincronização: [detalhes]`
- `📝 Arquivo JSON alterado, iniciando sincronização...`

## 🎯 Benefícios

- ✅ **Atualização Instantânea** - Mudanças refletem imediatamente
- ✅ **Backup Automático** - Nunca perde dados
- ✅ **Validação** - Previne erros de estrutura
- ✅ **Monitoramento** - Acompanha todas as operações
- ✅ **Fallback** - Sistema robusto e confiável
- ✅ **Configurável** - Personalize conforme necessário

## 🔗 Integração

Este sistema se integra perfeitamente com:
- `api/AskOpenai.js` - Sistema de IA
- `api/ask.js` - API principal
- MongoDB - Banco de dados
- Vercel - Plataforma de deploy

**Agora você pode atualizar o FAQ simplesmente editando o arquivo JSON!** 🚀
