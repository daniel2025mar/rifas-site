/**
 * Vendas — mesa de venda por rifa (registra em vendas_rifa)
 * Pessoa física sem pagamento: recurso bloqueado (mensagem + link para Pix).
 */
document.addEventListener('DOMContentLoaded', async () => {
  const session = await Layout.render({ active: 'vendas', title: 'Vendas' });
  if (!session) return;

  if (typeof API !== 'undefined' && API.isVendasLocked?.(session)) {
    Layout.setContent(
      typeof Layout.vendasLockedPageHTML === 'function'
        ? Layout.vendasLockedPageHTML()
        : '<p>Vendas bloqueada. Conclua o pagamento para liberar.</p>'
    );

    const unlockAndReload = async () => {
      if (typeof Layout.syncPaymentLock === 'function') {
        await Layout.syncPaymentLock({ toast: false });
      } else if (typeof API.refreshPaymentProfile === 'function') {
        await API.refreshPaymentProfile();
      }
      if (!API.isVendasLocked?.(Store.getSession())) {
        window.location.reload();
      }
    };

    document.addEventListener('pas:payment-approved', unlockAndReload);
    document.addEventListener('pas:live-update', async (event) => {
      const source = event.detail?.source;
      if (source === 'usuarios' || source === 'notificacoes') {
        await unlockAndReload();
      }
    });
    return;
  }

  const params = new URLSearchParams(window.location.search);
  let raffleId = params.get('id') || '';
  let raffle = null;
  const selected = new Set();

  function formatNum(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return String(n ?? '—');
    return typeof Store !== 'undefined' && Store.padNumber
      ? Store.padNumber(num, 100)
      : String(num).padStart(2, '0');
  }

  function availableSlots(r) {
    return (r?.numbers || []).filter((n) => n.status === 'disponivel');
  }

  function qtyLimit() {
    const el = document.getElementById('sale-qty');
    const n = Number(el?.value || 0);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  function syncSummary() {
    const countEl = document.getElementById('sale-selected-count');
    const totalEl = document.getElementById('sale-total');
    const listEl = document.getElementById('sale-selected-list');
    const btn = document.getElementById('sale-submit');
    const nums = [...selected].sort((a, b) => Number(a) - Number(b));
    const price = Number(raffle?.price || 0);
    if (countEl) countEl.textContent = String(nums.length);
    if (totalEl) totalEl.textContent = UI.money(nums.length * price);
    if (listEl) listEl.textContent = nums.length ? nums.map(formatNum).join(', ') : 'Nenhum';
    if (btn) btn.disabled = nums.length === 0;
  }

  function paintNumbers() {
    const grid = document.getElementById('sale-numbers');
    if (!grid || !raffle) return;
    const avail = availableSlots(raffle);
    if (!avail.length) {
      grid.innerHTML = '<p class="sale-desk__empty">Não há números disponíveis nesta rifa.</p>';
      return;
    }
    grid.innerHTML = avail.map((n) => {
      const isOn = selected.has(String(n.number));
      return `
        <button type="button"
          class="sale-num${isOn ? ' is-selected' : ''}"
          data-number="${UI.escapeHtml(String(n.number))}"
          aria-pressed="${isOn ? 'true' : 'false'}">
          ${UI.escapeHtml(formatNum(n.number))}
        </button>`;
    }).join('');

    grid.querySelectorAll('[data-number]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-number');
        const limit = qtyLimit();
        if (selected.has(num)) {
          selected.delete(num);
        } else {
          if (limit > 0 && selected.size >= limit) {
            UI.toast(`Limite de ${limit} número(s). Ajuste a quantidade.`, 'info');
            return;
          }
          selected.add(num);
        }
        const qtyEl = document.getElementById('sale-qty');
        if (qtyEl && (!qtyEl.value || Number(qtyEl.value) < selected.size)) {
          qtyEl.value = String(selected.size);
        }
        paintNumbers();
        syncSummary();
      });
    });
  }

  function raffleListHTML(list) {
    if (!list.length) {
      return `
        <div class="card empty-state">
          <h3>Nenhuma rifa ativa</h3>
          <p>Crie uma rifa para começar a registrar vendas.</p>
          <a class="btn btn-primary ripple" href="nova-rifa.html" style="margin-top:1rem;">Nova Rifa</a>
        </div>`;
    }
    return `
      <div class="sales-pick-grid">
        ${list.map((r) => {
          const avail = availableSlots(r).length;
          const stats = typeof calculateStatistics === 'function'
            ? calculateStatistics([r])
            : { sold: 0, available: avail };
          return `
            <article class="card sale-pick-card">
              <div class="sale-pick-card__head">
                <h3>${UI.escapeHtml(r.name)}</h3>
                <span class="badge">#${UI.escapeHtml(String(r.id))}</span>
              </div>
              <p class="sale-pick-card__meta">
                ${UI.money(r.price)} / número · Sorteio ${UI.formatDateBR(r.drawDate)}
              </p>
              <div class="sale-pick-card__stats">
                <span><strong>${avail}</strong> disponíveis</span>
                <span><strong>${stats.sold || 0}</strong> vendidos</span>
              </div>
              <a class="btn btn-primary btn-sm ripple" href="vendas.html?id=${UI.escapeHtml(String(r.id))}">
                ${avail ? 'Vender nesta rifa' : 'Sem números livres'}
              </a>
            </article>`;
        }).join('')}
      </div>`;
  }

  function isSellableRaffle(r) {
    const purpose = String(r?.purpose || 'beneficente').toLowerCase();
    if (purpose === 'empresarial') return false;
    // Vendas com valor: beneficente (e demais com preço)
    return purpose === 'beneficente' || Number(r?.price) > 0;
  }

  async function renderPicker() {
    UI.showLoading('Carregando rifas...');
    try {
      const list = (await searchRaffle('')).filter((r) => {
        const st = String(r.status || '').toLowerCase();
        if (st === 'encerrada' || st === 'cancelada') return false;
        return isSellableRaffle(r);
      });
      UI.hideLoading();
      Layout.setContent(`
        <div class="slide-up sales-page">
          <header class="sales-hero">
            <div class="sales-hero__copy">
              <h1 class="page-title">Vendas</h1>
              <p class="page-subtitle">Escolha uma rifa beneficente para registrar a venda.</p>
            </div>
          </header>
          ${list.length ? raffleListHTML(list) : `
            <div class="card empty-state">
              <h3>Nenhuma rifa beneficente para vender</h3>
              <p>Rifas empresariais não entram nesta tela porque não têm valor de venda.</p>
              <a class="btn btn-primary ripple" href="nova-rifa.html" style="margin-top:1rem;">Nova Rifa</a>
            </div>`}
        </div>
      `);
    } catch (err) {
      UI.hideLoading();
      UI.toast(err.message || 'Erro ao carregar rifas.', 'error');
    }
  }

  async function renderDesk(id) {
    UI.showLoading('Carregando rifa...');
    try {
      const result = await API.getRaffle(id);
      UI.hideLoading();
      if (!result.ok) {
        UI.toast(result.error || 'Rifa não encontrada.', 'error');
        raffleId = '';
        history.replaceState({}, '', 'vendas.html');
        await renderPicker();
        return;
      }

      if (!isSellableRaffle(result.raffle)) {
        UI.toast('Rifas empresariais não têm valor de venda nesta tela.', 'info');
        raffleId = '';
        history.replaceState({}, '', 'vendas.html');
        await renderPicker();
        return;
      }

      raffle = result.raffle;
      selected.clear();
      const avail = availableSlots(raffle);
      const stats = calculateStatistics([raffle]);

      Layout.setContent(`
        <div class="slide-up sales-page sales-desk">
          <div class="sales-desk__nav">
            <a class="btn btn-ghost btn-sm ripple" href="vendas.html">← Todas as rifas</a>
          </div>

          <header class="sales-desk__header">
            <div>
              <span class="badge">Rifa #${UI.escapeHtml(String(raffle.id))}</span>
              <h1 class="page-title" style="margin-top:.45rem;">${UI.escapeHtml(raffle.name)}</h1>
              <p class="page-subtitle">
                ${UI.money(raffle.price)} por número · ${avail.length} disponíveis · ${stats.sold} vendidos
              </p>
            </div>
          </header>

          <form id="sale-form" class="sale-form card" novalidate>
            <h2 class="sale-form__title">Dados da venda</h2>
            <div class="form-grid">
              <div class="form-group form-group--full">
                <label for="sale-name">Nome do comprador *</label>
                <input id="sale-name" name="name" type="text" required placeholder="Nome completo" autocomplete="name">
              </div>
              <div class="form-group">
                <label for="sale-phone">Telefone / WhatsApp *</label>
                <input id="sale-phone" name="phone" type="tel" inputmode="tel" required placeholder="(00) 00000-0000" autocomplete="tel">
              </div>
              <div class="form-group">
                <label for="sale-qty">Quantidade de números *</label>
                <input id="sale-qty" name="qty" type="number" min="1" max="${Math.max(1, avail.length)}" value="${Math.min(1, avail.length) || 1}" ${avail.length ? '' : 'disabled'}>
              </div>
              <div class="form-group form-group--full">
                <label for="sale-city">Cidade (opcional)</label>
                <input id="sale-city" name="city" type="text" placeholder="Cidade">
              </div>
            </div>

            <div class="sale-form__pick">
              <div class="sale-form__pick-head">
                <h3>Números disponíveis</h3>
                <p>Toque para selecionar até a quantidade informada.</p>
              </div>
              <div class="sale-legend">
                <span><i class="sale-dot sale-dot--free"></i> Livre</span>
                <span><i class="sale-dot sale-dot--sel"></i> Selecionado</span>
              </div>
              <div class="sale-numbers" id="sale-numbers"></div>
            </div>

            <div class="sale-summary">
              <div>
                <span class="sale-summary__label">Selecionados</span>
                <strong id="sale-selected-count">0</strong>
              </div>
              <div class="sale-summary__nums">
                <span class="sale-summary__label">Números</span>
                <strong id="sale-selected-list">Nenhum</strong>
              </div>
              <div>
                <span class="sale-summary__label">Total</span>
                <strong id="sale-total">${UI.money(0)}</strong>
              </div>
            </div>

            <p id="sale-error" class="form-error" hidden></p>

            <button type="submit" class="btn btn-primary btn-block ripple" id="sale-submit" disabled>
              Registrar venda
            </button>
          </form>
        </div>
      `);

      const phone = document.getElementById('sale-phone');
      phone?.addEventListener('input', () => {
        if (typeof UI.formatPhoneBR === 'function') phone.value = UI.formatPhoneBR(phone.value);
      });

      const saleName = document.getElementById('sale-name');
      if (saleName) (window.NomeCompleto || window.API)?.bindFullNameInput?.(saleName);

      const qtyEl = document.getElementById('sale-qty');
      qtyEl?.addEventListener('change', () => {
        const limit = qtyLimit();
        if (limit > 0 && selected.size > limit) {
          const keep = [...selected].sort((a, b) => Number(a) - Number(b)).slice(0, limit);
          selected.clear();
          keep.forEach((n) => selected.add(n));
          paintNumbers();
          syncSummary();
        }
      });

      document.getElementById('sale-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitSale();
      });

      paintNumbers();
      syncSummary();
    } catch (err) {
      UI.hideLoading();
      UI.toast(err.message || 'Erro ao carregar rifa.', 'error');
    }
  }

  async function submitSale() {
    const errorEl = document.getElementById('sale-error');
    const name = (document.getElementById('sale-name')?.value || '').trim();
    const phone = (document.getElementById('sale-phone')?.value || '').trim();
    const city = (document.getElementById('sale-city')?.value || '').trim();
    const nums = [...selected].sort((a, b) => Number(a) - Number(b));
    const limit = qtyLimit();

    const showErr = (msg) => {
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
      }
      UI.toast(msg, 'error');
    };

    if (!name || !phone) {
      showErr('Informe nome e telefone do comprador.');
      return;
    }
    const nameCheck = (window.NomeCompleto || window.API)?.validateFullName?.(name);
    if (nameCheck && !nameCheck.ok) {
      showErr(nameCheck.error);
      return;
    }
    const nomeOk = nameCheck?.value || name;
    if (!nums.length) {
      showErr('Selecione ao menos um número disponível.');
      return;
    }
    if (limit > 0 && nums.length > limit) {
      showErr(`Você selecionou mais números que a quantidade (${limit}).`);
      return;
    }

    const buyer = { name: nomeOk, phone, city, observation: '' };
    UI.showLoading(`Registrando ${nums.length} venda(s)...`);
    const okNums = [];
    const errors = [];
    try {
      for (const number of nums) {
        const result = await sellNumber(raffleId, number, buyer);
        if (!result.ok) {
          errors.push(`${formatNum(number)}: ${result.error}`);
          continue;
        }
        okNums.push(number);
        if (result.raffle) raffle = result.raffle;
      }
      UI.hideLoading();
      if (okNums.length) {
        UI.toast(`${okNums.length} número(s) vendido(s) com sucesso.`, 'success');
        selected.clear();
        await renderDesk(raffleId);
      } else {
        showErr(errors[0] || 'Não foi possível registrar a venda.');
      }
    } catch (err) {
      UI.hideLoading();
      showErr(err.message || 'Erro ao registrar venda.');
    }
  }

  if (raffleId) await renderDesk(raffleId);
  else await renderPicker();
});
