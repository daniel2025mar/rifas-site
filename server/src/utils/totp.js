'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { encryptSecret, decryptSecret } = require('./totp-crypto');

authenticator.options = { window: 1 };

function issuerName() {
  return String(process.env.TOTP_ISSUER || 'PowerApps Sistemas').trim() || 'PowerApps Sistemas';
}

function generateTotpSecret() {
  return authenticator.generateSecret();
}

function buildOtpauthUrl(secret, email) {
  return authenticator.keyuri(String(email || 'user'), issuerName(), secret);
}

async function qrDataUrl(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
}

function verifyTotp(token, secret) {
  try {
    return authenticator.verify({
      token: String(token || '').replace(/\s/g, ''),
      secret
    });
  } catch {
    return false;
  }
}

function generateBackupCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

function normalizeBackupCode(code) {
  return String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

async function hashBackupCodes(codes) {
  const out = [];
  for (const code of codes) {
    out.push(await bcrypt.hash(normalizeBackupCode(code), 10));
  }
  return out;
}

async function consumeBackupCode(code, hashes) {
  const list = Array.isArray(hashes) ? hashes.slice() : [];
  const normalized = normalizeBackupCode(code);
  if (!normalized || !list.length) return { ok: false, remaining: list };
  for (let i = 0; i < list.length; i += 1) {
    if (await bcrypt.compare(normalized, list[i])) {
      list.splice(i, 1);
      return { ok: true, remaining: list };
    }
  }
  return { ok: false, remaining: list };
}

function encryptTotpSecret(plain) {
  return encryptSecret(plain);
}

function decryptTotpSecret(cipher) {
  return decryptSecret(cipher);
}

module.exports = {
  generateTotpSecret,
  buildOtpauthUrl,
  qrDataUrl,
  verifyTotp,
  generateBackupCodes,
  hashBackupCodes,
  consumeBackupCode,
  normalizeBackupCode,
  encryptTotpSecret,
  decryptTotpSecret
};
