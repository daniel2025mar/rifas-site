'use strict';

/**
 * Desafios de login 2FA + bloqueio por tentativas (memória do processo).
 * Em multi-instância, troque por Redis; no free tier single-instance basta.
 */
const crypto = require('crypto');

const challenges = new Map();
const locks = new Map();

function tempTtlMs() {
  const n = Number(process.env.LOGIN_TEMP_TTL_MS);
  return Number.isFinite(n) && n > 0 ? n : 5 * 60 * 1000;
}

function maxAttempts() {
  const n = Number(process.env.TWO_FA_MAX_ATTEMPTS);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

function lockDurationMs() {
  const n = Number(process.env.TWO_FA_LOCK_MS);
  return Number.isFinite(n) && n > 0 ? n : 15 * 60 * 1000;
}

function createChallenge(userId, email) {
  const token = crypto.randomBytes(32).toString('hex');
  challenges.set(token, {
    userId: Number(userId),
    email: String(email || ''),
    attempts: 0,
    expiresAt: Date.now() + tempTtlMs()
  });
  return token;
}

function getChallenge(token) {
  const key = String(token || '').trim();
  if (!key) return null;
  const entry = challenges.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    challenges.delete(key);
    return null;
  }
  return { token: key, ...entry };
}

function deleteChallenge(token) {
  challenges.delete(String(token || '').trim());
}

function getLock(userId) {
  const key = `u:${userId}`;
  const until = locks.get(key);
  if (!until) return { blocked: false, retryAfterSec: 0 };
  if (Date.now() >= until) {
    locks.delete(key);
    return { blocked: false, retryAfterSec: 0 };
  }
  return {
    blocked: true,
    retryAfterSec: Math.ceil((until - Date.now()) / 1000)
  };
}

function recordFailedAttempt(challenge) {
  if (!challenge) return { locked: false, attemptsLeft: 0 };
  const next = {
    ...challenge,
    attempts: Number(challenge.attempts || 0) + 1
  };
  challenges.set(challenge.token, next);
  if (next.attempts >= maxAttempts()) {
    locks.set(`u:${challenge.userId}`, Date.now() + lockDurationMs());
    deleteChallenge(challenge.token);
    return { locked: true, attemptsLeft: 0 };
  }
  return { locked: false, attemptsLeft: maxAttempts() - next.attempts };
}

function clearLock(userId) {
  locks.delete(`u:${userId}`);
}

module.exports = {
  createChallenge,
  getChallenge,
  deleteChallenge,
  getLock,
  recordFailedAttempt,
  clearLock
};
