# 🚀 Servidor Local - Porta 3000

## ✅ Servidor Configurado

O servidor Express foi configurado para rodar na porta 3000.

## 📋 Como Usar

### Iniciar o Servidor

```bash
npm start
```

ou

```bash
node server-local.js
```

### Acessar o Sistema

- **Interface Web**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## 🔧 Configuração

### Porta
- **Porta**: 3000 (fixa, conforme regra do sistema)

### Arquivos Estáticos
- **Pasta**: `./public`
- **Index**: `public/index.html`

### APIs Disponíveis

#### Busca e Perguntas
- `GET /api/ask-mongodb` - Busca principal (Google Sheets)
- `GET /api/ask` - Busca alternativa
- `GET /api/ask-simple` - Busca simplificada
- `GET /api/AskOpenai` - Busca (OpenAI desativado)
- `POST /api/AskOpenai` - Busca com POST

#### Logs e Feedback
- `GET /api/logQuestion` - Consultar logs
- `POST /api/logQuestion` - Registrar pergunta
- `POST /api/feedback` - Registrar feedback

#### Administração
- `GET /api/admin` - Painel administrativo

#### Voz e Áudio
- `POST /api/voice` - Processar áudio
- `GET /api/voice` - Consultar voz
- `POST /api/elevenlabs` - ElevenLabs API
- `GET /api/elevenlabs` - ElevenLabs GET

#### Outros
- `GET /api/getNews` - Buscar notícias
- `GET /api/getProductStatus` - Status de produtos

## 🔐 Variáveis de Ambiente Necessárias

Certifique-se de ter configurado no arquivo `.env`:

```env
GOOGLE_CREDENTIALS={"type":"service_account",...}
```

## 📊 Estrutura do Servidor

```
server-local.js
├── Middleware
│   ├── JSON Parser
│   ├── URL Encoded Parser
│   ├── Static Files (public/)
│   └── CORS
├── Rotas da API
│   └── Todas as rotas /api/*
├── Rota Raiz (/)
│   └── Serve index.html
└── Health Check (/health)
```

## ⚠️ Observações

1. **Porta Fixa**: O servidor sempre roda na porta 3000 (conforme regra do sistema)
2. **CORS**: Configurado para aceitar requisições de qualquer origem
3. **Arquivos Estáticos**: Servidos automaticamente da pasta `public`
4. **Tratamento de Erros**: Middleware de erro configurado

## 🐛 Troubleshooting

### Porta já em uso
Se a porta 3000 estiver ocupada:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Erro de módulo não encontrado
```bash
npm install
```

### Erro de GOOGLE_CREDENTIALS
Certifique-se de ter o arquivo `.env` configurado com as credenciais do Google.

## 📝 Logs

O servidor exibe logs detalhados no console:
- ✅ Inicialização bem-sucedida
- ⚠️ Avisos de configuração
- ❌ Erros de execução

## 🎯 Próximos Passos

1. Inicie o servidor: `npm start`
2. Acesse: http://localhost:3000
3. Teste as APIs conforme necessário

