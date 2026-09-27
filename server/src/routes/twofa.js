'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { query } = require('../db');
const { authRequired } = require('../middleware/auth');
const { verifyPassword } = require('../utils/crypto-auth');
const {
  generateTotpSecret,
  buildOtpauthUrl,
  qrDataUrl,
  verifyTotp,
  generateBackupCodes,
  hashBackupCodes,
  consumeBackupCode,
  encryptTotpSecret,
  decryptTotpSecret
} = require('../utils/totp');
const {
  getChallenge,
  deleteChallenge,
  getLock,
  recordFailedAttempt,
  clearLock
} = require('../utils/twofa-challenge');
const { issueSession } = require('./auth');
/* API alinhada: totp.js + twofa-challenge.js + auth.issueSession */

const router = express.Router();

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.TWO_FA_VERIFY_RATE_MAX) || 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Muitas tentativas. Aguarde alguns minutos.' }
});

function parseBackupHashes(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

router.get('/status', authRequired, async (req, res) => {
  try {
    const result = await query(
      `SELECT two_fa_ativo FROM usuarios WHERE id = $1 LIMIT 1`,
      [req.user.id]
    );
    return res.json({ ok: true, ativo: result.rows[0]?.two_fa_ativo === true });
  } catch (err) {
    if (/two_fa_ativo|column .* does not exist/i.test(String(err.message || ''))) {
      return res.json({
        ok: true,
        ativo: false,
        needsMigration: true,
        error: 'Execute server/sql/001_two_fa_usuarios.sql no Aiven.'
      });
    }
    console.error('2fa/status', err);
    return res.status(500).json({ ok: false, error: 'Erro ao consultar 2FA.' });
  }
});

router.post('/iniciar', authRequired, async (req, res) => {
  try {
    const current = await query(
      `SELECT email, two_fa_ativo FROM usuarios WHERE id = $1 LIMIT 1`,
      [req.user.id]
    );
    const row = current.rows[0];
    if (!row) return res.status(404).json({ ok: false, error: 'Usuário não encontrado.' });
    if (row.two_fa_ativo === true) {
      return res.status(400).json({
        ok: false,
        error: 'O 2FA já está ativo. Desative antes de configurar de novo.'
      });
    }

    const secret = generateTotpSecret();
    await query(
      `UPDATE usuarios
          SET two_fa_secret = $1,
              two_fa_ativo = false,
              two_fa_codigos_backup = NULL
        WHERE id = $2`,
      [encryptTotpSecret(secret), req.user.id]
    );

    const otpauthUrl = buildOtpauthUrl(secret, row.email);
    return res.json({
      ok: true,
      otpauthUrl,
      qrCodeDataUrl: await qrDataUrl(otpauthUrl),
      manualSecret: secret
    });
  } catch (err) {
    if (/two_fa_|column .* does not exist/i.test(String(err.message || ''))) {
      return res.status(500).json({
        ok: false,
        needsMigration: true,
        error:
          'Execute server/sql/001_two_fa_usuarios.sql no Aiven e configure TWO_FA_ENCRYPTION_KEY.'
      });
    }
    console.error('2fa/iniciar', err);
    return res.status(500).json({ ok: false, error: 'Não foi possível iniciar o 2FA.' });
  }
});

router.post('/confirmar', authRequired, async (req, res) => {
  try {
    const code = String(req.body?.code || req.body?.codigo || '').trim();
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ ok: false, error: 'Informe o código de 6 dígitos.' });
    }

    const result = await query(
      `SELECT two_fa_secret, two_fa_ativo FROM usuarios WHERE id = $1 LIMIT 1`,
      [req.user.id]
    );
    const row = result.rows[0];
    if (!row?.two_fa_secret) {
      return res.status(400).json({ ok: false, error: 'Inicie o 2FA antes de confirmar.' });
    }
    if (row.two_fa_ativo === true) {
      return res.status(400).json({ ok: false, error: 'O 2FA já está ativo.' });
    }

    if (!verifyTotp(code, decryptTotpSecret(row.two_fa_secret))) {
      return res.status(400).json({ ok: false, error: 'Código inválido. Tente novamente.' });
    }

    const backupCodes = generateBackupCodes(8);
    const hashes = await hashBackupCodes(backupCodes);
    await query(
      `UPDATE usuarios
          SET two_fa_ativo = true,
              two_fa_codigos_backup = $1::jsonb
        WHERE id = $2`,
      [JSON.stringify(hashes), req.user.id]
    );

    return res.json({
      ok: true,
      backupCodes,
      warning:
        'Guarde estes códigos de backup em local seguro. Eles só são exibidos uma vez e cada um vale para um único uso.'
    });
  } catch (err) {
    console.error('2fa/confirmar', err);
    return res.status(500).json({ ok: false, error: 'Não foi possível confirmar o 2FA.' });
  }
});

