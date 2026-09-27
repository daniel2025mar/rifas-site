/**
 * Aviso do sistema — modal para usuários logados / sistema aberto
 * (não usa o sino de notificações)
 *
 * Entendi grava a leitura no servidor (aviso_sistema_lido).
 * O mesmo aviso não volta para aquele usuário até o desenvolvedor
 * publicar um novo registro/token em aviso_sistema.
 */
(function () {
  const CHECK_MS = 60 * 1000;
  const SEEN_KEY = 'pas_aviso_visto_token';
  const EXEMPT_PAGES = new Set([
    'dev.html',
    'dev-login.html',
    'offline.html',
    'index.html',
    'login.html',
    'cadastro.html',
    'termos.html'
  ]);

  let pollTimer = null;
  let checking = false;
  let showing = false;
  let lastToken = '';
  let suppressedToken = '';

  function pageFile() {
    try {
      const path = String(window.location.pathname || '');
      return (path.split('/').pop() || '').toLowerCase() || 'index.html';
    } catch {
      return 'index.html';
    }
  }

  function hasUserSession() {
    try {
      if (typeof Store === 'undefined' || typeof Store.getSession !== 'function') return false;
      const session = Store.getSession();
      if (!session?.userId) return false;
      if (typeof Store.hasAuthGate === 'function' && !Store.hasAuthGate()) return false;
      return true;
    } catch {
      return false;
    }
  }

  function isExempt() {
    if (EXEMPT_PAGES.has(pageFile())) return true;
    try {
      if (typeof DevAuth !== 'undefined' && DevAuth.isLoggedIn?.()) return true;
    } catch {
      /* ignore */
    }
    return !hasUserSession();
  }

  function getSeenToken() {
    try {
      return String(sessionStorage.getItem(SEEN_KEY) || '');
    } catch {
      return '';
    }
  }

  function setSeenToken(token) {
    try {
      sessionStorage.setItem(SEEN_KEY, String(token || ''));
    } catch {
      /* ignore */
    }
  }

  function clearSeenToken() {
    try {
      sessionStorage.removeItem(SEEN_KEY);
    } catch {
      /* ignore */
    }
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function markAvisoRead(token) {
    const value = String(token || '').trim();
    if (!value) return false;
    if (typeof API === 'undefined' || typeof API.markSystemAvisoRead !== 'function') {
      setSeenToken(value);
      return true;
    }
    try {
      const res = await API.markSystemAvisoRead(value);
      if (res?.ok) {
        setSeenToken(value);
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  function showAviso(aviso) {
    if (!aviso?.token || showing) return;
    if (typeof UI === 'undefined' || typeof UI.modal !== 'function') return;
    if (document.getElementById('app-modal')) return;

    showing = true;
    lastToken = String(aviso.token);

    UI.modal({
      title: String(aviso.title || 'Aviso do sistema'),
      body: `
        <div class="pas-system-aviso">
          <p class="pas-system-aviso__msg">${escapeHtml(aviso.message || '').replace(/\n/g, '<br>')}</p>
        </div>
      `,
      actions: [
        {
          label: 'Entendi',
          className: 'btn-primary',
          onClick: async (close) => {
            await markAvisoRead(aviso.token);
            showing = false;
            close();
          }
        }
      ],
      onClose: () => {
        showing = false;
        suppressedToken = String(aviso.token || '');
      }
    });
  }

  async function check() {
    if (checking || isExempt() || document.hidden) return;
    if (typeof API === 'undefined' || typeof API.getSystemAviso !== 'function') return;

    checking = true;
    try {
      const res = await API.getSystemAviso();
      const aviso = res?.aviso;
      if (!res?.ok || !aviso?.active || !aviso?.token) return;
      const token = String(aviso.token);
      if (aviso.seen) {
        setSeenToken(token);
        return;
      }
      if (getSeenToken() === token) return;
      if (suppressedToken === token) return;
      if (showing && lastToken === token) return;
      showAviso(aviso);
    } catch {
      /* ignore */
    } finally {
      checking = false;
    }
  }

  function start() {
    if (pollTimer) return;
    check();
    pollTimer = setInterval(() => {
      if (document.hidden) return;
      check();
    }, CHECK_MS);
  }

  function boot() {
    if (isExempt()) return;
    start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) check();
  });
  window.addEventListener('focus', () => check());

  window.AvisoSistema = {
    clearSeenCache: clearSeenToken
  };
})();
