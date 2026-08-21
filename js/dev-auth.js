/**
 * Sessão do Portal do Desenvolvedor
 *
 * A senha NUNCA fica no front nem em js/config.js.
 * Login → API Express → tabela usuarios.senha no Neon (bcrypt.compare no servidor).
 */
const DevAuth = (() => {
  const STORAGE_KEY = 'pas_dev_session';

  function getConfig() {
    const cfg = (window.PAS_CONFIG && window.PAS_CONFIG.DEV_PORTAL) || {};
    return {
      name: String(cfg.name || 'Desenvolvedor').trim() || 'Desenvolvedor'
    };
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.email || !data.loggedAt) return null;
      return data;
    } catch {
      return null;
    }
  }

  function setSession(session) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* ignore */
    }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  /**
   * Valida e-mail/senha no Neon (POST /api/auth/login).
   * Sem API online o portal não autentica.
   */
  async function login({ email, password }) {
    const cfg = getConfig();
    const mail = String(email || '').trim().toLowerCase();
    const pass = String(password || '');

    if (typeof API === 'undefined' || typeof API.loginDeveloperPortal !== 'function') {
      return {
        ok: false,
        error: 'Cliente da API não carregou. Recarregue a página.'
      };
    }

    const result = await API.loginDeveloperPortal({ email: mail, password: pass });
    if (!result.ok) return result;

    const session = {
      userId: result.session.userId,
      email: result.session.email,
      name: result.session.name || cfg.name,
      photo: result.session.photo || '',
      role: 'developer',
      sessionToken: result.session.sessionToken || null,
      nivelAcesso: result.session.nivelAcesso || 'super_admin',
      portal: 'dev',
      loggedAt: result.session.loggedAt || new Date().toISOString()
    };
    setSession(session);
    return { ok: true, session };
  }

  function logout() {
    clearSession();
  }

  function requireSession({ redirect = true } = {}) {
    const session = getSession();
    if (session) return session;
    if (redirect) {
      window.location.href = 'dev-login.html';
    }
    return null;
  }

  function adminEmail() {
    const session = getSession();
    return session?.email || '';
  }

  function userId() {
    const session = getSession();
    return session?.userId ? Number(session.userId) : null;
  }

  function isLoggedIn() {
    return Boolean(getSession());
  }

  return {
    STORAGE_KEY,
    getConfig,
    getSession,
    setSession,
    login,
    logout,
    requireSession,
    adminEmail,
    userId,
    isLoggedIn
  };
})();

window.DevAuth = DevAuth;
