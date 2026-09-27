/**
 * PowerApps Sistemas — Store (sessão + cache de rifas)
 * - Sessão em localStorage para navegar entre páginas do painel
 * - Flag em sessionStorage: só libera o painel após login nesta abertura do navegador
 * Dados persistentes ficam no Supabase.
 */

const Store = (() => {
  const KEYS = {
    session: 'pas_session',
    rafflesCache: 'pas_raffles_cache',
    authGate: 'pas_auth_ok',
    dashShortcuts: 'pas_dash_shortcuts'
  };

  function read(key, fallback, storage = localStorage) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value, storage = localStorage) {
    if (value == null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  }

  /** @type {{ userId: string|number, email: string, name: string, sessionToken?: string } | null} */
  let session = read(KEYS.session, null);

  /** Cache local das rifas do usuário (hidratado pelo API) */
  let raffles = read(KEYS.rafflesCache, []);

  function persistSession() {
    write(KEYS.session, session);
    if (session) {
      localStorage.setItem('usuario_id', String(session.userId));
      localStorage.setItem('usuario_nome', session.name || '');
      localStorage.setItem('usuario_email', session.email || '');
    } else {
      localStorage.removeItem('usuario_id');
      localStorage.removeItem('usuario_nome');
      localStorage.removeItem('usuario_email');
      try { sessionStorage.removeItem(KEYS.authGate); } catch { /* ignore */ }
    }
  }

  function persistRaffles() {
    write(KEYS.rafflesCache, raffles);
  }

  /** Marca que o usuário autenticou nesta abertura do navegador */
  function markAuthenticated() {
    try { sessionStorage.setItem(KEYS.authGate, '1'); } catch { /* ignore */ }
  }

  /** true se fez login nesta sessão do navegador */
  function hasAuthGate() {
    try { return sessionStorage.getItem(KEYS.authGate) === '1'; } catch { return false; }
  }

  /** Encerra sessão e exige novo login */
  function resetForLoginScreen() {
    session = null;
    raffles = [];
    persistSession();
    write(KEYS.rafflesCache, []);
    try {
      sessionStorage.removeItem(KEYS.authGate);
      sessionStorage.removeItem('pas_nav_allowed');
      sessionStorage.removeItem('pas_aviso_visto_token');
    } catch { /* ignore */ }
  }

  function padNumber(n, total) {
    const size = String(total).length;
    return String(n).padStart(Math.max(size, 2), '0');
  }

  function nowParts() {
    const d = new Date();
    // Sempre DD/MM/AAAA (evita 1/8/2026 sem zero à esquerda)
    const date = [
      String(d.getDate()).padStart(2, '0'),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getFullYear())
    ].join('/');
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return { date, time };
  }

  function dashShortcutsKey(userId) {
    const id = userId || session?.userId || 'guest';
    return `${KEYS.dashShortcuts}_${id}`;
  }

  /** Preferência: mostrar atalhos na tela inicial (padrão: sim) */
  function getDashShortcutsEnabled(userId) {
    try {
      const raw = localStorage.getItem(dashShortcutsKey(userId));
      if (raw === null) return true;
      return raw === '1';
    } catch {
      return true;
    }
  }

  function setDashShortcutsEnabled(enabled, userId) {
    try {
      localStorage.setItem(dashShortcutsKey(userId), enabled ? '1' : '0');
    } catch { /* ignore */ }
  }

  return {
    KEYS,
    getSession: () => session,
    setSession: (s) => { session = s; persistSession(); },
    clearSession: () => { session = null; persistSession(); },
    markAuthenticated,
    hasAuthGate,
    resetForLoginScreen,
    getRaffles: () => raffles,
    setRaffles: (list) => { raffles = list; persistRaffles(); },
    getRaffleById: (id) => raffles.find((r) => String(r.id) === String(id)) || null,
    upsertRaffle: (raffle) => {
      const idx = raffles.findIndex((r) => String(r.id) === String(raffle.id));
      if (idx >= 0) raffles[idx] = raffle;
      else raffles.push(raffle);
      persistRaffles();
      return raffle;
    },
    removeRaffle: (id) => {
      raffles = raffles.filter((r) => String(r.id) !== String(id));
      persistRaffles();
    },
    padNumber,
    nowParts,
    getDashShortcutsEnabled,
    setDashShortcutsEnabled
  };
})();

window.Store = Store;
