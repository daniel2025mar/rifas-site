/**
 * Controle de sessão do painel:
 * - logout por inatividade
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
    return nivel === 'super_admin' || session.portal === 'dev' || session.isDev === true;
  } catch {
    return false;
  }
}
const SessaoIdle = (() => {
  /** 15 minutos sem interação → logout */
  const IDLE_MS = 15 * 60 * 1000;
  const CHECK_MS = 30 * 1000;
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

  function touch() {
    lastActive = Date.now();
  }

  async function forceLogout(message, motivo) {
    if (loggingOut) return;
    if (!Store.getSession()) return;
    loggingOut = true;
    try {
      if (typeof UI !== 'undefined') {
        UI.showLoading('Sessão encerrada...');
        if (message) UI.toast(message, 'info');
      }
      await API.logout();
    } catch {
      try { Store.clearSession(); } catch { /* ignore */ }
    } finally {
      if (typeof UI !== 'undefined') UI.hideLoading();
      window.location.href =
        (typeof ProtecaoRota !== 'undefined' && ProtecaoRota.buildLoginUrl
          ? ProtecaoRota.buildLoginUrl(motivo || 'inatividade')
          : `login.html?motivo=${encodeURIComponent(motivo || 'inatividade')}`);
    }
  }

  function check() {
    if (!Store.getSession()) return;
    if (Date.now() - lastActive >= IDLE_MS) {
      forceLogout('Sessão encerrada por inatividade. Faça login novamente.', 'inatividade');
    }
  }

  function bind() {
    if (bound) {
      touch();
      return;
    }
    if (!Store.getSession()) return;
    bound = true;
    touch();

    ACTIVITY_EVENTS.forEach((evt) => {
      document.addEventListener(evt, touch, { passive: true, capture: true });
    });
    window.addEventListener('focus', touch);

    if (timer) clearInterval(timer);
    timer = setInterval(check, CHECK_MS);
  }

  return { bind, touch, forceLogout, IDLE_MS };
})();

const SessaoUnica = (() => {
  /** Validação periódica sem manter o banco ativo continuamente. */
  const CHECK_MS = 60 * 1000;
  const PRESENCE_MS = 5 * 60 * 1000;
  let timer = null;
  let presenceTimer = null;
  let bound = false;
  let checking = false;
  let touching = false;
  let schemaWarned = false;
  let lastForegroundCheckAt = 0;

  function kickMessage(reason) {
    if (reason === 'no-token' || reason === 'cleared' || reason === 'missing-user') {
      return 'Sessão inválida. Faça login novamente.';
    }
    return 'Sua conta entrou em outro dispositivo. Só é permitido um login por vez.';
  }

  async function touchPresence() {
    if (touching) return;
    if (!Store.getSession()) return;
    if (typeof API === 'undefined' || typeof API.touchPresence !== 'function') return;
    if (document.hidden) return;

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

  async function check() {
    if (checking) return;
    if (!Store.getSession()) return;
    if (document.hidden) return;
    // Conta do desenvolvedor pode ficar aberta em vários dispositivos
    if (isDeveloperSession()) {
      return;
    }
    if (typeof API === 'undefined' || typeof API.validateActiveSession !== 'function') return;

    checking = true;
    try {
      const result = await API.validateActiveSession({ strict: true });
      if (result?.ok || result?.reason === 'schema' || result?.reason === 'network') {
        return;
      }

      const msg = kickMessage(result?.reason);
      if (typeof SessaoIdle !== 'undefined' && SessaoIdle.forceLogout) {
        await SessaoIdle.forceLogout(msg, 'outro-dispositivo');
      } else {
        try { await API.logout(); } catch { /* ignore */ }
        window.location.href =
          typeof ProtecaoRota !== 'undefined' && ProtecaoRota.buildLoginUrl
            ? ProtecaoRota.buildLoginUrl('outro-dispositivo')
            : 'login.html?motivo=outro-dispositivo';
      }
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
    check();
    touchPresence();
  }

  function bind() {
    if (!Store.getSession()) return;
    if (bound) {
      check();
      touchPresence();
      return;
    }
    bound = true;
    check();
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
