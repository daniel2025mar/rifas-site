/**
 * Histórico de rifas já sorteadas — PowerApps Sistemas
 */
const HistoricoPage = (() => {
  function soldCount(r) {
    if (Number.isFinite(Number(r.soldCount))) return Number(r.soldCount);
    return (r.numbers || []).filter((n) => n.status === 'vendido').length;
  }

  function formatDrawnAt(value) {
    if (!value) return '';
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(value);
    }
  }

  function winnersHTML(winners) {
    if (!winners?.length) {
      return `<p class="muted historico-card__empty">Sorteio ainda sem ganhadores registrados.</p>`;
    }
    return `
      <div class="historico-winners">
        ${winners.map((w) => `
          <article class="historico-winner">
            <span class="historico-winner__place">${Number(w.place) || 1}º</span>
            <div class="historico-winner__body">
              <strong class="historico-winner__num">Nº ${UI.escapeHtml(String(w.number || '—'))}</strong>
              <span>${UI.escapeHtml(w.name || '—')}</span>
              <span class="muted">${w.phone && w.phone !== '—' ? UI.escapeHtml(UI.maskPhone(w.phone)) : '—'}${w.city && w.city !== '—' ? ` · ${UI.escapeHtml(w.city)}` : ''}</span>
            </div>
          </article>`).join('')}
      </div>`;
  }

  async function init() {
    const session = await Layout.render({
      active: 'historico',
      title: 'Histórico'
    });
    if (!session) return;

    let query = '';
    let drawing = false;
    let lastFingerprint = '';

    function fingerprint(list) {
      return (list || [])
        .map((r) => `${r.id}:${r.name}:${r.drawnAt || ''}:${(r.winners || []).map((w) => w.number).join(',')}`)
        .join('|');
    }

    async function draw({ silent = false } = {}) {
      if (drawing) return;
      drawing = true;
      if (!silent) UI.showLoading('Carregando histórico...');
      try {
        const listed = await searchRaffle(query, { status: 'encerrada' });
        const list = (listed || []).filter(
          (r) => (Array.isArray(r.winners) && r.winners.length > 0) || r.drawnAt
        );
        const nextFp = `${query}::${fingerprint(list)}`;
        if (silent && nextFp === lastFingerprint) return;
        lastFingerprint = nextFp;

        if (!silent) UI.hideLoading();
        Layout.setContent(`
          <div class="slide-up">
            <div class="detail-header">
              <div>
                <h1 class="page-title">Histórico</h1>
                <p class="page-subtitle">Rifas que já foram sorteadas, com o resultado do sorteio.</p>
              </div>
            </div>
            <div class="toolbar">
              <div class="search-box">
                <input id="historico-search" type="search" placeholder="Nome da rifa, prêmio ou data..." value="${UI.escapeHtml(query)}">
              </div>
            </div>
            <div class="historico-list">
              ${list.length ? list.map((r) => {
                const sold = soldCount(r);
                const drawnLabel = formatDrawnAt(r.drawnAt);
                return `
                  <article class="card historico-card">
                    <div class="historico-card__top">
                      <div>
                        <span class="historico-card__badge">Sorteada</span>
                        <h3>${UI.escapeHtml(r.name || 'Rifa')}</h3>
                        <p>${UI.escapeHtml(r.prize || '')}</p>
                      </div>
                      <div class="historico-card__meta">
                        <span>${UI.money(r.price)}</span>
                        <span>${UI.formatDateBR(r.drawDate)}</span>
                        <span>${sold}/${r.quantity} vendidos</span>
                        ${drawnLabel ? `<span>Sorteio: ${UI.escapeHtml(drawnLabel)}</span>` : ''}
                      </div>
                    </div>
                    ${winnersHTML(r.winners)}
                    <div class="historico-card__actions">
                      <a class="btn btn-primary btn-sm ripple" href="visualizar-rifa.html?id=${encodeURIComponent(r.id)}">Abrir rifa</a>
                    </div>
                  </article>`;
              }).join('') : `
                <div class="card empty-state">
                  <h3>Nenhuma rifa sorteada</h3>
                  <p>Quando você concluir um sorteio, o resultado aparece aqui.</p>
                </div>`}
            </div>
          </div>
        `);

        let timer;
        const searchEl = document.getElementById('historico-search');
        searchEl?.addEventListener('input', (e) => {
          query = e.target.value;
          clearTimeout(timer);
          timer = setTimeout(() => draw({ silent: false }), 350);
        });
        if (silent && searchEl && document.activeElement === searchEl) {
          const pos = searchEl.value.length;
          searchEl.focus();
          searchEl.setSelectionRange(pos, pos);
        }
      } catch (err) {
        if (!silent) UI.hideLoading();
        UI.toast(err?.message || 'Erro ao carregar o histórico.', 'error');
      } finally {
        drawing = false;
      }
    }

    await draw({ silent: false });
  }

  return { init };
})();

window.HistoricoPage = HistoricoPage;
