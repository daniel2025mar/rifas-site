'use strict';

/**
 * Cifra o secret TOTP com AES-256-GCM.
 * Chave: TWO_FA_ENCRYPTION_KEY (64 hex = 32 bytes, ou qualquer string → SHA-256).
 * O valor no banco NUNCA fica em texto puro.
 */
const crypto = require('crypto');

function getKey() {
  const raw = String(process.env.TWO_FA_ENCRYPTION_KEY || '').trim();
  if (!raw) {
    throw new Error(
      'TWO_FA_ENCRYPTION_KEY não configurada. Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

function encryptSecret(plain) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decryptSecret(payload) {
  const parts = String(payload || '').split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Formato de secret 2FA inválido.');
  }
  const key = getKey();
  const iv = Buffer.from(parts[1], 'hex');
  const tag = Buffer.from(parts[2], 'hex');
  const data = Buffer.from(parts[3], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

module.exports = { encryptSecret, decryptSecret };
