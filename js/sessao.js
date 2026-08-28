/**
 * Controle de sessão do painel:
 * - logout por longa ausência (cliente + servidor)
 * - sessão única (só 1 dispositivo por vez) — checagem rigorosa
 *   (não se aplica à conta do desenvolvedor)
 */

function isDeveloperSession() {
  try {
    const session = typeof Store !== 'undefined' ? Store.getSession() : null;
    if (!session) return false;
    if (typeof API !== 'undefined' && typeof API.isDeveloperAccount === 'function') {
      return !!API.isDeveloperAccount(session);
    }
    const nivel = String(session.nivelAcesso || session.nivel_acesso || '')
      .trim()
      .toLowerCase();
    return session.isDev === true;
  } catch {
    return false;
  }
}

const SessaoIdle = (() => {
  /** Longa ausência sem uso real → logout automático (padrão 4h). */
  const IDLE_MS = 4 * 60 * 60 * 1000;
  const CHECK_MS = 60 * 1000;
  const LAST_KEY = 'pas_last_active_at';
  const ACTIVITY_EVENTS = [
    'mousemove',
    'mousedown',
    'keydown',
    'touchstart',
    'scroll',
    'click',
    'wheel'
  ];

  let lastActive = Date.now();
  let timer = null;
  let loggingOut = false;
  let bound = false;

  function storageKey() {
    try {
      const id = Store.getSession()?.userId;
      return id ? `${LAST_KEY}_${id}` : LAST_KEY;
    } catch {
      return LAST_KEY;
    }
  }

  function readSavedActive() {
    try {
      const n = Number(localStorage.getItem(storageKey()));
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  }

  function touch() {
    lastActive = Date.now();
    try {
      localStorage.setItem(storageKey(), String(lastActive));
    } catch {
      /* ignore */
    }
  }

  async function forceLogout(message, motivo) {
    if (loggingOut) return;
    if (!Store.getSession()) return;
    loggingOut = true;
    try {
      try {
        localStorage.removeItem(storageKey());
      } catch {
        /* ignore */
      }
      if (typeof UI !== 'undefined') {
        UI.showLoading('Sessão encerrada...');
        if (message) UI.toast(message, 'info');
      }
      await API.logout();
    } catch {
      try {
        Store.clearSession();
      } catch {
        /* ignore */
      }
    } finally {
      if (typeof UI !== 'undefined') UI.hideLoading();
      window.location.href =
        typeof ProtecaoRota !== 'undefined' && ProtecaoRota.buildLoginUrl
          ? ProtecaoRota.buildLoginUrl(motivo || 'inatividade')
          : `login.html?motivo=${encodeURIComponent(motivo || 'inatividade')}`;
    }
  }

  function check() {
    if (!Store.getSession()) return;
    if (isDeveloperSession()) return;
    if (Date.now() - lastActive >= IDLE_MS) {
      forceLogout(
        'Sessão encerrada por longa ausência. Faça login novamente.',
        'inatividade'
      );
    }
  }

  function bind() {
    if (bound) {
      check();
      if (Store.getSession()) touch();
      return;
    }
    if (!Store.getSession()) return;
    bound = true;

    const saved = readSavedActive();
    // Idle antigo no localStorage (de outro dia) NÃO deve deslogar no bind pós-login
    if (saved && Date.now() - saved < IDLE_MS) {
      lastActive = saved;
    } else {
      touch();
    }

    check();
    if (!Store.getSession()) return;

    ACTIVITY_EVENTS.forEach((evt) => {
      document.addEventListener(evt, touch, { passive: true, capture: true });
    });
    window.addEventListener('focus', () => {
      check();
      if (Store.getSession()) touch();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      check();
      if (Store.getSession()) touch();
    });

    if (timer) clearInterval(timer);
    timer = setInterval(check, CHECK_MS);
  }

  return { bind, touch, forceLogout, IDLE_MS };
})();

const SessaoUnica = (() => {
  const CHECK_MS = 15 * 1000;
  /** Presença só em primeiro plano — ausência longa encerra a sessão no servidor. */
  const PRESENCE_MS = 60 * 1000;
  let timer = null;
  let presenceTimer = null;
  let bound = false;
  let checking = false;
  let touching = false;
  let schemaWarned = false;
  let lastForegroundCheckAt = 0;
  let invalidListenerBound = false;

  function kickMessage(reason) {
    if (reason === 'expired') {
      return 'Sessão encerrada por longa ausência. Faça login novamente.';
    }
    if (reason === 'no-token' || reason === 'cleared' || reason === 'missing-user') {
      return 'Sessão inválida. Faça login novamente.';
    }
    if (reason === 'replaced') {
      return 'Sua conta entrou em outro dispositivo. Só é permitido um login por vez.';
    }
    return 'Sua conta entrou em outro dispositivo. Só é permitido um login por vez.';
  }

  async function kickOut(reason) {
    const msg = kickMessage(reason);
    const motivo = reason === 'expired' ? 'inatividade' : 'outro-dispositivo';
    if (typeof SessaoIdle !== 'undefined' && SessaoIdle.forceLogout) {
      await SessaoIdle.forceLogout(msg, motivo);
      return;
    }
    try {
      await API.logout();
    } catch {
      /* ignore */
    }
    window.location.href =
      typeof ProtecaoRota !== 'undefined' && ProtecaoRota.buildLoginUrl
        ? ProtecaoRota.buildLoginUrl(motivo)
        : `login.html?motivo=${motivo}`;
  }

  function bindInvalidListener() {
    if (invalidListenerBound) return;
    invalidListenerBound = true;
    window.addEventListener('pas-session-invalid', (event) => {
      const reason = event?.detail?.reason || 'replaced';
      if (isDeveloperSession()) return;
      kickOut(reason);
    });
  }

  async function touchPresence() {
    if (touching) return;
    if (!Store.getSession()) return;
    if (typeof API === 'undefined' || typeof API.touchPresence !== 'function') return;
    // Em segundo plano não renova atividade — permite expirar por ausência
    if (typeof document !== 'undefined' && document.hidden) return;

    touching = true;
    try {
      const res = await API.touchPresence();
      if (res?.needsSchema && !schemaWarned && typeof UI !== 'undefined') {
        schemaWarned = true;
        console.info(res.error || 'Execute supabase/presenca_online.sql');
      }
    } catch {
      /* ignore */
    } finally {
      touching = false;
    }
  }

  async function check(options) {
    if (checking) return;
    if (!Store.getSession()) return;
    if (document.hidden) return;
    if (isDeveloperSession()) return;
    if (typeof API === 'undefined' || typeof API.validateActiveSession !== 'function') return;

    checking = true;
    try {
      const result = await API.validateActiveSession({ strict: true, force: Boolean(options?.force) });
      if (result?.ok || result?.reason === 'schema' || result?.reason === 'network') {
        return;
      }

      await kickOut(result?.reason);
    } catch {
      /* ignore */
    } finally {
      checking = false;
    }
  }

  function refreshAfterForeground() {
    if (document.hidden) return;
    const now = Date.now();
    if (now - lastForegroundCheckAt < 1000) return;
    lastForegroundCheckAt = now;
    check({ force: true });
    touchPresence();
  }

  function bind() {
    if (!Store.getSession()) return;
    bindInvalidListener();
    if (bound) {
      check({ force: true });
      touchPresence();
      return;
    }
    bound = true;
    check({ force: true });
    touchPresence();
    lastForegroundCheckAt = Date.now();
    if (timer) clearInterval(timer);
    timer = setInterval(check, CHECK_MS);
    if (presenceTimer) clearInterval(presenceTimer);
    presenceTimer = setInterval(touchPresence, PRESENCE_MS);
    window.addEventListener('focus', refreshAfterForeground);
    window.addEventListener('pageshow', refreshAfterForeground);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshAfterForeground();
    });
  }

  return { bind, check, touchPresence };
})();

window.SessaoIdle = SessaoIdle;
window.SessaoUnica = SessaoUnica;
