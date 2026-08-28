/**
 * Layout administrativo reutilizável — PowerApps Sistemas
 */
const Layout = (() => {
  const svg = (paths) =>
    `<svg class="nav-icon__svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

  const ICONS = {
    dashboard: svg('<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>'),
    home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
    plus: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
    list: svg('<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>'),
    share: svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>'),
    clock: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    history: svg('<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l3 3"/>'),
    sale: svg('<circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/><path d="M3 3h2l2.2 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 7H6"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 20c1.8-3.5 5-5 8-5s6.2 1.5 8 5"/>'),
    settings: svg('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
    support: svg('<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>'),
    terms: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>'),
    instagram: svg('<rect width="18" height="18" x="3" y="3" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="17" cy="7" r="1"/>'),
    logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>')
  };

  const NAV = [
    { id: 'dashboard', href: 'dashboard.html', icon: ICONS.dashboard, label: 'Dashboard' },
    { id: 'nova-rifa', href: 'nova-rifa.html', icon: ICONS.plus, label: 'Nova Rifa' },
    { id: 'minhas-rifas', href: 'minhas-rifas.html', icon: ICONS.list, label: 'Minhas Rifas' },
    { id: 'historico', href: 'historico.html', icon: ICONS.history, label: 'Histórico', desktopOnly: true },
    { id: 'sorteios', href: 'sorteios.html', icon: ICONS.instagram, label: 'Sorteios Instagram' },
    { id: 'vendas', href: 'vendas.html', icon: ICONS.sale, label: 'Vendas' },
    { id: 'compartilhamentos', href: 'compartilhamentos.html', icon: ICONS.share, label: 'Compartilhamentos' },
    { id: 'reservas', href: 'reservas.html', icon: ICONS.clock, label: 'Reservas Pendentes' },
    { id: 'configuracoes', href: 'configuracoes.html', icon: ICONS.settings, label: 'Configurações' }
  ];

  /** Bottom nav mobile: Home · Venda (FAB) · Histórico · Perfil */
  const BOTTOM_NAV = [
    { id: 'dashboard', href: 'dashboard.html', icon: ICONS.home, label: 'Home' },
    { id: 'vendas', href: 'vendas.html', icon: ICONS.sale, label: 'Venda', primary: true },
    { id: 'historico', href: 'historico.html', icon: ICONS.history, label: 'Histórico' },
    { id: 'perfil', href: '#', icon: ICONS.user, label: 'Perfil', profile: true }
  ];

  const APP_TITLE = 'PowerApps Systems';
  const APP_TITLE_HTML = 'Power<span class="brand-accent">Apps</span> Systems';

  const LOCK_ICON = svg(
    '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
  );

  /** Gate: telas do painel só abrem via menu / navegação interna autorizada */
  const NAV_GATE_KEY = 'pas_nav_allowed';
  const PANEL_PAGES = new Set([
    ...NAV.map((item) => String(item.href || '').toLowerCase()),
    ...BOTTOM_NAV.map((item) => String(item.href || '').toLowerCase()).filter((h) => h && h !== '#'),
    'historico.html',
    'configuracoes.html',
    'suporte.html',
    'visualizar-rifa.html',
    'compartilhar.html',
    'pagamento.html',
    'termos.html'
  ]);

  function pageFileFromHref(href) {
    try {
      const u = new URL(String(href || ''), window.location.href);
      return (u.pathname.split('/').pop() || '').toLowerCase();
    } catch {
      return String(href || '').split('?')[0].split('#')[0].toLowerCase();
    }
  }

  function readAllowedPages() {
    try {
      const raw = sessionStorage.getItem(NAV_GATE_KEY);
      if (!raw) return new Set();
      const list = JSON.parse(raw);
      return new Set(Array.isArray(list) ? list.map((x) => String(x).toLowerCase()) : []);
    } catch {
      return new Set();
    }
  }

  function writeAllowedPages(set) {
    try {
      sessionStorage.setItem(NAV_GATE_KEY, JSON.stringify([...set]));
    } catch { /* ignore */ }
  }

  function allowNavigate(href) {
    const file = pageFileFromHref(href);
    if (!file || !PANEL_PAGES.has(file)) return;
    const set = readAllowedPages();
    set.add(file);
    writeAllowedPages(set);
  }

  function clearNavGate() {
    try {
      sessionStorage.removeItem(NAV_GATE_KEY);
    } catch { /* ignore */ }
  }

  function isPanelNavAllowed(href = window.location.pathname) {
    const file = pageFileFromHref(href);
    if (!PANEL_PAGES.has(file)) return true;
    return readAllowedPages().has(file);
  }

  function go(href) {
    allowNavigate(href);
    window.location.href = href;
  }

  function bindPanelNavGate() {
    if (document.documentElement.dataset.pasNavGateBound === '1') return;
    document.documentElement.dataset.pasNavGateBound = '1';

    document.addEventListener(
      'click',
      (e) => {
        const a = e.target?.closest?.('a[href]');
        if (!a) return;
        const href = a.getAttribute('href');
        if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(href)) return;
        if (/^https?:\/\//i.test(href) && !href.includes(window.location.host)) return;
        const file = pageFileFromHref(href);
        if (PANEL_PAGES.has(file)) allowNavigate(file);
      },
      true
    );
  }

  bindPanelNavGate();

  function moneyBR(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }

  function vendasLockPriceLabel() {
    const plan =
      (typeof API !== 'undefined' && API.getPlanPrice
        ? API.getPlanPrice('pessoa_fisica')
        : null) || { valor: 20 };
    return moneyBR(plan.valor);
  }

  /** Modal ao clicar em recurso bloqueado (pessoa física sem pagamento) */
  function showFeatureLockedMessage(featureLabel = 'este recurso') {
    const price = vendasLockPriceLabel();
    const label = String(featureLabel || 'este recurso');
    if (typeof UI === 'undefined' || typeof UI.modal !== 'function') {
      window.alert(
        `A tela de ${label} está bloqueada. Faça o pagamento único de ${price} para liberar.`
      );
      return;
    }
    UI.modal({
      title: `${label} bloqueada`,
      body: `
        <p>Para usar a tela de <strong>${UI.escapeHtml ? UI.escapeHtml(label) : label}</strong>, é necessário o pagamento único de
        <strong>${price}</strong> (pessoa física).</p>
      <p class="muted" style="margin-top:.75rem;">Após o Pix, toque em “Já paguei”. A liberação
        só ocorre quando o administrador confirmar o pagamento — não libera automaticamente.</p>
      `,
      actions: [
        {
          label: 'Agora não',
          className: 'btn-ghost',
          onClick: (close) => close()
        },
        {
          label: `Pagar ${price}`,
          className: 'btn-primary',
          onClick: (close) => {
            close();
            go('pagamento.html');
          }
        }
      ]
    });
  }

  function showVendasLockedMessage() {
    showFeatureLockedMessage('Vendas');
  }

  function showReservasLockedMessage() {
    showFeatureLockedMessage('Reservas Pendentes');
  }

  function showNovaRifaLimitedMessage() {
    const price = vendasLockPriceLabel();
    if (typeof UI === 'undefined' || typeof UI.modal !== 'function') {
      window.alert(
        `No plano Free você pode criar apenas 1 rifa. Torne-se Pro (${price}) para criar rifas ilimitadas.`
      );
      return;
    }
    UI.modal({
      title: 'Limite do plano Free',
      body: `
        <p>No plano <strong>Free</strong> você pode criar apenas <strong>1 rifa</strong>.</p>
        <p class="muted" style="margin-top:.75rem;">
          Para criar rifas ilimitadas, torne-se <strong>Pro</strong> com o pagamento de
          <strong>${price}</strong> (status de pagamento ativo).
        </p>
      `,
      actions: [
        {
          label: 'Agora não',
          className: 'btn-ghost',
          onClick: (close) => close()
        },
        {
          label: `Tornar Pro — ${price}`,
          className: 'btn-primary',
          onClick: (close) => {
            close();
            go('pagamento.html');
          }
        }
      ]
    });
  }

  function markAfterLoginPayNotice() {
    try {
      sessionStorage.setItem('pas_show_pf_pay', '1');
    } catch { /* ignore */ }
  }

  function maybeShowPfPayNotice(session) {
    try {
      if (sessionStorage.getItem('pas_show_pf_pay') !== '1') return;
      sessionStorage.removeItem('pas_show_pf_pay');
    } catch {
      return;
    }
    if (typeof API === 'undefined' || !API.isVendasLocked?.(session)) return;
    const price = vendasLockPriceLabel();
    if (typeof UI === 'undefined' || typeof UI.modal !== 'function') return;
    UI.modal({
      title: 'Liberar recursos',
      body: `
        <p>Conta pessoa física: valor único de <strong>${price}</strong> para liberar <strong>Vendas</strong>, <strong>Reservas Pendentes</strong>, o <strong>chat de suporte</strong> e <strong>rifas ilimitadas</strong>.</p>
        <p class="muted" style="margin-top:.75rem;">No Free você pode criar 1 rifa. Vendas e Reservas ficam bloqueadas até a confirmação do pagamento.</p>
      `,
      actions: [
        {
          label: 'Continuar',
          className: 'btn-ghost',
          onClick: (close) => close()
        },
        {
          label: `Ver pagamento ${price}`,
          className: 'btn-primary',
          onClick: (close) => {
            close();
            go('pagamento.html');
          }
        }
      ]
    });
  }

  function showSuporteLockedMessage() {
    showFeatureLockedMessage('Suporte');
  }

  const SUPPORT_FAB_POLL_MS = 60 * 1000;
  let supportFabPoll = null;
  let supportFabKnownUnread = null;
  let supportFabEventsBound = false;

  function supportFabBaseLabel(locked) {
    return locked
      ? 'Suporte bloqueado — realize o pagamento para liberar'
      : 'Abrir chat de suporte';
  }

  function stopSupportFabLive() {
    if (supportFabPoll) {
      clearInterval(supportFabPoll);
      supportFabPoll = null;
    }
  }

  function renderSupportFabBadge(count, { locked = false } = {}) {
    const fab = document.getElementById('pas-support-fab');
    if (!fab) return;
    let badge = fab.querySelector('.pas-support-fab__badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'pas-support-fab__badge';
      badge.setAttribute('aria-hidden', 'true');
      fab.appendChild(badge);
    }
    const n = Math.max(0, Number(count) || 0);
    if (!locked && n > 0) {
      badge.hidden = false;
      badge.classList.remove('is-empty');
      badge.textContent = n > 9 ? '9+' : String(n);
      fab.setAttribute(
        'aria-label',
        `Abrir chat de suporte, ${n} mensagem${n === 1 ? '' : 'ns'} não lida${n === 1 ? '' : 's'}`
      );
    } else {
      badge.hidden = true;
      badge.classList.add('is-empty');
      badge.textContent = '';
      fab.setAttribute('aria-label', supportFabBaseLabel(locked));
    }
  }

  async function refreshSupportFabBadge({ playSound = false } = {}) {
    const fab = document.getElementById('pas-support-fab');
    const session = Store.getSession();
    if (!fab || !session?.userId || typeof API === 'undefined') {
      supportFabKnownUnread = 0;
      renderSupportFabBadge(0);
      return;
    }
    const locked = !!API.isVendasLocked?.(session);
    if (locked) {
      supportFabKnownUnread = 0;
      renderSupportFabBadge(0, { locked: true });
      return;
    }
    try {
      if (typeof API.getSupportUnread !== 'function') return;
      const result = await API.getSupportUnread();
      const unread = result.ok ? Number(result.unread) || 0 : 0;
      const prev = supportFabKnownUnread;
      supportFabKnownUnread = unread;
      renderSupportFabBadge(unread, { locked: false });
      if (
        playSound &&
        prev != null &&
        unread > prev &&
        typeof Notificacoes !== 'undefined' &&
        typeof Notificacoes.playNotifSound === 'function'
      ) {
        Notificacoes.playNotifSound();
      }
    } catch (err) {
      console.warn('support fab badge', err);
    }
  }

  function startSupportFabLive(session) {
    stopSupportFabLive();
    supportFabKnownUnread = null;
    if (!session?.userId || typeof API === 'undefined') return;
    if (API.isVendasLocked?.(session)) {
      renderSupportFabBadge(0, { locked: true });
      return;
    }

    const tick = () => {
      if (document.hidden) return;
      refreshSupportFabBadge({ playSound: true });
    };

    supportFabPoll = setInterval(tick, SUPPORT_FAB_POLL_MS);
    refreshSupportFabBadge({ playSound: false });
  }

  function bindSupportFabUnreadEvents() {
    if (supportFabEventsBound) return;
    supportFabEventsBound = true;
    window.addEventListener('focus', () => {
      if (document.getElementById('pas-support-fab')) {
        refreshSupportFabBadge({ playSound: false });
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && document.getElementById('pas-support-fab')) {
        refreshSupportFabBadge({ playSound: false });
      }
    });
    document.addEventListener('pas:support-unread-changed', () => {
      if (document.getElementById('pas-support-fab')) {
        refreshSupportFabBadge({ playSound: false });
      }
    });
  }

  function supportFabHTML(locked) {
    return `
      <button type="button" class="pas-support-fab${locked ? ' is-locked' : ''}" id="pas-support-fab"
        aria-label="${locked ? 'Suporte bloqueado — realize o pagamento para liberar' : 'Abrir chat de suporte'}"
        title="${locked ? 'Bloqueado na versão Free' : 'Falar com o suporte'}">
        <span class="pas-support-fab__icon" aria-hidden="true">${ICONS.support}</span>
        <span class="pas-support-fab__badge is-empty" aria-hidden="true" hidden></span>
        ${locked ? `<span class="pas-support-fab__lock" aria-hidden="true">${LOCK_ICON}</span>` : ''}
      </button>`;
  }

  function mountSupportFab(session, { show = false } = {}) {
    stopSupportFabLive();
    document.getElementById('pas-support-fab')?.remove();
    if (!show) return;
    const shell = document.querySelector('.app-shell');
    if (!shell) return;
    const locked = typeof API !== 'undefined' && !!API.isVendasLocked?.(session);
    shell.insertAdjacentHTML('beforeend', supportFabHTML(locked));
    const fab = document.getElementById('pas-support-fab');
    if (!fab || fab.dataset.bound) return;
    fab.dataset.bound = '1';
    fab.addEventListener('click', () => {
      const current = Store.getSession();
      if (typeof API !== 'undefined' && API.isVendasLocked?.(current)) {
        showSuporteLockedMessage();
        return;
      }
      if (typeof SuporteChat !== 'undefined' && typeof SuporteChat.openForCurrentUser === 'function') {
        SuporteChat.openForCurrentUser();
        return;
      }
      allowNavigate('suporte.html');
      window.location.href = 'suporte.html';
    });
    bindSupportFabUnreadEvents();
    startSupportFabLive(session);
  }

  function syncSupportFab(session = Store.getSession()) {
    const fab = document.getElementById('pas-support-fab');
    if (!fab) return;
    const locked = typeof API !== 'undefined' && !!API.isVendasLocked?.(session);
    fab.classList.toggle('is-locked', locked);
    fab.title = locked ? 'Bloqueado na versão Free' : 'Falar com o suporte';
    const lock = fab.querySelector('.pas-support-fab__lock');
    if (locked && !lock) {
      fab.insertAdjacentHTML(
        'beforeend',
        `<span class="pas-support-fab__lock" aria-hidden="true">${LOCK_ICON}</span>`
      );
    } else if (!locked && lock) {
      lock.remove();
    }
    if (locked) {
      stopSupportFabLive();
      supportFabKnownUnread = 0;
      renderSupportFabBadge(0, { locked: true });
    } else {
      fab.setAttribute('aria-label', supportFabBaseLabel(false));
      if (!supportFabPoll) startSupportFabLive(session);
      else refreshSupportFabBadge({ playSound: false });
    }
  }

  function showSuporteProLockedMessage() {
    showSuporteLockedMessage();
  }

  function bindVendasLockGuards(session) {
    const locked = typeof API !== 'undefined' && API.isVendasLocked?.(session);
    const lockTargets = [
      { nav: 'vendas', label: 'Vendas', show: showVendasLockedMessage },
      { nav: 'reservas', label: 'Reservas Pendentes', show: showReservasLockedMessage }
    ];

    lockTargets.forEach(({ nav, label, show }) => {
      document.querySelectorAll(`[data-nav="${nav}"]`).forEach((el) => {
        el.classList.toggle('nav-locked', !!locked);
        if (locked) {
          el.setAttribute('aria-disabled', 'true');
          el.title = `Bloqueado — pague ${vendasLockPriceLabel()} para liberar ${label}`;
          if (!el.querySelector('.nav-lock-badge')) {
            const badge = document.createElement('span');
            badge.className = 'nav-lock-badge';
            badge.setAttribute('aria-hidden', 'true');
            badge.innerHTML = LOCK_ICON;
            el.appendChild(badge);
          }
        } else {
          el.removeAttribute('aria-disabled');
          el.removeAttribute('title');
          el.querySelector('.nav-lock-badge')?.remove();
        }

        if (el.dataset.featureLockBound) return;
        el.dataset.featureLockBound = '1';
        el.addEventListener('click', (e) => {
          const current = Store.getSession();
          if (!(typeof API !== 'undefined' && API.isVendasLocked?.(current))) return;
          e.preventDefault();
          e.stopPropagation();
          show();
        });
      });
    });

    syncSupportFab(session);
  }

  /** Cadeado em Nova Rifa quando Free já tem 1 rifa cadastrada */
  async function bindNovaRifaLimitGuard(session) {
    const navEls = document.querySelectorAll('[data-nav="nova-rifa"]');
    if (!navEls.length) return;

    let limited = false;
    if (typeof API !== 'undefined' && API.isFreePlan?.(session)) {
      try {
        const check = await API.checkRaffleCreateLimit(session);
        limited = !check?.ok && check?.reason === 'free-limit';
      } catch {
        limited = false;
      }
    }

    navEls.forEach((el) => {
      el.classList.toggle('nav-locked', !!limited);
      if (limited) {
        el.setAttribute('aria-disabled', 'true');
        el.title = 'Limite Free — torne-se Pro para criar mais rifas';
        if (!el.querySelector('.nav-lock-badge')) {
          const badge = document.createElement('span');
          badge.className = 'nav-lock-badge';
          badge.setAttribute('aria-hidden', 'true');
          badge.innerHTML = LOCK_ICON;
          el.appendChild(badge);
        }
      } else {
        el.removeAttribute('aria-disabled');
        el.removeAttribute('title');
        el.querySelector('.nav-lock-badge')?.remove();
      }

      if (el.dataset.raffleLimitBound) return;
      el.dataset.raffleLimitBound = '1';
      el.addEventListener('click', async (e) => {
        const current = Store.getSession();
        if (typeof API === 'undefined' || !API.isFreePlan?.(current)) return;
        let blocked = false;
        try {
          const check = await API.checkRaffleCreateLimit(current);
          blocked = !check?.ok && check?.reason === 'free-limit';
        } catch {
          return;
        }
        if (!blocked) return;
        e.preventDefault();
        e.stopPropagation();
        showNovaRifaLimitedMessage();
      });
    });
  }

  function hasPagoEm(session) {
    const value = session?.pagoEm ?? session?.pago_em;
    if (value == null) return false;
    const text = String(value).trim();
    return text !== '' && text.toLowerCase() !== 'null' && text.toLowerCase() !== 'undefined';
  }

  function planBadgeMeta(session) {
    if (hasPagoEm(session)) {
      return {
        label: 'Pro',
        className: 'is-pro',
        title: 'Plano Pro — pagamento registrado',
        icon: `<svg class="sidebar__plan-badge-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M5 16 3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5Zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1Z"/></svg>`
      };
    }
    return {
      label: 'Free',
      className: 'is-free',
      title: 'Plano Free — sem pagamento registrado',
      icon: `<svg class="sidebar__plan-badge-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" d="M8 12h8"/></svg>`
    };
  }

  function planBadgeHTML(session) {
    const badge = planBadgeMeta(session);
    return `<span class="sidebar__plan-badge ${badge.className}" id="sidebar-plan-badge" title="${badge.title}">${badge.icon}<span class="sidebar__plan-badge-label">${badge.label}</span></span>`;
  }

  function syncPlanBadge(session = Store.getSession()) {
    const el = document.getElementById('sidebar-plan-badge');
    if (!el) return;
    const badge = planBadgeMeta(session);
    el.className = `sidebar__plan-badge ${badge.className}`;
    el.title = badge.title;
    el.innerHTML = `${badge.icon}<span class="sidebar__plan-badge-label">${badge.label}</span>`;
  }

  /** Atualiza sessão + cadeado de Vendas quando o pagamento é aprovado ao vivo */
  async function syncPaymentLock({ toast = false } = {}) {
    if (typeof API === 'undefined' || typeof API.refreshPaymentProfile !== 'function') {
      return { ok: false };
    }
    const before = Store.getSession();
    const wasLocked = API.isVendasLocked?.(before);
    const result = await API.refreshPaymentProfile();
    if (!result?.ok) return result;
    const session = Store.getSession();
    bindVendasLockGuards(session);
    await bindNovaRifaLimitGuard(session);
    syncPlanBadge(session);
    const nowLocked = API.isVendasLocked?.(session);
    if (wasLocked && !nowLocked) {
      if (toast && typeof UI !== 'undefined') {
        UI.toast(
          'Pagamento aprovado! Vendas, Reservas, suporte e rifas ilimitadas foram liberados.',
          'success',
          6000
        );
      }
      document.dispatchEvent(
        new CustomEvent('pas:payment-approved', { detail: { session } })
      );
    }
    return { ok: true, unlocked: wasLocked && !nowLocked, session };
  }

  function bottomNavHTML(active) {
    const side = BOTTOM_NAV.filter((item) => !item.primary);
    const fab = BOTTOM_NAV.find((item) => item.primary);
    const left = side.slice(0, 1);
    const right = side.slice(1);
    const sideItem = (item) => {
      if (item.profile) {
        return `
          <button type="button" class="bottom-nav__item" data-action="bottom-profile" aria-label="Abrir minha conta">
            <span class="bottom-nav__icon" aria-hidden="true">${item.icon}</span>
            <span class="bottom-nav__label">${item.label}</span>
          </button>`;
      }
      return `
        <a href="${item.href}" class="bottom-nav__item${item.id === active ? ' active' : ''}" data-nav="${item.id}">
          <span class="bottom-nav__icon" aria-hidden="true">${item.icon}</span>
          <span class="bottom-nav__label">${item.label}</span>
        </a>`;
    };

    return `
      <nav class="bottom-nav" id="bottom-nav" aria-label="Navegação principal">
        <svg class="bottom-nav__shape" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 10 H148 C156 10 159 15 161 22 C167 46 181 56 200 56 C219 56 233 46 239 22 C241 15 244 10 252 10 H400 V80 H0 Z"/>
        </svg>
        <div class="bottom-nav__row">
          <div class="bottom-nav__cluster bottom-nav__cluster--left">
            ${left.map(sideItem).join('')}
          </div>
          <span class="bottom-nav__gap" aria-hidden="true"></span>
          <div class="bottom-nav__cluster bottom-nav__cluster--right">
            ${right.map(sideItem).join('')}
          </div>
        </div>
        ${fab ? `
          <a href="${fab.href}" class="bottom-nav__fab${fab.id === active ? ' active' : ''}" data-nav="${fab.id}" aria-label="${fab.label}">
            <span class="bottom-nav__fab-icon" aria-hidden="true">${fab.icon}</span>
          </a>` : ''}
      </nav>`;
  }

  async function render({
    active = 'dashboard',
    title = 'Painel',
    showBottomNav = true,
    nivel = null,
    skipPayment = false
  } = {}) {
    // Proteção central: autenticação real (Supabase) + nível de acesso
    if (typeof ProtecaoRota !== 'undefined' && typeof ProtecaoRota.protegerRota === 'function') {
      const protected_ = await ProtecaoRota.protegerRota({
        nivel: nivel || undefined,
        ensurePayment: !skipPayment,
        showLoading: true
      });
      if (!protected_?.ok) return null;
      const session = protected_.session;
      const withBottomNav = showBottomNav !== false;
      return finishRender({ session, active, withBottomNav });
    }

    const local = API.requireAuth();
    if (!local) return null;

    allowNavigate(pageFileFromHref(window.location.pathname));

    if (typeof UI !== 'undefined') UI.showLoading('Validando sessão...');
    let gate;
    try {
      gate = await API.requireActiveSession();
    } finally {
      if (typeof UI !== 'undefined') UI.hideLoading();
    }
    if (!gate?.ok || !gate.session) return null;

    if (!skipPayment && typeof API.ensurePaymentAccess === 'function') {
      const pay = await API.ensurePaymentAccess();
      if (!pay?.ok) return null;
    }

    const session = gate.session;
    const withBottomNav = showBottomNav !== false;
    return finishRender({ session, active, withBottomNav });
  }

  async function finishRender({ session, active, withBottomNav }) {

    document.title = APP_TITLE;

    const root = document.getElementById('app');
    if (!root) return session;

    root.innerHTML = `
      <div class="app-shell${withBottomNav ? ' has-bottom-nav' : ''}">
        <aside class="sidebar" id="sidebar">
          <div class="sidebar__brand">
            <span class="logo-badge logo-badge--sidebar" role="img" aria-label="PowerApps">
              <img class="logo-badge__img" src="assets/Power2.png" alt="" width="44" height="44">
            </span>
            <div class="sidebar__brand-text">
              <strong>Power<span class="brand-accent">Apps</span></strong>
              <span class="sidebar__brand-sub">Systems</span>
              <span class="sidebar__brand-meta">
                <span class="app-version">v1.0.5</span>
                ${planBadgeHTML(session)}
              </span>
            </div>
          </div>
          <nav class="sidebar__nav">
            <button type="button" class="sidebar__2fa-btn is-off" id="sidebar-2fa-btn"
              title="Gerenciar autenticação em dois fatores"
              aria-label="2FA desativado — ativar se quiser">
              <span class="sidebar__2fa-btn-dot" aria-hidden="true"></span>
              <span class="sidebar__2fa-btn-label" id="sidebar-2fa-label">2FA Desativado</span>
            </button>
            ${NAV.map((item) => `
              <a href="${item.href}" data-nav="${item.id}"${item.desktopOnly ? ' class="sidebar__nav-link--desktop-only"' : ''}>
                <span class="nav-icon">${item.icon}</span>${item.label}
              </a>`).join('')}
            ${typeof Theme !== 'undefined' ? Theme.menuItemHTML() : ''}
            ${typeof Contribuicao !== 'undefined' ? Contribuicao.menuItemHTML() : ''}
            <div class="sidebar__nav-meta" aria-label="Informações">
              <a href="termos.html" class="sidebar__nav-meta-link" data-nav="termos">
                <span class="nav-icon">${ICONS.terms}</span>Termos de Uso
              </a>
            </div>
          </nav>
          <div class="sidebar__user">
            <button type="button" class="sidebar__account" data-action="edit-account" title="Editar conta" aria-label="Editar conta">
              <span class="sidebar__avatar" id="user-avatar" aria-hidden="true"></span>
              <span class="sidebar__account-text">
                <span class="name" id="user-name"></span>
                <span class="email" id="user-email"></span>
              </span>
            </button>
            <button type="button" class="btn btn-logout-sidebar btn-sm btn-block ripple" data-action="logout" aria-label="Logout">
              <span class="btn-logout-sidebar__icon" aria-hidden="true">${ICONS.logout}</span>
              Logout
            </button>
          </div>
        </aside>
        <div class="sidebar-overlay" id="sidebar-overlay"></div>
        <div class="app-main">
          <header class="app-header">
            <div class="header-left">
              <button class="menu-toggle" id="menu-toggle" aria-label="Abrir menu">☰</button>
              <div>
                <strong id="header-title">${APP_TITLE_HTML}</strong>
              </div>
            </div>
            <div class="header-right">
              ${typeof Notificacoes !== 'undefined' ? Notificacoes.headerHTML() : ''}
            </div>
          </header>
          <main class="content" id="page-content"></main>
        </div>
        ${withBottomNav ? bottomNavHTML(active) : ''}
      </div>
    `;

    UI.initAppShell({ active });
    bindVendasLockGuards(session);
    await bindNovaRifaLimitGuard(session);
    mountSupportFab(session, { show: active === 'dashboard' });
    maybeShowPfPayNotice(session);
    bindSidebar2fa();
    syncSidebar2faStatus();
    if (typeof Theme !== 'undefined') Theme.bind();
    if (typeof Contribuicao !== 'undefined') {
      Contribuicao.bind();
      Contribuicao.maybeOpenAfterLogin();
    }
    if (typeof Notificacoes !== 'undefined') Notificacoes.bind();
    if (typeof SessaoIdle !== 'undefined') SessaoIdle.bind();
    if (typeof SessaoUnica !== 'undefined') SessaoUnica.bind();
    if (typeof SystemBanner !== 'undefined') SystemBanner.maybeShowOnOpen();
    return session;
  }

  function applySidebar2faState(ativo) {
    const btn = document.getElementById('sidebar-2fa-btn');
    const label = document.getElementById('sidebar-2fa-label');
    const on = !!ativo;
    if (btn && label) {
      label.textContent = on ? '2FA Ativado' : '2FA Desativado';
      btn.classList.toggle('is-on', on);
      btn.classList.toggle('is-off', !on);
      btn.setAttribute(
        'aria-label',
        on ? '2FA ativado — gerenciar' : '2FA desativado — ativar se quiser'
      );
      btn.title = on
        ? '2FA ativado — gerenciar'
        : '2FA desativado — ativar com app autenticador';
    }

    const alertEl = document.getElementById('twofa-security-alert');
    if (alertEl) {
      alertEl.hidden = on;
      alertEl.toggleAttribute('hidden', on);
      alertEl.setAttribute('aria-hidden', on ? 'true' : 'false');
    }
  }

  function twoFaAppsListHTML() {
    return `
      <div class="twofa-modal__apps">
        <p class="twofa-modal__apps-title">Instale um destes apps no celular:</p>
        <ul class="twofa-modal__apps-list">
          <li><strong>Google Authenticator</strong> (Android / iPhone)</li>
          <li><strong>Microsoft Authenticator</strong> (Android / iPhone)</li>
          <li><strong>Authy</strong> (Android / iPhone)</li>
        </ul>
        <p class="twofa-modal__apps-hint">
          Abra o app → adicione uma conta → depois escaneie o QR Code.
        </p>
      </div>`;
  }

  function twoFaIntroModalBodyHTML({ ativo }) {
    if (ativo) {
      return `
        <div class="twofa-modal">
          <p class="twofa-modal__status is-on">2FA está <strong>ativado</strong> nesta conta.</p>
          <p class="twofa-modal__lead">
            No próximo login será pedido o código do app autenticador
            (Google Authenticator, Microsoft Authenticator ou Authy).
          </p>
          <div class="form-group" style="margin-top:1rem;">
            <label for="twofa-modal-disable-password">Senha atual para desativar</label>
            <input id="twofa-modal-disable-password" type="password" autocomplete="current-password" placeholder="********">
          </div>
          <div class="twofa-modal__actions">
            <button type="button" class="btn btn-outline" id="twofa-modal-disable">Desativar 2FA</button>
          </div>
        </div>`;
    }
    return `
      <div class="twofa-modal">
        <p class="twofa-modal__lead">
          Proteja sua conta com um código de 6 dígitos gerado no celular.
          É opcional — ative só se quiser.
        </p>
        ${twoFaAppsListHTML()}
        <div class="twofa-modal__actions">
          <button type="button" class="btn btn-primary" id="twofa-modal-start">Gerar QR Code</button>
        </div>
      </div>`;
  }

  function twoFaDigitBoxesHTML(idPrefix = 'twofa-modal-digit') {
    const box = (i) =>
      `<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1"
        class="twofa-digit" id="${idPrefix}-${i}" data-twofa-digit="${i}"
        aria-label="Dígito ${i + 1}" autocomplete="${i === 0 ? 'one-time-code' : 'off'}">`;
    return `
      <div class="twofa-digits" id="${idPrefix}-wrap" role="group" aria-label="Código de 6 dígitos">
        ${box(0)}${box(1)}${box(2)}${box(3)}${box(4)}${box(5)}
      </div>`;
  }

  function readTwoFaDigits(wrap) {
    if (!wrap) return '';
    return Array.from(wrap.querySelectorAll('[data-twofa-digit]'))
      .sort((a, b) => Number(a.dataset.twofaDigit) - Number(b.dataset.twofaDigit))
      .map((el) => String(el.value || '').replace(/\D/g, '').slice(0, 1))
      .join('');
  }

  function bindTwoFaDigitInputs(wrap) {
    if (!wrap || wrap.dataset.bound === '1') return;
    wrap.dataset.bound = '1';
    const inputs = Array.from(wrap.querySelectorAll('[data-twofa-digit]')).sort(
      (a, b) => Number(a.dataset.twofaDigit) - Number(b.dataset.twofaDigit)
    );

    function fillFromString(raw, startIndex = 0) {
      const digits = String(raw || '').replace(/\D/g, '').slice(0, 6 - startIndex);
      for (let i = 0; i < digits.length; i += 1) {
        const el = inputs[startIndex + i];
        if (el) el.value = digits[i];
      }
      const next = inputs[Math.min(startIndex + digits.length, inputs.length - 1)];
      next?.focus();
      next?.select?.();
    }

    inputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        const v = String(e.target.value || '').replace(/\D/g, '');
        if (v.length > 1) {
          fillFromString(v, index);
          return;
        }
        e.target.value = v.slice(0, 1);
        if (v && index < inputs.length - 1) {
          inputs[index + 1].focus();
          inputs[index + 1].select?.();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !String(e.target.value || '') && index > 0) {
          e.preventDefault();
          inputs[index - 1].focus();
          inputs[index - 1].value = '';
        }
        if (e.key === 'ArrowLeft' && index > 0) {
          e.preventDefault();
          inputs[index - 1].focus();
        }
        if (e.key === 'ArrowRight' && index < inputs.length - 1) {
          e.preventDefault();
          inputs[index + 1].focus();
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData?.getData('text') || '';
        fillFromString(text, index);
      });

      input.addEventListener('focus', () => {
        input.select?.();
      });
    });

    inputs[0]?.focus();
  }

  function twoFaQrModalBodyHTML({ qrCodeDataUrl, manualSecret }) {
    const manual = manualSecret
      ? `Se não puder escanear, digite no app: ${manualSecret}`
      : '';
    return `
      <div class="twofa-modal twofa-modal--qr">
        <p class="twofa-modal__lead">
          Escaneie o QR Code no app autenticador e digite o código de 6 dígitos.
        </p>
        <div class="twofa-modal__qr-wrap">
          <img id="twofa-modal-qr" alt="QR Code 2FA" class="twofa-modal__qr"
            src="${qrCodeDataUrl || ''}">
        </div>
        <p class="form-hint" id="twofa-modal-manual" style="word-break:break-all;">${manual}</p>
        <div id="twofa-modal-confirm-block">
            <div class="twofa-code-block">
              <span class="twofa-code-block__label">Código de 6 dígitos do app</span>
              ${twoFaDigitBoxesHTML('twofa-modal-digit')}
              <p class="twofa-digits__hint">Nunca repasse este código para terceiros</p>
            </div>
          <div class="twofa-modal__actions">
            <button type="button" class="btn btn-primary" id="twofa-modal-confirm">Confirmar e ativar</button>
            <button type="button" class="btn btn-ghost" id="twofa-modal-cancel-setup">Cancelar</button>
          </div>
        </div>
        <div id="twofa-modal-backup" hidden class="twofa-modal__backup">
          <strong>Guarde estes códigos agora</strong>
          <p>Eles só aparecem <strong>uma vez</strong>. Cada um vale para um único uso.</p>
          <pre id="twofa-modal-backup-codes" class="twofa-modal__backup-codes"></pre>
          <button type="button" class="btn btn-outline" id="twofa-modal-backup-done">Já guardei os códigos</button>
        </div>
      </div>`;
  }

  function openTwoFaQrModal({ qrCodeDataUrl, manualSecret }) {
    if (typeof UI === 'undefined') return;
    UI.modal({
      title: 'QR Code 2FA',
      dialogClass: 'modal-dialog--2fa modal-dialog--2fa-qr',
      body: twoFaQrModalBodyHTML({ qrCodeDataUrl, manualSecret })
    });

    const digitsWrap = document.getElementById('twofa-modal-digit-wrap');
    const confirmBlock = document.getElementById('twofa-modal-confirm-block');
    const backupBox = document.getElementById('twofa-modal-backup');
    const backupCodes = document.getElementById('twofa-modal-backup-codes');

    bindTwoFaDigitInputs(digitsWrap);

    document.getElementById('twofa-modal-cancel-setup')?.addEventListener('click', () => {
      UI.closeModal();
    });

    document.getElementById('twofa-modal-confirm')?.addEventListener('click', async () => {
      const code = readTwoFaDigits(digitsWrap);
      if (!/^\d{6}$/.test(code)) {
        UI.toast('Informe o código de 6 dígitos.', 'error');
        digitsWrap?.querySelector('[data-twofa-digit="0"]')?.focus();
        return;
      }
      UI.showLoading('Confirmando...');
      const res = await API.confirm2fa({ code });
      UI.hideLoading();
      if (!res.ok) {
        UI.toast(res.error || 'Código inválido.', 'error');
        return;
      }
      if (confirmBlock) confirmBlock.hidden = true;
      if (backupBox) backupBox.hidden = false;
      if (backupCodes) backupCodes.textContent = (res.backupCodes || []).join('\n');
      applySidebar2faState(true);
      UI.toast('2FA ativado. Guarde os códigos de backup agora.', 'success');
    });

    document.getElementById('twofa-modal-backup-done')?.addEventListener('click', () => {
      UI.toast('Códigos ocultados. Eles não serão mostrados de novo.', 'info');
      UI.closeModal();
    });
  }

  function bindTwoFaIntroModalEvents(ativo) {
    document.getElementById('twofa-modal-start')?.addEventListener('click', async () => {
      if (typeof UI === 'undefined') return;
      UI.showLoading('Gerando QR Code...');
      const res = await API.start2fa();
      UI.hideLoading();
      if (!res.ok) {
        UI.toast(res.error || 'Falha ao iniciar 2FA.', 'error');
        return;
      }
      openTwoFaQrModal({
        qrCodeDataUrl: res.qrCodeDataUrl || '',
        manualSecret: res.manualSecret || ''
      });
    });

    document.getElementById('twofa-modal-disable')?.addEventListener('click', async () => {
      const password = String(
        document.getElementById('twofa-modal-disable-password')?.value || ''
      );
      if (!password) {
        if (typeof UI !== 'undefined') UI.toast('Informe a senha atual.', 'error');
        return;
      }
      if (typeof UI !== 'undefined') UI.showLoading('Desativando...');
      const res = await API.disable2fa({ password });
      if (typeof UI !== 'undefined') UI.hideLoading();
      if (!res.ok) {
        if (typeof UI !== 'undefined') UI.toast(res.error || 'Não foi possível desativar.', 'error');
        return;
      }
      applySidebar2faState(false);
      if (typeof UI !== 'undefined') {
        UI.toast('2FA desativado.', 'success');
        UI.closeModal();
      }
    });

    if (ativo) {
      document.getElementById('twofa-modal-disable-password')?.focus();
    }
  }

  async function openSidebar2faModal() {
    if (typeof UI === 'undefined' || typeof API === 'undefined') return;
    if (typeof API.get2faStatus !== 'function') {
      UI.toast('2FA indisponível neste momento.', 'error');
      return;
    }

    UI.showLoading('Carregando 2FA...');
    let st;
    try {
      st = await API.get2faStatus();
    } finally {
      UI.hideLoading();
    }

    if (!st?.ok) {
      UI.toast(st?.error || 'Não foi possível consultar o 2FA.', 'error');
      return;
    }
    if (st.needsMigration) {
      UI.toast(
        'Execute a migração SQL de 2FA no Aiven e configure TWO_FA_ENCRYPTION_KEY.',
        'error'
      );
      return;
    }

    const ativo = !!st.ativo;
    applySidebar2faState(ativo);

    UI.modal({
      title: ativo ? '2FA ativado' : 'Ativar 2FA',
      dialogClass: 'modal-dialog--2fa',
      body: twoFaIntroModalBodyHTML({ ativo })
    });

    bindTwoFaIntroModalEvents(ativo);
  }

  function bindSidebar2fa() {
    const btn = document.getElementById('sidebar-2fa-btn');
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      openSidebar2faModal();
    });
  }

  async function syncSidebar2faStatus() {
    applySidebar2faState(false);
    if (typeof API === 'undefined' || typeof API.get2faStatus !== 'function') return;
    try {
      const st = await API.get2faStatus();
      applySidebar2faState(!!(st && st.ok && st.ativo));
    } catch {
      applySidebar2faState(false);
    }
  }

  function setContent(html) {
    const el = document.getElementById('page-content');
    if (el) {
      el.innerHTML = html;
      UI.bindRipple(el);
    }
  }

  function featureLockedPageHTML(featureLabel = 'Recurso') {
    const price = vendasLockPriceLabel();
    const label = String(featureLabel || 'Recurso');
    return `
      <div class="page-head">
        <div>
          <h1 class="page-title">${label}</h1>
          <p class="page-subtitle">Recurso bloqueado para esta conta</p>
        </div>
      </div>
      <div class="empty-state vendas-locked-card">
        <div class="vendas-locked-card__icon" aria-hidden="true">${LOCK_ICON}</div>
        <h2>${label} bloqueada</h2>
        <p>Para liberar este recurso, realize o pagamento único de <strong>${price}</strong>
          (pessoa física / causa social).</p>
        <div class="vendas-locked-card__actions">
          <a class="btn btn-primary ripple" href="pagamento.html" data-pas-nav="1">Pagar ${price}</a>
          <a class="btn btn-ghost ripple" href="dashboard.html" data-pas-nav="1">Voltar ao painel</a>
        </div>
      </div>`;
  }

  function vendasLockedPageHTML() {
    return featureLockedPageHTML('Vendas');
  }

  function reservasLockedPageHTML() {
    return featureLockedPageHTML('Reservas Pendentes');
  }

  function suporteLockedPageHTML() {
    return featureLockedPageHTML('Suporte');
  }

  function novaRifaLimitedPageHTML() {
    const price = vendasLockPriceLabel();
    return `
      <div class="page-head">
        <div>
          <h1 class="page-title">Nova Rifa</h1>
          <p class="page-subtitle">Limite do plano Free atingido</p>
        </div>
      </div>
      <div class="empty-state vendas-locked-card">
        <div class="vendas-locked-card__icon" aria-hidden="true">${LOCK_ICON}</div>
        <h2>Você já criou sua rifa grátis</h2>
        <p>No plano <strong>Free</strong> é possível criar apenas <strong>1 rifa</strong>.
          Para criar mais, torne-se <strong>Pro</strong> com o pagamento de <strong>${price}</strong>
          (status de pagamento ativo).</p>
        <div class="vendas-locked-card__actions">
          <a class="btn btn-primary ripple" href="pagamento.html" data-pas-nav="1">Tornar Pro — ${price}</a>
          <a class="btn btn-ghost ripple" href="minhas-rifas.html" data-pas-nav="1">Ver minhas rifas</a>
        </div>
      </div>`;
  }

  return {
    render,
    setContent,
    NAV,
    showVendasLockedMessage,
    showReservasLockedMessage,
    showSuporteLockedMessage,
    showNovaRifaLimitedMessage,
    markAfterLoginPayNotice,
    vendasLockedPageHTML,
    reservasLockedPageHTML,
    suporteLockedPageHTML,
    novaRifaLimitedPageHTML,
    syncPaymentLock,
    bindVendasLockGuards,
    bindNovaRifaLimitGuard,
    syncPlanBadge,
    syncSupportFab,
    mountSupportFab,
    refreshSupportFabBadge,
    syncSidebar2faStatus,
    applySidebar2faState,
    openSidebar2faModal,
    allowNavigate,
    clearNavGate,
    isPanelNavAllowed,
    go,
    pageFileFromHref
  };
})();

window.Layout = Layout;
window.PasNav = {
  allow: (href) => Layout.allowNavigate(href),
  go: (href) => Layout.go(href),
  clear: () => Layout.clearNavGate()
};
