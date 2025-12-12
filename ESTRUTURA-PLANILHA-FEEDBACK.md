# 📋 Estrutura da Planilha para Feedback

## ⚠️ IMPORTANTE: Conflito de Estrutura

Atualmente, o sistema está tentando escrever feedbacks na aba **LOGS**, mas essa aba já tem uma estrutura diferente para logs de perguntas. 

**Recomendação**: Criar uma aba separada chamada **FEEDBACK** para evitar conflitos.

---

## 📊 Estrutura da Aba FEEDBACK

Crie uma nova aba na planilha chamada **FEEDBACK** com as seguintes colunas:

| Coluna | Cabeçalho | Descrição | Exemplo |
|--------|-----------|-----------|---------|
| **A** | DATA | Data e hora do feedback (fuso horário de Brasília) | 15/01/2024 14:30:25 |
| **B** | Operador | Email do operador que deu o feedback | operador@velotax.com.br |
| **C** | Pergunta | A pergunta original que gerou a resposta | Como negociar dívida? |
| **D** | Tipo de Feedback | Tipo do feedback | 👍 Positivo ou 👎 Negativo |
| **E** | Resposta Recebida | A resposta que o bot deu ao operador | Você pode negociar... |
| **F** | Sugestão/Comentário | Comentário ou sugestão do operador (se feedback negativo) | Poderia ter mais detalhes sobre... |

### 📝 Exemplo de Cabeçalhos (Linha 1)

```
| DATA                | Operador              | Pergunta              | Tipo de Feedback | Resposta Recebida | Sugestão/Comentário |
|---------------------|----------------------|----------------------|------------------|-------------------|---------------------|
```

### 📝 Exemplo de Dados (Linhas seguintes)

```
| 15/01/2024 14:30:25 | user@velotax.com.br  | Como negociar dívida? | 👍 Positivo      | Você pode...      |                     |
| 15/01/2024 14:35:10 | user@velotax.com.br  | Qual o status?        | 👎 Negativo      | Seu status é...   | Falta mais detalhes |
```

## 📝 Formato dos Dados

- **DATA**: Formato brasileiro `DD/MM/YYYY HH:mm:ss` (fuso horário de Brasília)
- **Tipo de Feedback**: 
  - `👍 Positivo` para feedback positivo
  - `👎 Negativo` para feedback negativo
- **Sugestão/Comentário**: Texto livre (pode ficar vazio para feedback positivo)

## ⚠️ Configuração Necessária

1. **Criar a aba FEEDBACK** na planilha com os cabeçalhos acima
2. A primeira linha deve conter os **cabeçalhos** (títulos das colunas)
3. Os dados serão **adicionados automaticamente** nas linhas seguintes
4. A planilha deve estar **compartilhada** com a conta de serviço do Google:
   - Email: `cobran-a-bot@cobrancabot.iam.gserviceaccount.com`
   - Permissão: **Editor**

## 🔧 Configuração Atual do Código

- **ID da Planilha**: `1d0h9zr4haDx6etLtdMqPVsBXdVvH7n9OsRdqAhOJOp0`
- **Aba atual**: `LOGS` (precisa ser alterada para `FEEDBACK`)
- **Range usado**: `LOGS!A:F` (precisa ser alterado para `FEEDBACK!A:F`)

---

## 📌 Nota

Após criar a aba FEEDBACK com a estrutura acima, será necessário atualizar o código em `api/feedback.js` para usar `FEEDBACK` ao invés de `LOGS`.

