/**
 * Proteção central de rotas — PowerApps Sistemas
 *
 * Uso (páginas do painel via Layout.render — já integrado):
 *   const r = await protegerRota(); // ou ProtecaoRota.protegerRota()
 *   if (!r.ok) return;
 *
 * Nova página protegida:
 *   1) Registrar em ROTAS abaixo (ou ProtecaoRota.registrarRota)
 *   2) Incluir este script após api.js
 *   3) Chamar protegerRota() / Layout.render() antes de montar o conteúdo
 *
 * Níveis: publico < usuario < admin < super_admin
 * Autenticação: sessão real (sessao_token no Supabase), não só localStorage.
 */
const ProtecaoRota = (() => {
  const LOGIN_URL = 'login.html';
  const DASHBOARD_URL = 'dashboard.html';
  const DEV_LOGIN_URL = 'dev-login.html';

  const NIVEIS = Object.freeze({
    PUBLICO: 'publico',
    USUARIO: 'usuario',
    ADMIN: 'admin',
    SUPER_ADMIN: 'super_admin'
  });

  const RANK = Object.freeze({
    [NIVEIS.PUBLICO]: 0,
    [NIVEIS.USUARIO]: 1,
    [NIVEIS.ADMIN]: 2,
    [NIVEIS.SUPER_ADMIN]: 3
  });

  /**
   * Catálogo de rotas.
   * nivel: mínimo exigido
   * portal: 'dev' = sessão DevAuth (não a sessão do painel)
   * skipPayment: não aplica gate de pagamento empresarial
   */
  const ROTAS = {
    'index.html': { nivel: NIVEIS.PUBLICO },
    'login.html': { nivel: NIVEIS.PUBLICO },
    'cadastro.html': { nivel: NIVEIS.PUBLICO },
    'offline.html': { nivel: NIVEIS.PUBLICO },
    'instagram-callback.html': { nivel: NIVEIS.PUBLICO },
    'termos.html': { nivel: NIVEIS.PUBLICO },
    'dev-login.html': { nivel: NIVEIS.PUBLICO },

    'dashboard.html': { nivel: NIVEIS.USUARIO },
    'nova-rifa.html': { nivel: NIVEIS.USUARIO },
    'minhas-rifas.html': { nivel: NIVEIS.USUARIO },
    'visualizar-rifa.html': { nivel: NIVEIS.USUARIO },
    'vendas.html': { nivel: NIVEIS.USUARIO },
    'reservas.html': { nivel: NIVEIS.USUARIO },
    'compartilhamentos.html': { nivel: NIVEIS.USUARIO },
    'sorteios.html': { nivel: NIVEIS.USUARIO },
    'configuracoes.html': { nivel: NIVEIS.USUARIO },
    'pagamento.html': { nivel: NIVEIS.USUARIO, skipPayment: true },
    'compartilhar.html': { nivel: NIVEIS.USUARIO, hybrid: true },

    'admin-pagamentos.html': { nivel: NIVEIS.ADMIN },
    'dev.html': { nivel: NIVEIS.SUPER_ADMIN, portal: 'dev', skipPayment: true }
  };

  function pageFileFromHref(href) {
    try {
      const u = new URL(String(href || ''), window.location.href);
      return (u.pathname.split('/').pop() || '').toLowerCase() || 'index.html';
    } catch {
      return String(href || '')
        .split('?')[0]
        .split('#')[0]
        .split('/')
        .pop()
        .toLowerCase() || 'index.html';
    }
  }

  function currentPageFile() {
    return pageFileFromHref(window.location.pathname);
  }

  function registrarRota(page, config) {
    const file = String(page || '').toLowerCase();
    if (!file) return;
    ROTAS[file] = { ...(ROTAS[file] || {}), ...(config || {}) };
  }

  function getRota(page = currentPageFile()) {
    const file = pageFileFromHref(page);
    return ROTAS[file] || null;
  }

  /**
   * compartilhar.html: comprador (?id=) é público;
   * modo dono (?share=1) exige autenticação.
   */
  function resolveRotaEfetiva(page = currentPageFile(), search = window.location.search) {
    const file = pageFileFromHref(page);
    const base = ROTAS[file] || { nivel: NIVEIS.USUARIO };
    if (file === 'compartilhar.html' || base.hybrid) {
      const params = new URLSearchParams(search || '');
      const shareAdmin = params.get('share') === '1';
      if (!shareAdmin) {
        return { nivel: NIVEIS.PUBLICO, hybrid: true, page: file };
      }
    }
    return { ...base, page: file };
  }

  function normalizeNivel(value) {
    const v = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    if (
      v === 'super_admin' ||
      v === 'superadmin' ||
      v === 'super_administrador' ||
      v === 'developer' ||
      v === 'dev'
    ) {
      return NIVEIS.SUPER_ADMIN;
    }
    if (v === 'administrador' || v === 'admin') return NIVEIS.ADMIN;
    if (v === 'usuario' || v === 'user' || v === 'comum') return NIVEIS.USUARIO;
    if (v === 'publico' || v === 'public') return NIVEIS.PUBLICO;
    return NIVEIS.USUARIO;
  }

  function isAdminEmailLocal(_email) {
    return false;
  }

  /**
   * Resolve nível efetivo a partir de nivel_acesso da sessão (API).
   * Portal dev autenticado conta como super_admin.
   */
  function resolverNivelAcesso(sessionOrEmail) {
    if (!sessionOrEmail) return NIVEIS.PUBLICO;

    if (typeof sessionOrEmail === 'object' && sessionOrEmail.portal === 'dev') {
      const n = normalizeNivel(sessionOrEmail.nivelAcesso || sessionOrEmail.nivel_acesso || '');
      return n === NIVEIS.SUPER_ADMIN || n === NIVEIS.ADMIN ? n : NIVEIS.SUPER_ADMIN;
    }

    if (typeof sessionOrEmail === 'object') {
      const fromDb = normalizeNivel(
        sessionOrEmail.nivelAcesso || sessionOrEmail.nivel_acesso || ''
      );
      if (fromDb === NIVEIS.SUPER_ADMIN || fromDb === NIVEIS.ADMIN) return fromDb;
      if (typeof API !== 'undefined' && typeof API.isDeveloperAccount === 'function') {
        if (API.isDeveloperAccount(sessionOrEmail)) return NIVEIS.SUPER_ADMIN;
      }
      return NIVEIS.USUARIO;
    }

    return NIVEIS.USUARIO;
  }

  function temPermissao(nivelUsuario, nivelExigido) {
    const have = RANK[normalizeNivel(nivelUsuario)] ?? 0;
    const need = RANK[normalizeNivel(nivelExigido)] ?? 0;
    return have >= need;
  }

  function buildLoginUrl(motivo) {
    const q = motivo ? `?motivo=${encodeURIComponent(motivo)}` : '';
    return `${LOGIN_URL}${q}`;
  }

  function redirectLogin(motivo) {
    try {
      if (typeof Store !== 'undefined') {
        if (typeof Store.resetForLoginScreen === 'function') Store.resetForLoginScreen();
        else if (typeof Store.clearSession === 'function') Store.clearSession();
      }
    } catch { /* ignore */ }
    window.location.replace(buildLoginUrl(motivo));
  }

  function redirectForbidden() {
    try {
      if (typeof Layout !== 'undefined' && typeof Layout.allowNavigate === 'function') {
        Layout.allowNavigate(DASHBOARD_URL);
      }
    } catch { /* ignore */ }
    window.location.replace(DASHBOARD_URL);
  }

  function localSessionOk() {
    if (typeof Store === 'undefined') return false;
    const session = Store.getSession();
    if (!session?.userId) return false;
    const gateOk = typeof Store.hasAuthGate === 'function' ? Store.hasAuthGate() : true;
    return Boolean(gateOk);
  }

  /**
   * Validação da sessão no Supabase (token real).
   * Preferência: RPC pas_validar_sessao; fallback: API.validateActiveSession.
   */
  async function validarSessaoRemota() {
    if (typeof API === 'undefined') {
      return { ok: false, reason: 'no-api' };
    }

    if (typeof API.validateSessionRemote === 'function') {
      return API.validateSessionRemote();
    }

    const check = await API.validateActiveSession({ strict: true });
    if (check.ok || check.reason === 'schema' || check.reason === 'network') {
      return { ok: true, session: Store.getSession(), skipped: check.skipped, reason: check.reason };
    }
    return { ok: false, reason: check.reason || 'invalid' };
  }

  /**
   * @param {object} [options]
   * @param {string} [options.page] — arquivo HTML (default: página atual)
   * @param {string} [options.nivel] — sobrescreve nível mínimo
   * @param {boolean} [options.redirect=true]
   * @param {boolean} [options.validateRemote=true] — valida sessao_token no banco
   * @param {boolean} [options.ensurePayment=true] — gate empresarial → pagamento.html
   * @param {boolean} [options.silent=false] — não redireciona; só retorna resultado
   * @returns {Promise<{ok:boolean, session?:object, nivel?:string, reason?:string}>}
   */
  async function protegerRota(options = {}) {
    const page = pageFileFromHref(options.page || currentPageFile());
    const efetiva = resolveRotaEfetiva(page);
    const nivelExigido = normalizeNivel(options.nivel || efetiva.nivel || NIVEIS.USUARIO);
    const redirect = options.redirect !== false && options.silent !== true;
    const validateRemote = options.validateRemote !== false;
    const ensurePayment =
      options.ensurePayment !== false && !efetiva.skipPayment && nivelExigido !== NIVEIS.PUBLICO;

    if (nivelExigido === NIVEIS.PUBLICO) {
      return { ok: true, public: true, page, nivel: NIVEIS.PUBLICO };
    }

    // Portal do desenvolvedor (sessão separada; privilégio via nivelAcesso da API)
    if (efetiva.portal === 'dev') {
      if (typeof DevAuth === 'undefined' || !DevAuth.isLoggedIn()) {
        if (redirect) window.location.replace(DEV_LOGIN_URL);
        return { ok: false, reason: 'dev-auth', page };
      }
      const devSession = DevAuth.getSession();
      const nivelDev = normalizeNivel(devSession?.nivelAcesso || '');
      if (nivelDev !== NIVEIS.SUPER_ADMIN && nivelDev !== NIVEIS.ADMIN) {
        try {
          DevAuth.logout?.();
        } catch {
          /* ignore */
        }
        if (redirect) window.location.replace(DEV_LOGIN_URL);
        return { ok: false, reason: 'forbidden', page };
      }
      const nivel = NIVEIS.SUPER_ADMIN;
      if (!temPermissao(nivel, nivelExigido)) {
        if (redirect) window.location.replace(DEV_LOGIN_URL);
        return { ok: false, reason: 'forbidden', page, nivel };
      }
      return { ok: true, session: { ...devSession, portal: 'dev', nivelAcesso: 'super_admin' }, nivel, page };
    }

    // Gate local rápido (evita flash / URL digitada sem login)
    if (!localSessionOk()) {
      if (redirect) redirectLogin('auth');
      return { ok: false, reason: 'auth', page };
    }

    let session = Store.getSession();

    if (validateRemote) {
      if (typeof UI !== 'undefined' && options.showLoading !== false) {
        try { UI.showLoading('Validando sessão...'); } catch { /* ignore */ }
      }
      let remote;
      try {
        remote = await validarSessaoRemota();
      } finally {
        if (typeof UI !== 'undefined' && options.showLoading !== false) {
          try { UI.hideLoading(); } catch { /* ignore */ }
        }
      }

      if (!remote?.ok) {
        const softFail = remote?.reason === 'network' || remote?.reason === 'schema';
        if (!softFail) {
          if (redirect) {
            if (typeof API !== 'undefined' && typeof API.logout === 'function') {
              try { await API.logout(); } catch { /* ignore */ }
            }
            redirectLogin(remote?.reason === 'replaced' ? 'outro-dispositivo' : 'sessao');
          }
          return { ok: false, reason: remote?.reason || 'sessao', page };
        }
        session = Store.getSession();
      } else {
        session = remote.session || Store.getSession();
      }
    }

    const nivel = resolverNivelAcesso(session);
    if (session && session.nivelAcesso !== nivel) {
      try {
        Store.setSession({ ...session, nivelAcesso: nivel });
        session = Store.getSession();
      } catch { /* ignore */ }
    }

    if (!temPermissao(nivel, nivelExigido)) {
      if (redirect) redirectForbidden();
      return { ok: false, reason: 'forbidden', session, nivel, page };
    }

    // Autoriza navegação direta por URL quando a sessão/nível são válidos
    try {
      if (typeof Layout !== 'undefined' && typeof Layout.allowNavigate === 'function') {
        Layout.allowNavigate(page);
      } else {
        const key = 'pas_nav_allowed';
        const raw = sessionStorage.getItem(key);
        const list = raw ? JSON.parse(raw) : [];
        const set = new Set(Array.isArray(list) ? list.map((x) => String(x).toLowerCase()) : []);
        set.add(page);
        sessionStorage.setItem(key, JSON.stringify([...set]));
      }
    } catch { /* ignore */ }

    if (ensurePayment && typeof API !== 'undefined' && typeof API.ensurePaymentAccess === 'function') {
      const pay = await API.ensurePaymentAccess();
      if (!pay?.ok) {
        return { ok: false, reason: pay?.reason || 'payment', session, nivel, page };
      }
    }

    return { ok: true, session, nivel, page };
  }

  /** Proteção síncrona mínima ao carregar o script (antes do async). */
  function earlyGate() {
    try {
      const efetiva = resolveRotaEfetiva();
      if (efetiva.nivel === NIVEIS.PUBLICO) return;
      if (efetiva.portal === 'dev') return;
      if (!localSessionOk()) {
        redirectLogin('auth');
      }
    } catch { /* ignore */ }
  }

  earlyGate();

  return {
    NIVEIS,
    LOGIN_URL,
    ROTAS,
    registrarRota,
    getRota,
    resolveRotaEfetiva,
    pageFileFromHref,
    currentPageFile,
    normalizeNivel,
    resolverNivelAcesso,
    temPermissao,
    protegerRota,
    redirectLogin,
    buildLoginUrl
  };
})();

window.ProtecaoRota = ProtecaoRota;
window.protegerRota = (...args) => ProtecaoRota.protegerRota(...args);
