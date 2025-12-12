// Script para testar as credenciais do Google Sheets
require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = "1d0h9zr4haDx6etLtdMqPVsBXdVvH7n9OsRdqAhOJOp0";
const FAQ_SHEET_NAME = "FAQ!A:D";

async function testCredentials() {
  console.log('🔍 Testando credenciais do Google Sheets...\n');
  
  // Verificar se GOOGLE_CREDENTIALS existe
  if (!process.env.GOOGLE_CREDENTIALS) {
    console.error('❌ GOOGLE_CREDENTIALS não encontrado no .env');
    return;
  }
  
  console.log('✅ GOOGLE_CREDENTIALS encontrado');
  console.log('📋 Tamanho:', process.env.GOOGLE_CREDENTIALS.length, 'caracteres');
  
  // Tentar fazer parse do JSON
  let credentials;
  try {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    console.log('✅ JSON parseado com sucesso');
    console.log('📧 Email da conta de serviço:', credentials.client_email);
    console.log('🆔 Project ID:', credentials.project_id);
  } catch (error) {
    console.error('❌ Erro ao fazer parse do JSON:', error.message);
    console.error('❌ Verifique se o JSON está correto no arquivo .env');
    return;
  }
  
  // Tentar autenticar
  let auth, sheets;
  try {
    auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Cliente Google Sheets criado');
  } catch (error) {
    console.error('❌ Erro ao criar cliente Google Sheets:', error.message);
    return;
  }
  
  // Tentar acessar a planilha
  try {
    console.log('\n🔍 Tentando acessar a planilha...');
    console.log('📋 SPREADSHEET_ID:', SPREADSHEET_ID);
    console.log('📋 Range:', FAQ_SHEET_NAME);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: FAQ_SHEET_NAME,
    });
    
    console.log('✅ Planilha acessada com sucesso!');
    console.log('📊 Linhas encontradas:', response.data.values ? response.data.values.length : 0);
    
    if (response.data.values && response.data.values.length > 0) {
      console.log('📋 Cabeçalho:', response.data.values[0]);
      if (response.data.values.length > 1) {
        console.log('📋 Primeira linha de dados:', response.data.values[1]);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Erro ao acessar a planilha:');
    console.error('❌ Mensagem:', error.message);
    
    if (error.response) {
      console.error('❌ Status:', error.response.status);
      console.error('❌ Status Text:', error.response.statusText);
      console.error('❌ Data:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 403) {
        const errorData = error.response.data?.error;
        if (errorData?.reason === 'accessNotConfigured' || errorData?.status === 'PERMISSION_DENIED') {
          console.error('\n⚠️ GOOGLE SHEETS API NÃO ESTÁ HABILITADA!');
          console.error('🔧 A API precisa ser habilitada no Google Cloud Console');
          if (errorData?.details?.[0]?.metadata?.activationUrl) {
            console.error('🔗 Link direto para habilitar:', errorData.details[0].metadata.activationUrl);
          } else {
            console.error('🔗 Link: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=' + credentials.project_id);
          }
          console.error('\n📝 Passos:');
          console.error('   1. Acesse o link acima');
          console.error('   2. Clique em "ATIVAR" ou "ENABLE"');
          console.error('   3. Aguarde alguns minutos');
          console.error('   4. Execute este teste novamente');
        } else {
          console.error('\n⚠️ ERRO DE PERMISSÃO (403)');
          console.error('📧 Verifique se o email', credentials.client_email, 'tem permissão de Editor na planilha');
          console.error('🔗 URL da planilha: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit');
        }
      } else if (error.response.status === 404) {
        console.error('\n⚠️ PLANILHA NÃO ENCONTRADA (404)');
        console.error('📋 Verifique se o SPREADSHEET_ID está correto:', SPREADSHEET_ID);
      }
    } else {
      console.error('❌ Erro completo:', error);
    }
  }
}

testCredentials().catch(console.error);

