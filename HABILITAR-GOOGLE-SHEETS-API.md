# 🔧 Como Habilitar a Google Sheets API

## ❌ Problema Identificado

A Google Sheets API não está habilitada no seu projeto do Google Cloud.

## ✅ Solução Rápida

### Opção 1: Link Direto (Mais Rápido)

Clique neste link para habilitar a API diretamente:

**🔗 https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=230417725720**

Depois clique no botão **"ATIVAR"** ou **"ENABLE"**.

### Opção 2: Manual

1. Acesse: https://console.cloud.google.com/
2. Selecione o projeto: **230417725720** (ou procure por "cobrancabot")
3. No menu lateral, vá em **"APIs e serviços"** > **"Biblioteca"**
4. Na busca, digite: **"Google Sheets API"**
5. Clique no resultado **"Google Sheets API"**
6. Clique no botão **"ATIVAR"** ou **"ENABLE"**
7. Aguarde alguns minutos para a ativação propagar

## ⏱️ Após Habilitar

1. Aguarde **2-5 minutos** para a ativação propagar
2. Execute o teste novamente:
   ```bash
   node test-google-credentials.js
   ```
3. Se funcionar, reinicie o servidor:
   ```bash
   npm start
   ```

## ✅ Verificação

Após habilitar, você deve ver no teste:
- ✅ Planilha acessada com sucesso!
- ✅ Linhas encontradas: X

## 📝 Nota

- A API precisa estar habilitada no projeto do Google Cloud
- Isso é diferente de dar permissão na planilha (que você já fez)
- A ativação pode levar alguns minutos para propagar

