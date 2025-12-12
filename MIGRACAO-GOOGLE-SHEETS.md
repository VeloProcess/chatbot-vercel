# 🔄 Migração MongoDB → Google Sheets

## ✅ Migração Concluída

O sistema foi completamente migrado do MongoDB para Google Sheets como fonte única de dados.

## 📋 Planilha Configurada

- **ID da Planilha**: `1d0h9zr4haDx6etLtdMqPVsBXdVvH7n9OsRdqAhOJOp0`
- **URL**: https://docs.google.com/spreadsheets/d/1d0h9zr4haDx6etLtdMqPVsBXdVvH7n9OsRdqAhOJOp0/edit?gid=0#gid=0
- **Aba FAQ**: `FAQ!A:E` (ajustável conforme estrutura da planilha)

## 🔧 Arquivos Modificados

### 1. **api/ask-mongodb.js**
- ✅ Removida dependência do MongoDB
- ✅ Implementada leitura direta do Google Sheets
- ✅ Mantida toda lógica de busca e correspondências
- ✅ Cache local mantido para performance

### 2. **api/AskOpenai.js**
- ✅ Removida dependência do MongoDB
- ✅ Implementada leitura direta do Google Sheets
- ✅ Funções de sincronização adaptadas
- ✅ Sistema de IA avançada mantido

### 3. **api/logQuestion.js**
- ✅ Atualizado ID da planilha

### 4. **api/feedback.js**
- ✅ Atualizado ID da planilha

### 5. **api/ask.js**
- ✅ Atualizado ID da planilha

### 6. **api/ask-simple.js**
- ✅ Atualizado ID da planilha

### 7. **api/admin.js**
- ✅ Atualizado ID da planilha

### 8. **public/script.js**
- ✅ Comentários atualizados

## 📝 Novos Arquivos Criados

### **validate-google-sheets.js**
Script para validar a estrutura da planilha Google Sheets:
- Valida colunas esperadas
- Verifica linhas vazias
- Mostra estatísticas de preenchimento
- Exibe exemplos de dados

### **run-sync.js** (Atualizado)
Agora executa validação da planilha ao invés de sincronização MongoDB.

## 🗑️ Arquivos Obsoletos

### **sync-google-sheets-to-mongodb.js**
Este arquivo não é mais necessário, pois não há mais sincronização com MongoDB.
A planilha Google Sheets é agora a fonte única da verdade.

## 📊 Estrutura Esperada da Planilha

A planilha deve ter uma aba chamada `FAQ` com as seguintes colunas:

| Coluna | Descrição |
|--------|-----------|
| A | Pergunta |
| B | Resposta |
| C | Palavras-chave |
| D | Sinônimos |
| E | Tabulação |

**Nota**: O sistema detecta automaticamente as colunas pelo nome (case-insensitive), então variações como "Palavras-chave", "Palavras Chave", "palavras-chave" são aceitas.

## 🔐 Configuração Necessária

Certifique-se de que a variável de ambiente `GOOGLE_CREDENTIALS` está configurada com as credenciais do Google Service Account que tem acesso de **Editor** na planilha.

## 🚀 Como Usar

### Validar Planilha
```bash
node run-sync.js
```

Ou diretamente:
```bash
node validate-google-sheets.js
```

### Testar Sistema
O sistema agora lê diretamente da planilha Google Sheets. Qualquer alteração na planilha será refletida automaticamente (com cache de 5 minutos).

## ⚠️ Observações Importantes

1. **Cache**: O sistema mantém cache local de 5 minutos para melhor performance
2. **Permissões**: A conta de serviço precisa ter permissão de **Editor** na planilha
3. **Estrutura**: A planilha deve ter pelo menos as colunas: Pergunta, Resposta, Palavras-chave
4. **Linhas Vazias**: Linhas sem pergunta são automaticamente ignoradas

## 📈 Benefícios da Migração

- ✅ **Simplicidade**: Não precisa mais manter MongoDB
- ✅ **Acessibilidade**: Dados editáveis diretamente no Google Sheets
- ✅ **Colaboração**: Múltiplos usuários podem editar simultaneamente
- ✅ **Versionamento**: Histórico de alterações no Google Sheets
- ✅ **Custo**: Redução de custos (sem necessidade de MongoDB)

## 🔍 Verificação

Para verificar se tudo está funcionando:

1. Execute `node validate-google-sheets.js` para validar a estrutura
2. Teste uma pergunta no sistema
3. Verifique os logs para confirmar leitura do Google Sheets

## 📞 Suporte

Em caso de problemas:
- Verifique se `GOOGLE_CREDENTIALS` está configurado
- Verifique se a planilha tem permissões corretas
- Execute o script de validação para diagnosticar problemas

