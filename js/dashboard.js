/**
 * Dashboard — PowerApps Sistemas (Supabase)
 * Foco: atenção, atalhos e próximos sorteios
 * Atualiza em tempo real via vendas_rifa + notificacoes
 */
document.addEventListener('DOMContentLoaded', async () => {
  const session = await Layout.render({ active: 'dashboard', title: 'Dashboard' });
  if (!session) return;

  const CHART_PERIOD_KEY = `pas_chart_period_${session.userId}`;
  let refreshing = false;
  let chartPeriod = '7d';
  try {
    const saved = sessionStorage.getItem(CHART_PERIOD_KEY);
    if (saved === 'month' || saved === '7d') chartPeriod = saved;
  } catch { /* ignore */ }
  let cache = { stats: null, list: [], pendingCount: 0, shareHref: '', chartData: null };

  function chartTitle(period) {
    return period === 'month' ? 'Movimentação (12 meses)' : 'Movimentação (7 dias)';
  }

  function chartPeriodControls(period) {
    return `
      <div class="dash-chart__periods" role="group" aria-label="Período do gráfico">
        <button type="button" class="dash-chart__period ${period === '7d' ? 'is-active' : ''}" data-chart-period="7d">7 dias</button>
        <button type="button" class="dash-chart__period ${period === 'month' ? 'is-active' : ''}" data-chart-period="month">Por mês</button>
      </div>`;
  }

  function syncChartPeriodUI(period) {
    const title = document.getElementById('dash-chart-title');
    if (title) title.textContent = chartTitle(period);
    const section = document.querySelector('.dash-chart');
    if (section) {
      section.setAttribute(
        'aria-label',
        period === 'month' ? 'Movimentação dos últimos 12 meses' : 'Movimentação dos últimos 7 dias'
      );
    }
    document.querySelectorAll('[data-chart-period]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-chart-period') === period);
    });
  }

  const icon = (paths) =>
    `<svg class="stat-card__svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

  const ICONS = {
    sold: icon('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
    reserved: icon('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    money: icon('<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>'),
    target: icon('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
    percent: icon('<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>'),
    plus: icon('<path d="M5 12h14"/><path d="M12 5v14"/>'),
    list: icon('<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>'),
    clock: icon('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    share: icon('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>'),
    alert: icon('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>'),
    calendar: icon('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>')
  };

  function parseDrawDate(iso) {
    const raw = String(iso || '').trim();
    if (!raw) return null;
    const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function dayKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function startOfDay(d = new Date()) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function isActiveRaffle(r) {
    const st = String(r?.status || 'ativa').toLowerCase();
    return st === 'ativa';
  }

  function raffleSoldPct(r) {
    const qty = Number(r?.quantity) || 0;
    const sold = Number.isFinite(Number(r?.soldCount))
      ? Number(r.soldCount)
      : (Array.isArray(r?.numbers) ? r.numbers.filter((n) => n.status === 'vendido').length : 0);
    return qty ? Math.round((sold / qty) * 100) : 0;
  }

  function buildAlerts(pendingCount, raffles) {
    const alerts = [];
    const today = startOfDay();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayKey = dayKey(today);
    const tomorrowKey = dayKey(tomorrow);

    if (pendingCount > 0) {
      alerts.push({
        type: 'pending',
        icon: ICONS.clock,
        title: pendingCount === 1
          ? '1 reserva aguardando confirmação'
          : `${pendingCount} reservas aguardando confirmação`,
        href: 'reservas.html',
        cta: 'Ver reservas'
      });
    }

    const drawSoon = raffles.filter((r) => {
      if (!isActiveRaffle(r)) return false;
      const d = parseDrawDate(r.drawDate);
      if (!d) return false;
      const key = dayKey(d);
      return key === todayKey || key === tomorrowKey;
    });

    if (drawSoon.length) {
      const todayDraws = drawSoon.filter((r) => dayKey(parseDrawDate(r.drawDate)) === todayKey);
      const label = todayDraws.length
        ? (todayDraws.length === 1
          ? `Sorteio hoje: ${todayDraws[0].name}`
          : `${todayDraws.length} sorteios hoje`)
        : (drawSoon.length === 1
          ? `Sorteio amanhã: ${drawSoon[0].name}`
          : `${drawSoon.length} sorteios amanhã`);
      const first = todayDraws[0] || drawSoon[0];
      alerts.push({
        type: 'draw',
        icon: ICONS.calendar,
        title: label,
        href: `visualizar-rifa.html?id=${first.id}`,
        cta: 'Abrir rifa'
      });
    }

    const almost = raffles
      .filter((r) => isActiveRaffle(r) && raffleSoldPct(r) >= 90)
      .sort((a, b) => raffleSoldPct(b) - raffleSoldPct(a));

    if (almost.length) {
      const top = almost[0];
      alerts.push({
        type: 'hot',
        icon: ICONS.alert,
        title: almost.length === 1
          ? `${top.name} está com ${raffleSoldPct(top)}% vendido`
          : `${almost.length} rifas quase esgotadas`,
        href: `visualizar-rifa.html?id=${top.id}`,
        cta: 'Ver rifa'
      });
    }

    return alerts;
  }

  function nextDraws(raffles, limit = 5) {
    const today = startOfDay().getTime();
    return raffles
      .filter((r) => isActiveRaffle(r) && parseDrawDate(r.drawDate))
      .map((r) => ({ r, d: parseDrawDate(r.drawDate) }))
      .filter(({ d }) => d && startOfDay(d).getTime() >= today)
      .sort((a, b) => {
        const ta = a.d.getTime();
        const tb = b.d.getTime();
        if (ta !== tb) return ta - tb;
        return String(a.r.drawTime || '').localeCompare(String(b.r.drawTime || ''));
      })
      .slice(0, limit)
      .map(({ r }) => r);
  }

  function alertsHTML(alerts) {
    if (!alerts.length) return '';
    return `
      <section class="dash-alerts" aria-label="Precisa da sua atenção">
        <h2 class="dash-alerts__title">Precisa da sua atenção</h2>
        <div class="dash-alerts__list">
          ${alerts.map((a) => `
            <a class="dash-alert dash-alert--${a.type}" href="${a.href}">
              <span class="dash-alert__icon" aria-hidden="true">${a.icon}</span>
              <span class="dash-alert__body">
                <strong>${UI.escapeHtml(a.title)}</strong>
                <span>${UI.escapeHtml(a.cta)}</span>
              </span>
            </a>`).join('')}
        </div>
      </section>`;
  }

  function shortcutsHTML(shareHref, pendingCount) {
    if (typeof Store !== 'undefined' && Store.getDashShortcutsEnabled
      && !Store.getDashShortcutsEnabled(session.userId)) {
      return '';
    }
    return `
      <nav class="dash-shortcuts" aria-label="Atalhos rápidos">
        <a class="dash-shortcut" href="nova-rifa.html">
          <span class="dash-shortcut__icon" aria-hidden="true">${ICONS.plus}</span>
          <span>Nova Rifa</span>
        </a>
        <a class="dash-shortcut" href="minhas-rifas.html">
          <span class="dash-shortcut__icon" aria-hidden="true">${ICONS.list}</span>
          <span>Minhas Rifas</span>
        </a>
        <a class="dash-shortcut" href="reservas.html">
          <span class="dash-shortcut__icon" aria-hidden="true">${ICONS.clock}</span>
          <span>Reservas${pendingCount > 0 ? ` (${pendingCount})` : ''}</span>
        </a>
        <a class="dash-shortcut ${shareHref ? '' : 'is-disabled'}" href="${shareHref || '#'}" ${shareHref ? '' : 'aria-disabled="true" tabindex="-1"'}>
          <span class="dash-shortcut__icon" aria-hidden="true">${ICONS.share}</span>
          <span>Compartilhar</span>
        </a>
      </nav>`;
  }

  function drawRowHTML(r) {
    const pct = raffleSoldPct(r);
    const dateLabel = `${UI.formatDateBR(r.drawDate)}${r.drawTime ? ` · ${r.drawTime}` : ''}`;
    return `
      <article class="dash-draw">
        <div class="dash-draw__main">
          <h3 class="dash-draw__title">${UI.escapeHtml(r.name)}</h3>
          <p class="dash-draw__meta">${UI.escapeHtml(dateLabel)} · ${pct}% vendido</p>
          <div class="progress dash-draw__progress" aria-label="${pct}% vendido">
            <div class="progress__bar" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="dash-draw__actions">
          <button class="btn btn-success btn-sm ripple" type="button" data-action="sortear" data-raffle-id="${r.id}">Sortear</button>
          <a class="btn btn-primary btn-sm ripple" href="visualizar-rifa.html?id=${r.id}">Abrir</a>
        </div>
      </article>`;
  }

  function drawsSectionHTML(upcoming) {
    const empty = !upcoming.length;
    return `
      <div class="dash-draws-wrap${empty ? ' is-empty' : ''}" id="next-draws-wrap">
        <button type="button" class="dash-draws__nav dash-draws__nav--prev" id="draws-prev" aria-label="Sorteio anterior" hidden>
          <span aria-hidden="true">‹</span>
        </button>
        <div class="dash-draws" id="next-draws">
          ${empty
            ? '<p class="dash-draws__empty">Nenhum sorteio futuro no momento.</p>'
            : upcoming.map(drawRowHTML).join('')}
        </div>
        <button type="button" class="dash-draws__nav dash-draws__nav--next" id="draws-next" aria-label="Próximo sorteio" hidden>
          <span aria-hidden="true">›</span>
        </button>
      </div>`;
  }

  function bindDrawsCarousel() {
    const track = document.getElementById('next-draws');
    const prev = document.getElementById('draws-prev');
    const next = document.getElementById('draws-next');
    if (!track || !prev || !next) return;

    const step = () => Math.max(1, track.clientWidth);

    const syncNav = () => {
      const cards = track.querySelectorAll('.dash-draw');
      const overflow = cards.length > 1 && track.scrollWidth > track.clientWidth + 6;
      prev.hidden = !overflow;
      next.hidden = !overflow;
      if (!overflow) return;
      const max = Math.max(0, track.scrollWidth - track.clientWidth);
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = track.scrollLeft >= max - 4;
    };

    prev.onclick = (e) => {
      e.preventDefault();
      track.scrollBy({ left: -step(), behavior: 'smooth' });
    };
    next.onclick = (e) => {
      e.preventDefault();
      track.scrollBy({ left: step(), behavior: 'smooth' });
    };

    track.addEventListener('scroll', syncNav, { passive: true });
    if (!bindDrawsCarousel._resizeBound) {
      bindDrawsCarousel._resizeBound = true;
      window.addEventListener('resize', () => {
        if (document.getElementById('next-draws')) syncNav();
      });
    }
    requestAnimationFrame(syncNav);
  }

  function formatSaleNum(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return String(n ?? '—');
    return Store.padNumber(num, 100);
  }

  async function openChartBarModal({ key, kind, label }) {
    if (!key || typeof UI === 'undefined') return;
    const isReserved = kind === 'reservado';
    const titleKind = isReserved ? 'Reservas' : 'Vendas';
    UI.modal({
      title: `${titleKind} · ${label || key}`,
      dialogClass: 'modal-dialog--chart-summary',
      body: '<p class="chart-summary__loading">Carregando resumo...</p>'
    });

    const result = await API.getSalesChartBucketDetails({
      period: chartPeriod,
      key,
      kind: isReserved ? 'reservado' : 'vendido',
      limit: 40
    });

    const body = document.querySelector('#app-modal .modal-body');
    if (!body) return;

    if (!result.ok) {
      body.innerHTML = `<p class="chart-summary__empty">${UI.escapeHtml(result.error || 'Não foi possível carregar.')}</p>`;
      return;
    }

    const items = result.items || [];
    const total = Number(result.total) || items.length;
    if (!total) {
      body.innerHTML = `<p class="chart-summary__empty">Nenhum registro neste período.</p>`;
      return;
    }

    const rows = items.map((item) => {
      const href = item.raffleId ? `visualizar-rifa.html?id=${UI.escapeHtml(item.raffleId)}` : '#';
      const when = [item.date, item.time].filter(Boolean).join(' · ');
      return `
        <a class="chart-summary__row" href="${href}">
          <span class="chart-summary__num">Nº ${UI.escapeHtml(formatSaleNum(item.number))}</span>
          <span class="chart-summary__main">
            <strong>${UI.escapeHtml(item.buyerName || 'Comprador')}</strong>
            <em>${UI.escapeHtml(item.raffleName || 'Rifa')}${when ? ` · ${UI.escapeHtml(when)}` : ''}</em>
          </span>
          <span class="chart-summary__val">${item.value ? UI.money(item.value) : ''}</span>
        </a>`;
    }).join('');

    body.innerHTML = `
      <div class="chart-summary">
        <div class="chart-summary__stats">
          <span class="chart-summary__pill chart-summary__pill--${isReserved ? 'reserved' : 'sold'}">
            ${total} ${isReserved ? (total === 1 ? 'reserva' : 'reservas') : (total === 1 ? 'venda' : 'vendas')}
          </span>
        </div>
        <div class="chart-summary__list">${rows}</div>
        ${total > items.length ? `<p class="chart-summary__more">Mostrando ${items.length} de ${total}</p>` : ''}
      </div>`;
  }

  function syncChart(chartData) {
    if (typeof GraficoVendas === 'undefined') return;
    const canvas = document.getElementById('sales-chart');
    if (!canvas) return;
    GraficoVendas.mount(canvas, { onBarClick: openChartBarModal });
    GraficoVendas.setOnBarClick(openChartBarModal);
    GraficoVendas.update(chartData || { labels: [], keys: [], vendidos: [], reservados: [] });
  }

  function paintHome({ stats, list, pendingCount, shareHref, chartData }) {
    const alerts = buildAlerts(pendingCount, list);
    const upcoming = nextDraws(list, 5);

    if (typeof GraficoVendas !== 'undefined') GraficoVendas.destroy();

    Layout.setContent(`
      <div class="slide-up dash-home">
        <h1 class="page-title">Olá, ${UI.escapeHtml(session.name.split(' ')[0])}</h1>
        <p class="page-subtitle">O que precisa da sua atenção e os próximos sorteios.</p>
        <div class="dash-divider" aria-hidden="true"></div>

        <div id="dash-alerts-root">${alertsHTML(alerts)}</div>
        <div id="dash-shortcuts-root">${shortcutsHTML(shareHref, pendingCount)}</div>

        <div class="dash-raised card stat-card stat-card--accent" id="dash-raised-card">
          <div class="dash-raised__icon">${ICONS.money}</div>
          <div class="dash-raised__body">
            <div class="stat-card__label">Valor arrecadado</div>
            <div class="stat-card__value stat-card__value--money" id="stat-raised">${UI.money(stats.raised)}</div>
            <p class="dash-raised__meta">
              Previsto: <strong id="stat-expected">${UI.money(stats.expected)}</strong>
              · <span id="stat-percent-inline">${stats.soldPercent}%</span> vendido
            </p>
          </div>
        </div>

        <div class="stats-grid stats-grid--dash">
          <div class="card stat-card">
            <div class="stat-card__icon">${ICONS.sold}</div>
            <div class="stat-card__label">Vendidos</div>
            <div class="stat-card__value" id="stat-sold">${stats.sold}</div>
          </div>
          <div class="card stat-card">
            <div class="stat-card__icon">${ICONS.reserved}</div>
            <div class="stat-card__label">Reservados</div>
            <div class="stat-card__value" id="stat-reserved">${stats.reserved}</div>
          </div>
          <div class="card stat-card">
            <div class="stat-card__icon">${ICONS.target}</div>
            <div class="stat-card__label">Valor previsto</div>
            <div class="stat-card__value stat-card__value--money" id="stat-expected-card">${UI.money(stats.expected)}</div>
          </div>
          <div class="card stat-card">
            <div class="stat-card__icon">${ICONS.percent}</div>
            <div class="stat-card__label">Percentual vendido</div>
            <div class="stat-card__value" id="stat-percent">${stats.soldPercent}%</div>
          </div>
        </div>

        <div class="dash-divider" aria-hidden="true"></div>

        <section class="dash-chart card" aria-label="${chartPeriod === 'month' ? 'Movimentação dos últimos 12 meses' : 'Movimentação dos últimos 7 dias'}">
          <div class="dash-chart__head">
            <div class="dash-chart__titles">
              <h2 class="section-title" id="dash-chart-title">${chartTitle(chartPeriod)}</h2>
              <p class="dash-chart__hint">Clique numa barra para ver o resumo</p>
            </div>
            ${chartPeriodControls(chartPeriod)}
          </div>
          <div class="dash-chart__canvas-wrap">
            <canvas id="sales-chart" aria-label="Gráfico de vendidos e reservados"></canvas>
          </div>
        </section>

        <div class="dash-divider" aria-hidden="true"></div>

        <div class="section-head">
          <h2 class="section-title">Próximos sorteios</h2>
          <a class="btn btn-outline btn-sm ripple" href="minhas-rifas.html">Ver todas</a>
        </div>

        ${drawsSectionHTML(upcoming)}
      </div>
    `);
    if (typeof Sorteio !== 'undefined') Sorteio.bind();
    bindDrawsCarousel();
    syncChart(chartData);
  }

  function patchHome({ stats, list, pendingCount, shareHref, chartData }) {
    const root = document.querySelector('.dash-home');
    if (!root || !document.getElementById('sales-chart')) {
      paintHome({ stats, list, pendingCount, shareHref, chartData });
      return;
    }

    const alertsRoot = document.getElementById('dash-alerts-root');
    const shortcutsRoot = document.getElementById('dash-shortcuts-root');
    if (alertsRoot) alertsRoot.innerHTML = alertsHTML(buildAlerts(pendingCount, list));
    if (shortcutsRoot) shortcutsRoot.innerHTML = shortcutsHTML(shareHref, pendingCount);

    const raised = document.getElementById('stat-raised');
    const expected = document.getElementById('stat-expected');
    const expectedCard = document.getElementById('stat-expected-card');
    const sold = document.getElementById('stat-sold');
    const reserved = document.getElementById('stat-reserved');
    const percent = document.getElementById('stat-percent');
    const percentInline = document.getElementById('stat-percent-inline');
    if (raised) raised.textContent = UI.money(stats.raised);
    if (expected) expected.textContent = UI.money(stats.expected);
    if (expectedCard) expectedCard.textContent = UI.money(stats.expected);
    if (sold) sold.textContent = String(stats.sold);
    if (reserved) reserved.textContent = String(stats.reserved);
    if (percent) percent.textContent = `${stats.soldPercent}%`;
    if (percentInline) percentInline.textContent = `${stats.soldPercent}%`;

    const drawsHost = document.getElementById('next-draws-wrap')
      || document.getElementById('next-draws')?.closest('.dash-draws-wrap')
      || document.getElementById('next-draws');
    if (drawsHost) {
      const upcoming = nextDraws(list, 5);
      const tmp = document.createElement('div');
      tmp.innerHTML = drawsSectionHTML(upcoming).trim();
      const nextNode = tmp.firstElementChild;
      if (nextNode) {
        drawsHost.replaceWith(nextNode);
        if (typeof Sorteio !== 'undefined') Sorteio.bind();
        bindDrawsCarousel();
      }
    }

    syncChartPeriodUI(chartPeriod);
    syncChart(chartData);
  }

  Layout.setContent(`
    <div class="slide-up">
      <h1 class="page-title">Olá, ${UI.escapeHtml(session.name.split(' ')[0])}</h1>
      <p class="page-subtitle">Carregando dados...</p>
    </div>
  `);

  async function refresh({ silent = false } = {}) {
    if (refreshing) return;
    if (document.hidden) return;
    refreshing = true;
    if (!silent) UI.showLoading('Carregando Dados...');
    try {
      const [listed, chartResult] = await Promise.all([
        API.listRaffles(),
        API.getSalesChartData({ period: chartPeriod })
      ]);
      if (!listed?.ok) throw new Error(listed?.error || 'Erro ao listar rifas.');

      const raffles = listed.raffles || [];
      const stats = API.calculateStatistics(raffles);
      const pendingCount = raffles.reduce((sum, raffle) => sum + (Number(raffle.reservedCount) || 0), 0);
      const list = Array.isArray(raffles) ? raffles : [];
      const shareTarget = list.find(isActiveRaffle) || null;
      const shareHref = shareTarget ? `compartilhar.html?id=${shareTarget.id}&share=1` : '';
      const chartData = {
        labels: chartResult?.labels || [],
        keys: chartResult?.keys || [],
        vendidos: chartResult?.vendidos || [],
        reservados: chartResult?.reservados || []
      };

      cache = { stats, list, pendingCount, shareHref, chartData };

      if (silent && document.querySelector('.dash-home')) {
        patchHome(cache);
      } else {
        paintHome(cache);
      }
    } catch (err) {
      if (!silent) {
        UI.toast(err.message || 'Erro ao carregar dashboard.', 'error');
        Layout.setContent(`
          <div class="card empty-state">
            <h3>Não foi possível carregar os dados</h3>
            <p>${UI.escapeHtml(err.message || 'Verifique a conexão com o banco de dados na nuvem.')}</p>
            <button class="btn btn-primary ripple" type="button" id="retry-dash" style="margin-top:1rem;">Tentar de novo</button>
          </div>
        `);
        document.getElementById('retry-dash')?.addEventListener('click', () => refresh({ silent: false }));
      } else {
        console.warn('Falha ao atualizar dashboard', err);
      }
    } finally {
      refreshing = false;
      if (!silent) UI.hideLoading();
    }
  }

  function startLive() {
    document.addEventListener('pas:live-update', (event) => {
      const source = event.detail?.source;
      if (source === 'rifas' || source === 'vendas_rifa') refresh({ silent: true });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh({ silent: true });
    });
    document.addEventListener('click', (e) => {
      const periodBtn = e.target.closest('[data-chart-period]');
      if (periodBtn) {
        e.preventDefault();
        const next = periodBtn.getAttribute('data-chart-period');
        if (next !== '7d' && next !== 'month') return;
        if (next === chartPeriod) return;
        chartPeriod = next;
        try { sessionStorage.setItem(CHART_PERIOD_KEY, chartPeriod); } catch { /* ignore */ }
        syncChartPeriodUI(chartPeriod);
        refresh({ silent: true });
        return;
      }
      if (!e.target.closest('[data-action="toggle-theme"]')) return;
      setTimeout(() => syncChart(cache.chartData), 40);
    });
  }

  await refresh({ silent: false });
  startLive();

  if (typeof UI !== 'undefined' && UI.maybeOpenSystemRatingAfterLogin) {
    UI.maybeOpenSystemRatingAfterLogin();
  }
});
