# 🔐 Solução: Erro de Permissão no Google Sheets

## ❌ Problema

Você está recebendo o erro `permission_denied` ao tentar acessar a planilha do Google Sheets.

## ✅ Solução

### Passo 1: Verificar o Email da Conta de Serviço

1. Abra o arquivo `.env` no seu projeto
2. Procure pela variável `GOOGLE_CREDENTIALS`
3. Copie o conteúdo JSON e cole em um editor de texto
4. Procure pelo campo `client_email` - esse é o email da conta de serviço

Exemplo:
```json
{
  "type": "service_account",
  "project_id": "seu-projeto",
  "private_key_id": "...",
  "private_key": "...",
  "client_email": "sua-conta-de-servico@seu-projeto.iam.gserviceaccount.com",
  ...
}
```

### Passo 2: Compartilhar a Planilha com a Conta de Serviço

1. Abra a planilha no Google Sheets: https://docs.google.com/spreadsheets/d/1d0h9zr4haDx6etLtdMqPVsBXdVvH7n9OsRdqAhOJOp0/edit

2. Clique no botão **"Compartilhar"** (canto superior direito)

3. No campo de compartilhamento, cole o **email da conta de serviço** (o `client_email` do passo 1)

4. **IMPORTANTE**: Selecione a permissão **"Editor"** (não apenas "Visualizador")

5. Clique em **"Enviar"** ou **"Concluído"**

### Passo 3: Verificar se Funcionou

1. Reinicie o servidor local
2. Tente fazer uma pergunta no bot novamente
3. Verifique os logs do servidor - não deve mais aparecer `permission_denied`

## 🔍 Verificação Adicional

Se ainda não funcionar, verifique:

1. **Email correto**: Certifique-se de que copiou o email completo da conta de serviço (incluindo `@...iam.gserviceaccount.com`)

2. **Permissão de Editor**: A conta precisa ter permissão de **Editor**, não apenas Visualizador

3. **Planilha correta**: Verifique se está compartilhando a planilha correta:
   - ID: `1d0h9zr4haDx6etLtdMqPVsBXdVvH7n9OsRdqAhOJOp0`
   - URL: https://docs.google.com/spreadsheets/d/1d0h9zr4haDx6etLtdMqPVsBXdVvH7n9OsRdqAhOJOp0/edit

4. **Credenciais válidas**: Verifique se o arquivo `.env` tem as credenciais corretas e válidas

## 📝 Nota Importante

- A conta de serviço precisa ter permissão de **Editor** porque:
  - O sistema precisa **ler** dados da aba FAQ
  - O sistema precisa **escrever** logs na aba LOGS

- Se você só der permissão de Visualizador, o sistema poderá ler mas não poderá escrever logs.

## 🆘 Ainda com Problemas?

Se após seguir todos os passos ainda houver erro:

1. Verifique os logs completos do servidor
2. Confirme que o email da conta de serviço está correto
3. Tente remover e adicionar novamente a permissão na planilha
4. Verifique se as credenciais não expiraram

