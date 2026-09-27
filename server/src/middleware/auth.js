'use strict';

const { query } = require('../db');
const { hashSessionToken } = require('../utils/crypto-auth');

function readBearer(req) {
  const header = String(req.headers.authorization || '');
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  return String(req.headers['x-session-token'] || '').trim();
}

async function authRequired(req, res, next) {
  try {
    const token = readBearer(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Não autenticado.' });
    }
    const hashed = hashSessionToken(token);
    let result;
    try {
      result = await query(
        `SELECT id, nome, email, two_fa_ativo
           FROM usuarios
          WHERE sessao_token = $1
          LIMIT 1`,
        [hashed]
      );
    } catch (err) {
      if (/two_fa_ativo|column .* does not exist/i.test(String(err.message || ''))) {
        result = await query(
          `SELECT id, nome, email
             FROM usuarios
            WHERE sessao_token = $1
            LIMIT 1`,
          [hashed]
        );
      } else {
        throw err;
      }
    }
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Sessão inválida ou expirada.' });
    }
    req.user = {
      id: Number(user.id),
      nome: user.nome,
      email: user.email,
      twoFaAtivo: user.two_fa_ativo === true,
      sessionToken: token
    };
    return next();
  } catch (err) {
    console.error('authRequired', err.message);
    return res.status(500).json({ ok: false, error: 'Erro ao validar sessão.' });
  }
}

module.exports = { authRequired, readBearer };
