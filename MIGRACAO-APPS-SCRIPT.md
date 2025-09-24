# 🔄 Migração para Sistema Unificado - Google Apps Script

## ✅ **SISTEMA UNIFICADO IMPLEMENTADO!**

Agora você tem **TUDO** em um só lugar no Google Apps Script:

### **📊 FUNCIONALIDADES INTEGRADAS:**

1. **✅ Perguntas Frequentes** (já existente)
   - Endpoint HTTP para o bot buscar top 10 perguntas
   - Cálculo automático diário das perguntas mais frequentes

2. **✅ Relatórios Automáticos** (novo)
   - Relatórios semanais e mensais por email
   - Análise completa de dados da planilha
   - Templates HTML profissionais

3. **✅ Triggers Automáticos** (novo)
   - Relatório semanal: Segunda-feira às 9h
   - Relatório mensal: Primeira segunda do mês às 10h
   - Perguntas frequentes: Atualização manual via planilha

## 🔄 **COMO MIGRAR:**

### **1. Acessar seu Apps Script Existente**
1. Vá para: https://script.google.com
2. Abra o projeto que já tem as perguntas frequentes
3. **IMPORTANTE**: Faça backup do código atual antes de alterar

### **2. Substituir o Código**
1. Selecione todo o código atual (Ctrl+A)
2. Delete tudo
3. Cole o código completo do arquivo `google-apps-script.js`
4. Salve o projeto (Ctrl+S)

### **3. Configurar Triggers**
1. Execute a função `configurarTriggers()`:
   - Clique no menu **"Executar"**
   - Selecione `configurarTriggers`
   - Clique em **"Executar"**
2. Confirme as permissões se solicitado

### **4. Testar o Sistema**
1. Execute a função `testarSistema()`:
   - Clique no menu **"Executar"**
   - Selecione `testarSistema`
   - Clique em **"Executar"**
2. Verifique sua caixa de entrada

## 📋 **ESTRUTURA DA PLANILHA:**

O sistema funciona com estas abas da sua planilha:

### **Log_Perguntas** (já existe)
- **Coluna A**: Data/Hora
- **Coluna B**: Pergunta do usuário
- **Coluna C**: Email do usuário
- **Coluna D**: Resposta do bot

### **Perguntas_Frequentes** (já existe)
- **Coluna A**: Pergunta
- **Coluna B**: Frequência
- **Coluna D**: JSON com dados (para o bot)

### **Log_Feedback** (para relatórios)
- **Coluna A**: Data/Hora
- **Coluna B**: Email do usuário
- **Coluna C**: Pergunta
- **Coluna D**: Feedback (Positivo/Negativo)
- **Coluna E**: Rating (1-5)
- **Coluna F**: Resposta
- **Coluna G**: Fonte

## 🔧 **FUNÇÕES DISPONÍVEIS:**

### **Perguntas Frequentes (já existentes):**
- `doGet()` - Endpoint HTTP para o bot
- `calcularTop10Perguntas()` - Cálculo automático

### **Relatórios (novos):**
- `gerarRelatorioSemanal()` - Relatório semanal
- `gerarRelatorioMensal()` - Relatório mensal
- `configurarTriggers()` - Configurar triggers
- `testarSistema()` - Testar sistema

## 📅 **CRONOGRAMA AUTOMÁTICO:**

### **Segunda-feira às 9h:**
- 📧 Gera relatório semanal
- 📊 Analisa dados da semana
- 📬 Envia por email para gestores

### **Primeira segunda do mês às 10h:**
- 📧 Gera relatório mensal
- 📊 Análise completa do mês
- 📬 Envia para diretoria

### **Perguntas Frequentes:**
- 📊 Atualização manual via planilha (trigger da própria planilha)
- 🔄 Função disponível para uso manual quando necessário

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

## 🎯 **VANTAGENS DA MIGRAÇÃO:**

1. **🔄 Sistema Unificado** - Tudo em um só lugar
2. **📊 Dados Integrados** - Usa a mesma planilha
3. **⏰ Automatização Completa** - Sem intervenção manual
4. **📧 Relatórios Profissionais** - Templates HTML
5. **🔐 Segurança Total** - Autenticação Google
6. **💰 Custo Zero** - Sem taxas adicionais
7. **🛠️ Manutenção Simples** - Código centralizado

## 🚨 **IMPORTANTE:**

### **Antes de Migrar:**
1. ✅ Faça backup do código atual
2. ✅ Teste em ambiente de desenvolvimento se possível
3. ✅ Confirme que a planilha tem as abas necessárias

### **Após Migrar:**
1. ✅ Execute `configurarTriggers()` uma vez
2. ✅ Execute `testarSistema()` para verificar
3. ✅ Monitore os primeiros relatórios automáticos
4. ✅ Verifique se o bot continua funcionando

## 🔍 **VERIFICAÇÃO:**

### **Verificar se Funcionou:**
1. **Perguntas Frequentes**: Teste a URL do bot
2. **Triggers**: Verifique na aba "Triggers" do Apps Script
3. **Relatórios**: Execute `testarSistema()` e verifique o email
4. **Logs**: Monitore as execuções na aba "Execuções"

### **Solução de Problemas:**
- **Erro de permissões**: Execute `configurarTriggers()` novamente
- **Email não enviado**: Verifique se o Gmail está ativo
- **Dados incorretos**: Confirme a estrutura da planilha
- **Triggers não funcionando**: Verifique se estão ativos

## 🎉 **RESULTADO FINAL:**

Após a migração, você terá:

- ✅ **Bot funcionando** com perguntas frequentes atualizadas
- ✅ **Relatórios automáticos** por email
- ✅ **Sistema unificado** e integrado
- ✅ **Manutenção simplificada**
- ✅ **Custo zero** e máxima segurança

**O sistema estará 100% automatizado e profissional!** 🚀
