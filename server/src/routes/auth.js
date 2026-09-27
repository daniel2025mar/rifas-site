'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { query } = require('../db');
const {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken
} = require('../utils/crypto-auth');
const { createChallenge, getLock } = require('../utils/twofa-challenge');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Muitas tentativas. Aguarde alguns minutos.' }
});

function publicUser(row) {
  return {
    id: Number(row.id),
    nome: row.nome,
    email: row.email,
    twoFaAtivo: row.two_fa_ativo === true
  };
}

function sessionPayload(user, rawToken) {
  return {
    userId: Number(user.id),
    name: user.nome,
    email: user.email,
    sessionToken: rawToken,
    twoFaAtivo: user.two_fa_ativo === true
  };
}

async function issueSession(user) {
  const rawToken = generateSessionToken();
  const hashed = hashSessionToken(rawToken);
  await query(
    `UPDATE usuarios
        SET sessao_token = $1,
            sessao_em = NOW()
      WHERE id = $2`,
    [hashed, user.id]
  );
  return sessionPayload(user, rawToken);
}

router.post('/cadastro', authLimiter, async (req, res) => {
  try {
    const nome = String(req.body?.nome || req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const senha = String(req.body?.senha || req.body?.password || '');

    if (nome.length < 2) {
      return res.status(400).json({ ok: false, error: 'Informe o nome.' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ ok: false, error: 'Informe um e-mail válido.' });
    }
    if (senha.length < 6) {
      return res.status(400).json({ ok: false, error: 'A senha deve ter no mínimo 6 caracteres.' });
    }

    const existing = await query(
      `SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );
    if (existing.rows.length) {
      return res.status(409).json({ ok: false, error: 'Este e-mail já está cadastrado.' });
    }

    const hashed = await hashPassword(senha);
    let inserted;
    try {
      inserted = await query(
        `INSERT INTO usuarios (nome, email, senha, two_fa_ativo)
         VALUES ($1, $2, $3, false)
         RETURNING id, nome, email, two_fa_ativo`,
        [nome, email, hashed]
      );
    } catch (err) {
      if (/two_fa_ativo|column .* does not exist/i.test(String(err.message || ''))) {
        inserted = await query(
          `INSERT INTO usuarios (nome, email, senha)
           VALUES ($1, $2, $3)
           RETURNING id, nome, email`,
          [nome, email, hashed]
        );
      } else {
        throw err;
      }
    }

    return res.status(201).json({
      ok: true,
      user: publicUser({ ...inserted.rows[0], two_fa_ativo: false })
    });
  } catch (err) {
    console.error('cadastro', err);
    return res.status(500).json({ ok: false, error: 'Erro ao cadastrar.' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const senha = String(req.body?.senha || req.body?.password || '');

    if (!email || !senha) {
      return res.status(400).json({ ok: false, error: 'Informe e-mail e senha.' });
    }

    let result;
    try {
      result = await query(
        `SELECT id, nome, email, senha, two_fa_ativo, ativo
           FROM usuarios
          WHERE LOWER(email) = LOWER($1)
          LIMIT 1`,
        [email]
      );
    } catch (err) {
      if (/two_fa_ativo|column .* does not exist/i.test(String(err.message || ''))) {
        result = await query(
          `SELECT id, nome, email, senha
             FROM usuarios
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1`,
          [email]
        );
      } else {
        throw err;
      }
    }

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ ok: false, error: 'E-mail ou senha inválidos.' });
    }

    const check = await verifyPassword(senha, user.senha);
    if (!check.ok) {
      return res.status(401).json({ ok: false, error: 'E-mail ou senha inválidos.' });
    }

    if (check.needsRehash) {
      try {
        await query(`UPDATE usuarios SET senha = $1 WHERE id = $2`, [
          await hashPassword(senha),
          user.id
        ]);
      } catch (err) {
        console.warn('rehash', err.message);
      }
    }

    if (user.ativo === false) {
      return res.status(403).json({
        ok: false,
        error: 'Conta desativada. Entre em contato com o suporte.',
        reason: 'disabled'
      });
    }

    if (user.two_fa_ativo === true) {
      const lock = getLock(user.id);
      if (lock.blocked) {
        return res.status(429).json({
          ok: false,
          error: 'Muitas tentativas de 2FA. Aguarde alguns minutos.',
          reason: 'locked',
          retryAfterSec: lock.retryAfterSec
        });
      }
      return res.json({
        ok: true,
        requires2fa: true,
        tempToken: createChallenge(user.id, user.email),
        email: user.email
      });
    }

    return res.json({ ok: true, session: await issueSession(user) });
  } catch (err) {
    console.error('login', err);
    return res.status(500).json({ ok: false, error: 'Erro ao entrar.' });
  }
});

module.exports = { router, issueSession, sessionPayload };