router.post('/desativar', authRequired, async (req, res) => {
  try {
    const senha = String(req.body?.senha || req.body?.password || '');
    if (!senha) {
      return res.status(400).json({
        ok: false,
        error: 'Informe a senha atual para desativar o 2FA.'
      });
    }

    const result = await query(`SELECT senha FROM usuarios WHERE id = $1 LIMIT 1`, [req.user.id]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ ok: false, error: 'Usuário não encontrado.' });

    const check = await verifyPassword(senha, row.senha);
    if (!check.ok) {
      return res.status(401).json({ ok: false, error: 'Senha incorreta.' });
    }

    await query(
      `UPDATE usuarios
          SET two_fa_ativo = false,
              two_fa_secret = NULL,
              two_fa_codigos_backup = NULL
        WHERE id = $1`,
      [req.user.id]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('2fa/desativar', err);
    return res.status(500).json({ ok: false, error: 'Não foi possível desativar o 2FA.' });
  }
});

router.post('/verificar', verifyLimiter, async (req, res) => {
  try {
    const tempToken = String(req.body?.tempToken || req.body?.temp_token || '').trim();
    const code = String(req.body?.code || req.body?.codigo || '').trim();

    if (!tempToken || !code) {
      return res.status(400).json({ ok: false, error: 'Informe o token temporário e o código.' });
    }

    const challenge = getChallenge(tempToken);
    if (!challenge) {
      return res.status(401).json({
        ok: false,
        error: 'Desafio 2FA expirado ou inválido. Faça login novamente.',
        reason: 'expired'
      });
    }

    const lock = getLock(challenge.userId);
    if (lock.blocked) {
      return res.status(429).json({
        ok: false,
        error: 'Muitas tentativas incorretas. Aguarde alguns minutos.',
        reason: 'locked',
        retryAfterSec: lock.retryAfterSec
      });
    }

    const result = await query(
      `SELECT id, nome, email, two_fa_ativo, two_fa_secret, two_fa_codigos_backup
         FROM usuarios WHERE id = $1 LIMIT 1`,
      [challenge.userId]
    );
    const user = result.rows[0];
    if (!user || user.two_fa_ativo !== true || !user.two_fa_secret) {
      deleteChallenge(tempToken);
      return res.status(401).json({ ok: false, error: '2FA não está ativo para esta conta.' });
    }

    let accepted = false;
    let remainingBackup = parseBackupHashes(user.two_fa_codigos_backup);
    const digits = code.replace(/\s/g, '');

    if (/^\d{6}$/.test(digits)) {
      accepted = verifyTotp(digits, decryptTotpSecret(user.two_fa_secret));
    }

    if (!accepted) {
      const consumed = await consumeBackupCode(code, remainingBackup);
      if (consumed.ok) {
        accepted = true;
        remainingBackup = consumed.remaining;
        await query(
          `UPDATE usuarios SET two_fa_codigos_backup = $1::jsonb WHERE id = $2`,
          [JSON.stringify(remainingBackup), user.id]
        );
      }
    }

    if (!accepted) {
      const fail = recordFailedAttempt(challenge);
      if (fail.locked) {
        return res.status(429).json({
          ok: false,
          error: 'Muitas tentativas incorretas. Aguarde alguns minutos.',
          reason: 'locked'
        });
      }
      return res.status(401).json({
        ok: false,
        error: 'Código inválido.',
        attemptsLeft: fail.attemptsLeft
      });
    }

    deleteChallenge(tempToken);
    clearLock(user.id);
    return res.json({ ok: true, session: await issueSession(user) });
  } catch (err) {
    console.error('2fa/verificar', err);
    return res.status(500).json({ ok: false, error: 'Erro ao verificar 2FA.' });
  }
});

module.exports = router;
