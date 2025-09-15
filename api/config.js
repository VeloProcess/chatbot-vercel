// config.js

import 'dotenv/config';

export default function handler(req, res) {
  res.status(200).json({
    clientId: process.env.CLIENT_ID,
    dominioPermitido: process.env.DOMINIO_PERMITIDO
  });
}


export const ARQUIVOS_AUTORIZADOS = [
  "./data/politicas_internas.txt",
  "./data/manuais_operacionais.txt"
];

export const SITES_AUTORIZADOS = [
  "https://intranet.empresa.com.br",
  "https://docs.empresa.com.br"
];
