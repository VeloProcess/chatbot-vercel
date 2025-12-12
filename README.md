# Cobran-a-BOT

Sistema de chatbot para o setor de cobrança, integrado com Google Sheets para armazenamento de dados e respostas.

## Características

- Chatbot inteligente com busca local por palavras-chave
- Integração com Google Sheets para FAQ e logs
- Sistema de feedback integrado
- Múltiplos temas (Claro, Escuro, Mint, Rosa)
- Categorização automática de perguntas
- Logs centralizados na planilha Google Sheets

## Tecnologias

- Node.js
- Express.js
- Google Sheets API
- Frontend HTML/CSS/JavaScript

## Instalação

1. Clone o repositório
2. Instale as dependências: `npm install`
3. Configure as variáveis de ambiente no arquivo `.env`
4. Inicie o servidor: `npm start`

## Configuração

O sistema utiliza Google Sheets como banco de dados. Certifique-se de:
- Ter uma planilha Google Sheets configurada
- Compartilhar a planilha com a conta de serviço do Google Cloud
- Habilitar a Google Sheets API no projeto Google Cloud

## Uso

O servidor inicia na porta 3000 por padrão. Acesse `http://localhost:3000` para usar o chatbot.

