/**
 * Painel admin — confirmação manual de pagamentos com comprovante
 */
document.addEventListener('DOMContentLoaded', async () => {
  const session = await Layout.render({
    active: 'configuracoes',
    title: 'Pagamentos',
    showBottomNav: false,
    nivel: 'admin',
    skipPayment: true
  });
  if (!session) return;

  const isAdmin =
    typeof API !== 'undefined' && typeof API.hasMinAccessLevel === 'function'
      ? API.hasMinAccessLevel(session, 'admin')
      : typeof API !== 'undefined' && typeof API.isDeveloperAccount === 'function'
        ? API.isDeveloperAccount(session)
        : false;

  if (!isAdmin) {
    Layout.setContent(`
      <div class="slide-up" style="max-width:560px;">
        <h1 class="page-title">Acesso restrito</h1>
        <p class="page-subtitle">Esta área é exclusiva para administradores do sistema.</p>
        <a class="btn btn-primary ripple" href="dashboard.html">Voltar ao painel</a>
      </div>
    `);
    return;
  }

  Layout.setContent(`
    <div class="slide-up" style="max-width:920px;">
      <h1 class="page-title">Pagamentos pendentes</h1>
      <p class="page-subtitle">Verifique o comprovante enviado e aprove para liberar o recurso.</p>
      <div id="admin-pay-list" class="admin-pay-list">
        <p class="muted">Carregando…</p>
      </div>
    </div>
  `);

  const listEl = document.getElementById('admin-pay-list');

  function tipoLabel(tipo) {
    return API.normalizeTipoConta(tipo) === 'empresa' ? 'Empresa' : 'Pessoa física';
  }

  function formatCnpj(value) {
    return API.formatCnpjMask ? API.formatCnpjMask(value) : value;
  }

  function formatWhen(value) {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString('pt-BR');
    } catch {
      return String(value);
    }
  }

  function openProofModal(src, title) {
    UI.modal({
      title: title || 'Comprovante',
      dialogClass: 'modal-dialog--wide',
      body: `
        <div class="admin-pay-proof-modal">
          <img src="${UI.escapeHtml(src)}" alt="Comprovante de pagamento">
        </div>
      `,
      actions: [
        {
          label: 'Fechar',
          className: 'btn-ghost',
          onClick: (close) => close()
        }
      ]
    });
  }

  async function loadList() {
    UI.showLoading('Carregando…');
    try {
      const res = await API.listPendingPaymentReviews();
      UI.hideLoading();
      if (!res.ok) {
        listEl.innerHTML = `<p class="form-error">${UI.escapeHtml(res.error || 'Erro ao listar.')}</p>`;
        return;
      }

      const users = res.users || [];
      if (!users.length) {
        listEl.innerHTML = '<p class="muted">Nenhum pagamento aguardando revisão.</p>';
        return;
      }

      listEl.innerHTML = users
        .map((u) => {
          const hasProof = Boolean(u.hasComprovante || u.comprovanteEm || u.comprovantePagamento);
          return `
          <article class="admin-pay-card" data-user-id="${UI.escapeHtml(String(u.id))}">
            <div class="admin-pay-card__main">
              <strong>${UI.escapeHtml(u.name || '—')}</strong>
              <span>${UI.escapeHtml(u.email || '')}</span>
              <span class="pill">${UI.escapeHtml(tipoLabel(u.tipoConta))}</span>
              ${u.tipoConta === 'empresa' ? `
                <span class="muted">${UI.escapeHtml(u.razaoSocial || '')}</span>
                <span class="muted">CNPJ ${UI.escapeHtml(formatCnpj(u.cnpj || ''))}</span>
              ` : ''}
              <span class="muted">Plano: ${UI.escapeHtml(u.plano || '—')}</span>
              ${u.comprovanteEm ? `<span class="muted">Enviado: ${UI.escapeHtml(formatWhen(u.comprovanteEm))}</span>` : ''}
              ${hasProof ? `
                <button type="button" class="btn btn-outline btn-sm ripple" data-action="view-proof">
                  Ver comprovante
                </button>
                <div class="admin-pay-proof-thumb" hidden>
                  <img src="" alt="Miniatura do comprovante" loading="lazy">
                </div>
              ` : `
                <span class="pill pill--warn">Sem comprovante</span>
              `}
            </div>
            <button type="button" class="btn btn-success btn-sm ripple" data-action="confirm" ${hasProof ? '' : 'disabled title="Sem comprovante para verificar"'}>
              Aprovar pagamento
            </button>
          </article>`;
        })
        .join('');

      listEl.querySelectorAll('[data-action="view-proof"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const card = btn.closest('[data-user-id]');
          const userId = card?.getAttribute('data-user-id');
          if (!userId) return;
          UI.showLoading('Carregando comprovante…');
          try {
            const proof = await API.getPaymentProof(userId);
            UI.hideLoading();
            if (!proof.ok || !proof.url) {
              UI.toast(proof.error || 'Comprovante não encontrado.', 'error');
              return;
            }
            const thumb = card?.querySelector('.admin-pay-proof-thumb');
            const img = thumb?.querySelector('img');
            if (thumb && img) {
              img.src = proof.url;
              thumb.hidden = false;
            }
            const name = card?.querySelector('strong')?.textContent || 'Comprovante';
            openProofModal(proof.url, `Comprovante — ${name}`);
          } catch (err) {
            UI.hideLoading();
            UI.toast(err.message || 'Falha ao carregar comprovante.', 'error');
          }
        });
      });

      listEl.querySelectorAll('[data-action="confirm"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const card = btn.closest('[data-user-id]');
          const userId = card?.getAttribute('data-user-id');
          if (!userId || btn.disabled) return;

          const ok = window.confirm(
            'Confirmar que o comprovante é válido e liberar o pagamento deste usuário?'
          );
          if (!ok) return;

          UI.showLoading('Aprovando…');
          try {
            const result = await API.confirmUserPayment(userId);
            UI.hideLoading();
            if (!result.ok) {
              UI.toast(result.error || 'Falha ao confirmar.', 'error');
              return;
            }
            UI.toast('Pagamento aprovado e recurso liberado.', 'success');
            await loadList();
          } catch (err) {
            UI.hideLoading();
            UI.toast(err.message || 'Erro de conexão.', 'error');
          }
        });
      });
    } catch (err) {
      UI.hideLoading();
      listEl.innerHTML = `<p class="form-error">${UI.escapeHtml(err.message || 'Erro.')}</p>`;
    }
  }

  await loadList();
});
