# 🚀 Como Iniciar o Servidor

## ⚠️ Problema com PowerShell

O PowerShell está tendo problemas com caracteres especiais no caminho. Use uma das opções abaixo:

## ✅ Opção 1: Usar o arquivo .bat (Recomendado)

1. Abra o Explorador de Arquivos
2. Navegue até a pasta do projeto
3. Clique duas vezes em `start-server.bat`

## ✅ Opção 2: Usar o Terminal do VS Code/Cursor

1. Abra o terminal integrado (Ctrl + `)
2. Execute:
```bash
npm start
```

## ✅ Opção 3: Usar CMD (Prompt de Comando)

1. Abra o CMD (Prompt de Comando)
2. Navegue até a pasta:
```cmd
cd "C:\Users\VelotaxSUP\OneDrive\Documentos\Cobrança BOT"
```
3. Execute:
```cmd
npm start
```

## ✅ Opção 4: Executar diretamente com Node

```cmd
node server-local.js
```

## 🔍 Verificar Erros

Se houver erros, o servidor mostrará qual módulo está falhando ao carregar.

## 📋 O que o servidor deve mostrar:

```
📦 Carregando handlers da API...
✅ ask-mongodb carregado
✅ ask carregado
...
🚀 Servidor iniciado!
📡 Rodando em: http://localhost:3000
```

## 🐛 Se ainda der erro

Envie a mensagem de erro completa para que possamos identificar o problema.

