# 🚀 Implementação Google Apps Script - Sistema de Relatórios VeloBot

## ✅ **VANTAGENS DO GOOGLE APPS SCRIPT:**

- 🔐 **Sem senhas de app** - Usa autenticação nativa do Google
- 📧 **Integração Gmail** - Envio direto sem configurações SMTP
- 📊 **Acesso direto às planilhas** - Lê dados diretamente do Google Sheets
- ⏰ **Triggers automáticos** - Relatórios automáticos sem cron jobs
- 💰 **Gratuito** - Sem custos adicionais
- 🛡️ **Seguro** - Autenticação OAuth2 do Google
- 🔄 **Sincronização automática** - Sempre atualizado

## 📋 **PASSO A PASSO PARA IMPLEMENTAR:**

### **1. Acessar Google Apps Script**
1. Vá para: https://script.google.com
2. Clique em **"Novo projeto"**
3. Renomeie o projeto para **"VeloBot Relatórios"**

### **2. Configurar o Código**
1. Delete todo o código padrão
2. Cole o código completo do arquivo `google-apps-script.js`
3. Salve o projeto (Ctrl+S)

### **3. Configurar Permissões**
1. Na primeira execução, clique em **"Revisar permissões"**
2. Escolha sua conta Google
3. Clique em **"Avançado"** → **"Ir para VeloBot Relatórios (não seguro)"**
4. Clique em **"Permitir"**

### **4. Configurar Triggers Automáticos**
1. Execute a função `configurarTriggers()`:
   - Clique no menu **"Executar"**
   - Selecione `configurarTriggers`
   - Clique em **"Executar"**
2. Confirme as permissões se solicitado

### **5. Testar o Sistema**
1. Execute a função `testarSistema()`:
   - Clique no menu **"Executar"**
   - Selecione `testarSistema`
   - Clique em **"Executar"**
2. Verifique sua caixa de entrada

### **6. Verificar Triggers**
1. No menu lateral, clique em **"Triggers"**
2. Você deve ver:
   - **Relatório Semanal**: Segunda-feira às 9h
   - **Relatório Mensal**: Primeira segunda do mês às 10h

## 📊 **ESTRUTURA DA PLANILHA:**

O sistema espera que sua planilha tenha estas colunas:

| Coluna | Descrição | Exemplo |
|--------|-----------|---------|
| A | Data/Hora | 2025-01-15 14:30:00 |
| B | Email do usuário | usuario@velotax.com.br |
| C | Pergunta | Como funciona o crédito pessoal? |
| D | Feedback | Positivo/Negativo |
| E | Rating | 1-5 |
| F | Resposta | Resposta do bot |
| G | Fonte | IA Avançada/Cache/Sistema |

## 📧 **DESTINATÁRIOS CONFIGURADOS:**

### **Relatórios Semanais:**
- gabriel@velotax.com.br
- gestor1@velotax.com.br
- gestor2@velotax.com.br

### **Relatórios Mensais:**
- gabriel@velotax.com.br
- diretor@velotax.com.br
- gestor1@velotax.com.br

### **Alertas de Erro:**
- gabriel@velotax.com.br
- suporte@velotax.com.br

## 🔧 **FUNÇÕES DISPONÍVEIS:**

### **Funções Automáticas:**
- `gerarRelatorioSemanal()` - Executada automaticamente toda segunda às 9h
- `gerarRelatorioMensal()` - Executada automaticamente na primeira segunda do mês às 10h

### **Funções de Configuração:**
- `configurarTriggers()` - Configura os triggers automáticos (execute uma vez)
- `testarSistema()` - Envia um relatório de teste

### **Funções de Suporte:**
- `gerarDadosRelatorio()` - Gera dados do relatório
- `gerarHTMLRelatorio()` - Gera HTML do email
- `enviarEmailRelatorio()` - Envia o email

## 📅 **CRONOGRAMA AUTOMÁTICO:**

### **Relatórios Semanais:**
- **Quando**: Toda segunda-feira às 9h
- **Conteúdo**: Dados da semana anterior (segunda a domingo)
- **Destinatários**: Gestores e equipe

### **Relatórios Mensais:**
- **Quando**: Primeira segunda do mês às 10h
- **Conteúdo**: Dados do mês anterior
- **Destinatários**: Diretoria e gestores

### **Alertas de Erro:**
- **Quando**: Sempre que houver erro no sistema
- **Conteúdo**: Detalhes do erro e data/hora
- **Destinatários**: Suporte técnico

## 🎨 **TEMPLATE DO EMAIL:**

O sistema gera emails HTML profissionais com:
- ✅ **Design responsivo** e moderno
- ✅ **Gradiente no cabeçalho** (azul escuro)
- ✅ **Cards de estatísticas** visuais
- ✅ **Cores organizadas** por seção
- ✅ **Ícones** para melhor visualização
- ✅ **Seções bem estruturadas**:
  - Resumo do período
  - Top perguntas
  - Usuários mais ativos
  - Alertas
  - Insights
  - Recomendações

## 🔍 **MONITORAMENTO:**

### **Logs do Apps Script:**
1. Acesse o projeto no Apps Script
2. Clique em **"Execuções"** no menu lateral
3. Veja o histórico de execuções
4. Clique em qualquer execução para ver os logs

### **Verificar Triggers:**
1. Clique em **"Triggers"** no menu lateral
2. Veja os triggers ativos
3. Monitore a próxima execução

## 🚨 **SOLUÇÃO DE PROBLEMAS:**

### **Erro de Permissões:**
- Execute `configurarTriggers()` novamente
- Confirme todas as permissões solicitadas

### **Email não enviado:**
- Verifique se o Gmail está ativo
- Confirme se os destinatários estão corretos
- Execute `testarSistema()` para diagnosticar

### **Dados incorretos:**
- Verifique a estrutura da planilha
- Confirme se as colunas estão na ordem correta
- Teste com dados de exemplo

### **Triggers não funcionando:**
- Verifique se os triggers estão ativos
- Confirme se a conta tem permissões adequadas
- Reconfigure os triggers se necessário

## 📈 **BENEFÍCIOS:**

1. **Automação Completa** - Sem intervenção manual
2. **Confiabilidade** - Sistema robusto do Google
3. **Segurança** - Autenticação OAuth2
4. **Custo Zero** - Sem taxas adicionais
5. **Integração Nativa** - Com Google Workspace
6. **Escalabilidade** - Suporta grandes volumes
7. **Manutenção Simples** - Código centralizado

## 🎯 **PRÓXIMOS PASSOS:**

1. ✅ Implementar o código no Apps Script
2. ✅ Configurar os triggers automáticos
3. ✅ Testar o sistema
4. ✅ Verificar o primeiro relatório automático
5. ✅ Ajustar destinatários se necessário
6. ✅ Monitorar o sistema por algumas semanas

**O sistema estará 100% funcional e automático!** 🚀
