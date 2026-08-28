'use strict';

const fs = require('fs');
const { Pool } = require('pg');

let pool;

function sslInsecure() {
  const v = String(process.env.DATABASE_SSL_INSECURE || '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function sslConfig() {
  if (sslInsecure()) {
    return { rejectUnauthorized: false };
  }
  const caPath = String(process.env.AIVEN_CA_PATH || '').trim();
  if (caPath) {
    return {
      rejectUnauthorized: true,
      ca: fs.readFileSync(caPath, 'utf8')
    };
  }
  return { rejectUnauthorized: true };
}

function connectionString() {
  return String(process.env.AIVEN_DATABASE_URL || process.env.DATABASE_URL || '').trim();
}

function getPool() {
  if (pool) return pool;
  const cs = connectionString();
  if (!cs) {
    throw new Error(
      'AIVEN_DATABASE_URL não configurada. Defina a connection string do Postgres no ambiente.'
    );
  }
  pool = new Pool({
    connectionString: cs,
    ssl: sslConfig(),
    max: Math.max(1, Number(process.env.DATABASE_POOL_MAX) || 5),
    idleTimeoutMillis: 30 * 1000,
    connectionTimeoutMillis: 10 * 1000
  });
  return pool;
}

async function query(text, params = []) {
  return getPool().query(text, params);
}

module.exports = { getPool, query, connectionString };
