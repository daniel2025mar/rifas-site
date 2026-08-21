/**
 * Reservas Pendentes — Supabase
 * Pessoa física sem pagamento: mesmo bloqueio da tela de Vendas.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const session = await Layout.render({ active: 'reservas', title: 'Reservas Pendentes' });
  if (!session) return;

  if (typeof API !== 'undefined' && API.isVendasLocked?.(session)) {
    Layout.setContent(
      typeof Layout.reservasLockedPageHTML === 'function'
        ? Layout.reservasLockedPageHTML()
        : '<p>Reservas Pendentes bloqueada. Conclua o pagamento para liberar.</p>'
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

  async function render() {
    UI.showLoading('Carregando reservas...');
    try {
      const items = await API.getPendingReservations();
      UI.hideLoading();

      Layout.setContent(`
        <div class="slide-up">
          <h1 class="page-title">Reservas Pendentes</h1>
          <p class="page-subtitle">Confirme vendas ou cancele reservas aguardando pagamento.</p>

          ${items.length ? `
            <div class="table-wrap" style="margin-top:1.25rem;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Rifa</th>
                    <th>Número</th>
                    <th>Nome</th>
                    <th>Telefone</th>
                    <th>Cidade</th>
                    <th>Data</th>
                    <th>Hora</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map((item) => `
                    <tr>
                      <td>${UI.escapeHtml(item.raffleName)}</td>
                      <td><strong>${UI.escapeHtml(item.number)}</strong></td>
                      <td>${UI.escapeHtml(item.buyerName || '—')}</td>
                      <td>${UI.escapeHtml(item.buyerPhone || '—')}</td>
                      <td>${UI.escapeHtml(item.buyerCity || '—')}</td>
                      <td>${UI.escapeHtml(item.date || '—')}</td>
                      <td>${UI.escapeHtml(item.time || '—')}</td>
                      <td class="actions">
                        <button class="btn btn-success btn-sm ripple" type="button"
                          data-confirm="${item.raffleId}:${item.number}">Confirmar Venda</button>
                        <button class="btn btn-outline btn-sm ripple" type="button"
                          data-cancel="${item.raffleId}:${item.number}">Cancelar Reserva</button>
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>

            <div class="raffles-grid" style="margin-top:1rem;">
              ${items.map((item) => `
                <article class="card raffle-card" style="display:none;" data-mobile-card>
                  <h3>Nº ${UI.escapeHtml(item.number)} · ${UI.escapeHtml(item.raffleName)}</h3>
                  <p>${UI.escapeHtml(item.buyerName || '')} · ${UI.escapeHtml(item.buyerPhone || '')}</p>
                  <div class="raffle-card__meta">
                    <span>${UI.escapeHtml(item.buyerCity || '—')}</span>
                    <span>${UI.escapeHtml(item.date || '')} ${UI.escapeHtml(item.time || '')}</span>
                  </div>
                  <div class="raffle-card__actions">
                    <button class="btn btn-success btn-sm ripple" type="button"
                      data-confirm="${item.raffleId}:${item.number}">Confirmar Venda</button>
                    <button class="btn btn-outline btn-sm ripple" type="button"
                      data-cancel="${item.raffleId}:${item.number}">Cancelar Reserva</button>
                  </div>
                </article>`).join('')}
            </div>
          ` : `
            <div class="card empty-state" style="margin-top:1.25rem;">
              <h3>Nenhuma reserva pendente</h3>
              <p>Quando compradores reservarem números, eles aparecerão aqui.</p>
            </div>`}
        </div>
      `);

      const mq = window.matchMedia('(max-width: 767px)');
      document.querySelectorAll('[data-mobile-card]').forEach((el) => {
        el.style.display = mq.matches ? 'flex' : 'none';
      });
      const table = document.querySelector('.table-wrap');
      if (table) table.style.display = mq.matches ? 'none' : 'block';

      document.querySelectorAll('[data-confirm]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const [raffleId, number] = btn.getAttribute('data-confirm').split(':');
          UI.showLoading('Confirmando venda...');
          const result = await sellNumber(raffleId, number);
          UI.hideLoading();
          if (!result.ok) {
            UI.toast(result.error, 'error');
            return;
          }
          UI.toast(`Número ${number} confirmado como vendido.`, 'success');
          await render();
        });
      });

      document.querySelectorAll('[data-cancel]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const [raffleId, number] = btn.getAttribute('data-cancel').split(':');
          UI.showLoading('Cancelando...');
          const result = await cancelReservation(raffleId, number);
          UI.hideLoading();
          if (!result.ok) {
            UI.toast(result.error, 'error');
            return;
          }
          UI.toast(`Reserva do número ${number} cancelada.`, 'success');
          await render();
        });
      });
    } catch (err) {
      UI.hideLoading();
      UI.toast(err.message || 'Erro ao carregar reservas.', 'error');
    }
  }

  render();
});
