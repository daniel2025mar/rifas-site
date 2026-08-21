/**
 * Portal do Desenvolvedor — layout admin (PowerApps Sistemas)
 */
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof protegerRota === 'function') {
    const gate = await protegerRota({ page: 'dev.html', showLoading: false });
    if (!gate?.ok) return;
  } else {
    const session = DevAuth.requireSession();
    if (!session) return;
  }

  const session = DevAuth.getSession();
  if (!session) return;

  const root = document.getElementById('dev-app');
  if (!root) return;

  let activeTab = 'dashboard';
  let usersCache = [];
  let ratingsCache = [];
  let ratingsFilter = 'todos';
  let ratingsSearch = '';
  let payFilter = 'todos';
  let assinaturasTipoFilter = 'todos';
  let assinaturasStatusFilter = 'todos';
  let assinaturasSearch = '';
  let usersLiveSub = null;
  let usersPollTimer = null;
  let usersLiveBusy = false;
  let messagePanelOpen = false;
  let messagePanelQuery = '';
  let securityFilters = {
    period: '7d',
    severidade: '',
    categoria: '',
    status: '',
    usuario_id: '',
    ip: '',
    endpoint: ''
  };
  let neonUsageCache = null;
  let neonRefreshBusy = false;

  const NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { id: 'usuarios', label: 'Usuários', icon: 'users' },
    { id: 'assinaturas', label: 'Assinaturas', icon: 'card' },
    { id: 'pagamentos', label: 'Pagamentos', icon: 'wallet' },
    { id: 'avaliacoes', label: 'Avaliações', icon: 'star' },
    { id: 'planos', label: 'Planos', icon: 'layers' },
    { id: 'relatorios', label: 'Relatórios', icon: 'chart' },
    { id: 'configuracoes', label: 'Configurações', icon: 'gear' },
    { id: 'logs', label: 'Segurança', icon: 'list' }
  ];

  const TITLES = {
    dashboard: 'Dashboard',
    usuarios: 'Usuários',
    assinaturas: 'Assinaturas',
    pagamentos: 'Pagamentos',
    avaliacoes: 'Avaliações',
    planos: 'Planos',
    relatorios: 'Relatórios',
    configuracoes: 'Configurações',
    logs: 'Incidentes de segurança'
  };

  const ICONS = {
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 2 9 4.9-9 4.9L3 6.9 12 2Z"/><path d="m3 12 9 4.9 9-4.9"/><path d="m3 17 9 4.9 9-4.9"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 9.5c0-1.5-1.3-2.5-3-2.5s-3 1-3 2.5 1.3 2 3 2.5 3 1 3 2.5-1.3 2.5-3 2.5-3-1-3-2.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>',
    diamond: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 2 9l10 13L22 9 12 2Z"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z"/></svg>',
    message: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
  };

  function escape(s) {
    return typeof UI !== 'undefined' ? UI.escapeHtml(String(s ?? '')) : String(s ?? '');
  }

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function tipoLabel(tipo) {
    return API.normalizeTipoConta(tipo) === 'empresa' ? 'Empresa' : 'Pessoa física';
  }

  function contaTipoLabel(u) {
    return isEmpresaUser(u) ? 'Pessoa jurídica' : 'Pessoa física';
  }

  function statusLabel(st) {
    const v = API.normalizeStatusPagamento(st);
    const map = {
      pendente: 'Pendente',
      pendente_revisao: 'Pendente',
      ativo: 'Pago',
      atrasado: 'Pendente',
      cancelado: 'Falhado'
    };
    return map[v] || v;
  }

  function assinaturaStatusLabel(st) {
    const v = API.normalizeStatusPagamento(st);
    const map = {
      pendente: 'Pendente',
      pendente_revisao: 'Em revisão',
      ativo: 'Ativa',
      atrasado: 'Atrasada',
      cancelado: 'Bloqueada'
    };
    return map[v] || v;
  }

  function assinaturaStatusClass(st) {
    const v = API.normalizeStatusPagamento(st);
    if (v === 'ativo') return 'pago';
    if (v === 'cancelado') return 'falhado';
    if (v === 'atrasado') return 'atrasado';
    return 'pendente';
  }

  function statusClass(st) {
    const v = API.normalizeStatusPagamento(st);
    if (v === 'ativo') return 'pago';
    if (v === 'cancelado') return 'falhado';
    return 'pendente';
  }

  function planLabel(u) {
    const plano = String(u.plano || '');
    if (plano.includes('empresarial') || API.normalizeTipoConta(u.tipoConta) === 'empresa') {
      return 'Empresarial';
    }
    return 'Pessoal';
  }

  function planValue(u) {
    const price = API.getPlanPrice?.(u.tipoConta || u.plano) || { valor: 20 };
    return Number(price.valor || 0);
  }

  function moneyBR(n) {
    return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function moneyUSD(n) {
    if (n == null || !Number.isFinite(Number(n))) return 'Não disponível';
    return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  function naLabel(value) {
    if (value == null || value === '' || value === undefined) return 'Não disponível';
    return String(value);
  }

  function neonToneClass(tone) {
    return `pas-neon-status pas-neon-status--${escape(tone || 'muted')}`;
  }

  function neonStatusDot(tone) {
    const map = {
      normal: '🟢',
      attention: '🟡',
      high: '🟠',
      critical: '🔴',
      exhausted: '🛑'
    };
    return map[tone] || '⚪';
  }

  function formatWhen(iso) {
    if (!iso) return 'Não disponível';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Não disponível';
    return d.toLocaleString('pt-BR');
  }

  function localYmd(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function startOfLocalDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Série diária de receita Pro (pago_em) nos últimos N dias */
  function buildRevenueSeries(users, days = 7) {
    const today = startOfLocalDay();
    const series = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      series.push({
        key: localYmd(d),
        label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
        shortDate: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        value: 0,
        count: 0
      });
    }
    const byKey = new Map(series.map((row) => [row.key, row]));

    (users || []).forEach((u) => {
      if (isDevUserRow(u)) return;
      const st = API.normalizeStatusPagamento(u.statusPagamento);
      if (st !== 'ativo') return;
      const paidAt = u.pagoEm || u.comprovanteEm;
      if (!paidAt) return;
      const bucket = byKey.get(localYmd(paidAt));
      if (!bucket) return;
      bucket.value += planValue(u);
      bucket.count += 1;
    });

    const total = series.reduce((acc, row) => acc + row.value, 0);
    const payments = series.reduce((acc, row) => acc + row.count, 0);
    return { series, total, payments };
  }

  function revenueSparkline(users = usersCache) {
    const { series, total, payments } = buildRevenueSeries(users, 7);
    const values = series.map((row) => row.value);
    const max = Math.max(...values, 1);
    const w = 320;
    const h = 118;
    const padX = 10;
    const padTop = 16;
    const padBottom = 28;
    const chartH = h - padTop - padBottom;
    const chartW = w - padX * 2;
    const step = series.length > 1 ? chartW / (series.length - 1) : 0;

    const points = series.map((row, i) => {
      const x = padX + i * step;
      const y = padTop + chartH - (row.value / max) * chartH;
      return { ...row, x, y };
    });

    const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = [
      `${padX},${padTop + chartH}`,
      ...points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
      `${padX + chartW},${padTop + chartH}`
    ].join(' ');

    const uid = `rev${Date.now().toString(36)}`;
    const empty = payments === 0;

    return `
      <div class="pas-revenue">
        <div class="pas-revenue__meta">
          <div>
            <strong>${escape(moneyBR(total))}</strong>
            <span>nos últimos 7 dias</span>
          </div>
          <em>${escape(String(payments))} pagamento${payments === 1 ? '' : 's'} Pro</em>
        </div>
        <div class="pas-spark-wrap${empty ? ' is-empty' : ''}">
          <svg class="pas-spark pas-spark--revenue" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Receita dos últimos 7 dias">
            <defs>
              <linearGradient id="${uid}-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#e11d2e" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="#e11d2e" stop-opacity="0.02"/>
              </linearGradient>
              <linearGradient id="${uid}-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#f87171"/>
                <stop offset="55%" stop-color="#e11d2e"/>
                <stop offset="100%" stop-color="#991b1b"/>
              </linearGradient>
            </defs>
            <line x1="${padX}" y1="${padTop}" x2="${padX + chartW}" y2="${padTop}" class="pas-spark__grid"/>
            <line x1="${padX}" y1="${padTop + chartH / 2}" x2="${padX + chartW}" y2="${padTop + chartH / 2}" class="pas-spark__grid"/>
            <line x1="${padX}" y1="${padTop + chartH}" x2="${padX + chartW}" y2="${padTop + chartH}" class="pas-spark__grid"/>
            <polygon fill="url(#${uid}-fill)" points="${area}"></polygon>
            <polyline fill="none" stroke="url(#${uid}-stroke)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${line}"></polyline>
            ${points
              .map(
                (p) => `
              <g class="pas-spark__point${p.value > 0 ? ' has-value' : ''}">
                <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.value > 0 ? 4.5 : 2.5}"></circle>
                <title>${escape(p.shortDate)}: ${escape(moneyBR(p.value))} (${p.count})</title>
              </g>`
              )
              .join('')}
            ${points
              .map(
                (p) => `
              <text x="${p.x.toFixed(1)}" y="${h - 8}" text-anchor="middle" class="pas-spark__label">${escape(p.label)}</text>`
              )
              .join('')}
          </svg>
          ${empty ? '<p class="pas-revenue__empty">Sem pagamentos Pro nestes 7 dias</p>' : ''}
        </div>
      </div>`;
  }

  function formatWhen(value) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(value);
    }
  }

  function firstName() {
    return String(session.name || 'Desenvolvedor').trim().split(/\s+/)[0] || 'Desenvolvedor';
  }

  function canApprovePayment(status) {
    const v = API.normalizeStatusPagamento(status);
    return v === 'pendente' || v === 'pendente_revisao' || v === 'atrasado';
  }

  function hasPaymentProof(valueOrUser) {
    if (valueOrUser && typeof valueOrUser === 'object') {
      if (valueOrUser.hasComprovante) return true;
      if (valueOrUser.comprovanteEm) return true;
      return hasPaymentProof(valueOrUser.comprovantePagamento);
    }
    const proof = String(valueOrUser || '').trim();
    if (!proof) return false;
    if (/^data:image\//i.test(proof)) return true;
    if (/^https?:\/\//i.test(proof)) return true;
    if (/^(comprovantes|rifas-media|avatars|banners)\//i.test(proof)) return true;
    if (proof.length > 80 && /^[A-Za-z0-9+/=\s]+$/.test(proof)) return true;
    return false;
  }

  function proofSrc(value) {
    const proof = String(value || '').trim();
    if (!proof) return '';
    if (/^data:image\//i.test(proof) || /^https?:\/\//i.test(proof)) return proof;
    if (typeof API !== 'undefined' && API.resolveMediaSrc) {
      const resolved = API.resolveMediaSrc(proof);
      if (resolved && resolved !== proof) return resolved;
    }
    if (/^(comprovantes|rifas-media|avatars|banners)\//i.test(proof)) return proof;
    if (proof.length > 80 && /^[A-Za-z0-9+/=\s]+$/.test(proof)) {
      return `data:image/jpeg;base64,${proof.replace(/\s+/g, '')}`;
    }
    return proof;
  }

  function avatarSrc(photo) {
    if (window.PAS_AVATAR && typeof PAS_AVATAR.resolve === 'function') {
      return PAS_AVATAR.resolve(photo);
    }
    const list = window.PAS_DEFAULT_AVATARS || [];
    return String(photo || '').trim() || list[0]?.src || '';
  }

  /** Foto de usuarios.foto_perfil ou avatar padrão */
  function userAvatarHTML(user) {
    const id = user?.id != null ? String(user.id) : '';
    return `<span class="pas-user-avatar" data-avatar-user="${escape(id)}"><img src="${escape(avatarSrc(user?.photo))}" alt="" loading="lazy"></span>`;
  }

  function patchUserAvatars(users = usersCache) {
    const byId = new Map((users || []).map((u) => [String(u.id), u]));
    document.querySelectorAll('[data-avatar-user]').forEach((el) => {
      const id = el.getAttribute('data-avatar-user');
      if (!id) return;
      // Nunca altera o avatar do perfil do desenvolvedor (header)
      if (el.closest('#dev-profile-avatar, #dev-profile-btn, #dev-profile-wrap')) return;
      const u = byId.get(id);
      if (!u) return;
      // Conta do desenvolvedor não entra na lista de avatares de usuários
      if (typeof API !== 'undefined' && API.isDeveloperAccount?.(u)) return;
      const nextSrc = avatarSrc(u.photo);
      let img = el.querySelector('img');
      if (!img) {
        el.innerHTML = `<img src="${escape(nextSrc)}" alt="" loading="lazy">`;
        img = el.querySelector('img');
      }
      if (img && img.getAttribute('src') !== nextSrc) {
        img.setAttribute('src', nextSrc);
      }
    });
  }

  function applyPhotoFromPayload(payload) {
    const row = payload?.new;
    if (!row?.id) return false;
    // Mudança na conta do desenvolvedor não altera a lista de usuários
    if (typeof API !== 'undefined' && API.isDeveloperAccount?.(row)) return false;
    const id = String(row.id);
    const photo = row.foto_perfil || '';
    const name = row.nome || '';
    const email = row.email || '';
    const idx = usersCache.findIndex((u) => String(u.id) === id);
    if (idx >= 0) {
      usersCache[idx] = {
        ...usersCache[idx],
        photo: Object.prototype.hasOwnProperty.call(row, 'foto_perfil')
          ? photo
          : usersCache[idx].photo,
        name: name || usersCache[idx].name,
        email: email || usersCache[idx].email
      };
    }
    patchUserAvatars(usersCache);
    return true;
  }

  function presenceSignature(users = usersCache) {
    return (users || [])
      .filter((u) => isUserOnline(u))
      .map((u) => String(u.id))
      .sort()
      .join(',');
  }

  function applyPresenceFromPayload(payload) {
    const row = payload?.new;
    if (!row || row.id == null) return false;
    const id = String(row.id);
    const idx = usersCache.findIndex((u) => String(u.id) === id);
    if (idx < 0) return false;
    const prev = usersCache[idx];
    const next = {
      ...prev,
      sessionActive: Object.prototype.hasOwnProperty.call(row, 'sessao_token')
        ? Boolean(row.sessao_token)
        : prev.sessionActive,
      sessionAt: row.sessao_em != null ? row.sessao_em : prev.sessionAt,
      lastSeen:
        row.ultimo_acesso != null
          ? row.ultimo_acesso
          : row.sessao_em != null
            ? row.sessao_em
            : prev.lastSeen
    };
    usersCache[idx] = next;
    return true;
  }

  function patchPresenceUI(users = usersCache) {
    const s = computeStats(users);
    const onlineUsers = users
      .filter((u) => isUserOnline(u))
      .sort((a, b) => {
        const ta = new Date(a.lastSeen || a.sessionAt || 0).getTime();
        const tb = new Date(b.lastSeen || b.sessionAt || 0).getTime();
        return tb - ta;
      })
      .slice(0, 8);

    document.querySelectorAll('.pas-kpi--presence strong').forEach((el) => {
      el.textContent = String(s.online);
    });
    document.querySelectorAll('.pas-kpi--presence em').forEach((el) => {
      el.textContent = `${s.offline} offline agora`;
    });
    document.querySelectorAll('.pas-presence-count').forEach((el) => {
      el.textContent = `${s.online} online`;
    });

    const list = document.getElementById('dev-presence-list');
    if (list) {
      list.innerHTML = onlineUsers.length
        ? onlineUsers
            .map(
              (u) => `
            <div class="pas-presence-row">
              ${userAvatarHTML(u)}
              <div>
                <strong>${escape(u.name || '—')}</strong>
                <span>${escape(u.email || '')}</span>
              </div>
              ${presenceBadgeHTML(u)}
            </div>`
            )
            .join('')
        : '<p class="pas-muted">Nenhum usuário online no momento.</p>';
    }

    document.querySelectorAll('tr[data-user-id]').forEach((tr) => {
      const id = tr.getAttribute('data-user-id');
      const u = (users || []).find((x) => String(x.id) === String(id));
      if (!u) return;
      const cell = tr.querySelector('.pas-presence');
      if (!cell) return;
      const wrap = document.createElement('div');
      wrap.innerHTML = presenceBadgeHTML(u);
      const next = wrap.firstElementChild;
      if (next) cell.replaceWith(next);
    });

    document.querySelectorAll('.pas-presence-summary').forEach((el) => {
      el.innerHTML = `
        <span class="pas-presence is-online"><i></i>${escape(String(s.online))} online</span>
        <span class="pas-presence is-offline"><i></i>${escape(String(s.offline))} offline</span>`;
    });

    if (messagePanelOpen) patchMessagePanelPresence(users);
    if (typeof SuporteChat !== 'undefined' && typeof SuporteChat.syncDockPresence === 'function') {
      SuporteChat.syncDockPresence(users);
    }
  }

  async function silentRefreshUsers(payload) {
    if (usersLiveBusy) return;
    usersLiveBusy = true;
    try {
      const prevPresence = presenceSignature(usersCache);

      // Atualiza avatar na hora com o payload do Realtime
      if (payload?.type === 'UPDATE' && payload.new?.id != null) {
        applyPhotoFromPayload(payload);
        applyPresenceFromPayload(payload);
      }

      const prevCount = usersCache.length;
      await loadUsers();
      patchUserAvatars(usersCache);

      const nextPresence = presenceSignature(usersCache);
      const presenceChanged = prevPresence !== nextPresence;
      const structural =
        payload?.type === 'INSERT' ||
        payload?.type === 'DELETE' ||
        usersCache.length !== prevCount;

      if (['dashboard', 'usuarios'].includes(activeTab) && (presenceChanged || payload?.source === 'poll' || payload?.source === 'visible')) {
        patchPresenceUI(usersCache);
      } else if (messagePanelOpen) {
        patchPresenceUI(usersCache);
      }

      if (structural && ['dashboard', 'usuarios', 'pagamentos'].includes(activeTab)) {
        await renderTab({ quiet: true });
      } else if (presenceChanged && ['dashboard', 'usuarios'].includes(activeTab)) {
        // Garante lista completa quando alguém entra/sai do online
        await renderTab({ quiet: true });
      }

      if (messagePanelOpen && structural) {
        renderMessagePanelList();
      }
    } catch (err) {
      console.warn('Falha ao atualizar usuários ao vivo', err);
    } finally {
      usersLiveBusy = false;
    }
  }

  function startUsersLiveUpdates() {
    if (usersLiveSub) {
      try {
        usersLiveSub.unsubscribe();
      } catch {
        /* ignore */
      }
      usersLiveSub = null;
    }
    if (usersPollTimer) {
      clearInterval(usersPollTimer);
      usersPollTimer = null;
    }

    if (typeof API.subscribeDevUsersLive === 'function') {
      usersLiveSub = API.subscribeDevUsersLive((payload) => {
        silentRefreshUsers(payload);
      });
    }

    // Presença online/offline: atualização periódica, pausada fora da aba.
    usersPollTimer = setInterval(() => {
      if (document.hidden) return;
      silentRefreshUsers({ type: 'POLL', source: 'poll' });
    }, 60 * 1000);

    if (!document.documentElement.dataset.devUsersVisibilityBound) {
      document.documentElement.dataset.devUsersVisibilityBound = '1';
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) silentRefreshUsers({ type: 'POLL', source: 'visible' });
      });
    }
  }

  function sortMessageUsers(list) {
    return (list || []).slice().sort((a, b) => {
      const ao = isUserOnline(a) ? 1 : 0;
      const bo = isUserOnline(b) ? 1 : 0;
      if (bo !== ao) return bo - ao;
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
  }

  function isEmpresaUser(u) {
    return API.normalizeTipoConta(u?.tipoConta) === 'empresa';
  }

  function filteredMessageUsers(users = usersCache) {
    const q = String(messagePanelQuery || '')
      .trim()
      .toLowerCase();
    const list = (users || []).filter((u) => !isDevUserRow(u) && isProUser(u));
    const filtered = !q
      ? list
      : list.filter((u) => {
          const name = String(u.name || '').toLowerCase();
          const email = String(u.email || '').toLowerCase();
          const company = String(u.razaoSocial || u.razao_social || '').toLowerCase();
          return name.includes(q) || email.includes(q) || company.includes(q);
        });
    return sortMessageUsers(filtered);
  }

  function groupedMessageUsers(users = usersCache) {
    const rows = filteredMessageUsers(users);
    return {
      fisica: sortMessageUsers(rows.filter((u) => !isEmpresaUser(u))),
      juridica: sortMessageUsers(rows.filter((u) => isEmpresaUser(u)))
    };
  }

  function messageGroupSignature(users = usersCache) {
    const groups = groupedMessageUsers(users);
    return [
      'pf:' + groups.fisica.map((u) => String(u.id)).join(','),
      'pj:' + groups.juridica.map((u) => String(u.id)).join(',')
    ].join('|');
  }

  function messageUserRowHTML(u) {
    const online = isUserOnline(u);
    const company = String(u.razaoSocial || u.razao_social || '').trim();
    const subtitle = isEmpresaUser(u) && company ? company : u.email || '';
    return `
      <button type="button" class="pas-admin-msg__user" role="listitem" data-message-user-id="${escape(String(u.id))}" data-message-tipo="${
        isEmpresaUser(u) ? 'empresa' : 'pessoa'
      }">
        ${userAvatarHTML(u)}
        <span class="pas-admin-msg__user-info">
          <strong>${escape(u.name || '—')}</strong>
          <em>${escape(subtitle)}</em>
        </span>
        <span class="pas-presence ${online ? 'is-online' : 'is-offline'}" data-message-presence="${escape(String(u.id))}" title="${
          online ? 'Online agora' : 'Offline'
        }"><i></i>${online ? 'Online' : 'Offline'}</span>
      </button>`;
  }

  function messageGroupHTML(title, users) {
    if (!users.length) return '';
    return `
      <section class="pas-admin-msg__group" aria-label="${escape(title)}">
        <div class="pas-admin-msg__group-head">
          <strong>${escape(title)}</strong>
          <span>${users.length}</span>
        </div>
        <div class="pas-admin-msg__group-list">
          ${users.map(messageUserRowHTML).join('')}
        </div>
      </section>`;
  }

  function renderMessagePanelList(users = usersCache) {
    const listEl = document.getElementById('dev-message-list');
    const countEl = document.getElementById('dev-message-count');
    if (!listEl) return;
    const groups = groupedMessageUsers(users);
    const rows = [...groups.fisica, ...groups.juridica];
    const proUsers = (users || []).filter((u) => !isDevUserRow(u) && isProUser(u));
    const onlineCount = proUsers.filter(isUserOnline).length;
    if (countEl) countEl.textContent = `${onlineCount} online · ${proUsers.length} Pro`;
    if (!rows.length) {
      listEl.innerHTML = messagePanelQuery
        ? '<p class="pas-muted">Nenhum usuário encontrado.</p>'
        : '<p class="pas-muted">Nenhum usuário Pro cadastrado.</p>';
      return;
    }
    listEl.innerHTML = [
      messageGroupHTML('Pessoa física', groups.fisica),
      messageGroupHTML('Pessoa jurídica', groups.juridica)
    ].join('');
  }

  function patchMessagePanelPresence(users = usersCache) {
    const panel = document.getElementById('dev-message-panel');
    if (!panel || panel.hidden) return;
    const countEl = document.getElementById('dev-message-count');
    const proUsers = (users || []).filter((u) => !isDevUserRow(u) && isProUser(u));
    const onlineCount = proUsers.filter(isUserOnline).length;
    if (countEl) countEl.textContent = `${onlineCount} online · ${proUsers.length} Pro`;

    const byId = new Map((users || []).map((u) => [String(u.id), u]));
    panel.querySelectorAll('[data-message-presence]').forEach((el) => {
      const id = el.getAttribute('data-message-presence');
      const u = byId.get(String(id));
      if (!u) return;
      const online = isUserOnline(u);
      el.classList.toggle('is-online', online);
      el.classList.toggle('is-offline', !online);
      el.title = online ? 'Online agora' : 'Offline';
      el.innerHTML = `<i></i>${online ? 'Online' : 'Offline'}`;
    });

    // Reordena online primeiro sem recriar se a busca estiver vazia e a lista já existir
    const listEl = document.getElementById('dev-message-list');
    if (listEl && !messagePanelQuery) {
      const desired = messageGroupSignature(users);
      const current = [
        'pf:' +
          Array.from(listEl.querySelectorAll('[data-message-tipo="pessoa"]'))
            .map((btn) => btn.getAttribute('data-message-user-id'))
            .join(','),
        'pj:' +
          Array.from(listEl.querySelectorAll('[data-message-tipo="empresa"]'))
            .map((btn) => btn.getAttribute('data-message-user-id'))
            .join(',')
      ].join('|');
      if (desired !== current) renderMessagePanelList(users);
    }
  }

  function openMessageUserChat(userId) {
    const u = (usersCache || []).find((x) => String(x.id) === String(userId));
    if (!u || isDevUserRow(u)) {
      UI.toast('Usuário inválido para chat.', 'error');
      return;
    }
    if (typeof SuporteChat === 'undefined') {
      UI.toast('Módulo de chat indisponível.', 'error');
      return;
    }
    const open =
      typeof SuporteChat.openDockWindow === 'function'
        ? SuporteChat.openDockWindow
        : SuporteChat.openChatModal;
    if (typeof open !== 'function') {
      UI.toast('Módulo de chat indisponível.', 'error');
      return;
    }
    open({
      userId: u.id,
      userName: u.name || 'Usuário',
      userEmail: u.email || '',
      photo: u.photo || '',
      online: isUserOnline(u),
      asDeveloper: true
    });
  }

  function isHomeTab() {
    return activeTab === 'dashboard';
  }

  function syncMessageFabVisibility() {
    const fab = document.getElementById('dev-message-fab');
    const onHome = isHomeTab();
    if (fab) fab.hidden = !onHome;
    if (!onHome && messagePanelOpen) closeMessagePanel();
  }

  function setMessagePanelOpen(open) {
    const panel = document.getElementById('dev-message-panel');
    const fab = document.getElementById('dev-message-fab');
    messagePanelOpen = !!open && isHomeTab();
    if (panel) panel.hidden = !messagePanelOpen;
    if (fab) {
      fab.hidden = !isHomeTab();
      fab.classList.toggle('is-open', messagePanelOpen);
      fab.setAttribute('aria-expanded', messagePanelOpen ? 'true' : 'false');
    }
    document.body.classList.toggle('dev-message-open', messagePanelOpen);
  }

  function closeMessagePanel() {
    setMessagePanelOpen(false);
  }

  async function openMessagePanel() {
    setMessagePanelOpen(true);
    const listEl = document.getElementById('dev-message-list');
    if (listEl && !usersCache.length) {
      listEl.innerHTML = '<p class="pas-muted">Carregando usuários…</p>';
    }
    try {
      if (!usersCache.length) await loadUsers();
      else silentRefreshUsers({ type: 'POLL', source: 'message-open' });
      renderMessagePanelList();
      document.getElementById('dev-message-search')?.focus();
    } catch (err) {
      if (listEl) {
        listEl.innerHTML = `<p class="form-error">${escape(err.message || 'Erro ao carregar usuários.')}</p>`;
      }
    }
  }

  function mountMessageFab() {
    const fab = document.getElementById('dev-message-fab');
    const panel = document.getElementById('dev-message-panel');
    if (!fab || !panel || fab.dataset.bound) return;
    fab.dataset.bound = '1';

    fab.addEventListener('click', () => {
      if (messagePanelOpen) closeMessagePanel();
      else openMessagePanel();
    });

    document.getElementById('dev-message-close')?.addEventListener('click', () => {
      closeMessagePanel();
    });

    document.getElementById('dev-message-search')?.addEventListener('input', (e) => {
      messagePanelQuery = String(e.target.value || '');
      renderMessagePanelList();
    });

    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-message-user-id]');
      if (!btn || !panel.contains(btn)) return;
      openMessageUserChat(btn.getAttribute('data-message-user-id'));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && messagePanelOpen) closeMessagePanel();
    });
  }

  function isPrimaryDeveloperEmail(_email) {
    return false;
  }

  function restrictedAreaLabel() {
    if (session?.nivelAcesso === 'super_admin' || session?.portal === 'dev') {
      return 'Desenvolvedor';
    }
    return 'Equipe';
  }

  function shellHTML() {
    const photo = avatarSrc(session.photo);
    return `
      <div class="pas-admin">
        <aside class="pas-admin__sidebar" id="dev-sidebar">
          <div class="pas-admin__brand">
            <img class="pas-admin__logo" src="assets/Power2.png" alt="" width="34" height="34" aria-hidden="true">
            <div>
              <strong>Power<span>Apps</span></strong>
              <em>SYSTEMS</em>
            </div>
          </div>
          <nav class="pas-admin__nav" aria-label="Menu do desenvolvedor">
            ${NAV.map(
              (item) => `
              <button type="button" class="pas-admin__nav-btn" data-tab="${item.id}">
                <span class="pas-admin__nav-icon" aria-hidden="true">${ICONS[item.icon] || ''}</span>
                <span>${escape(item.label)}</span>
              </button>`
            ).join('')}
          </nav>
          <div class="pas-admin__plan">
            <div class="pas-admin__plan-icon" aria-hidden="true">${ICONS.diamond}</div>
            <div>
              <span>Área Restrita</span>
              <strong id="dev-restricted-name">${escape(restrictedAreaLabel())}</strong>
            </div>
          </div>
        </aside>

        <div class="pas-admin__main">
          <header class="pas-admin__top">
            <div class="pas-admin__top-left">
              <button type="button" class="pas-admin__menu" id="dev-menu-toggle" aria-label="Menu">☰</button>
              <h1 id="dev-title">PowerApps Systems</h1>
            </div>
            <div class="pas-admin__top-right">
              <button type="button" class="pas-admin__icon-btn" aria-label="Buscar">${ICONS.search}</button>
              ${typeof Notificacoes !== 'undefined' ? Notificacoes.headerHTML() : ''}
              <div class="pas-admin__profile-wrap" id="dev-profile-wrap">
                <button type="button" class="pas-admin__profile" id="dev-profile-btn" aria-haspopup="true" aria-expanded="false">
                  <span class="pas-admin__avatar" id="dev-profile-avatar">
                    <img src="${escape(photo)}" alt="">
                  </span>
                  <div>
                    <strong id="dev-profile-name">${escape(session.name || 'Desenvolvedor')}</strong>
                    <span>Desenvolvedor</span>
                  </div>
                  <em class="pas-admin__caret" aria-hidden="true">▾</em>
                </button>
                <div class="pas-admin__menu-pop" id="dev-profile-menu" hidden>
                  <button type="button" data-dev-action="perfil">
                    <span class="pas-admin__menu-ico" aria-hidden="true">${ICONS.user}</span>
                    Perfil
                  </button>
                  ${
                    typeof Theme !== 'undefined' && Theme.profileMenuItemHTML
                      ? Theme.profileMenuItemHTML()
                      : `<button type="button" data-dev-action="tema">
                          <span class="theme-label">Tema escuro</span>
                        </button>`
                  }
                  <button type="button" data-dev-action="sair" class="is-danger">
                    <span class="pas-admin__menu-ico" aria-hidden="true">${ICONS.logout}</span>
                    Sair
                  </button>
                </div>
              </div>
            </div>
          </header>
          <main class="pas-admin__content" id="dev-content">
            <p class="muted">Carregando…</p>
          </main>
        </div>
        <div class="pas-admin__overlay" id="dev-overlay" hidden></div>
        <button type="button" class="pas-admin-fab" id="dev-message-fab" aria-label="Abrir mensagens" aria-expanded="false" aria-controls="dev-message-panel">
          <span class="pas-admin-fab__icon" aria-hidden="true">${ICONS.message}</span>
          <span class="pas-admin-fab__label">Mensagem</span>
        </button>
        <div class="pas-admin-msg" id="dev-message-panel" hidden>
          <div class="pas-admin-msg__head">
            <div>
              <strong>Mensagens</strong>
              <span class="pas-admin-msg__count" id="dev-message-count">0 online</span>
            </div>
            <button type="button" class="pas-admin-msg__close" id="dev-message-close" aria-label="Fechar mensagens">
              <span aria-hidden="true">${ICONS.close}</span>
            </button>
          </div>
          <div class="pas-admin-msg__search">
            <span aria-hidden="true">${ICONS.search}</span>
            <input type="search" id="dev-message-search" placeholder="Buscar usuário…" autocomplete="off" enterkeyhint="search">
          </div>
          <div class="pas-admin-msg__list" id="dev-message-list" role="list">
            <p class="pas-muted">Carregando usuários…</p>
          </div>
        </div>
      </div>`;
  }

  function setActiveNav() {
    root.querySelectorAll('.pas-admin__nav-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-tab') === activeTab);
    });
    const titleEl = document.getElementById('dev-title');
    if (titleEl) titleEl.textContent = 'PowerApps Systems';
  }

  function closeMobileNav() {
    document.body.classList.remove('dev-nav-open');
    const ov = document.getElementById('dev-overlay');
    if (ov) ov.hidden = true;
  }

  function openProofModal(src, title) {
    UI.modal({
      title: title || 'Comprovante',
      dialogClass: 'modal-dialog--wide',
      body: `
        <div class="admin-pay-proof-modal">
          <img src="${escape(src)}" alt="Comprovante de pagamento">
        </div>
      `,
      actions: [{ label: 'Fechar', className: 'btn-ghost', onClick: (c) => c() }]
    });
  }

  /** Modal de manutenção — desativa ou reativa o sistema para todos os usuários */
  async function refreshMaintenanceButton() {
    const btn = document.getElementById('dev-maintenance-btn');
    if (!btn) return;
    try {
      const res = await API.getSystemMaintenance?.();
      const active = !!res?.maintenance?.active;
      btn.dataset.active = active ? '1' : '0';
      btn.innerHTML = active
        ? `<span class="pas-action-ico" aria-hidden="true">${ICONS.wrench}</span><span class="pas-action-label">Reativar Sistema</span>`
        : `<span class="pas-action-ico" aria-hidden="true">${ICONS.wrench}</span><span class="pas-action-label">Desativar Sistema</span>`;
      btn.classList.toggle('is-reactivate', active);
    } catch {
      /* ignore */
    }
  }

  function openBroadcastModal() {
    UI.modal({
      title: 'Enviar aviso a todos',
      body: `
        <div class="form-group">
          <p class="form-hint" style="margin-top:0">
            O aviso abre em um <strong>modal</strong> para todos os usuários que estiverem
            logados ou com o sistema aberto. Não vai para o sino de notificações.
          </p>
          <label for="dev-broadcast-title">Título</label>
          <input
            type="text"
            id="dev-broadcast-title"
            maxlength="120"
            placeholder="Ex.: Aviso importante do sistema"
          >
          <label for="dev-broadcast-message" style="margin-top:0.85rem">Mensagem</label>
          <textarea
            id="dev-broadcast-message"
            rows="7"
            maxlength="4000"
            placeholder="Digite o aviso que todos os usuários vão ver…"
          ></textarea>
          <p id="dev-broadcast-error" class="form-error" hidden></p>
        </div>
      `,
      actions: [
        { label: 'Cancelar', className: 'btn-ghost', onClick: (c) => c() },
        {
          label: 'Enviar aviso',
          className: 'btn-primary',
          onClick: async (close) => {
            const titleEl = document.getElementById('dev-broadcast-title');
            const msgEl = document.getElementById('dev-broadcast-message');
            const errorEl = document.getElementById('dev-broadcast-error');
            const title = String(titleEl?.value || '').trim();
            const message = String(msgEl?.value || '').trim();

            if (title.length < 3) {
              if (errorEl) {
                errorEl.textContent = 'Informe um título (mínimo 3 caracteres).';
                errorEl.hidden = false;
              }
              UI.toast('Informe um título (mínimo 3 caracteres).', 'error');
              titleEl?.focus();
              return;
            }
            if (message.length < 5) {
              if (errorEl) {
                errorEl.textContent = 'Informe a mensagem (mínimo 5 caracteres).';
                errorEl.hidden = false;
              }
              UI.toast('Informe a mensagem (mínimo 5 caracteres).', 'error');
              msgEl?.focus();
              return;
            }

            UI.showLoading('Enviando aviso…');
            try {
              const res = await API.publishSystemAviso({ title, message });
              UI.hideLoading();
              if (!res?.ok) {
                if (errorEl) {
                  errorEl.textContent = res?.error || 'Não foi possível enviar.';
                  errorEl.hidden = false;
                }
                UI.toast(res?.error || 'Não foi possível enviar.', 'error');
                return;
              }
              UI.toast('Aviso publicado. Usuários online verão o modal em instantes.', 'success');
              close();
            } catch (err) {
              UI.hideLoading();
              UI.toast(err?.message || 'Erro ao enviar aviso.', 'error');
            }
          }
        }
      ]
    });
    setTimeout(() => document.getElementById('dev-broadcast-title')?.focus(), 50);
  }

  function openMaintenanceModal() {
    const btn = document.getElementById('dev-maintenance-btn');
    const isActive = btn?.dataset?.active === '1';

    if (isActive) {
      UI.modal({
        title: 'Reativar sistema',
        body: `
          <p class="form-hint" style="margin:0">
            O sistema está desativado para os usuários. Confirme para liberar o acesso novamente.
          </p>
        `,
        actions: [
          { label: 'Cancelar', className: 'btn-ghost', onClick: (c) => c() },
          {
            label: 'Reativar agora',
            className: 'btn-primary',
            onClick: async (close) => {
              UI.showLoading('Reativando…');
              try {
                const res = await API.deactivateSystemMaintenance();
                UI.hideLoading();
                if (!res?.ok) {
                  UI.toast(res?.error || 'Não foi possível reativar.', 'error');
                  return;
                }
                UI.toast('Sistema reativado com sucesso.', 'success');
                close();
                await refreshMaintenanceButton();
              } catch (err) {
                UI.hideLoading();
                UI.toast(err?.message || 'Erro ao reativar.', 'error');
              }
            }
          }
        ]
      });
      return;
    }

    UI.modal({
      title: 'Desativar sistema temporariamente',
      body: `
        <div class="form-group">
          <p class="form-hint" style="margin-top:0">
            Informe o motivo da manutenção. Ao confirmar, a coluna
            <strong>ativo</strong> de todos os usuários muda para
            <strong>false</strong> (exceto a conta do desenvolvedor) e a mensagem é salva em
            <strong>mensagem_bloqueio</strong> para a tela de bloqueio.
          </p>
          <label for="dev-maintenance-message">Motivo da desativação</label>
          <textarea
            id="dev-maintenance-message"
            rows="8"
            maxlength="4000"
            placeholder="Ex.: Estamos realizando melhorias no sistema. Voltamos em breve."
          ></textarea>
          <p id="dev-maintenance-error" class="form-error" hidden></p>
        </div>
      `,
      actions: [
        { label: 'Cancelar', className: 'btn-ghost', onClick: (c) => c() },
        {
          label: 'Desativar sistema',
          className: 'btn-primary',
          onClick: async (close) => {
            const field = document.getElementById('dev-maintenance-message');
            const errorEl = document.getElementById('dev-maintenance-error');
            const message = String(field?.value || '').trim();
            if (message.length < 5) {
              if (errorEl) {
                errorEl.textContent = 'Digite o motivo da manutenção (mínimo 5 caracteres).';
                errorEl.hidden = false;
              }
              UI.toast('Digite o motivo da manutenção (mínimo 5 caracteres).', 'error');
              field?.focus();
              return;
            }
            UI.showLoading('Desativando…');
            try {
              const res = await API.activateSystemMaintenance({ message });
              UI.hideLoading();
              if (!res?.ok) {
                if (errorEl) {
                  errorEl.textContent = res?.error || 'Não foi possível desativar.';
                  errorEl.hidden = false;
                }
                UI.toast(res?.error || 'Não foi possível desativar.', 'error');
                return;
              }
              UI.toast('Sistema desativado. Contas em usuarios.ativo=false (exceto o desenvolvedor).', 'success');
              close();
              await refreshMaintenanceButton();
            } catch (err) {
              UI.hideLoading();
              UI.toast(err?.message || 'Erro ao desativar.', 'error');
            }
          }
        }
      ]
    });
    setTimeout(() => document.getElementById('dev-maintenance-message')?.focus(), 50);
  }

  function refreshProfileHeader(next) {
    if (!next) return;
    const nextEmail = String(next.email || '').trim().toLowerCase();
    const sessionEmail = String(session.email || '').trim().toLowerCase();
    // Só aceita atualização do próprio desenvolvedor logado
    if (nextEmail && sessionEmail && nextEmail !== sessionEmail) return;
    if (
      next.userId != null &&
      session.userId != null &&
      String(next.userId) !== String(session.userId)
    ) {
      return;
    }
    Object.assign(session, {
      name: next.name != null ? next.name : session.name,
      photo: next.photo != null ? next.photo : session.photo,
      email: next.email != null ? next.email : session.email,
      userId: next.userId != null ? next.userId : session.userId
    });
    if (typeof DevAuth !== 'undefined' && DevAuth.setSession) {
      DevAuth.setSession({ ...session, role: 'developer' });
    }
    const nameEl = document.getElementById('dev-profile-name');
    const avatarEl = document.getElementById('dev-profile-avatar');
    const restrictedEl = document.getElementById('dev-restricted-name');
    if (nameEl) nameEl.textContent = session.name || 'Desenvolvedor';
    if (restrictedEl) restrictedEl.textContent = restrictedAreaLabel();
    if (avatarEl) {
      avatarEl.innerHTML = `<img src="${escape(avatarSrc(session.photo))}" alt="">`;
    }
  }

  function closeProfileMenu() {
    const menu = document.getElementById('dev-profile-menu');
    const btn = document.getElementById('dev-profile-btn');
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function toggleProfileMenu() {
    const menu = document.getElementById('dev-profile-menu');
    const btn = document.getElementById('dev-profile-btn');
    if (!menu || !btn) return;
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  async function fileToProfilePhoto(file) {
    if (!file) return { ok: false, error: 'Selecione uma imagem.' };
    const up = await API.uploadImage(file, { kind: 'avatar' });
    if (!up.ok) return up;
    // Se já foi para Storage, usa a URL/path curta
    if (up.stored || up.path || (up.dataUrl && !String(up.dataUrl).startsWith('data:'))) {
      return { ok: true, dataUrl: up.path || up.dataUrl };
    }
    const source =
      up.dataUrl ||
      (await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
        reader.readAsDataURL(file);
      }));
    if (!source || !/^data:image\//i.test(source)) {
      return { ok: false, error: 'Falha ao processar a foto.' };
    }
    // Fallback legado: reduz tamanho para caber na coluna text
    const dataUrl = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const max = 320;
        let w = img.width;
        let h = img.height;
        if (w > max || h > max) {
          const ratio = Math.min(max / w, max / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('Falha ao processar a foto.'));
      img.src = source;
    });
    return { ok: true, dataUrl };
  }

  async function openDeveloperProfileModal() {
    UI.showLoading('Carregando perfil…');
    let profile = {
      name: session.name || '',
      email: session.email || '',
      photo: session.photo || ''
    };
    try {
      const res = await API.getDeveloperProfile();
      UI.hideLoading();
      if (res.ok && res.profile) {
        profile = res.profile;
        if (res.needsSchema) {
          UI.toast(
            'Para salvar foto, execute supabase/add_foto_perfil_usuarios.sql no Supabase.',
            'info',
            5000
          );
        }
      } else if (!res.ok) {
        UI.toast(res.error || 'Não foi possível carregar o perfil.', 'error');
      }
    } catch (err) {
      UI.hideLoading();
      UI.toast(err.message || 'Erro ao carregar perfil.', 'error');
    }

    let pendingPhoto = String(profile.photo || '').trim();
    const previewSrc = avatarSrc(pendingPhoto);
    const body = document.createElement('div');
    body.className = 'pas-profile-form';
    body.innerHTML = `
      <div class="pas-profile-photo">
        <div class="pas-profile-photo__preview" id="dev-photo-preview">
          <img src="${escape(previewSrc)}" alt="Foto de perfil">
        </div>
        <div class="pas-profile-photo__actions">
          <label class="btn btn-outline btn-sm ripple">
            Enviar foto
            <input id="dev-photo-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>
          </label>
          <button type="button" class="btn btn-ghost btn-sm" id="dev-photo-remove">Usar padrão</button>
        </div>
      </div>
      <div class="form-group">
        <label for="dev-account-name">Nome completo</label>
        <input id="dev-account-name" type="text" required value="${escape(profile.name || '')}" autocomplete="name">
      </div>
      <div class="form-group">
        <label for="dev-account-email">E-mail</label>
        <input id="dev-account-email" type="email" value="${escape(profile.email || '')}" readonly disabled autocomplete="username">
      </div>
      <p class="form-hint">O e-mail não pode ser alterado. Para redefinir a senha, informe a senha atual e a nova senha.</p>
      <div class="form-group">
        <label for="dev-account-current">Senha atual</label>
        <input id="dev-account-current" type="password" placeholder="Obrigatória para trocar a senha" autocomplete="current-password">
      </div>
      <div class="form-grid form-grid--account-pass">
        <div class="form-group">
          <label for="dev-account-new">Nova senha</label>
          <input id="dev-account-new" type="password" placeholder="Mín. 6 caracteres" autocomplete="new-password">
        </div>
        <div class="form-group">
          <label for="dev-account-confirm">Confirmar senha</label>
          <input id="dev-account-confirm" type="password" placeholder="Repita a senha" autocomplete="new-password">
        </div>
      </div>
      <p id="dev-account-error" class="form-error" hidden></p>`;

    function setPreviewPhoto(src) {
      const preview = body.querySelector('#dev-photo-preview');
      if (!preview) return;
      preview.innerHTML = `<img src="${escape(avatarSrc(src))}" alt="Foto de perfil">`;
    }

    body.querySelector('#dev-photo-input')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      UI.showLoading('Processando foto…');
      try {
        const result = await fileToProfilePhoto(file);
        UI.hideLoading();
        if (!result.ok) {
          UI.toast(result.error || 'Falha na foto.', 'error');
          return;
        }
        pendingPhoto = result.dataUrl;
        setPreviewPhoto(pendingPhoto);
      } catch (err) {
        UI.hideLoading();
        UI.toast(err.message || 'Falha na foto.', 'error');
      }
    });

    body.querySelector('#dev-photo-remove')?.addEventListener('click', () => {
      pendingPhoto = '';
      setPreviewPhoto('');
    });

    UI.modal({
      title: 'Meu perfil',
      dialogClass: 'modal-dialog--wide',
      body,
      actions: [
        { label: 'Cancelar', className: 'btn-ghost', onClick: (c) => c() },
        {
          label: 'Salvar',
          className: 'btn-primary',
          onClick: async (c) => {
            const errorEl = body.querySelector('#dev-account-error');
            const name = body.querySelector('#dev-account-name')?.value || '';
            const currentPassword = body.querySelector('#dev-account-current')?.value || '';
            const newPassword = body.querySelector('#dev-account-new')?.value || '';
            const confirmPassword = body.querySelector('#dev-account-confirm')?.value || '';

            const showErr = (msg) => {
              if (errorEl) {
                errorEl.textContent = msg;
                errorEl.hidden = false;
              }
              UI.toast(msg, 'error');
            };

            if (!name.trim()) {
              showErr('Informe o nome completo.');
              return;
            }
            const nameCheck = (window.NomeCompleto || window.API)?.validateFullName?.(name);
            if (nameCheck && !nameCheck.ok) {
              showErr(nameCheck.error);
              return;
            }
            const nomeOk = nameCheck?.value || name.trim();
            if (newPassword || confirmPassword) {
              if (!currentPassword) {
                showErr('Informe a senha atual para redefinir.');
                return;
              }
              if (newPassword.length < 6) {
                showErr('A nova senha deve ter no mínimo 6 caracteres.');
                return;
              }
              if (newPassword !== confirmPassword) {
                showErr('As novas senhas não coincidem.');
                return;
              }
            }

            UI.showLoading('Salvando…');
            try {
              const result = await API.updateDeveloperProfile({
                name: nomeOk,
                currentPassword: newPassword ? currentPassword : '',
                newPassword: newPassword || '',
                photo: pendingPhoto
              });
              UI.hideLoading();
              if (!result.ok) {
                showErr(result.error || 'Não foi possível salvar.');
                return;
              }
              refreshProfileHeader(result.session);
              c();
              UI.toast(
                result.passwordChanged
                  ? 'Perfil e senha atualizados.'
                  : 'Perfil atualizado com sucesso.',
                'success'
              );
              if (result.needsSchema) {
                UI.toast(
                  'Para persistir a foto, execute supabase/add_foto_perfil_usuarios.sql.',
                  'info',
                  6000
                );
              }
            } catch (err) {
              UI.hideLoading();
              showErr(err.message || 'Erro ao salvar.');
            }
          }
        }
      ]
    });
  }

  function bindProfileMenu() {
    const btn = document.getElementById('dev-profile-btn');
    const menu = document.getElementById('dev-profile-menu');
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof Notificacoes !== 'undefined' && Notificacoes.toggle) Notificacoes.toggle(false);
      toggleProfileMenu();
    });

    menu.querySelectorAll('[data-dev-action]').forEach((item) => {
      item.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = item.getAttribute('data-dev-action');
        if (action === 'tema') {
          closeProfileMenu();
          if (typeof Theme !== 'undefined') {
            Theme.toggle();
            Theme.bind();
          }
          return;
        }
        closeProfileMenu();
        if (action === 'sair') {
          DevAuth.logout();
          window.location.href = 'dev-login.html';
          return;
        }
        if (action === 'perfil') {
          await openDeveloperProfileModal();
        }
      });
    });

    document.addEventListener('click', (e) => {
      const wrap = document.getElementById('dev-profile-wrap');
      if (!wrap || wrap.contains(e.target)) return;
      closeProfileMenu();
    });
  }

  async function approvePayment(userId, onDone, { hasProof = true } = {}) {
    if (!userId) return;
    const msg = hasProof
      ? 'Aprovar este pagamento e liberar o recurso?'
      : 'Este usuário está sem comprovante. Aprovar o pagamento mesmo assim?';
    if (!window.confirm(msg)) return;
    UI.showLoading('Aprovando…');
    try {
      const result = await API.confirmUserPayment(userId);
      UI.hideLoading();
      if (!result.ok) {
        UI.toast(result.error || 'Falha ao aprovar.', 'error');
        return;
      }
      UI.toast('Pagamento aprovado. Notificação enviada ao usuário.', 'success', 5000);
      if (typeof onDone === 'function') await onDone();
    } catch (err) {
      UI.hideLoading();
      UI.toast(err.message || 'Erro de conexão.', 'error');
    }
  }

  function plusDaysYmd(days) {
    const d = new Date();
    d.setDate(d.getDate() + Number(days || 0));
    return localYmd(d);
  }

  async function updateSubscriptionStatus(userId, status, onDone) {
    if (!userId || !status) return;
    const u = (usersCache || []).find((x) => String(x.id) === String(userId));
    if (!u) {
      UI.toast('Usuário não encontrado.', 'error');
      return;
    }

    const st = API.normalizeStatusPagamento(status);
    const labels = {
      ativo: 'marcar a assinatura como ativa',
      cancelado: 'bloquear a conta e o acesso ao sistema',
      atrasado: 'marcar a assinatura como atrasada',
      pendente: 'desbloquear a conta sem alterar o plano'
    };
    const actionLabel = labels[st] || 'atualizar a assinatura';
    if (!window.confirm(`Confirma ${actionLabel} de ${u.name || u.email || 'este usuário'}?`)) {
      return;
    }

    const empresa = isEmpresaUser(u);
    const patch = { statusPagamento: st };

    // Bloquear / desbloquear NÃO aprova pagamento e NÃO promove Free → Pro.
    if (st === 'cancelado') {
      // só bloqueia
    } else if (st === 'atrasado') {
      // só marca atraso
    } else if (st === 'ativo') {
      // Só restaura Pro se o usuário já tinha pagamento confirmado antes.
      const hadPaid =
        u.pagoEm != null &&
        String(u.pagoEm).trim() &&
        String(u.pagoEm).toLowerCase() !== 'null';
      if (!hadPaid) {
        UI.toast('Use Aprovar para liberar pagamento Free → Pro.', 'error');
        return;
      }
      patch.plano = empresa ? 'empresarial_mensal' : 'pessoal_unico';
      if (empresa) patch.proximoVencimento = plusDaysYmd(30);
    }

    UI.showLoading(
      st === 'cancelado'
        ? 'Bloqueando conta…'
        : st === 'pendente'
          ? 'Desbloqueando conta…'
          : 'Atualizando assinatura…'
    );
    try {
      if (typeof API.updateUserForDev !== 'function') {
        UI.hideLoading();
        UI.toast('API de atualização indisponível.', 'error');
        return;
      }
      const result = await API.updateUserForDev(userId, patch);
      UI.hideLoading();
      if (!result.ok) {
        UI.toast(result.error || 'Não foi possível atualizar a conta.', 'error');
        return;
      }
      UI.toast(
        st === 'cancelado'
          ? 'Conta bloqueada. O usuário verá o aviso de assinatura cancelada.'
          : st === 'pendente'
            ? 'Conta desbloqueada. O plano do usuário não foi alterado.'
            : st === 'ativo'
              ? 'Conta Pro desbloqueada.'
              : 'Assinatura atualizada.',
        'success'
      );
      if (typeof onDone === 'function') await onDone();
    } catch (err) {
      UI.hideLoading();
      UI.toast(err.message || 'Erro de conexão.', 'error');
    }
  }

  /** Desbloqueia o sistema sem aprovar pagamento (Free permanece Free). */
  async function unblockAccountAccess(userId, onDone) {
    if (!userId) return;
    const u = (usersCache || []).find((x) => String(x.id) === String(userId));
    if (!u) {
      UI.toast('Usuário não encontrado.', 'error');
      return;
    }

    const hadPaid =
      u.pagoEm != null &&
      String(u.pagoEm).trim() &&
      String(u.pagoEm).toLowerCase() !== 'null';
    const okProof = hasPaymentProof(u);

    // Restaura o status anterior: Pro só se já tinha pago_em; senão Free (pendente/revisão).
    let restoreStatus = 'pendente';
    if (hadPaid) restoreStatus = 'ativo';
    else if (okProof) restoreStatus = 'pendente_revisao';

    if (
      !window.confirm(
        hadPaid
          ? `Desbloquear ${u.name || u.email || 'este usuário'} e restaurar o acesso Pro já pago?`
          : `Desbloquear ${u.name || u.email || 'este usuário'} sem aprovar pagamento? (permanece Free)`
      )
    ) {
      return;
    }

    UI.showLoading('Desbloqueando conta…');
    try {
      if (typeof API.updateUserForDev !== 'function') {
        UI.hideLoading();
        UI.toast('API de atualização indisponível.', 'error');
        return;
      }
      const patch = { statusPagamento: restoreStatus };
      const result = await API.updateUserForDev(userId, patch);
      UI.hideLoading();
      if (!result.ok) {
        UI.toast(result.error || 'Não foi possível desbloquear.', 'error');
        return;
      }
      UI.toast(
        hadPaid
          ? 'Conta desbloqueada. Acesso Pro restaurado.'
          : 'Conta desbloqueada. Usuário continua Free — use Aprovar para liberar Pro.',
        'success',
        6000
      );
      if (typeof onDone === 'function') await onDone();
    } catch (err) {
      UI.hideLoading();
      UI.toast(err.message || 'Erro de conexão.', 'error');
    }
  }

  function filterAssinaturas(users, { tipo = 'todos', status = 'todos', search = '' } = {}) {
    const q = String(search || '')
      .trim()
      .toLowerCase()
      .replace(/\D/g, '');
    const qText = String(search || '')
      .trim()
      .toLowerCase();

    return (users || []).filter((u) => {
      if (isDevUserRow(u)) return false;

      const empresa = isEmpresaUser(u);
      if (tipo === 'fisica' && empresa) return false;
      if (tipo === 'juridica' && !empresa) return false;

      const st = API.normalizeStatusPagamento(u.statusPagamento);
      if (status === 'ativo' && st !== 'ativo') return false;
      if (status === 'atrasado' && st !== 'atrasado') return false;
      if (status === 'cancelado' && st !== 'cancelado') return false;
      if (status === 'pendente' && !['pendente', 'pendente_revisao'].includes(st)) return false;

      if (!qText) return true;
      const name = String(u.name || '').toLowerCase();
      const email = String(u.email || '').toLowerCase();
      const company = String(u.razaoSocial || u.razao_social || '').toLowerCase();
      const cnpj = String(u.cnpj || '').replace(/\D/g, '');
      return (
        name.includes(qText) ||
        email.includes(qText) ||
        company.includes(qText) ||
        (q && cnpj.includes(q))
      );
    });
  }

  function subscriptionActionsHTML(u) {
    const st = API.normalizeStatusPagamento(u.statusPagamento);
    const okProof = hasPaymentProof(u);
    const empresa = isEmpresaUser(u);
    const parts = [];

    if (okProof) {
      parts.push(`<button type="button" class="pas-link-btn" data-action="view-proof">Comprovante</button>`);
    }

    if (st === 'cancelado') {
      parts.push(
        `<button type="button" class="pas-approve-btn" data-action="sub-unblock" title="Desbloquear acesso sem aprovar pagamento">Desbloquear</button>`
      );
    } else {
      parts.push(
        `<button type="button" class="pas-link-btn" data-action="sub-cancel" title="Bloquear conta e acesso ao sistema">Bloquear</button>`
      );
      if (canApprovePayment(st)) {
        parts.push(
          `<button type="button" class="pas-approve-btn" data-action="confirm" title="Aprovar pagamento e liberar plano Pro">Aprovar</button>`
        );
      }
      if (st === 'ativo' && empresa) {
        parts.push(`<button type="button" class="pas-ghost-btn" data-action="sub-overdue">Atrasada</button>`);
      }
    }

    if (!parts.length) return `<span class="pas-muted">—</span>`;
    return parts.join(' ');
  }

  function subscriptionRowsHTML(users, { limit = 200 } = {}) {
    const list = users.slice(0, limit);
    if (!list.length) {
      return `<tr><td colspan="8" class="pas-empty-cell">Nenhuma assinatura nesta lista.</td></tr>`;
    }
    return list
      .map((u) => {
        const st = API.normalizeStatusPagamento(u.statusPagamento);
        const kind = assinaturaStatusClass(st);
        const okProof = hasPaymentProof(u);
        const empresa = isEmpresaUser(u);
        const company = String(u.razaoSocial || u.razao_social || '').trim();
        const subtitle = empresa && company ? company : u.email || '';
        const vencRaw = u.proximoVencimento || u.proximo_vencimento;
        let venc = '—';
        if (empresa && vencRaw) {
          const ymd = String(vencRaw).slice(0, 10);
          const parts = ymd.split('-');
          venc =
            parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : formatWhen(vencRaw);
        }
        return `
          <tr data-user-id="${escape(String(u.id))}" data-has-proof="${okProof ? '1' : '0'}" data-tipo="${
            empresa ? 'empresa' : 'pessoa'
          }">
            <td>
              <div class="pas-user-cell">
                ${userAvatarHTML(u)}
                <div>
                  <strong>${escape(u.name || '—')}</strong>
                  <span>${escape(subtitle)}</span>
                </div>
              </div>
            </td>
            <td><em class="pas-tipo-pill ${empresa ? 'is-pj' : 'is-pf'}">${escape(contaTipoLabel(u))}</em></td>
            <td>${escape(planLabel(u))}${
              isProUser(u) ? ' <em class="pas-plan-pill is-pro">Pro</em>' : ' <em class="pas-plan-pill is-free">Free</em>'
            }</td>
            <td>${escape(moneyBR(planValue(u)))}</td>
            <td><span class="pas-status pas-status--${kind}">${escape(assinaturaStatusLabel(st))}</span></td>
            <td>${escape(formatWhen(u.pagoEm || u.comprovanteEm))}</td>
            <td>${escape(venc)}</td>
            <td class="pas-row-actions">${subscriptionActionsHTML(u)}</td>
          </tr>`;
      })
      .join('');
  }

  function bindSubscriptionTable(scope, onDone) {
    bindPaymentTable(scope, onDone);

    scope.querySelectorAll('[data-action="sub-unblock"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('[data-user-id]');
        const userId = row?.getAttribute('data-user-id');
        await unblockAccountAccess(userId, onDone);
      });
    });

    scope.querySelectorAll('[data-action="sub-cancel"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('[data-user-id]');
        const userId = row?.getAttribute('data-user-id');
        await updateSubscriptionStatus(userId, 'cancelado', onDone);
      });
    });

    scope.querySelectorAll('[data-action="sub-overdue"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('[data-user-id]');
        const userId = row?.getAttribute('data-user-id');
        await updateSubscriptionStatus(userId, 'atrasado', onDone);
      });
    });
  }

  function paintAssinaturasTable(scope, users) {
    const filtered = filterAssinaturas(users, {
      tipo: assinaturasTipoFilter,
      status: assinaturasStatusFilter,
      search: assinaturasSearch
    });
    const tbody = scope.querySelector('#dev-assinaturas-tbody');
    const countEl = scope.querySelector('#dev-assinaturas-count');
    if (tbody) tbody.innerHTML = subscriptionRowsHTML(filtered, { limit: 300 });
    if (countEl) countEl.textContent = String(filtered.length);
    bindSubscriptionTable(scope, () => renderAssinaturas(scope, { quiet: true }));
  }

  async function renderAssinaturas(content, { quiet = false } = {}) {
    if (!quiet) {
      content.innerHTML = '<p class="muted">Carregando assinaturas…</p>';
      UI.showLoading('Carregando…');
    }
    try {
      const users = await loadUsers();
      if (!quiet) UI.hideLoading();
      const s = computeStats(users);
      const filtered = filterAssinaturas(users, {
        tipo: assinaturasTipoFilter,
        status: assinaturasStatusFilter,
        search: assinaturasSearch
      });

      content.innerHTML = `
        <section class="pas-welcome pas-welcome--compact">
          <div>
            <h2>Assinaturas</h2>
            <p>Vínculo dos planos Pessoa física e Pessoa jurídica com cada usuário.</p>
          </div>
        </section>

        <section class="pas-kpis">
          <article class="pas-kpi">
            <div>
              <span>Pessoa física</span>
              <strong>${escape(String(s.pessoaFisica))}</strong>
              <em>Plano pessoal</em>
            </div>
            <div class="pas-kpi__icon">${ICONS.user}</div>
          </article>
          <article class="pas-kpi">
            <div>
              <span>Pessoa jurídica</span>
              <strong>${escape(String(s.empresa))}</strong>
              <em>Plano empresarial</em>
            </div>
            <div class="pas-kpi__icon">${ICONS.card}</div>
          </article>
          <article class="pas-kpi">
            <div>
              <span>Assinaturas ativas</span>
              <strong>${escape(String(s.ativo))}</strong>
              <em class="is-up">${escape(moneyBR(s.receita))} estimados</em>
            </div>
            <div class="pas-kpi__icon pas-kpi__icon--red">${ICONS.diamond}</div>
          </article>
          <article class="pas-kpi">
            <div>
              <span>Pendentes / atrasadas</span>
              <strong>${escape(String(s.pendentesTotal))}</strong>
              <em class="is-down">${escape(String(s.atrasado))} atrasadas</em>
            </div>
            <div class="pas-kpi__icon">${ICONS.clock}</div>
          </article>
        </section>

        <article class="pas-card">
          <div class="pas-card__head pas-card__head--assinaturas">
            <h3>Assinaturas vinculadas (<span id="dev-assinaturas-count">${escape(String(filtered.length))}</span>)</h3>
            <div class="pas-assinaturas-tools">
              <div class="pas-tabs" id="dev-assinaturas-tipo-tabs" role="tablist" aria-label="Tipo de conta">
                <button type="button" data-tipo="todos" class="${assinaturasTipoFilter === 'todos' ? 'is-active' : ''}">Todos</button>
                <button type="button" data-tipo="fisica" class="${assinaturasTipoFilter === 'fisica' ? 'is-active' : ''}">Pessoa física</button>
                <button type="button" data-tipo="juridica" class="${assinaturasTipoFilter === 'juridica' ? 'is-active' : ''}">Pessoa jurídica</button>
              </div>
              <div class="pas-tabs" id="dev-assinaturas-status-tabs" role="tablist" aria-label="Status">
                <button type="button" data-status="todos" class="${assinaturasStatusFilter === 'todos' ? 'is-active' : ''}">Todos</button>
                <button type="button" data-status="ativo" class="${assinaturasStatusFilter === 'ativo' ? 'is-active' : ''}">Ativas</button>
                <button type="button" data-status="pendente" class="${assinaturasStatusFilter === 'pendente' ? 'is-active' : ''}">Pendentes</button>
                <button type="button" data-status="atrasado" class="${assinaturasStatusFilter === 'atrasado' ? 'is-active' : ''}">Atrasadas</button>
                <button type="button" data-status="cancelado" class="${assinaturasStatusFilter === 'cancelado' ? 'is-active' : ''}">Bloqueadas</button>
              </div>
              <label class="pas-ratings-search">
                <input type="search" id="dev-assinaturas-search" placeholder="Buscar nome, e-mail, CNPJ ou razão social…" value="${escape(assinaturasSearch)}" aria-label="Buscar assinatura">
              </label>
            </div>
          </div>
          <div class="pas-table-wrap">
            <table class="pas-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Tipo</th>
                  <th>Plano</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Pago em</th>
                  <th>Próx. vencimento</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody id="dev-assinaturas-tbody">
                ${subscriptionRowsHTML(filtered, { limit: 300 })}
              </tbody>
            </table>
          </div>
        </article>`;

      const tipoTabs = content.querySelector('#dev-assinaturas-tipo-tabs');
      tipoTabs?.querySelectorAll('button[data-tipo]').forEach((btn) => {
        btn.addEventListener('click', () => {
          assinaturasTipoFilter = btn.getAttribute('data-tipo') || 'todos';
          tipoTabs.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === btn));
          paintAssinaturasTable(content, usersCache);
        });
      });

      const statusTabs = content.querySelector('#dev-assinaturas-status-tabs');
      statusTabs?.querySelectorAll('button[data-status]').forEach((btn) => {
        btn.addEventListener('click', () => {
          assinaturasStatusFilter = btn.getAttribute('data-status') || 'todos';
          statusTabs.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === btn));
          paintAssinaturasTable(content, usersCache);
        });
      });

      const searchInput = content.querySelector('#dev-assinaturas-search');
      searchInput?.addEventListener('input', () => {
        assinaturasSearch = searchInput.value || '';
        paintAssinaturasTable(content, usersCache);
      });

      bindSubscriptionTable(content, () => renderAssinaturas(content, { quiet: true }));
    } catch (err) {
      if (!quiet) UI.hideLoading();
      content.innerHTML = `<p class="form-error">${escape(err.message || 'Erro')}</p>`;
    }
  }

  function isDevUserRow(u) {
    if (!u) return false;
    if (typeof API !== 'undefined' && typeof API.isDeveloperAccount === 'function') {
      return !!API.isDeveloperAccount(u);
    }
    const nivel = String(u.nivelAcesso || u.nivel_acesso || '')
      .trim()
      .toLowerCase();
    return nivel === 'super_admin';
  }

  async function loadUsers() {
    const res = await API.listUsersForDev();
    if (!res.ok) throw new Error(res.error || 'Erro ao listar usuários.');
    usersCache = (res.users || []).filter((u) => !isDevUserRow(u));
    return usersCache;
  }

  function isUserOnline(u) {
    if (typeof API !== 'undefined' && typeof API.isUserOnline === 'function') {
      return API.isUserOnline(u);
    }
    return false;
  }

  function presenceBadgeHTML(u) {
    const online = isUserOnline(u);
    return `<span class="pas-presence ${online ? 'is-online' : 'is-offline'}" title="${
      online ? 'Online agora' : 'Offline'
    }"><i></i>${online ? 'Online' : 'Offline'}</span>`;
  }

  function computeStats(users) {
    const stats = {
      total: users.length,
      ativo: 0,
      pendente: 0,
      pendenteRevisao: 0,
      atrasado: 0,
      cancelado: 0,
      receita: 0,
      pessoaFisica: 0,
      empresa: 0,
      online: 0,
      offline: 0
    };
    users.forEach((u) => {
      const st = API.normalizeStatusPagamento(u.statusPagamento);
      if (st === 'ativo') {
        stats.ativo += 1;
        stats.receita += planValue(u);
      } else if (st === 'pendente') stats.pendente += 1;
      else if (st === 'pendente_revisao') stats.pendenteRevisao += 1;
      else if (st === 'atrasado') stats.atrasado += 1;
      else if (st === 'cancelado') stats.cancelado += 1;
      if (API.normalizeTipoConta(u.tipoConta) === 'empresa') stats.empresa += 1;
      else stats.pessoaFisica += 1;
      if (isUserOnline(u)) stats.online += 1;
      else stats.offline += 1;
    });
    stats.pendentesTotal = stats.pendente + stats.pendenteRevisao + stats.atrasado;
    return stats;
  }

  function filterPayments(users, filter) {
    return users.filter((u) => {
      const kind = statusClass(u.statusPagamento);
      if (filter === 'realizados') return kind === 'pago';
      if (filter === 'pendentes') return kind === 'pendente';
      if (filter === 'falhados') return kind === 'falhado';
      return true;
    });
  }

  function isProUser(u) {
    if (typeof API !== 'undefined' && typeof API.isProAccount === 'function') {
      return API.isProAccount(u);
    }
    const pago = u?.pagoEm ?? u?.pago_em;
    if (pago != null && String(pago).trim() && String(pago).toLowerCase() !== 'null') return true;
    return API.normalizeStatusPagamento(u?.statusPagamento) === 'ativo';
  }

  function paymentRowsHTML(users, { limit = 8, showActions = true, showPresence = false } = {}) {
    const list = users.slice(0, limit);
    const cols = showPresence ? 8 : 6;
    if (!list.length) {
      return `<tr><td colspan="${cols}" class="pas-empty-cell">Nenhum registro nesta lista.</td></tr>`;
    }
    return list
      .map((u) => {
        const st = API.normalizeStatusPagamento(u.statusPagamento);
        const kind = statusClass(st);
        const okProof = hasPaymentProof(u);
        const showApprove = showActions && canApprovePayment(st);
        const pro = isProUser(u);
        return `
          <tr data-user-id="${escape(String(u.id))}" data-has-proof="${okProof ? '1' : '0'}">
            <td>
              <div class="pas-user-cell">
                ${userAvatarHTML(u)}
                <div>
                  <strong>${escape(u.name || '—')}</strong>
                  <span>${escape(u.email || '')}</span>
                </div>
              </div>
            </td>
            ${showPresence ? `<td>${presenceBadgeHTML(u)}</td>` : ''}
            ${showPresence ? `<td>${escape(u.cicloVida || 'ativo')}</td>` : ''}
            <td>${escape(planLabel(u))}${pro ? ' <em class="pas-plan-pill is-pro">Pro</em>' : ' <em class="pas-plan-pill is-free">Free</em>'}</td>
            <td>${escape(moneyBR(planValue(u)))}</td>
            <td><span class="pas-status pas-status--${kind}">${escape(statusLabel(st))}</span></td>
            <td>${escape(formatWhen(u.pagoEm || u.comprovanteEm))}</td>
            <td class="pas-row-actions">
              ${
                okProof
                  ? `<button type="button" class="pas-link-btn" data-action="view-proof">Comprovante</button>`
                  : ''
              }
              ${
                showApprove
                  ? `<button type="button" class="pas-approve-btn" data-action="confirm">Aprovar</button>`
                  : kind === 'pago'
                    ? `<span class="pas-muted">Aprovado</span>`
                    : `<span class="pas-muted">—</span>`
              }
              ${
                showPresence
                  ? String(u.cicloVida || 'ativo') === 'arquivado'
                    ? `<button type="button" class="pas-link-btn" data-action="ciclo-active">Reativar ciclo</button>`
                    : `<button type="button" class="pas-link-btn" data-action="ciclo-archive">Arquivar ciclo</button>`
                  : ''
              }
            </td>
          </tr>`;
      })
      .join('');
  }

  function bindPaymentTable(scope, onDone) {
    const proofById = new Map();
    usersCache.forEach((u) => {
      const raw = String(u.comprovantePagamento || '').trim();
      if (raw) {
        const src = proofSrc(raw);
        if (src) proofById.set(String(u.id), src);
      }
    });

    scope.querySelectorAll('[data-action="view-proof"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('[data-user-id]');
        const id = row?.getAttribute('data-user-id');
        if (!id) return;
        let src = proofById.get(id);
        if (!src && typeof API !== 'undefined' && API.getPaymentProof) {
          UI.showLoading('Carregando comprovante…');
          try {
            const proof = await API.getPaymentProof(id);
            UI.hideLoading();
            if (!proof.ok || !proof.url) {
              UI.toast(proof.error || 'Comprovante não encontrado.', 'error');
              return;
            }
            src = proof.url;
            proofById.set(id, src);
          } catch (err) {
            UI.hideLoading();
            UI.toast(err.message || 'Falha ao carregar comprovante.', 'error');
            return;
          }
        }
        if (!src) {
          UI.toast('Comprovante não encontrado.', 'error');
          return;
        }
        const name = row?.querySelector('strong')?.textContent || '';
        openProofModal(src, `Comprovante — ${name}`);
      });
    });

    scope.querySelectorAll('[data-action="confirm"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('[data-user-id]');
        const userId = row?.getAttribute('data-user-id');
        const hasProof = row?.getAttribute('data-has-proof') === '1';
        await approvePayment(userId, onDone, { hasProof });
      });
    });

    scope.querySelectorAll('[data-action="ciclo-archive"], [data-action="ciclo-active"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('[data-user-id]');
        const userId = row?.getAttribute('data-user-id');
        if (!userId) return;
        const next = btn.getAttribute('data-action') === 'ciclo-archive' ? 'arquivado' : 'ativo';
        const result = await API.updateUserForDev(userId, { cicloVida: next });
        if (!result?.ok) {
          UI.toast(result?.error || 'Não foi possível atualizar o ciclo.', 'error');
          return;
        }
        UI.toast(next === 'arquivado' ? 'Usuário arquivado (dados preservados).' : 'Ciclo reativado.', 'success');
        if (typeof onDone === 'function') onDone();
      });
    });
  }

  function donutSVG(ativo, pendente, cancelado) {
    const total = Math.max(1, ativo + pendente + cancelado);
    const a = (ativo / total) * 100;
    const p = (pendente / total) * 100;
    const c = (cancelado / total) * 100;
    return `
      <svg class="pas-donut" viewBox="0 0 42 42" aria-hidden="true">
        <circle cx="21" cy="21" r="15.5" fill="transparent" stroke="#e5e7eb" stroke-width="6"></circle>
        <circle cx="21" cy="21" r="15.5" fill="transparent" stroke="#e11d2e" stroke-width="6"
          stroke-dasharray="${a} ${100 - a}" stroke-dashoffset="25"></circle>
        <circle cx="21" cy="21" r="15.5" fill="transparent" stroke="#111827" stroke-width="6"
          stroke-dasharray="${p} ${100 - p}" stroke-dashoffset="${25 - a}"></circle>
        <circle cx="21" cy="21" r="15.5" fill="transparent" stroke="#9ca3af" stroke-width="6"
          stroke-dasharray="${c} ${100 - c}" stroke-dashoffset="${25 - a - p}"></circle>
      </svg>`;
  }

  function activityItems(users) {
    const items = users.slice(0, 5).map((u) => {
      const st = API.normalizeStatusPagamento(u.statusPagamento);
      if (st === 'ativo') {
        return {
          title: `Pagamento aprovado — ${u.name || u.email}`,
          when: formatWhen(u.pagoEm)
        };
      }
      if (st === 'pendente_revisao') {
        return {
          title: `Comprovante enviado por ${u.name || u.email}`,
          when: formatWhen(u.comprovanteEm)
        };
      }
      return {
        title: `Novo usuário: ${u.name || u.email}`,
        when: formatWhen(u.comprovanteEm || u.pagoEm)
      };
    });
    if (!items.length) {
      return `<p class="pas-muted">Sem atividades recentes.</p>`;
    }
    return `
      <ul class="pas-activity">
        ${items
          .map(
            (it) => `
          <li>
            <span class="pas-activity__dot"></span>
            <div>
              <strong>${escape(it.title)}</strong>
              <em>${escape(it.when)}</em>
            </div>
          </li>`
          )
          .join('')}
      </ul>`;
  }

  function neonPct(v) {
    return v == null || !Number.isFinite(Number(v)) ? 'Não disponível' : `${Number(v).toLocaleString('pt-BR')}%`;
  }

  function neonMeterPct(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(100, n);
  }

  function neonQuotaLabel(driver) {
    const map = {
      transfer: 'Transferência',
      compute: 'Compute',
      storage: 'Storage'
    };
    return map[String(driver || '').trim()] || null;
  }

  function neonSummaryCardHTML(usage) {
    const pctVal = usage?.ok ? usage.percents?.quota ?? usage.percents?.overall ?? usage.percents?.budget : null;
    const tone = usage?.ok ? usage.status?.tone || 'muted' : 'muted';
    const meter = neonMeterPct(pctVal);
    const pctLabel = neonPct(pctVal);
    const statusLabel = usage?.ok ? usage.status?.label || 'NORMAL' : 'Não disponível';
    const driver = usage?.quota?.driver || usage?.percents?.driver || null;
    const driverLabel = neonQuotaLabel(driver);
    const exhausted = Boolean(usage?.ok && (usage?.quota?.exhausted || usage?.status?.code === 'exhausted'));
    const transfer = usage?.quota?.transfer || usage?.metrics?.transfer || {};
    const transferLine =
      transfer.usedGb != null && transfer.limitGb != null
        ? `${transfer.usedGb} / ${transfer.limitGb} GB`
        : transfer.display || '';
    const planLabel = String(usage?.quota?.plan || usage?.billing?.plan || usage?.config?.plan || 'free')
      .toUpperCase();
    const franchiseMsg =
      usage?.quota?.message ||
      (exhausted && driver === 'transfer'
        ? 'Você já utilizou toda a sua franquia mensal de transferência de dados para este projeto.'
        : null);
    const hint = !usage?.ok
      ? usage?.error || 'Não disponível'
      : exhausted
        ? franchiseMsg || 'Limite mensal do Neon atingido para este projeto.'
        : driverLabel && pctVal != null && Number(pctVal) >= 90
          ? `${driverLabel} próximo do limite do plano ${planLabel}.`
          : transferLine
            ? `Transferência neste mês: ${transferLine} (plano ${planLabel}).`
            : 'Porcentagem usada do Neon neste mês.';
    const lastSync = usage?.ok && usage?.fetchedAt ? formatWhen(usage.fetchedAt) : '';
    const cachedNote = usage?.cached ? ' (cache)' : '';
    const billing = usage?.billing || {};
    const links = billing.links || {};
    const showUpgrade = Boolean(usage?.ok && (billing.canUpgrade || exhausted || planLabel === 'FREE'));
    const upgradeHref = links.upgrade || links.billing || 'https://neon.com/pricing';
    const usageHref = links.usage || links.console || 'https://console.neon.tech';
    return `
      <section class="pas-neon-dash" id="pas-neon-dash">
        <article class="pas-card pas-neon-card pas-neon-card--limit${exhausted ? ' pas-neon-card--exhausted' : ''}" id="pas-neon-limit-card">
          <div class="pas-card__head">
            <div>
              <h3>Limite Neon</h3>
              <p class="pas-muted" style="margin:0.25rem 0 0">${escape(hint)}</p>
            </div>
            <div class="pas-neon-head-meta">
              <span class="${neonToneClass(tone)}">${neonStatusDot(tone)} ${escape(statusLabel)}</span>
              <strong class="pas-neon-limit-pct">${escape(pctLabel)}</strong>
            </div>
          </div>
          ${
            exhausted
              ? `<div class="pas-neon-banner pas-neon-banner--exhausted" role="status">
                  <span class="pas-neon-banner__badge">Limite atingido</span>
                  <p>${escape(
                    franchiseMsg ||
                      'Você já utilizou toda a sua franquia mensal de transferência de dados para este projeto.'
                  )}</p>
                </div>`
              : ''
          }
          <div class="pas-neon-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${meter}" aria-label="Porcentagem usada do Neon">
            <span class="pas-neon-meter__fill pas-neon-meter__fill--${escape(tone)}" style="width:${meter}%"></span>
          </div>
          ${
            transferLine
              ? `<p class="pas-neon-quota-line"><strong>Transferência:</strong> ${escape(transferLine)}</p>`
              : ''
          }
          <p class="pas-neon-foot form-hint" id="neon-last-sync">${lastSync ? `Última atualização: ${escape(lastSync)}${cachedNote}` : 'Clique em Atualizar para consultar a API Neon.'}</p>
          <div class="pas-neon-actions">
            <button type="button" class="pas-ghost-btn" id="neon-refresh-btn">Atualizar</button>
            <button type="button" class="pas-ghost-btn" id="neon-details-btn" ${usage?.ok ? '' : 'disabled'}>Detalhes</button>
            ${
              showUpgrade
                ? `<a class="pas-ghost-btn pas-neon-link-btn" href="${escape(usageHref)}" target="_blank" rel="noopener noreferrer">${escape(billing.analysisLabel || 'Análise de utilização')}</a>
                   <a class="btn btn-primary btn-sm pas-neon-upgrade-btn" href="${escape(upgradeHref)}" target="_blank" rel="noopener noreferrer">${escape(billing.ctaLabel || 'Atualizar plano no Neon')}</a>`
                : ''
            }
          </div>
        </article>
      </section>`;
  }

  function replaceNeonSummaryCard(content, usage) {
    neonUsageCache = usage || null;
    const dash = content.querySelector('#pas-neon-dash');
    if (dash) {
      dash.outerHTML = neonSummaryCardHTML(usage);
    }
    bindNeonSummaryCard(content);
  }

  function bindNeonSummaryCard(content) {
    content.querySelector('#neon-details-btn')?.addEventListener('click', () => {
      if (!neonUsageCache?.ok) {
        UI.toast('Atualize o consumo Neon antes de abrir os detalhes.', 'info');
        return;
      }
      openNeonDetailsModal(neonUsageCache);
    });

    content.querySelector('#neon-refresh-btn')?.addEventListener('click', async () => {
      if (neonRefreshBusy || typeof API.refreshNeonUsage !== 'function') return;
      const btn = content.querySelector('#neon-refresh-btn');
      neonRefreshBusy = true;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Atualizando…';
      }
      UI.showLoading('Consultando a API Neon…');
      try {
        const res = await API.refreshNeonUsage({ period: 'this_month' });
        if (!res?.ok) {
          UI.toast(res?.error || 'Não foi possível atualizar o Neon.', 'error');
          return;
        }
        replaceNeonSummaryCard(content, res);
        const cached = (res.limitations || []).some((line) => /cache/i.test(String(line)));
        UI.toast(
          cached ? 'Neon atualizado com dados em cache (intervalo mínimo da API).' : 'Consumo Neon atualizado.',
          cached ? 'info' : 'success'
        );
      } catch (err) {
        UI.toast(err?.message || 'Não foi possível atualizar o Neon.', 'error');
      } finally {
        neonRefreshBusy = false;
        UI.hideLoading();
        const freshBtn = content.querySelector('#neon-refresh-btn');
        if (freshBtn) {
          freshBtn.disabled = false;
          freshBtn.textContent = 'Atualizar';
        }
      }
    });
  }

  function openNeonDetailsModal(usage) {
    const m = usage?.metrics || {};
    const cost = usage?.cost || {};
    const period = usage?.period || {};
    const billing = usage?.billing || {};
    const links = billing.links || {};
    const quota = usage?.quota || {};
    UI.modal({
      title: 'Detalhes do consumo Neon',
      body: `
        <div class="pas-neon-details">
          ${
            quota.exhausted
              ? `<div class="pas-neon-banner pas-neon-banner--exhausted" role="status">
                  <span class="pas-neon-banner__badge">Limite atingido</span>
                  <p>${escape(
                    quota.message ||
                      'Você já utilizou toda a sua franquia mensal de transferência de dados para este projeto.'
                  )}</p>
                </div>`
              : ''
          }
          <p><strong>Plano detectado:</strong> ${escape(naLabel(quota.plan || billing.plan))}</p>
          <p><strong>Fonte:</strong> ${escape(naLabel(usage?.source))}</p>
          <p><strong>API:</strong> ${escape(naLabel(usage?.integration?.api))}</p>
          <p><strong>Período:</strong> ${escape(naLabel(period.label))}</p>
          <p><strong>Granularidade:</strong> ${escape(naLabel(period.granularity))}</p>
          <p><strong>Compute:</strong> ${escape(naLabel(m.compute?.display))}</p>
          <p><strong>CU-hours:</strong> ${escape(m.compute?.value != null ? String(m.compute.value) : 'Não disponível')}</p>
          <p><strong>Storage:</strong> ${escape(naLabel(m.storage?.display))}</p>
          <p><strong>Transferência:</strong> ${escape(naLabel(m.transfer?.display))}</p>
          <p><strong>Instant Restore:</strong> ${escape(naLabel(m.instantRestore?.display))}</p>
          <p><strong>Custo estimado USD:</strong> ${escape(moneyUSD(cost.usd))}</p>
          <p><strong>Custo estimado BRL:</strong> ${escape(cost.brl != null ? moneyBR(cost.brl) : 'Não disponível')}</p>
          <p><strong>Cotação utilizada:</strong> ${escape(cost.quoteUsdBrl != null ? `R$ ${Number(cost.quoteUsdBrl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não disponível')}</p>
          <p><strong>Última atualização:</strong> ${escape(formatWhen(usage?.fetchedAt))}</p>
          <p class="form-hint">${escape(cost.estimateDisclaimer || '')}</p>
          ${(usage?.limitations || []).map((l) => `<p class="form-hint">${escape(l)}</p>`).join('')}
          <div class="pas-neon-actions" style="margin-top:1rem">
            <a class="pas-ghost-btn pas-neon-link-btn" href="${escape(links.usage || links.console || 'https://console.neon.tech')}" target="_blank" rel="noopener noreferrer">${escape(billing.analysisLabel || 'Análise de utilização')}</a>
            <a class="btn btn-primary btn-sm pas-neon-upgrade-btn" href="${escape(links.upgrade || links.billing || 'https://neon.com/pricing')}" target="_blank" rel="noopener noreferrer">${escape(billing.ctaLabel || 'Atualizar plano no Neon')}</a>
          </div>
        </div>
      `,
      actions: [{ label: 'Fechar', className: 'btn-primary', onClick: (c) => c() }]
    });
  }

  function cfFlag(feat) {
    if (!feat) return '—';
    if (feat.available === false) return `Requer ${feat.requiresPlan || 'plano pago'}`;
    const map = {
      ativo_quando_proxied: 'ATIVO (com proxy)',
      limitado_no_free: 'Limitado no Free',
      bot_fight_opcional: 'DISPONÍVEL (opcional)',
      nao_obrigatorio: 'Disponível — não usar em todas as rotas',
      disponivel: 'ATIVO/DISPONÍVEL'
    };
    return map[feat.status] || String(feat.status || '—');
  }

  function cloudflareCardHTML(st) {
    const linked = Boolean(st?.tokenConfigured && st?.zoneConfigured);
    const apiOk = Boolean(st?.api?.ok);
    const zoneOn = String(st?.zone?.status || '') === 'active' && !st?.zone?.paused;
    const statusLabel = !linked
      ? 'Conta ainda não ligada'
      : apiOk && zoneOn
        ? 'Protegido'
        : apiOk
          ? 'API ok — DNS/proxy pendente'
          : 'Token inválido ou sem permissão';
    const dot = linked && apiOk && zoneOn ? '🟢' : linked ? '🟡' : '⚪';
    const steps = (st?.setupSteps || [])
      .map((s, i) => `<li>${escape(`${i + 1}. ${s}`)}</li>`)
      .join('');
    const perms = (st?.tokenPermissions || [])
      .map((p) => `<li>${escape(`${p.group} · ${p.permission} · ${p.access}`)}</li>`)
      .join('');
    const last = st?.lastEvent ? formatWhen(st.lastEvent) : 'Nenhum evento agregado';
    const blocked = st?.blockedApprox != null ? String(st.blockedApprox) : '0';
    return `
      <article class="pas-card pas-cf-card" id="pas-cloudflare">
        <div class="pas-card__head">
          <div>
            <h3>Cloudflare</h3>
            <p class="pas-muted" style="margin:0.25rem 0 0">Camada de borda. Não substitui login, rate limit nem incidentes do backend.</p>
          </div>
          <span class="pas-neon-status ${linked && apiOk && zoneOn ? 'pas-neon-status--normal' : 'pas-neon-status--muted'}">${dot} ${escape(statusLabel)}</span>
        </div>
        <dl class="pas-neon-dl">
          <div><dt>Status da integração</dt><dd>${escape(statusLabel)}</dd></div>
          <div><dt>WAF</dt><dd>${escape(cfFlag(st?.features?.wafManaged))} · custom: ${escape(cfFlag(st?.features?.customWaf))}</dd></div>
          <div><dt>DDoS</dt><dd>${escape(cfFlag(st?.features?.ddos))}</dd></div>
          <div><dt>Rate limiting (borda)</dt><dd>${escape(cfFlag(st?.features?.rateLimit))}</dd></div>
          <div><dt>Bot protection</dt><dd>${escape(cfFlag(st?.features?.bot))}</dd></div>
          <div><dt>Turnstile</dt><dd>${escape(cfFlag(st?.features?.turnstile))}</dd></div>
          <div><dt>Última sincronização</dt><dd>${escape(st?.lastSync ? formatWhen(st.lastSync) : 'Ainda não sincronizou')}</dd></div>
          <div><dt>Último evento</dt><dd>${escape(last)}</dd></div>
          <div><dt>Ataques bloqueados (agregado)</dt><dd>${escape(blocked)}</dd></div>
          <div><dt>Status da API</dt><dd>${escape(st?.api?.ok ? 'OK' : st?.api?.error || 'Não configurada')}</dd></div>
          <div><dt>Zona</dt><dd>${escape(st?.zone?.name || '—')}</dd></div>
          <div><dt>Plano Cloudflare</dt><dd>${escape(st?.zone?.plan || st?.features?.plan || 'free')}</dd></div>
        </dl>
        ${(st?.paidWarnings || []).map((w) => `<p class="form-hint">${escape(w)}</p>`).join('')}
        <p class="form-hint">Nunca cole o token no HTML. Nunca use Global API Key. CLOUDFLARE_REQUIRE_ORIGIN deve permanecer false até o site funcionar pelo proxy.</p>
        <details class="pas-cf-details">
          <summary>Como criar a conta do zero (plano Free)</summary>
          <ol class="pas-cf-steps">${steps}</ol>
          <p><strong>Permissões do API Token (somente estas):</strong></p>
          <ul>${perms}</ul>
        </details>
        <div class="pas-neon-actions">
          <button type="button" class="pas-ghost-btn" id="cf-view-events">Ver eventos Cloudflare</button>
        </div>
      </article>`;
  }

  function openCloudflareEventsModal(events) {
    const rows = (events || []).length
      ? events
          .map((e) => {
            const origens =
              e.origens && typeof e.origens === 'object'
                ? Object.keys(e.origens).slice(0, 5).join(', ')
                : '—';
            return `<tr>
              <td>${escape(formatWhen(e.ultimo_em))}</td>
              <td>${escape(e.categoria || '—')}</td>
              <td>${escape(e.acao || '—')}</td>
              <td>${escape(e.endpoint || '—')}</td>
              <td>${escape(String(e.quantidade || 1))}</td>
              <td>${escape(e.regra_id || '—')}</td>
              <td>${escape(origens)}</td>
            </tr>`;
          })
          .join('')
      : '<tr><td colspan="7" class="pas-muted">Nenhum evento agregado. A conta Cloudflare ainda não está ligada ou o webhook não foi configurado.</td></tr>';
    UI.modal({
      title: 'Eventos Cloudflare (agregados)',
      body: `<div class="pas-table-wrap"><table class="pas-table pas-table--security"><thead>
        <tr><th>Último</th><th>Tipo</th><th>Ação</th><th>Endpoint</th><th>Qtd</th><th>Regra</th><th>Origens</th></tr>
      </thead><tbody>${rows}</tbody></table></div>
      <p class="form-hint">Milhares de bloqueios viram uma linha. Secrets não são armazenados.</p>`,
      actions: [{ label: 'Fechar', className: 'btn-primary', onClick: (c) => c() }]
    });
  }

  function bindCloudflareCard(content) {
    content.querySelector('#cf-view-events')?.addEventListener('click', async () => {
      UI.showLoading('Carregando eventos…');
      const res = await API.listCloudflareEvents(40);
      UI.hideLoading();
      if (!res?.ok) {
        UI.toast(res?.error || 'Não foi possível listar eventos.', 'error');
        return;
      }
      openCloudflareEventsModal(res.events || []);
    });
  }

  async function renderConfiguracoes(content, { quiet = false } = {}) {
    if (!quiet) {
      content.innerHTML = '<p class="muted">Carregando…</p>';
      UI.showLoading('Carregando…');
    }
    try {
      const cfRes =
        typeof API.getCloudflareStatus === 'function'
          ? await API.getCloudflareStatus().catch((err) => ({
              ok: true,
              configured: false,
              api: { ok: false, error: err?.message || 'Não foi possível consultar o Cloudflare.' },
              features: {}
            }))
          : { ok: true, configured: false, api: { ok: false, error: 'Recarregue a página.' } };
      if (!quiet) UI.hideLoading();

      content.innerHTML = `
        <section class="pas-welcome pas-welcome--compact" id="sec-cloudflare">
          <div>
            <h2>Cloudflare</h2>
            <p>Camada de borda. O consumo do Neon e o alerta do sistema ficam na tela inicial.</p>
          </div>
        </section>
        ${cloudflareCardHTML(cfRes || {})}`;

      bindCloudflareCard(content);
    } catch (err) {
      if (!quiet) UI.hideLoading();
      content.innerHTML = `<p class="form-error">${escape(err.message || 'Erro')}</p>`;
    }
  }

  async function renderDashboard(content, { quiet = false } = {}) {
    if (!quiet) {
      content.innerHTML = '<p class="muted">Carregando dashboard…</p>';
      UI.showLoading('Carregando…');
    }
    try {
      const [users, statsRes, neonUsage] = await Promise.all([
        loadUsers(),
        typeof API.getDevStats === 'function' ? API.getDevStats().catch(() => ({ ok: false })) : Promise.resolve({ ok: false }),
        typeof API.getNeonUsage === 'function'
          ? API.getNeonUsage({ period: 'this_month' }).catch((err) => ({
              ok: false,
              error: err?.message || 'Não foi possível carregar o Neon.'
            }))
          : Promise.resolve({ ok: false, error: 'Cliente da API do Neon indisponível. Recarregue a página.' })
      ]);
      if (!quiet) UI.hideLoading();
      neonUsageCache = neonUsage?.ok ? neonUsage : null;
      const s = computeStats(users);
      const usage = statsRes?.stats?.usage || {};

      const recentPay = filterPayments(users, payFilter);
      const recentUsers = users.slice(0, 5);
      const onlineUsers = users
        .filter((u) => isUserOnline(u))
        .sort((a, b) => {
          const ta = new Date(a.lastSeen || a.sessionAt || 0).getTime();
          const tb = new Date(b.lastSeen || b.sessionAt || 0).getTime();
          return tb - ta;
        })
        .slice(0, 8);

      content.innerHTML = `
        <section class="pas-welcome">
          <div>
            <h2>Olá! ${escape(firstName())}</h2>
            <p>Acompanhe usuários, pagamentos e o status do sistema PowerApps.</p>
          </div>
          <div class="pas-welcome__actions">
            <button type="button" class="pas-date-chip pas-broadcast-btn" id="dev-broadcast-btn" title="Enviar aviso a todos os usuários">
              <span class="pas-action-ico" aria-hidden="true">${ICONS.bell}</span>
              <span class="pas-action-label">Enviar aviso</span>
            </button>
            <button type="button" class="pas-date-chip pas-maintenance-btn" id="dev-maintenance-btn">
              <span class="pas-action-ico" aria-hidden="true">${ICONS.wrench}</span>
              <span class="pas-action-label">Desativar Sistema</span>
            </button>
          </div>
        </section>

        ${neonSummaryCardHTML(neonUsage)}

        <section class="pas-kpis">
          <article class="pas-kpi pas-kpi--presence">
            <div>
              <span>Usuários Online</span>
              <strong>${escape(String(s.online))}</strong>
              <em class="is-up">${escape(String(s.offline))} offline agora</em>
            </div>
            <div class="pas-kpi__icon pas-kpi__icon--online">${ICONS.users}</div>
          </article>
          <article class="pas-kpi">
            <div>
              <span>Usuários Ativos</span>
              <strong>${escape(String(s.ativo))}</strong>
              <em class="is-up">+ ${escape(String(s.total))} cadastrados</em>
            </div>
            <div class="pas-kpi__icon pas-kpi__icon--red">${ICONS.users}</div>
          </article>
          <article class="pas-kpi">
            <div>
              <span>Receita Total (estimada)</span>
              <strong>${escape(moneyBR(s.receita))}</strong>
              <em class="is-up">Planos ativos</em>
            </div>
            <div class="pas-kpi__icon">${ICONS.money}</div>
          </article>
          <article class="pas-kpi">
            <div>
              <span>Pagamentos Pendentes</span>
              <strong>${escape(String(s.pendentesTotal))}</strong>
              <em class="is-down">Aguardando revisão</em>
            </div>
            <div class="pas-kpi__icon">${ICONS.clock}</div>
          </article>
        </section>

        <section class="pas-kpis">
          <article class="pas-kpi"><div><span>Ciclo usuários (ativo / inativo / arquivado)</span><strong>${escape(`${usage.usuariosAtivos || 0} / ${usage.usuariosInativos || 0} / ${usage.usuariosArquivados || 0}`)}</strong></div></article>
          <article class="pas-kpi"><div><span>Rifas (ativa / encerrada / arquivada)</span><strong>${escape(`${usage.rifasAtivas || 0} / ${usage.rifasEncerradas || 0} / ${usage.rifasArquivadas || 0}`)}</strong></div></article>
          <article class="pas-kpi"><div><span>Vendas</span><strong>${escape(String(usage.totalVendas || 0))}</strong><em>COUNT no banco</em></div></article>
        </section>

        <section class="pas-dash-grid">
          <div class="pas-dash-main">
            <article class="pas-card">
              <div class="pas-card__head">
                <h3>Pagamentos Recentes</h3>
                <div class="pas-tabs" id="dev-pay-tabs">
                  <button type="button" data-filter="todos" class="${payFilter === 'todos' ? 'is-active' : ''}">Todos</button>
                  <button type="button" data-filter="realizados" class="${payFilter === 'realizados' ? 'is-active' : ''}">Realizados</button>
                  <button type="button" data-filter="pendentes" class="${payFilter === 'pendentes' ? 'is-active' : ''}">Pendentes</button>
                  <button type="button" data-filter="falhados" class="${payFilter === 'falhados' ? 'is-active' : ''}">Falhados</button>
                </div>
              </div>
              <div class="pas-table-wrap">
                <table class="pas-table">
                  <thead>
                    <tr>
                      <th>Usuário</th>
                      <th>Plano</th>
                      <th>Valor</th>
                      <th>Status</th>
                      <th>Data</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody id="dev-pay-tbody">
                    ${paymentRowsHTML(recentPay, { limit: 8 })}
                  </tbody>
                </table>
              </div>
              <div class="pas-card__foot">
                <button type="button" class="pas-ghost-btn" data-tab="pagamentos">Carregar mais</button>
              </div>
            </article>

            <article class="pas-card">
              <div class="pas-card__head">
                <h3>Usuários Recentes</h3>
              </div>
              <div class="pas-recent-users">
                ${
                  recentUsers.length
                    ? recentUsers
                        .map(
                          (u) => `
                      <button type="button" class="pas-recent-user" data-tab="usuarios">
                        ${userAvatarHTML(u)}
                        <strong>${escape(u.name || '—')}</strong>
                        <span>${escape(u.email || '')}</span>
                      </button>`
                        )
                        .join('')
                    : '<p class="pas-muted">Nenhum usuário ainda.</p>'
                }
              </div>
            </article>
          </div>

          <aside class="pas-dash-side">
            <article class="pas-card">
              <div class="pas-card__head"><h3>Status das Assinaturas</h3></div>
              <div class="pas-donut-wrap">
                ${donutSVG(s.ativo, s.pendentesTotal, s.cancelado)}
                <ul class="pas-legend">
                  <li><i class="is-red"></i> Ativo (${s.ativo})</li>
                  <li><i class="is-dark"></i> Pendente (${s.pendentesTotal})</li>
                  <li><i class="is-gray"></i> Cancelado (${s.cancelado})</li>
                </ul>
              </div>
            </article>

            <article class="pas-card pas-card--revenue">
              <div class="pas-card__head"><h3>Receita (últimos 7 dias)</h3></div>
              ${revenueSparkline(users)}
            </article>

            <article class="pas-card pas-card--presence">
              <div class="pas-card__head">
                <h3>Presença agora</h3>
                <span class="pas-presence-count">${escape(String(s.online))} online</span>
              </div>
              <div class="pas-presence-list" id="dev-presence-list">
                ${
                  onlineUsers.length
                    ? onlineUsers
                        .map(
                          (u) => `
                      <div class="pas-presence-row">
                        ${userAvatarHTML(u)}
                        <div>
                          <strong>${escape(u.name || '—')}</strong>
                          <span>${escape(u.email || '')}</span>
                        </div>
                        ${presenceBadgeHTML(u)}
                      </div>`
                        )
                        .join('')
                    : '<p class="pas-muted">Nenhum usuário online no momento.</p>'
                }
              </div>
              <div class="pas-card__foot">
                <button type="button" class="pas-ghost-btn" data-tab="usuarios">Ver todos</button>
              </div>
            </article>

            <article class="pas-card">
              <div class="pas-card__head"><h3>Ações Rápidas</h3></div>
              <div class="pas-quick">
                <button type="button" data-tab="usuarios"><span>${ICONS.users}</span>Novo Usuário</button>
                <button type="button" data-tab="planos"><span>${ICONS.layers}</span>Novo Plano</button>
                <button type="button" data-tab="relatorios"><span>${ICONS.file}</span>Relatório</button>
                <button type="button" data-tab="pagamentos"><span>${ICONS.wallet}</span>Pagamentos</button>
              </div>
            </article>

            <article class="pas-card">
              <div class="pas-card__head"><h3>Atividades do Sistema</h3></div>
              ${activityItems(users)}
            </article>
          </aside>
        </section>`;

      content.querySelectorAll('[data-tab]').forEach((el) => {
        el.addEventListener('click', () => {
          activeTab = el.getAttribute('data-tab') || 'dashboard';
          renderTab();
        });
      });

      content.querySelector('#dev-broadcast-btn')?.addEventListener('click', () => {
        openBroadcastModal();
      });
      content.querySelector('#dev-maintenance-btn')?.addEventListener('click', () => {
        openMaintenanceModal();
      });
      refreshMaintenanceButton();

      content.querySelectorAll('#dev-pay-tabs button').forEach((btn) => {
        btn.addEventListener('click', () => {
          payFilter = btn.getAttribute('data-filter') || 'todos';
          const tbody = document.getElementById('dev-pay-tbody');
          if (!tbody) return;
          content.querySelectorAll('#dev-pay-tabs button').forEach((b) => {
            b.classList.toggle('is-active', b === btn);
          });
          tbody.innerHTML = paymentRowsHTML(filterPayments(usersCache, payFilter), { limit: 8 });
          bindPaymentTable(tbody, () => renderDashboard(content));
        });
      });

      bindPaymentTable(content, () => renderDashboard(content));
      bindNeonSummaryCard(content);

      if (!quiet) {
        setTimeout(() => {
          openPriorityRatingsModal().catch(() => {});
        }, 450);
      }
    } catch (err) {
      if (!quiet) UI.hideLoading();
      content.innerHTML = `<p class="form-error">${escape(err.message || 'Erro')}</p>`;
    }
  }

  async function renderPagamentos(content, { quiet = false } = {}) {
    if (!quiet) {
      content.innerHTML = '<p class="muted">Carregando pagamentos…</p>';
      UI.showLoading('Carregando…');
    }
    try {
      const users = await loadUsers();
      if (!quiet) UI.hideLoading();
      const pending = users.filter((u) => canApprovePayment(u.statusPagamento));
      const all = users;

      content.innerHTML = `
        <section class="pas-welcome pas-welcome--compact">
          <div>
            <h2>Pagamentos</h2>
            <p>Verifique comprovantes e aprove para liberar o recurso do usuário.</p>
          </div>
        </section>
        <article class="pas-card">
          <div class="pas-card__head">
            <h3>Fila de aprovação (${pending.length})</h3>
          </div>
          <div class="pas-table-wrap">
            <table class="pas-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Plano</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                ${paymentRowsHTML(pending.length ? pending : all, { limit: 50 })}
              </tbody>
            </table>
          </div>
        </article>`;
      bindPaymentTable(content, () => renderPagamentos(content));
    } catch (err) {
      if (!quiet) UI.hideLoading();
      content.innerHTML = `<p class="form-error">${escape(err.message || 'Erro')}</p>`;
    }
  }

  async function renderUsuarios(content, { quiet = false } = {}) {
    if (!quiet) {
      content.innerHTML = '<p class="muted">Carregando usuários…</p>';
      UI.showLoading('Carregando…');
    }
    try {
      const users = await loadUsers();
      if (!quiet) UI.hideLoading();
      content.innerHTML = `
        <section class="pas-welcome pas-welcome--compact">
          <div>
            <h2>Usuários</h2>
            <p>Veja quem está online/offline, converse com usuários Pro e confirme pagamentos. Chat bloqueado no plano Free.</p>
          </div>
          <div class="pas-presence-summary">
            <span class="pas-presence is-online"><i></i>${escape(String((users || []).filter(isUserOnline).length))} online</span>
            <span class="pas-presence is-offline"><i></i>${escape(String((users || []).filter((u) => !isUserOnline(u)).length))} offline</span>
          </div>
        </section>
        <article class="pas-card">
          <div class="pas-table-wrap">
            <table class="pas-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Presença</th>
                  <th>Ciclo</th>
                  <th>Plano</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                ${paymentRowsHTML(users, { limit: 200, showPresence: true })}
              </tbody>
            </table>
          </div>
        </article>`;
      bindPaymentTable(content, () => renderUsuarios(content));
    } catch (err) {
      if (!quiet) UI.hideLoading();
      content.innerHTML = `<p class="form-error">${escape(err.message || 'Erro')}</p>`;
    }
  }

  function starsHTML(count) {
    const n = Math.max(0, Math.min(5, Number(count) || 0));
    let html = '<span class="pas-rating-stars" aria-label="' + n + ' de 5">';
    for (let i = 1; i <= 5; i += 1) {
      html += `<span class="${i <= n ? 'is-on' : ''}">★</span>`;
    }
    html += '</span>';
    return html;
  }

  function ratingStatusOf(r) {
    if (typeof API !== 'undefined' && typeof API.normalizeRatingStatus === 'function') {
      return API.normalizeRatingStatus(r?.status, r?.stars);
    }
    const raw = String(r?.status || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    if (['em_aberto', 'em_andamento', 'resolvido', 'positiva'].includes(raw)) return raw;
    return Number(r?.stars) <= 3 ? 'em_aberto' : 'positiva';
  }

  function ratingStatusLabel(st) {
    const map = {
      em_aberto: 'Em aberto',
      em_andamento: 'Em andamento',
      resolvido: 'Resolvido',
      positiva: 'Positiva'
    };
    return map[st] || 'Em aberto';
  }

  function ratingStatusClass(st) {
    const map = {
      em_aberto: 'aberto',
      em_andamento: 'andamento',
      resolvido: 'resolvido',
      positiva: 'positiva'
    };
    return map[st] || 'aberto';
  }

  function ratingStatusBadgeHTML(r) {
    const st = ratingStatusOf(r);
    return `<span class="pas-status pas-status--${ratingStatusClass(st)}">${escape(ratingStatusLabel(st))}</span>`;
  }

  function filterRatings(list, filter, search) {
    const q = String(search || '')
      .trim()
      .toLowerCase();
    return (list || []).filter((r) => {
      const st = ratingStatusOf(r);
      const stars = Number(r.stars) || 0;
      if (filter === 'em_aberto') {
        if (st !== 'em_aberto') return false;
      } else if (filter === 'em_andamento') {
        if (st !== 'em_andamento') return false;
      } else if (filter === 'resolvido') {
        if (st !== 'resolvido') return false;
      } else if (filter === 'positivas') {
        if (!(st === 'positiva' || stars >= 4)) return false;
      } else if (filter === 'reclamações' || filter === 'reclamacoes') {
        if (!(stars > 0 && stars <= 3)) return false;
      }
      if (!q) return true;
      const hay = [r.userName, r.userEmail, r.reason, r.reply, r.internalNotes, r.userId]
        .map((v) => String(v || '').toLowerCase())
        .join(' ');
      return hay.includes(q);
    });
  }

  function openRatingDetailModal(rating, onSaved) {
    if (!rating || typeof UI === 'undefined' || typeof UI.modal !== 'function') return;
    const st = ratingStatusOf(rating);
    const name = String(rating.userName || 'Usuário').trim() || 'Usuário';
    const email = String(rating.userEmail || '—').trim() || '—';
    const reason = String(rating.reason || '').trim();
    const reply = String(rating.reply || '').trim();
    const notes = String(rating.internalNotes || '').trim();
    const stars = Number(rating.stars) || 0;
    const isComplaint = stars > 0 && stars <= 3;

    const body = document.createElement('div');
    body.className = 'dev-rating-detail';
    body.innerHTML = `
      <div class="dev-rating-detail__user">
        <span class="pas-user-avatar">
          <img src="${escape(avatarSrc(rating.photo))}" alt="">
        </span>
        <div>
          <strong>${escape(name)}</strong>
          <span>${escape(email)}</span>
        </div>
        ${ratingStatusBadgeHTML(rating)}
      </div>
      <div class="dev-rating-detail__score">
        ${starsHTML(stars)}
        <span>${escape(String(stars))}/5 · ${escape(formatWhen(rating.createdAt || rating.updatedAt))}</span>
      </div>
      <div class="dev-rating-detail__block">
        <label>Mensagem do usuário</label>
        <div class="dev-rating-detail__msg">
          ${
            reason
              ? `<p>${escape(reason)}</p>`
              : '<p class="pas-muted">Sem mensagem informada.</p>'
          }
        </div>
      </div>
      <div class="form-group">
        <label for="dev-rating-status">Status do atendimento</label>
        <select id="dev-rating-status">
          <option value="em_aberto"${st === 'em_aberto' ? ' selected' : ''}>Em aberto</option>
          <option value="em_andamento"${st === 'em_andamento' ? ' selected' : ''}>Em andamento</option>
          <option value="resolvido"${st === 'resolvido' ? ' selected' : ''}>Resolvido</option>
          <option value="positiva"${st === 'positiva' ? ' selected' : ''}>Positiva</option>
        </select>
      </div>
      <div class="form-group">
        <label for="dev-rating-reply">Resposta ao usuário${isComplaint ? ' (recomendado)' : ''}</label>
        <textarea id="dev-rating-reply" rows="4" maxlength="1200"
          placeholder="Explique a solução ou agradeça o feedback...">${escape(reply)}</textarea>
      </div>
      <div class="form-group">
        <label for="dev-rating-notes">Notas internas</label>
        <textarea id="dev-rating-notes" rows="2" maxlength="800"
          placeholder="Apenas para a equipe — o usuário não vê isto.">${escape(notes)}</textarea>
      </div>
      <label class="dev-rating-detail__check">
        <input type="checkbox" id="dev-rating-notify" checked>
        <span>Notificar o usuário quando houver resposta</span>
      </label>
      <p class="dev-rating-detail__hint pas-muted">
        Use <strong>Em aberto</strong> para reclamações novas,
        <strong>Em andamento</strong> enquanto analisa e
        <strong>Resolvido</strong> quando o caso for concluído.
      </p>`;

    UI.modal({
      title: isComplaint ? 'Tratar reclamação' : 'Detalhe da avaliação',
      body,
      dialogClass: 'modal-dialog--wide',
      actions: [
        {
          label: 'Cancelar',
          className: 'btn-ghost',
          onClick: (close) => close()
        },
        {
          label: 'Salvar',
          className: 'btn-primary',
          onClick: async (close) => {
            const statusEl = body.querySelector('#dev-rating-status');
            const replyEl = body.querySelector('#dev-rating-reply');
            const notesEl = body.querySelector('#dev-rating-notes');
            const notifyEl = body.querySelector('#dev-rating-notify');
            const nextStatus = statusEl?.value || st;
            const nextReply = String(replyEl?.value || '').trim();
            const nextNotes = String(notesEl?.value || '').trim();
            const notifyUser = !!notifyEl?.checked;

            UI.showLoading('Salvando…');
            try {
              const res = await API.updateSystemRatingAdmin({
                id: rating.id,
                status: nextStatus,
                reply: nextReply,
                internalNotes: nextNotes,
                notifyUser: notifyUser && !!nextReply
              });
              UI.hideLoading();
              if (!res?.ok) {
                UI.toast(res?.error || 'Não foi possível salvar.', 'error');
                return;
              }
              UI.toast(
                nextStatus === 'resolvido'
                  ? 'Reclamação marcada como resolvida.'
                  : 'Avaliação atualizada.',
                'success'
              );
              close();
              if (typeof onSaved === 'function') await onSaved(res.rating);
            } catch (err) {
              UI.hideLoading();
              UI.toast(err?.message || 'Erro ao salvar.', 'error');
            }
          }
        }
      ]
    });
  }

  async function quickUpdateRatingStatus(rating, status, onSaved) {
    if (!rating?.id) return;
    UI.showLoading('Atualizando…');
    try {
      const res = await API.updateSystemRatingAdmin({
        id: rating.id,
        status,
        reply: rating.reply || '',
        internalNotes: rating.internalNotes || '',
        notifyUser: false
      });
      UI.hideLoading();
      if (!res?.ok) {
        UI.toast(res?.error || 'Falha ao atualizar status.', 'error');
        return;
      }
      UI.toast(`Status: ${ratingStatusLabel(status)}.`, 'success');
      if (typeof onSaved === 'function') await onSaved(res.rating);
    } catch (err) {
      UI.hideLoading();
      UI.toast(err?.message || 'Erro ao atualizar.', 'error');
    }
  }

  function enrichRatingsWithUserPhotos(ratings = []) {
    const byId = new Map((usersCache || []).map((u) => [String(u.id), u]));
    return (ratings || []).map((r) => {
      if (r?.photo) return r;
      const u = byId.get(String(r?.userId || ''));
      if (!u?.photo) return r;
      return { ...r, photo: u.photo };
    });
  }

  async function openPriorityRatingsModal() {
    if (typeof UI === 'undefined' || typeof UI.modal !== 'function') return;
    if (document.getElementById('app-modal')) return;
    if (typeof API === 'undefined' || typeof API.listSystemRatings !== 'function') return;

    const res = await API.listSystemRatings();
    if (!res?.ok) return;

    const low = enrichRatingsWithUserPhotos(res.ratings || [])
      .filter((r) => {
        const st = ratingStatusOf(r);
        return st === 'em_aberto' || st === 'em_andamento';
      })
      .sort((a, b) => {
        const order = { em_aberto: 0, em_andamento: 1 };
        const oa = order[ratingStatusOf(a)] ?? 2;
        const ob = order[ratingStatusOf(b)] ?? 2;
        if (oa !== ob) return oa - ob;
        const starsDiff = (Number(a.stars) || 0) - (Number(b.stars) || 0);
        if (starsDiff !== 0) return starsDiff;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });

    if (!low.length) return;
    if (document.getElementById('app-modal')) return;

    const openCount = low.filter((r) => ratingStatusOf(r) === 'em_aberto').length;
    const avg =
      low.reduce((acc, r) => acc + (Number(r.stars) || 0), 0) / (low.length || 1);

    const body = document.createElement('div');
    body.className = 'dev-priority-ratings';
    body.innerHTML = `
      <div class="dev-priority-ratings__banner">
        <div class="dev-priority-ratings__banner-icon" aria-hidden="true">${ICONS.star}</div>
        <div class="dev-priority-ratings__banner-copy">
          <strong>Reclamações em aberto</strong>
          <p>Priorize respostas e acompanhe o status de cada feedback.</p>
        </div>
        <div class="dev-priority-ratings__stats">
          <div>
            <span>Em aberto</span>
            <strong>${escape(String(openCount))}</strong>
          </div>
          <div>
            <span>Fila</span>
            <strong>${escape(String(low.length))}</strong>
          </div>
          <div>
            <span>Média</span>
            <strong>${escape(avg.toFixed(1))}</strong>
          </div>
        </div>
      </div>
      <div class="dev-priority-ratings__list">
        ${low
          .map((r) => {
            const name = String(r.userName || 'Usuário').trim() || 'Usuário';
            const email = String(r.userEmail || '—').trim() || '—';
            const reason = String(r.reason || '').trim();
            const stars = Number(r.stars) || 0;
            return `
              <article class="dev-priority-ratings__item" data-rating-id="${escape(String(r.id))}">
                <div class="dev-priority-ratings__top">
                  <div class="dev-priority-ratings__user">
                    <span class="dev-priority-ratings__avatar" aria-hidden="true">
                      <img src="${escape(avatarSrc(r.photo))}" alt="">
                    </span>
                    <div>
                      <strong>${escape(name)}</strong>
                      <span>${escape(email)}</span>
                    </div>
                  </div>
                  <div class="dev-priority-ratings__meta">
                    ${ratingStatusBadgeHTML(r)}
                    <span class="dev-priority-ratings__badge">${escape(String(stars))}/5</span>
                  </div>
                </div>
                <div class="dev-priority-ratings__score">
                  ${starsHTML(stars)}
                  <em>${escape(formatWhen(r.createdAt || r.updatedAt))}</em>
                </div>
                <div class="dev-priority-ratings__msg">
                  ${
                    reason
                      ? `<p>${escape(reason)}</p>`
                      : '<p class="is-empty">Sem mensagem informada.</p>'
                  }
                </div>
                <div class="dev-priority-ratings__actions">
                  <button type="button" class="pas-link-btn" data-priority-action="tratar">Tratar</button>
                  <button type="button" class="pas-link-btn" data-priority-action="andamento">Em andamento</button>
                  <button type="button" class="pas-approve-btn" data-priority-action="resolver">Resolver</button>
                </div>
              </article>`;
          })
          .join('')}
      </div>`;

    const byId = new Map(low.map((r) => [String(r.id), r]));

    UI.modal({
      title: 'Avaliações prioritárias',
      body,
      dialogClass: 'modal-dialog--wide modal-dialog--priority-ratings',
      actions: [
        {
          label: 'Fechar',
          className: 'btn-ghost',
          onClick: (close) => close()
        },
        {
          label: 'Ver todas',
          className: 'btn-primary',
          onClick: (close) => {
            close();
            activeTab = 'avaliacoes';
            ratingsFilter = 'em_aberto';
            renderTab();
          }
        }
      ]
    });

    body.querySelectorAll('[data-priority-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const item = btn.closest('[data-rating-id]');
        const id = item?.getAttribute('data-rating-id');
        const rating = id ? byId.get(String(id)) : null;
        if (!rating) return;
        const action = btn.getAttribute('data-priority-action');
        const refresh = () => {
          document.getElementById('app-modal')?.remove();
          activeTab = 'avaliacoes';
          renderTab();
        };
        if (action === 'tratar') {
          openRatingDetailModal(rating, refresh);
          return;
        }
        if (action === 'andamento') {
          await quickUpdateRatingStatus(rating, 'em_andamento', refresh);
          return;
        }
        if (action === 'resolver') {
          await quickUpdateRatingStatus(rating, 'resolvido', refresh);
        }
      });
    });
  }

  function ratingRowsHTML(ratings) {
    if (!ratings.length) {
      return `<tr><td colspan="6" class="pas-muted">Nenhuma avaliação neste filtro.</td></tr>`;
    }
    return ratings
      .map((r) => {
        const name = r.userName || 'Usuário';
        const email = r.userEmail || '—';
        const reason = String(r.reason || '').trim();
        const st = ratingStatusOf(r);
        const stars = Number(r.stars) || 0;
        const canResolve = st === 'em_aberto' || st === 'em_andamento';
        const canReopen = st === 'resolvido';
        return `
          <tr data-rating-id="${escape(String(r.id))}">
            <td>
              <div class="pas-user-cell">
                <span class="pas-user-avatar">
                  <img src="${escape(avatarSrc(r.photo))}" alt="" loading="lazy">
                </span>
                <div>
                  <strong>${escape(name)}</strong>
                  <span>${escape(email)}</span>
                </div>
              </div>
            </td>
            <td>
              <div class="pas-rating-cell">
                ${starsHTML(r.stars)}
                <span>${escape(String(stars))}/5</span>
              </div>
            </td>
            <td class="pas-rating-msg">
              ${reason ? escape(reason) : '<span class="pas-muted">—</span>'}
              ${
                r.reply
                  ? `<em class="pas-rating-reply-preview">Resposta enviada</em>`
                  : ''
              }
            </td>
            <td>${ratingStatusBadgeHTML(r)}</td>
            <td>${escape(formatWhen(r.createdAt || r.updatedAt))}</td>
            <td class="pas-row-actions">
              <button type="button" class="pas-link-btn" data-rating-action="ver">
                ${stars <= 3 || st === 'em_aberto' || st === 'em_andamento' ? 'Tratar' : 'Ver'}
              </button>
              ${
                st === 'em_aberto'
                  ? `<button type="button" class="pas-link-btn" data-rating-action="andamento">Em andamento</button>`
                  : ''
              }
              ${
                canResolve
                  ? `<button type="button" class="pas-approve-btn" data-rating-action="resolver">Resolver</button>`
                  : ''
              }
              ${
                canReopen
                  ? `<button type="button" class="pas-link-btn" data-rating-action="reabrir">Reabrir</button>`
                  : ''
              }
            </td>
          </tr>`;
      })
      .join('');
  }

  function bindRatingsTable(scope, onReload) {
    const byId = new Map(ratingsCache.map((r) => [String(r.id), r]));
    scope.querySelectorAll('[data-rating-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('[data-rating-id]');
        const id = row?.getAttribute('data-rating-id');
        const rating = id ? byId.get(String(id)) : null;
        if (!rating) return;
        const action = btn.getAttribute('data-rating-action');
        if (action === 'ver') {
          openRatingDetailModal(rating, onReload);
          return;
        }
        if (action === 'andamento') {
          await quickUpdateRatingStatus(rating, 'em_andamento', onReload);
          return;
        }
        if (action === 'resolver') {
          await quickUpdateRatingStatus(rating, 'resolvido', onReload);
          return;
        }
        if (action === 'reabrir') {
          await quickUpdateRatingStatus(rating, 'em_aberto', onReload);
        }
      });
    });
  }

  function refreshRatingsTable(content) {
    const tbody = content.querySelector('#dev-ratings-tbody');
    const countEl = content.querySelector('#dev-ratings-count');
    if (!tbody) return;
    const filtered = filterRatings(ratingsCache, ratingsFilter, ratingsSearch);
    tbody.innerHTML = ratingRowsHTML(filtered);
    if (countEl) countEl.textContent = String(filtered.length);
    bindRatingsTable(tbody, () => renderAvaliacoes(content));
  }

  async function renderAvaliacoes(content, { quiet = false } = {}) {
    if (!quiet) {
      content.innerHTML = '<p class="muted">Carregando avaliações…</p>';
      UI.showLoading('Carregando…');
    }
    try {
      const res = await API.listSystemRatings();
      if (!quiet) UI.hideLoading();

      if (!res?.ok) {
        content.innerHTML = `
          <section class="pas-welcome pas-welcome--compact">
            <div>
              <h2>Avaliações</h2>
              <p>Feedbacks enviados pelos usuários do sistema.</p>
            </div>
          </section>
          <article class="pas-card">
            <p class="form-error">${escape(res?.error || 'Não foi possível carregar as avaliações.')}</p>
            ${
              res?.needsSchema
                ? '<p class="pas-muted">Execute <code>supabase/avaliacoes_sistema.sql</code> no Supabase.</p>'
                : ''
            }
          </article>`;
        return;
      }

      ratingsCache = enrichRatingsWithUserPhotos(res.ratings || []);
      const ratings = ratingsCache;
      const total = ratings.length;
      const sum = ratings.reduce((acc, r) => acc + (Number(r.stars) || 0), 0);
      const avg = total ? sum / total : 0;
      const openCount = ratings.filter((r) => ratingStatusOf(r) === 'em_aberto').length;
      const progressCount = ratings.filter((r) => ratingStatusOf(r) === 'em_andamento').length;
      const high = ratings.filter((r) => Number(r.stars) >= 4).length;
      const filtered = filterRatings(ratings, ratingsFilter, ratingsSearch);

      content.innerHTML = `
        <section class="pas-welcome pas-welcome--compact">
          <div>
            <h2>Avaliações</h2>
            <p>Acompanhe reclamações em aberto, responda usuários e melhore a experiência.</p>
          </div>
          <button type="button" class="pas-ghost-btn" id="dev-ratings-refresh">Atualizar</button>
        </section>

        <section class="pas-kpis pas-kpis--ratings">
          <article class="pas-kpi" data-ratings-kpi="todos">
            <div>
              <span>Total</span>
              <strong>${escape(String(total))}</strong>
              <em>avaliações</em>
            </div>
            <div class="pas-kpi__icon">${ICONS.star}</div>
          </article>
          <article class="pas-kpi" data-ratings-kpi="em_aberto">
            <div>
              <span>Em aberto</span>
              <strong>${escape(String(openCount))}</strong>
              <em>reclamações</em>
            </div>
            <div class="pas-kpi__icon pas-kpi__icon--red">${ICONS.clock}</div>
          </article>
          <article class="pas-kpi" data-ratings-kpi="em_andamento">
            <div>
              <span>Em andamento</span>
              <strong>${escape(String(progressCount))}</strong>
              <em>sendo tratadas</em>
            </div>
            <div class="pas-kpi__icon">${ICONS.wrench}</div>
          </article>
          <article class="pas-kpi" data-ratings-kpi="positivas">
            <div>
              <span>Positivas</span>
              <strong>${escape(String(high))}</strong>
              <em>média ${escape(avg.toFixed(1))}</em>
            </div>
            <div class="pas-kpi__icon">${ICONS.users}</div>
          </article>
        </section>

        <article class="pas-card">
          <div class="pas-card__head pas-card__head--ratings">
            <h3>Avaliações dos usuários (<span id="dev-ratings-count">${escape(String(filtered.length))}</span>)</h3>
            <div class="pas-ratings-toolbar">
              <div class="pas-tabs" id="dev-ratings-tabs">
                <button type="button" data-filter="todos" class="${ratingsFilter === 'todos' ? 'is-active' : ''}">Todas</button>
                <button type="button" data-filter="em_aberto" class="${ratingsFilter === 'em_aberto' ? 'is-active' : ''}">Em aberto</button>
                <button type="button" data-filter="em_andamento" class="${ratingsFilter === 'em_andamento' ? 'is-active' : ''}">Em andamento</button>
                <button type="button" data-filter="resolvido" class="${ratingsFilter === 'resolvido' ? 'is-active' : ''}">Resolvidas</button>
                <button type="button" data-filter="positivas" class="${ratingsFilter === 'positivas' ? 'is-active' : ''}">Positivas</button>
                <button type="button" data-filter="reclamacoes" class="${ratingsFilter === 'reclamacoes' ? 'is-active' : ''}">Reclamações</button>
              </div>
              <label class="pas-ratings-search">
                <span class="pas-ratings-search__icon" aria-hidden="true">${ICONS.search}</span>
                <input type="search" id="dev-ratings-search" placeholder="Buscar usuário, e-mail ou mensagem…" value="${escape(ratingsSearch)}">
              </label>
            </div>
          </div>
          <div class="pas-table-wrap">
            <table class="pas-table pas-table--ratings">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Estrelas</th>
                  <th>Mensagem</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody id="dev-ratings-tbody">
                ${ratingRowsHTML(filtered)}
              </tbody>
            </table>
          </div>
        </article>`;

      content.querySelector('#dev-ratings-refresh')?.addEventListener('click', () => {
        renderAvaliacoes(content);
      });

      content.querySelectorAll('#dev-ratings-tabs button').forEach((btn) => {
        btn.addEventListener('click', () => {
          ratingsFilter = btn.getAttribute('data-filter') || 'todos';
          content.querySelectorAll('#dev-ratings-tabs button').forEach((b) => {
            b.classList.toggle('is-active', b === btn);
          });
          refreshRatingsTable(content);
        });
      });

      content.querySelectorAll('[data-ratings-kpi]').forEach((kpi) => {
        kpi.addEventListener('click', () => {
          const next = kpi.getAttribute('data-ratings-kpi') || 'todos';
          ratingsFilter = next;
          content.querySelectorAll('#dev-ratings-tabs button').forEach((b) => {
            b.classList.toggle('is-active', b.getAttribute('data-filter') === next);
          });
          refreshRatingsTable(content);
        });
      });

      const searchInput = content.querySelector('#dev-ratings-search');
      searchInput?.addEventListener('input', () => {
        ratingsSearch = searchInput.value || '';
        refreshRatingsTable(content);
      });

      bindRatingsTable(content, () => renderAvaliacoes(content));
    } catch (err) {
      if (!quiet) UI.hideLoading();
      content.innerHTML = `<p class="form-error">${escape(err.message || 'Erro')}</p>`;
    }
  }

  function securityPeriodRange(period) {
    const now = Date.now();
    if (period === '24h') return { from: new Date(now - 24 * 60 * 60 * 1000).toISOString() };
    if (period === '7d') return { from: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString() };
    if (period === '30d') return { from: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString() };
    return {};
  }

  function securityStatusLabel(status) {
    const map = {
      atividade_suspeita: 'Atividade suspeita detectada',
      possivel_ataque: 'Possível ataque detectado',
      tentativa_bloqueada: 'Tentativa de ataque bloqueada',
      ataque_potencialmente_confirmado: 'Ataque potencialmente confirmado'
    };
    return map[status] || status || '—';
  }

  function securityThreatLabel(categoria) {
    const map = {
      brute_force: 'Brute force',
      sql_injection: 'SQL Injection',
      xss: 'XSS',
      acesso_sem_autenticacao: 'Sem autenticação',
      acesso_indevido: 'Acesso indevido',
      manipulacao_usuario_id: 'usuario_id',
      manipulacao_id_recurso: 'ID de recurso',
      acesso_admin_negado: 'Admin sem permissão',
      token_invalido: 'Token inválido',
      sessao_expirada: 'Sessão expirada',
      excesso_requisicoes: 'Excesso de requisições',
      abuso_api: 'Abuso de API',
      comportamento_anormal: 'Anormal',
      operacao_sensivel_repetida: 'Operação sensível',
      bloqueio: 'Bloqueio',
      auditoria_admin: 'Auditoria'
    };
    return map[categoria] || categoria || '—';
  }

  function securityIncidentRowsHTML(items) {
    if (!items.length) {
      return '<tr><td colspan="9" class="muted">Nenhum incidente neste filtro.</td></tr>';
    }
    return items.map((row) => {
      const sev = String(row.severidade || 'INFO').toUpperCase();
      const blocked = row.bloqueado === true || row.bloqueado === 't' || row.bloqueado === 1;
      const title = escape([row.descricao, row.evidencias, row.acao_executada].filter(Boolean).join(' · '));
      return `<tr class="pas-inc-row" data-incident-id="${escape(String(row.id))}" title="${title}">
        <td>${escape(formatWhen(row.data_hora || row.criado_em))}</td>
        <td><span class="pas-sev pas-sev--${escape(sev.toLowerCase())}">${escape(sev)}</span></td>
        <td>${escape(securityThreatLabel(row.categoria))}</td>
        <td>${escape(securityStatusLabel(row.status))}</td>
        <td>${escape(`${row.metodo_http || ''} ${row.endpoint || ''}`.trim() || '—')}</td>
        <td>${escape(row.ip || '—')}</td>
        <td>${escape(row.usuario_id ? `#${row.usuario_id}` : 'Não autenticado')}</td>
        <td>${blocked ? 'SIM' : 'NÃO'}</td>
        <td>${escape(String(row.acao_executada || '—').slice(0, 80))}</td>
      </tr>`;
    }).join('');
  }

  function bindSecurityDashboard(content) {
    const form = content.querySelector('#dev-sec-filters');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        securityFilters = {
          period: form.period.value || '7d',
          severidade: form.severidade.value || '',
          categoria: form.categoria.value || '',
          status: form.status.value || '',
          usuario_id: form.usuario_id.value || '',
          ip: form.ip.value || '',
          endpoint: form.endpoint.value || ''
        };
        renderSecurityLogs(content);
      });
    }
    content.querySelectorAll('[data-lift-ip]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ip = btn.getAttribute('data-lift-ip');
        UI.showLoading('Encerrando bloqueio…');
        const res = await API.liftSecurityBlock(ip);
        UI.hideLoading();
        if (!res.ok) {
          UI.toast(res.error || 'Não foi possível encerrar o bloqueio.', 'error');
          return;
        }
        UI.toast('Bloqueio temporário encerrado.', 'success');
        renderSecurityLogs(content, { quiet: true });
      });
    });
    content.querySelectorAll('[data-incident-id]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button, a, input, select, label')) return;
        const id = row.getAttribute('data-incident-id');
        if (id) openSecurityIncidentModal({ id });
      });
    });
  }

  function yn(value) {
    return value ? 'SIM' : 'NÃO';
  }

  function incKv(label, value) {
    return `<div class="pas-inc-kv"><span>${escape(label)}</span><strong>${value || '—'}</strong></div>`;
  }

  function incidentModalHTML(detail) {
    const inc = detail.incident || {};
    const actions = detail.actions || {};
    const alert = detail.alert || {};
    const sev = String(inc.severidade || 'INFO').toUpperCase();
    const notes = Array.isArray(detail.notes) ? detail.notes : [];
    const timeline = Array.isArray(detail.timeline) ? detail.timeline : [];
    const userBlock = inc.usuario_autenticado && inc.usuario_id
      ? `${incKv('Usuário', escape(inc.usuario_nome || '—'))}
         ${incKv('ID do usuário', escape(`#${inc.usuario_id}`))}
         ${incKv('E-mail', escape(inc.usuario_email || '—'))}`
      : `<p class="pas-inc-empty">Usuário não autenticado</p>`;
    const notesHtml = notes.length
      ? notes
          .map(
            (n) => `<li><strong>${escape(n.autor_nome || `Usuário #${n.usuario_id || '—'}`)}</strong>
              <span>${escape(formatWhen(n.criado_em))}</span>
              <p>${escape(n.texto)}</p></li>`
          )
          .join('')
      : '<p class="pas-inc-empty">Nenhuma observação registrada.</p>';
    const timelineHtml = timeline.length
      ? timeline
          .map((ev) => `<li><time>${escape(formatWhen(ev.at))}</time><span>${escape(ev.label)}</span></li>`)
          .join('')
      : '<p class="pas-inc-empty">Não há linha do tempo adicional para este registro.</p>';
    const workflow = inc.workflow_status || 'detectado';
    const options = [
      ['detectado', 'Detectado'],
      ['em_analise', 'Em análise'],
      ['bloqueado', 'Bloqueado'],
      ['resolvido', 'Resolvido'],
      ['falso_positivo', 'Falso positivo']
    ]
      .map(([v, l]) => `<option value="${v}" ${workflow === v ? 'selected' : ''}>${l}</option>`)
      .join('');

    return `
      <div class="pas-inc-modal" data-incident-id="${escape(String(inc.id || ''))}">
        <header class="pas-inc-hero pas-inc-hero--${escape(sev.toLowerCase())}">
          <p class="pas-inc-kicker">🚨 Incidente de Segurança</p>
          <div class="pas-inc-hero__row">
            ${incKv('ID do incidente', escape(`#${inc.id || '—'}`))}
            <div class="pas-inc-kv">
              <span>Severidade</span>
              <strong><span class="pas-sev pas-sev--${escape(sev.toLowerCase())}">${escape(sev)}</span></strong>
            </div>
            ${incKv('Status', escape(inc.workflow_label || 'Detectado'))}
            ${incKv('Data e hora', escape(formatWhen(inc.data_hora)))}
          </div>
        </header>

        <section class="pas-inc-section">
          <h4>Identificação da ameaça</h4>
          <div class="pas-inc-grid">
            ${incKv('Tipo de ameaça', escape(inc.tipo_ameaca || inc.categoria || '—'))}
            ${incKv('Categoria', escape(inc.categoria || '—'))}
            ${incKv('Confiança da detecção', escape(inc.confianca || 'Baixa'))}
            ${incKv('Status da detecção', escape(inc.status_deteccao_label || inc.status_deteccao || '—'))}
          </div>
          <p class="pas-inc-desc">${escape(inc.descricao || '—')}</p>
        </section>

        <section class="pas-inc-section">
          <h4>Informações da requisição</h4>
          <div class="pas-inc-grid">
            ${incKv('Endpoint', escape(inc.endpoint || '—'))}
            ${incKv('Método HTTP', escape(inc.metodo_http || '—'))}
            ${incKv('Recurso afetado', escape(inc.recurso_afetado || '—'))}
            ${incKv('Quantidade de tentativas', escape(String(alert.quantidade || inc.quantidade_tentativas || 1)))}
            ${incKv('Primeira ocorrência', escape(formatWhen(alert.primeiro_em || inc.data_hora)))}
            ${incKv('Última ocorrência', escape(formatWhen(alert.ultimo_em || inc.data_hora)))}
          </div>
        </section>

        <section class="pas-inc-section">
          <h4>Usuário envolvido</h4>
          <div class="pas-inc-grid">${userBlock}</div>
        </section>

        <section class="pas-inc-section">
          <h4>Origem da requisição</h4>
          <div class="pas-inc-grid">
            ${incKv('IP de origem', escape(inc.ip || '—'))}
            ${incKv('User-Agent', escape(inc.user_agent || '—'))}
            ${incKv('Origem', 'Não registrada')}
          </div>
        </section>

        <section class="pas-inc-section">
          <h4>Ação executada</h4>
          <div class="pas-inc-grid">
            ${incKv('Bloqueado', yn(actions.bloqueado))}
            ${incKv('Sessão invalidada', yn(actions.sessao_invalidada))}
            ${incKv('IP temporariamente bloqueado', yn(actions.ip_bloqueado))}
            ${incKv('Rate limit aplicado', yn(actions.rate_limit))}
            ${incKv('Duração do bloqueio', escape(actions.duracao_bloqueio || '—'))}
          </div>
          <p class="pas-inc-desc">${escape(actions.acao_executada || inc.acao_executada || '—')}</p>
        </section>

        <section class="pas-inc-section">
          <h4>Evidências do incidente</h4>
          <pre class="pas-inc-pre">${escape(inc.evidencias || 'Nenhuma evidência textual adicional.')}</pre>
        </section>

        <section class="pas-inc-section">
          <h4>Linha do tempo</h4>
          <ol class="pas-inc-timeline">${timelineHtml}</ol>
        </section>

        <section class="pas-inc-section">
          <h4>Recomendação</h4>
          <p class="pas-inc-desc">${escape(detail.recommendation || 'Não há recomendação automática disponível.')}</p>
        </section>

        <section class="pas-inc-section">
          <h4>Status do incidente</h4>
          <label class="pas-inc-field">Alterar status
            <select id="sec-inc-workflow">${options}</select>
          </label>
          <button type="button" class="pas-ghost-btn" id="sec-inc-save-status">Aplicar status</button>
        </section>

        <section class="pas-inc-section">
          <h4>Observação do desenvolvedor</h4>
          <textarea id="sec-inc-note" rows="3" maxlength="2000" placeholder="Registre a análise deste incidente."></textarea>
          <button type="button" class="pas-ghost-btn" id="sec-inc-save-note">Salvar observação</button>
          <ul class="pas-inc-notes">${notesHtml}</ul>
        </section>

        <section class="pas-inc-section" id="sec-inc-related-wrap">
          <h4>Eventos relacionados</h4>
          <p class="muted" id="sec-inc-related-summary">Encontrados ${escape(String(detail.related_total || 0))} eventos relacionados.</p>
          <div id="sec-inc-related"></div>
        </section>
      </div>`;
  }

  function bindIncidentModal(body, detail) {
    const id = detail.incident?.id;
    body.querySelector('#sec-inc-save-status')?.addEventListener('click', async () => {
      const workflow_status = body.querySelector('#sec-inc-workflow')?.value;
      UI.showLoading('Atualizando status…');
      const res = await API.updateSecurityIncident(id, { workflow_status });
      UI.hideLoading();
      if (!res.ok) {
        UI.toast(res.error || 'Não foi possível atualizar o status.', 'error');
        return;
      }
      UI.toast('Status atualizado.', 'success');
      openSecurityIncidentModal({ id, detail: res });
    });
    body.querySelector('#sec-inc-save-note')?.addEventListener('click', async () => {
      const nota = body.querySelector('#sec-inc-note')?.value || '';
      if (!String(nota).trim()) {
        UI.toast('Escreva uma observação antes de salvar.', 'info');
        return;
      }
      UI.showLoading('Salvando observação…');
      const res = await API.updateSecurityIncident(id, { nota });
      UI.hideLoading();
      if (!res.ok) {
        UI.toast(res.error || 'Não foi possível salvar a observação.', 'error');
        return;
      }
      UI.toast('Observação registrada.', 'success');
      openSecurityIncidentModal({ id, detail: res });
    });
  }

  async function openSecurityIncidentModal({ id, href, ref, detail } = {}) {
    if (typeof UI === 'undefined' || typeof UI.modal !== 'function') return;
    let payload = detail;
    if (!payload?.incident) {
      UI.showLoading('Carregando incidente…');
      const res = id
        ? await API.getSecurityIncident(id)
        : await API.resolveSecurityIncident({ href, ref });
      UI.hideLoading();
      if (!res.ok) {
        UI.toast(res.error || 'Não foi possível abrir o incidente.', 'error');
        return;
      }
      payload = res;
    }
    const incidentId = payload.incident?.id;
    const body = document.createElement('div');
    body.innerHTML = incidentModalHTML(payload);
    bindIncidentModal(body, payload);
    UI.modal({
      title: 'Detalhes do Incidente de Segurança',
      dialogClass: 'modal-dialog--wide modal-dialog--security-incident',
      body,
      actions: [
        { label: 'Fechar', className: 'btn-ghost', onClick: (c) => c() },
        {
          label: 'Ver logs',
          className: 'btn-ghost',
          onClick: (c) => {
            activeTab = 'logs';
            renderTab({ quiet: true });
            c();
          }
        },
        {
          label: 'Ver eventos relacionados',
          className: 'btn-ghost',
          onClick: async () => {
            const box = body.querySelector('#sec-inc-related');
            const summary = body.querySelector('#sec-inc-related-summary');
            if (!box) return;
            UI.showLoading('Carregando relacionados…');
            const related = await API.listRelatedSecurityIncidents(incidentId);
            UI.hideLoading();
            if (!related.ok) {
              UI.toast(related.error || 'Não foi possível listar os relacionados.', 'error');
              return;
            }
            if (summary) {
              summary.textContent = `Encontrados ${related.total} eventos relacionados.`;
            }
            if (!related.items.length) {
              box.innerHTML = '<p class="pas-inc-empty">Nenhum outro evento relacionado no período.</p>';
              return;
            }
            box.innerHTML = `<div class="pas-table-wrap"><table class="pas-table pas-table--security"><thead>
              <tr><th>Data</th><th>Severidade</th><th>Tipo</th><th>Endpoint</th><th>IP</th></tr>
            </thead><tbody>
              ${related.items
                .map(
                  (item) => `<tr class="pas-inc-row" data-open-related="${escape(String(item.id))}">
                    <td>${escape(formatWhen(item.data_hora))}</td>
                    <td>${escape(item.severidade || '')}</td>
                    <td>${escape(item.tipo_ameaca || item.categoria || '')}</td>
                    <td>${escape(item.endpoint || '')}</td>
                    <td>${escape(item.ip || '')}</td>
                  </tr>`
                )
                .join('')}
            </tbody></table></div>`;
            box.querySelectorAll('[data-open-related]').forEach((row) => {
              row.addEventListener('click', () => {
                openSecurityIncidentModal({ id: row.getAttribute('data-open-related') });
              });
            });
          }
        },
        {
          label: 'Marcar como resolvido',
          className: 'btn-primary',
          onClick: async () => {
            UI.showLoading('Marcando como resolvido…');
            const res = await API.updateSecurityIncident(incidentId, { workflow_status: 'resolvido' });
            UI.hideLoading();
            if (!res.ok) {
              UI.toast(res.error || 'Não foi possível resolver.', 'error');
              return;
            }
            UI.toast('Incidente marcado como resolvido.', 'success');
            openSecurityIncidentModal({ id: incidentId, detail: res });
          }
        }
      ]
    });
  }

  async function renderSecurityLogs(content, { quiet = false } = {}) {
    if (!quiet) {
      content.innerHTML = '<p class="muted">Carregando incidentes de segurança…</p>';
      UI.showLoading('Carregando…');
    }
    try {
      const range = securityPeriodRange(securityFilters.period);
      const [summaryRes, listRes, cfRes] = await Promise.all([
        API.getSecuritySummary(),
        API.listSecurityIncidents({
          ...range,
          severidade: securityFilters.severidade,
          categoria: securityFilters.categoria,
          status: securityFilters.status,
          usuario_id: securityFilters.usuario_id,
          ip: securityFilters.ip,
          endpoint: securityFilters.endpoint,
          limit: 120
        }),
        typeof API.getCloudflareStatus === 'function'
          ? API.getCloudflareStatus().catch(() => null)
          : Promise.resolve(null)
      ]);
      if (!quiet) UI.hideLoading();
      if (!summaryRes.ok && !listRes.ok) {
        content.innerHTML = `<p class="form-error">${escape(summaryRes.error || listRes.error || 'Acesso recusado.')}</p>`;
        return;
      }
      const s = summaryRes.summary || {};
      const blocks = summaryRes.blocks || [];
      const items = listRes.incidents || [];
      const f = securityFilters;
      const sel = (name, value) => (f[name] === value ? 'selected' : '');

      content.innerHTML = `
        <section class="pas-welcome pas-welcome--compact">
          <div>
            <h2>Incidentes de segurança</h2>
            <p>Eventos do backend. Cloudflare é a borda — bloqueios da CDN aparecem agregados abaixo.</p>
          </div>
        </section>
        ${cfRes ? cloudflareCardHTML(cfRes) : ''}

        <section class="pas-kpis">
          <article class="pas-kpi">
            <div>
              <span>Últimas 24h</span>
              <strong>${escape(String(s.total_24h || 0))}</strong>
              <em>${escape(String(s.total || 0))} em 7 dias</em>
            </div>
            <div class="pas-kpi__icon">${ICONS.list}</div>
          </article>
          <article class="pas-kpi">
            <div>
              <span>Críticos / altos</span>
              <strong>${escape(String((s.critical || 0) + (s.high || 0)))}</strong>
              <em class="is-down">${escape(String(s.critical || 0))} críticos</em>
            </div>
            <div class="pas-kpi__icon pas-kpi__icon--red">${ICONS.wrench}</div>
          </article>
          <article class="pas-kpi">
            <div>
              <span>Ataques bloqueados</span>
              <strong>${escape(String(s.blocked || 0))}</strong>
              <em>Ações recusadas</em>
            </div>
            <div class="pas-kpi__icon">${ICONS.clock}</div>
          </article>
          <article class="pas-kpi">
            <div>
              <span>Brute force / SQLi</span>
              <strong>${escape(String(s.brute_force || 0))}</strong>
              <em>${escape(String(s.sql_injection || 0))} SQL Injection</em>
            </div>
            <div class="pas-kpi__icon">${ICONS.gear}</div>
          </article>
        </section>

        <article class="pas-card">
          <div class="pas-card__head">
            <h3>Filtros</h3>
          </div>
          <form id="dev-sec-filters" class="pas-sec-filters">
            <label>Período
              <select name="period">
                <option value="24h" ${sel('period', '24h')}>24 horas</option>
                <option value="7d" ${sel('period', '7d')}>7 dias</option>
                <option value="30d" ${sel('period', '30d')}>30 dias</option>
                <option value="all" ${sel('period', 'all')}>Todos</option>
              </select>
            </label>
            <label>Severidade
              <select name="severidade">
                <option value="">Todas</option>
                ${['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((v) => `<option value="${v}" ${sel('severidade', v)}>${v}</option>`).join('')}
              </select>
            </label>
            <label>Tipo
              <select name="categoria">
                <option value="">Todos</option>
                ${['brute_force','sql_injection','xss','acesso_sem_autenticacao','acesso_indevido','manipulacao_usuario_id','manipulacao_id_recurso','acesso_admin_negado','token_invalido','sessao_expirada','excesso_requisicoes','abuso_api','operacao_sensivel_repetida'].map((v) => `<option value="${v}" ${sel('categoria', v)}>${escape(securityThreatLabel(v))}</option>`).join('')}
              </select>
            </label>
            <label>Status
              <select name="status">
                <option value="">Todos</option>
                <option value="atividade_suspeita" ${sel('status', 'atividade_suspeita')}>Atividade suspeita</option>
                <option value="possivel_ataque" ${sel('status', 'possivel_ataque')}>Possível ataque</option>
                <option value="tentativa_bloqueada" ${sel('status', 'tentativa_bloqueada')}>Bloqueada</option>
                <option value="ataque_potencialmente_confirmado" ${sel('status', 'ataque_potencialmente_confirmado')}>Potencialmente confirmado</option>
              </select>
            </label>
            <label>Usuário
              <input name="usuario_id" value="${escape(f.usuario_id)}" placeholder="ID">
            </label>
            <label>IP
              <input name="ip" value="${escape(f.ip)}" placeholder="IP">
            </label>
            <label>Endpoint
              <input name="endpoint" value="${escape(f.endpoint)}" placeholder="/api/...">
            </label>
            <button type="submit" class="pas-ghost-btn">Filtrar</button>
          </form>
        </article>

        <article class="pas-card">
          <div class="pas-card__head">
            <h3>IPs suspeitos e endpoints</h3>
          </div>
          <p class="muted pas-sec-toplist">
            IPs: ${(s.topIps || []).map((x) => escape(`${x.ip} (${x.total})`)).join(' · ') || '—'}
            <br>
            Endpoints: ${(s.topEndpoints || []).map((x) => escape(`${x.endpoint} (${x.total})`)).join(' · ') || '—'}
          </p>
          ${blocks.length ? `
            <div class="pas-table-wrap">
              <table class="pas-table">
                <thead><tr><th>IP bloqueado</th><th>Motivo</th><th>Até</th><th>Ação</th></tr></thead>
                <tbody>
                  ${blocks.map((b) => `<tr>
                    <td>${escape(b.ip || '—')}</td>
                    <td>${escape(b.motivo || b.categoria || '—')}</td>
                    <td>${escape(formatWhen(b.ate))}</td>
                    <td><button type="button" class="pas-ghost-btn" data-lift-ip="${escape(b.ip || '')}">Encerrar</button></td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>` : '<p class="muted">Nenhum bloqueio temporário ativo.</p>'}
        </article>

        <article class="pas-card">
          <div class="pas-card__head">
            <h3>Incidentes recentes (${escape(String(items.length))})</h3>
          </div>
          <div class="pas-table-wrap">
            <table class="pas-table pas-table--security">
              <thead>
                <tr>
                  <th>Data/hora</th>
                  <th>Severidade</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Endpoint</th>
                  <th>IP</th>
                  <th>Usuário</th>
                  <th>Bloqueado</th>
                  <th>Ação tomada</th>
                </tr>
              </thead>
              <tbody>${securityIncidentRowsHTML(items)}</tbody>
            </table>
          </div>
        </article>`;

      bindSecurityDashboard(content);
      if (cfRes) bindCloudflareCard(content);
    } catch (err) {
      if (!quiet) UI.hideLoading();
      content.innerHTML = `<p class="form-error">${escape(err.message || 'Erro')}</p>`;
    }
  }

  function renderPlaceholder(content, title, text) {
    content.innerHTML = `
      <section class="pas-welcome pas-welcome--compact">
        <div>
          <h2>${escape(title)}</h2>
          <p>${escape(text)}</p>
        </div>
      </section>
      <article class="pas-card pas-card--center">
        <div class="pas-placeholder">
          <strong>Em breve</strong>
          <p>Esta área do portal do desenvolvedor será liberada na próxima atualização.</p>
        </div>
      </article>`;
  }

  async function renderTab(opts = {}) {
    const content = document.getElementById('dev-content');
    if (!content) return;
    setActiveNav();
    syncMessageFabVisibility();
    if (!opts.quiet) closeMobileNav();
    if (activeTab === 'dashboard') return renderDashboard(content, opts);
    if (activeTab === 'pagamentos') return renderPagamentos(content, opts);
    if (activeTab === 'usuarios') return renderUsuarios(content, opts);
    if (activeTab === 'avaliacoes') return renderAvaliacoes(content, opts);
    if (activeTab === 'assinaturas') {
      return renderAssinaturas(content, opts);
    }
    if (activeTab === 'planos') {
      return renderPlaceholder(content, 'Planos', 'Gerencie valores e benefícios dos planos.');
    }
    if (activeTab === 'relatorios') {
      return renderPlaceholder(content, 'Relatórios', 'Exportações e indicadores do sistema.');
    }
    if (activeTab === 'suporte') {
      // Suporte ficou só no botão flutuante — não há mais aba no menu lateral.
      activeTab = 'dashboard';
      setActiveNav();
      syncMessageFabVisibility();
      openMessagePanel();
      return renderDashboard(content, opts);
    }
    if (activeTab === 'configuracoes') {
      return renderConfiguracoes(content, opts);
    }
    if (activeTab === 'logs') {
      return renderSecurityLogs(content, opts);
    }
    return renderDashboard(content, opts);
  }

  root.innerHTML = shellHTML();
  setActiveNav();
  bindProfileMenu();
  mountMessageFab();
  if (typeof Notificacoes !== 'undefined') Notificacoes.bind();
  document.addEventListener('pas:dev-go-tab', (e) => {
    const tab = e.detail?.tab;
    if (!tab) return;
    activeTab = tab;
    renderTab();
  });
  document.addEventListener('pas:dev-open-incident', (e) => {
    if (activeTab !== 'logs') {
      activeTab = 'logs';
      renderTab({ quiet: true });
    }
    openSecurityIncidentModal(e.detail || {});
  });
  document.addEventListener('pas:dev-open-messages', async () => {
    if (!isHomeTab()) {
      activeTab = 'dashboard';
      await renderTab({ quiet: true });
    }
    openMessagePanel();
  });
  if (typeof Theme !== 'undefined') {
    Theme.apply(Theme.get());
    Theme.bind();
  }

  // Carrega foto/nome atualizados do banco
  API.getDeveloperProfile?.()
    .then((res) => {
      if (res?.ok && res.profile) {
        refreshProfileHeader({
          userId: res.profile.id,
          name: res.profile.name,
          email: res.profile.email,
          photo: res.profile.photo,
          role: 'developer',
          loggedAt: session.loggedAt || new Date().toISOString()
        });
      }
    })
    .catch(() => {});

  root.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (!tab) return;
      activeTab = tab;
      renderTab();
    });
  });

  document.getElementById('dev-menu-toggle')?.addEventListener('click', () => {
    document.body.classList.toggle('dev-nav-open');
    const ov = document.getElementById('dev-overlay');
    if (ov) ov.hidden = !document.body.classList.contains('dev-nav-open');
  });

  document.getElementById('dev-overlay')?.addEventListener('click', closeMobileNav);

  await renderTab();
  const hash = String(location.hash || '');
  if (/configuracoes|sec-cloudflare/i.test(hash)) {
    activeTab = 'configuracoes';
    await renderTab({ quiet: true });
    if (/sec-cloudflare/i.test(hash)) {
      document.getElementById('pas-cloudflare')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  const hashInc = String(location.hash || '').match(/sec-incidente-(\d+)/i);
  if (hashInc) {
    openSecurityIncidentModal({ id: hashInc[1] });
  }
  startUsersLiveUpdates();
  if (typeof SuporteChat !== 'undefined' && typeof SuporteChat.startDevIncomingWatcher === 'function') {
    SuporteChat.startDevIncomingWatcher(() => usersCache);
  }
});
