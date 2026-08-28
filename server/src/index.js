'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const { router: authRouter } = require('./routes/auth');
const twoFaRouter = require('./routes/twofa');
const { connectionString } = require('./db');

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 1);

const corsOrigin = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigin.length ? corsOrigin : true,
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'rifas-auth-server',
    databaseConfigured: Boolean(connectionString())
  });
});

app.use('/api', authRouter);
app.use('/api/2fa', twoFaRouter);

app.use((err, _req, res, _next) => {
  console.error('unhandled', err);
  res.status(500).json({ ok: false, error: 'Erro interno.' });
});

if (require.main === module) {
  if (!connectionString()) {
    console.error('Defina AIVEN_DATABASE_URL (ou DATABASE_URL) em server/.env');
    process.exit(1);
  }
  if (!String(process.env.TWO_FA_ENCRYPTION_KEY || '').trim()) {
    console.warn(
      '[aviso] TWO_FA_ENCRYPTION_KEY vazia — rotas de 2FA falharão até configurar a chave.'
    );
  }
  app.listen(PORT, () => {
    console.log(`Auth server em http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
