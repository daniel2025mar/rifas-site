/**
 * Maintenance guard — bloqueia o sistema todo quando o desenvolvedor ativa a manutenção
 */
(function () {
  const OVERLAY_ID = 'pas-maintenance-overlay';
  const CHECK_MS = 15 * 1000;
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
  let lastActive = false;
  let lastAccountCancelled = false;

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
      if (typeof DevAuth !== 'undefined' && typeof DevAuth.isLoggedIn === 'function' && DevAuth.isLoggedIn()) {
        return true;
      }
    } catch { /* ignore */ }
    // Só bloqueia depois do login (sessão autenticada)
    if (!hasUserSession()) return true;
    return false;
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDisabledAt(value) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(value);
    }
  }

  function ensureOverlay() {
    let el = document.getElementById(OVERLAY_ID);
    if (el) return el;

    el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.className = 'pas-maintenance-overlay';
    el.hidden = true;
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'pas-maintenance-brand');
    el.setAttribute('aria-describedby', 'pas-maintenance-msg');
    el.innerHTML =
      '<div class="pas-maintenance-overlay__bg" aria-hidden="true">' +
      '<span class="pas-maintenance-overlay__orb pas-maintenance-overlay__orb--a"></span>' +
      '<span class="pas-maintenance-overlay__orb pas-maintenance-overlay__orb--b"></span>' +
      '<span class="pas-maintenance-overlay__grid"></span>' +
      '</div>' +
      '<div class="pas-maintenance-overlay__content">' +
      '<div class="pas-maintenance-overlay__logo-wrap">' +
      '<img class="pas-maintenance-overlay__logo" src="assets/Power2.png" alt="PowerApps" width="112" height="112">' +
      '</div>' +
      '<p id="pas-maintenance-brand" class="pas-maintenance-overlay__brand">Power<span>Apps</span></p>' +
      '<p class="pas-maintenance-overlay__subtitle">Systems</p>' +
      '<div class="pas-maintenance-overlay__rule" aria-hidden="true"></div>' +
      '<p class="pas-maintenance-overlay__status">Sistema temporariamente indisponível</p>' +
      '<p class="pas-maintenance-overlay__date" id="pas-maintenance-date"></p>' +
      '<div class="pas-maintenance-overlay__message">' +
      '<p class="pas-maintenance-overlay__msg" id="pas-maintenance-msg"></p>' +
      '</div>' +
      '</div>';
    document.body.appendChild(el);
    return el;
  }

  function formatMaintenanceMessage(raw) {
    const text = String(raw || '').trim() ||
      'O sistema está temporariamente desativado para manutenção.';
    // Permite **negrito** simples sem HTML livre
    return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  function showMaintenance(maintenance) {
    if (isExempt()) return;
    const el = ensureOverlay();
    const dateEl = document.getElementById('pas-maintenance-date');
    const msgEl = document.getElementById('pas-maintenance-msg');
    const when = formatDisabledAt(maintenance?.disabledAt);
    const message = String(maintenance?.message || '').trim();

    if (dateEl) {
      dateEl.innerHTML =
        '<span class="pas-maintenance-overlay__date-label">Manutenção</span>' +
        '<strong>' +
        escapeHtml(when) +
        '</strong>';
    }
    if (msgEl) msgEl.innerHTML = formatMaintenanceMessage(message);

    el.hidden = false;
    document.documentElement.classList.add('pas-is-maintenance');
    lastActive = true;
    const messageBox = el.querySelector('.pas-maintenance-overlay__message');
    if (messageBox) messageBox.scrollTop = 0;
  }

  function showAccountCancelled(profile) {
    if (isExempt()) return;
    const el = ensureOverlay();
    const dateEl = document.getElementById('pas-maintenance-date');
    const msgEl = document.getElementById('pas-maintenance-msg');

    if (dateEl) {
      dateEl.innerHTML =
        '<span class="pas-maintenance-overlay__date-label">Conta bloqueada</span>' +
        '<strong>Assinatura cancelada</strong>';
    }
    if (msgEl) {
      const name = String(profile?.name || '').trim();
      msgEl.innerHTML =
        (name ? `Olá, <strong>${escapeHtml(name)}</strong>. ` : '') +
        'A sua assinatura foi cancelada e o acesso ao sistema está bloqueado. ' +
        'Entre em contacto com o suporte para reativar a sua conta.';
    }

    el.hidden = false;
    document.documentElement.classList.add('pas-is-maintenance');
    lastAccountCancelled = true;
    const statusEl = el.querySelector('.pas-maintenance-overlay__status');
    if (statusEl) statusEl.textContent = 'Acesso bloqueado';
  }

  function hideMaintenance() {
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.hidden = true;
    document.documentElement.classList.remove('pas-is-maintenance');
    lastActive = false;
    lastAccountCancelled = false;
    const statusEl = el?.querySelector('.pas-maintenance-overlay__status');
    if (statusEl) statusEl.textContent = 'Sistema temporariamente indisponível';
  }

  async function fetchStatus() {
    if (typeof API === 'undefined' || typeof API.getSystemMaintenance !== 'function') {
      return null;
    }
    try {
      const res = await API.getSystemMaintenance();
      if (!res || res.needsSchema) return null;
      return res.maintenance || null;
    } catch {
      return null;
    }
  }

  async function fetchPaymentProfile() {
    if (typeof API === 'undefined' || typeof API.getPaymentProfile !== 'function') {
      return null;
    }
    try {
      const res = await API.getPaymentProfile();
      return res?.ok ? res.profile || null : null;
    } catch {
      return null;
    }
  }

  async function sync() {
    if (isExempt() || checking) return;
    checking = true;
    try {
      const [maintenance, profile] = await Promise.all([fetchStatus(), fetchPaymentProfile()]);
      const cancelled = String(profile?.statusPagamento || '').trim().toLowerCase() === 'cancelado';
      if (cancelled) {
        showAccountCancelled(profile);
        return;
      }
      if (lastAccountCancelled) hideMaintenance();
      if (!maintenance) {
        if (lastActive) hideMaintenance();
        return;
      }
      if (maintenance.active) showMaintenance(maintenance);
      else hideMaintenance();
    } finally {
      checking = false;
    }
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      if (document.hidden) return;
      sync();
    }, CHECK_MS);
  }

  function boot() {
    if (isExempt()) return;
    ensureOverlay();
    sync();
    startPolling();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) sync();
  });

  window.MaintenanceGuard = {
    sync,
    show: showMaintenance,
    hide: hideMaintenance
  };
})();
