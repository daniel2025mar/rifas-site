/**
 * Central de notificações do painel
 * - Persistidas no Supabase por usuario_id
 * - Atualização automática + som de alerta em novas notificações
 */
const Notificacoes = (() => {
  const POLL_MS = 60 * 1000;
  const SOUND_KEY = 'pas_notif_sound_ok';
  const ALERT_TYPES = new Set(['reserva', 'venda', 'sorteio', 'sistema']);

  const BELL_SVG = `
    <svg class="notif-bell__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3a6 6 0 0 0-6 6v2.2c0 .7-.2 1.4-.6 2L4.2 15.6A1 1 0 0 0 5 17h14a1 1 0 0 0 .8-1.4l-1.2-2.4c-.4-.6-.6-1.3-.6-2V9a6 6 0 0 0-6-6Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M9.5 17a2.5 2.5 0 0 0 5 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    </svg>`;

  let timer = null;
  let liveSub = null;
  let cache = [];
  let open = false;
  let bootstrapped = false;
  let schemaWarned = false;
  let knownIds = null;
  let knownPaymentSigs = null;
  let audioCtx = null;
  let soundUnlocked = false;
  let pendingSound = false;
  let refreshInFlight = false;
  let lastForegroundRefreshAt = 0;

  function getNotifSession() {
    const store = typeof Store !== 'undefined' ? Store.getSession() : null;
    if (store?.userId) return store;
    if (typeof DevAuth !== 'undefined' && DevAuth.isLoggedIn?.()) {
      return DevAuth.getSession();
    }
    return null;
  }

  function isDeveloperNotifContext() {
    try {
      if (typeof DevAuth !== 'undefined' && DevAuth.isLoggedIn?.()) return true;
    } catch {
      /* ignore */
    }
    try {
      const page = String(window.location.pathname || '')
        .split('/')
        .pop()
        .toLowerCase();
      if (page === 'dev.html') return true;
    } catch {
      /* ignore */
    }
    try {
      const store = typeof Store !== 'undefined' ? Store.getSession() : null;
      if (store && typeof API !== 'undefined' && typeof API.isDeveloperAccount === 'function') {
        return !!API.isDeveloperAccount(store);
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  /** Respostas do suporte no cliente vão no FAB, não no sino. */
  function isClientSupportReplyNotif(n) {
    if (isDeveloperNotifContext()) return false;
    const ref = String(n?.refKey || n?.ref_key || '');
    return /^user-support-reply-/i.test(ref);
  }

  function sanitizeAppHref(href) {
    const raw = String(href || '').trim();
    if (!raw) return '';
    if (/^[a-z0-9][\w.-]*\.html(?:[?#][^\s]*)?$/i.test(raw)) return raw;
    return '';
  }

  function visibleNotifications(list = cache) {
    return (list || []).filter((n) => !isClientSupportReplyNotif(n));
  }

  function unreadCount() {
    return visibleNotifications().filter((n) => !n.read).length;
  }

  function formatWhen(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function ensureAudio() {
    if (audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  }

  function unlockSound() {
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    soundUnlocked = true;
    try { sessionStorage.setItem(SOUND_KEY, '1'); } catch { /* ignore */ }
    if (pendingSound) {
      pendingSound = false;
      playNotifSound();
    }
  }

  function playNotifSound() {
    try {
      const ctx = ensureAudio();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
        if (!soundUnlocked) {
          pendingSound = true;
          return;
        }
      }

      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
      master.connect(ctx.destination);

      const beep = (freq, start, dur) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(0.28, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        osc.connect(gain);
        gain.connect(master);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.02);
      };

      // Alerta em 3 tons
      beep(740, 0, 0.12);
      beep(988, 0.14, 0.12);
      beep(1175, 0.28, 0.2);
    } catch (err) {
      console.warn('Som de notificação indisponível', err);
    }
  }

  function alertIds(list) {
    return new Set(
      (list || [])
        .filter((n) => !isClientSupportReplyNotif(n))
        .filter((n) => ALERT_TYPES.has(String(n.type || '').toLowerCase()))
        .filter((n) => !n.read)
        .map((n) => String(n.id))
    );
  }

  function maybePlayForNew(previousIds, nextList, forceNewSystem) {
    if (forceNewSystem) {
      if (soundUnlocked) playNotifSound();
      else pendingSound = true;
      return;
    }
    if (!previousIds) return;
    const next = alertIds(nextList);
    let hasNew = false;
    next.forEach((id) => {
      if (!previousIds.has(id)) hasNew = true;
    });
    if (!hasNew) return;
    if (soundUnlocked) playNotifSound();
    else pendingSound = true;
  }

  function headerHTML() {
    return `
      <div class="notif-wrap" id="notif-wrap">
        <button type="button" class="notif-bell" id="notif-bell" aria-label="Notificações" title="Notificações">
          ${BELL_SVG}
          <span class="notif-bell__badge is-empty" id="notif-badge" hidden></span>
        </button>
        <div class="notif-panel" id="notif-panel" hidden>
          <div class="notif-panel__head">
            <strong>Notificações</strong>
            <div class="notif-panel__actions">
              <button type="button" class="btn btn-ghost btn-sm" id="notif-mark-all">Marcar lidas</button>
              <button type="button" class="btn btn-ghost btn-sm" id="notif-clear-all">Limpar</button>
            </div>
          </div>
          <div class="notif-panel__list" id="notif-list">
            <p class="notif-empty">Carregando...</p>
          </div>
        </div>
      </div>`;
  }

  function renderBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const count = unreadCount();
    if (count > 0) {
      badge.hidden = false;
      badge.classList.remove('is-empty');
      badge.textContent = count > 9 ? '9+' : String(count);
    } else {
      badge.hidden = true;
      badge.classList.add('is-empty');
      badge.textContent = '';
    }
  }

  function renderList() {
    const list = document.getElementById('notif-list');
    if (!list) return;
    const items = visibleNotifications();
    if (!items.length) {
      list.innerHTML = '<p class="notif-empty">Nenhuma notificação no momento.</p>';
      return;
    }
    list.innerHTML = items.map((n) => {
      const unread = !n.read;
      const icon = n.type === 'sistema' ? '◆' : n.type === 'reserva' ? '◷' : n.type === 'sorteio' ? '★' : '●';
      return `
        <button type="button" class="notif-item ${unread ? 'is-unread' : ''}" data-notif-id="${UI.escapeHtml(n.id)}" data-notif-href="${UI.escapeHtml(n.href || '')}" data-notif-ref="${UI.escapeHtml(n.refKey || '')}">
          <span class="notif-item__icon" aria-hidden="true">${icon}</span>
          <span class="notif-item__body">
            <strong>${UI.escapeHtml(n.title || 'Aviso')}</strong>
            ${n.body ? `<span>${UI.escapeHtml(n.body)}</span>` : ''}
            <em>${UI.escapeHtml(formatWhen(n.createdAt))}</em>
          </span>
        </button>`;
    }).join('');
  }

  async function refresh(source, { sync = false } = {}) {
    if (document.hidden || refreshInFlight) return;
    refreshInFlight = true;
    try {
      const session = getNotifSession();
      if (!session?.userId) {
        cache = [];
        knownIds = new Set();
        knownPaymentSigs = new Set();
        renderBadge();
        if (open) renderList();
        return;
      }

      const previousIds = knownIds;
      const previousPaySigs = knownPaymentSigs;
      let newSystemKeys = [];
      try {
        const result = await API.listNotifications({ limit: 30, sync });
        if (!result.ok) {
          if (result.needsSchema && !schemaWarned && typeof UI !== 'undefined') {
            schemaWarned = true;
            UI.toast(result.error || 'Notificações na nuvem ainda não estão ativas.', 'info', 6000);
          }
          cache = result.notifications || [];
        } else {
          cache = result.notifications || [];
          newSystemKeys = result.newSystemKeys || [];
        }
      } catch (err) {
        console.warn('Falha ao carregar notificações', err);
      }

      const paymentNotif = findNewPaymentApproved(previousPaySigs, cache);
      maybePlayForNew(previousIds, cache, newSystemKeys.length > 0 || Boolean(paymentNotif));
      knownIds = alertIds(cache);
      knownPaymentSigs = paymentSignatures(cache);

      renderBadge();
      if (open) renderList();

      if (paymentNotif) {
        announcePaymentApproved(paymentNotif);
      } else if (!isDeveloperNotifContext() && (source === 'usuarios' || source === 'notificacoes')) {
        if (typeof Layout !== 'undefined' && Layout.syncPaymentLock) {
          Layout.syncPaymentLock({ toast: false }).catch(() => {});
        }
      }
    } finally {
      refreshInFlight = false;
    }
  }

  function refreshAfterForeground() {
    if (document.hidden) return;
    const now = Date.now();
    if (now - lastForegroundRefreshAt < 1000) return;
    lastForegroundRefreshAt = now;
    refresh();
  }

  function paymentSignatures(list) {
    return new Set(
      (list || [])
        .filter((n) => /^pagamento-aprovado-/i.test(String(n.refKey || '')))
        .map((n) => `${n.refKey}|${n.createdAt || ''}|${n.read ? 1 : 0}`)
    );
  }

  function findNewPaymentApproved(previousSigs, nextList) {
    if (!previousSigs) return null;
    return (
      (nextList || []).find((n) => {
        const ref = String(n.refKey || '');
        if (!/^pagamento-aprovado-/i.test(ref)) return false;
        const sig = `${n.refKey}|${n.createdAt || ''}|${n.read ? 1 : 0}`;
        return !previousSigs.has(sig) && !n.read;
      }) || null
    );
  }

  function announcePaymentApproved(notif) {
    if (isDeveloperNotifContext()) return;
    if (typeof UI !== 'undefined') {
      UI.toast(
        notif.body || notif.title || 'Pagamento realizado com sucesso. Vendas liberada.',
        'success',
        7000
      );
    }
    toggle(true);
    if (typeof Layout !== 'undefined' && Layout.syncPaymentLock) {
      Layout.syncPaymentLock({ toast: false }).catch(() => {});
    }
    document.dispatchEvent(
      new CustomEvent('pas:payment-approved', { detail: { notification: notif } })
    );
  }

  function openDeveloperNotifTarget(href, ref) {
    let tab = 'pagamentos';
    const h = String(href || '');
    const r = String(ref || '');
    if (/avaliac/i.test(h) || /avaliac/i.test(r)) tab = 'avaliacoes';
    else if (/suporte|support|dev-support/i.test(h) || /dev-support|support/i.test(r)) {
      // Abre o painel flutuante de mensagens (sem aba no menu lateral).
      document.dispatchEvent(new CustomEvent('pas:dev-open-messages'));
      return;
    } else if (/usuario/i.test(h) || /usuario/i.test(r)) tab = 'usuarios';
    else if (/assinatur/i.test(h)) tab = 'assinaturas';
    else if (/sec-alert|sec-incidente|seguran|logs/i.test(h) || /sec-alert|sec-incidente|seguran/i.test(r)) {
      document.dispatchEvent(
        new CustomEvent('pas:dev-open-incident', { detail: { href: h, ref: r } })
      );
      return;
    }
    else if (/pagament|pay|dev-pay/i.test(h) || /dev-pay/i.test(r)) tab = 'pagamentos';
    document.dispatchEvent(new CustomEvent('pas:dev-go-tab', { detail: { tab } }));
  }

  async function markRead(id) {
    const item = cache.find((n) => String(n.id) === String(id));
    if (item) item.read = true;
    renderBadge();
    renderList();
    const result = await API.markNotificationRead(id);
    if (!result.ok && typeof UI !== 'undefined') {
      UI.toast(result.error || 'Não foi possível marcar como lida.', 'error');
      await refresh();
    }
  }

  async function markAllRead() {
    cache.forEach((n) => { n.read = true; });
    renderBadge();
    renderList();
    const result = await API.markAllNotificationsRead();
    if (!result.ok && typeof UI !== 'undefined') {
      UI.toast(result.error || 'Não foi possível marcar as notificações.', 'error');
      await refresh();
      return;
    }
    if (typeof UI !== 'undefined') UI.toast('Notificações marcadas como lidas.', 'success');
  }

  async function clearAll() {
    cache = [];
    knownIds = new Set();
    knownPaymentSigs = new Set();
    renderBadge();
    renderList();
    const result = await API.clearNotifications();
    if (!result.ok && typeof UI !== 'undefined') {
      UI.toast(result.error || 'Não foi possível limpar.', 'error');
      await refresh();
      return;
    }
    // Garante que o painel fica vazio até chegar notificação nova do banco.
    cache = [];
    knownIds = new Set();
    knownPaymentSigs = new Set();
    renderBadge();
    renderList();
    if (typeof UI !== 'undefined') {
      UI.toast('Notificações limpas. Só aparecerão de novo se houver avisos novos.', 'success');
    }
  }

  function ensureBackdrop() {
    let el = document.getElementById('notif-backdrop');
    if (el) return el;
    el = document.createElement('button');
    el.type = 'button';
    el.id = 'notif-backdrop';
    el.className = 'notif-backdrop';
    el.setAttribute('aria-label', 'Fechar notificações');
    el.hidden = true;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      toggle(false);
    });
    document.body.appendChild(el);
    return el;
  }

  function mountPanelForMobile(panel) {
    if (!panel || window.matchMedia('(min-width: 641px)').matches) return;
    const wrap = document.getElementById('notif-wrap');
    if (!wrap) return;
    if (!panel.dataset.homeParent) {
      panel.dataset.homeParent = 'notif-wrap';
    }
    if (panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }
  }

  function restorePanelHome(panel) {
    if (!panel) return;
    const wrap = document.getElementById('notif-wrap');
    if (wrap && panel.parentElement !== wrap) {
      wrap.appendChild(panel);
    }
  }

  function setBackdrop(visible) {
    const el = ensureBackdrop();
    el.hidden = !visible;
    document.body.classList.toggle('notif-open', visible);
  }

  function toggle(force) {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    open = typeof force === 'boolean' ? force : panel.hidden;
    panel.hidden = !open;
    if (open) {
      mountPanelForMobile(panel);
    } else {
      restorePanelHome(panel);
    }
    setBackdrop(open);
    if (open) {
      if (isDeveloperNotifContext()) {
        const profileMenu = document.getElementById('dev-profile-menu');
        const profileBtn = document.getElementById('dev-profile-btn');
        if (profileMenu) profileMenu.hidden = true;
        if (profileBtn) profileBtn.setAttribute('aria-expanded', 'false');
      }
      unlockSound();
      renderList();
      refresh();
    }
  }

  function bind() {
    const bell = document.getElementById('notif-bell');
    const markAll = document.getElementById('notif-mark-all');
    const clearAllBtn = document.getElementById('notif-clear-all');
    const list = document.getElementById('notif-list');
    if (!bell || bell.dataset.bound) return;
    bell.dataset.bound = '1';

    try {
      if (sessionStorage.getItem(SOUND_KEY) === '1') soundUnlocked = true;
    } catch { /* ignore */ }

    const unlockOnce = () => unlockSound();
    document.addEventListener('pointerdown', unlockOnce, { once: true, passive: true });
    document.addEventListener('keydown', unlockOnce, { once: true });

    bell.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      unlockSound();
      toggle();
    });

    markAll?.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await markAllRead();
    });

    clearAllBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await clearAll();
    });

    list?.addEventListener('click', async (e) => {
      const item = e.target.closest('[data-notif-id]');
      if (!item) return;
      const id = item.getAttribute('data-notif-id');
      const href = item.getAttribute('data-notif-href');
      const ref = item.getAttribute('data-notif-ref') || '';
      await markRead(id);
      toggle(false);
      if (isDeveloperNotifContext()) {
        openDeveloperNotifTarget(href, ref);
        return;
      }
      if (/^sys-dia-dos-pais-/i.test(ref) && typeof SystemBanner !== 'undefined') {
        if (typeof SystemBanner.isFathersDay === 'function' && !SystemBanner.isFathersDay()) {
          UI.toast('Esta homenagem fica disponível no Dia dos Pais.', 'info');
          return;
        }
        SystemBanner.open(SystemBanner.FATHERS_DAY_BANNER || undefined);
        return;
      }
      if (href) {
        const safe = sanitizeAppHref(href);
        if (!safe) return;
        if (typeof Layout !== 'undefined' && typeof Layout.go === 'function') Layout.go(safe);
        else window.location.href = safe;
      }
    });

    document.addEventListener('click', (e) => {
      const wrap = document.getElementById('notif-wrap');
      if (!wrap || !open) return;
      if (!wrap.contains(e.target)) toggle(false);
    });

    window.addEventListener('focus', refreshAfterForeground);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshAfterForeground();
    });

    if (!bootstrapped) {
      bootstrapped = true;
      refresh(null, { sync: true });
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        if (document.hidden) return;
        refresh();
      }, POLL_MS);

      const session = getNotifSession();
      if (session?.userId && typeof API !== 'undefined' && API.subscribeLiveUpdates) {
        if (liveSub) liveSub.unsubscribe();
        liveSub = API.subscribeLiveUpdates(session.userId, (source) => {
          refresh(source);
          document.dispatchEvent(new CustomEvent('pas:live-update', { detail: { source } }));
        });
      }
    }
  }

  return { headerHTML, bind, refresh, markAllRead, clearAll, playNotifSound, toggle };
})();

window.Notificacoes = Notificacoes;
