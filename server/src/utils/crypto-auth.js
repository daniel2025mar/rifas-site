'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const ROUNDS = 10;

function isBcryptHash(value) {
  return /^\$2[aby]\$\d{2}\$/.test(String(value || ''));
}

async function hashPassword(plain) {
  return bcrypt.hash(String(plain), ROUNDS);
}

async function verifyPassword(plain, stored) {
  const raw = String(stored || '');
  if (!raw) return { ok: false, needsRehash: false };
  if (isBcryptHash(raw)) {
    const ok = await bcrypt.compare(String(plain), raw);
    return { ok, needsRehash: false };
  }
  const legacy = String(process.env.ALLOW_LEGACY_PLAINTEXT || 'true').trim().toLowerCase();
  if (legacy === '0' || legacy === 'false' || legacy === 'no') {
    return { ok: false, needsRehash: false };
  }
  const ok = raw === String(plain);
  return { ok, needsRehash: ok };
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken
};
