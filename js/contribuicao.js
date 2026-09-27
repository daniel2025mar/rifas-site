/**
 * Contribuição voluntária via PIX — manutenção do sistema
 */
const Contribuicao = (() => {
  const PIX = {
    nome: 'Daniel Antonio Martins',
    banco: 'Nubank',
    chave: '34998217498'
  };

  function detailsHTML() {
    return `
      <div class="contribute-box">
        <p class="contribute-intro">
          Se o PowerApps Sistemas tem ajudado nas suas rifas, você pode contribuir
          voluntariamente para manter o sistema atualizado e estável com o banco de dados.
        </p>

        <div class="contribute-card">
          <div class="contribute-row">
            <span>Favorecido</span>
            <strong>${UI.escapeHtml(PIX.nome)}</strong>
          </div>
          <div class="contribute-row">
            <span>Banco</span>
            <strong>${UI.escapeHtml(PIX.banco)}</strong>
          </div>
          <div class="contribute-row contribute-row--key">
            <span>Chave PIX (telefone)</span>
            <strong id="pix-chave-display">${UI.escapeHtml(PIX.chave)}</strong>
          </div>
        </div>

        <p class="contribute-hint">
          No app do banco: PIX → Transferir → Chave. Qualquer valor ajuda — obrigado!
        </p>
      </div>`;
  }

  function open() {
    UI.modal({
      title: 'Apoiar o sistema',
      body: detailsHTML(),
      actions: [
        {
          label: 'Copiar chave PIX',
          className: 'btn-primary',
          onClick: async (c) => {
            try {
              if (window.API?.copyLink) await API.copyLink(PIX.chave);
              else await navigator.clipboard.writeText(PIX.chave);
              UI.toast('Chave PIX copiada! Cole no app do seu banco.', 'success');
            } catch (_) {
              UI.toast(`Chave PIX: ${PIX.chave}`, 'info', 5000);
            }
            c();
          }
        }
      ]
    });
  }

  function bind(root = document) {
    root.querySelectorAll('[data-action="contribuir"]').forEach((el) => {
      if (el.dataset.contribBound) return;
      el.dataset.contribBound = '1';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        open();
      });
    });
  }

  function menuItemHTML() {
    return `
      <a href="#" data-action="contribuir" data-nav="contribuir">
        <span class="nav-icon"><svg class="nav-icon__svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></span>Contribuir
      </a>`;
  }

  function cardHTML() {
    return `
      <div class="card contribute-banner">
        <div>
          <h3>Apoie o PowerApps Sistemas</h3>
          <p>
            Contribuição voluntária via PIX para manter atualizações,
            melhorias e o bom funcionamento com o banco de dados.
          </p>
        </div>
        <button type="button" class="btn btn-primary btn-sm ripple" data-action="contribuir">
          Ver dados do PIX
        </button>
      </div>`;
  }

  function markAfterLogin() {
    try {
      sessionStorage.setItem('pas_show_contribuicao', '1');
    } catch (_) { /* ignore */ }
  }

  function maybeOpenAfterLogin() {
    try {
      if (sessionStorage.getItem('pas_show_contribuicao') !== '1') return;
      // Avaliação pós-login tem prioridade
      if (sessionStorage.getItem('pas_show_rating') === '1') {
        setTimeout(maybeOpenAfterLogin, 700);
        return;
      }
      // Aguarda fechar qualquer modal (avaliação / banner)
      if (document.getElementById('app-modal')) {
        setTimeout(maybeOpenAfterLogin, 500);
        return;
      }
      // Banner abre antes da contribuição (inclui chave do Dia dos Pais)
      if (typeof SystemBanner !== 'undefined') {
        let bannerSeen = false;
        try {
          if (typeof SystemBanner.isSeen === 'function') {
            bannerSeen = SystemBanner.isSeen();
          } else {
            const seenKey = SystemBanner.SEEN_KEY || 'pas_promo_banner_seen_v4';
            bannerSeen = sessionStorage.getItem(seenKey) === '1'
              || sessionStorage.getItem('pas_promo_banner_seen_v3') === '1'
              || sessionStorage.getItem('pas_promo_banner_seen_v2') === '1'
              || sessionStorage.getItem('pas_promo_banner_seen') === '1';
          }
        } catch { /* ignore */ }
        if (!bannerSeen) {
          maybeOpenAfterLogin._bannerWait = (maybeOpenAfterLogin._bannerWait || 0) + 1;
          if (maybeOpenAfterLogin._bannerWait < 40) {
            setTimeout(maybeOpenAfterLogin, 700);
            return;
          }
        }
      }
      maybeOpenAfterLogin._bannerWait = 0;
      sessionStorage.removeItem('pas_show_contribuicao');
      setTimeout(() => {
        if (document.getElementById('app-modal')) {
          sessionStorage.setItem('pas_show_contribuicao', '1');
          maybeOpenAfterLogin();
          return;
        }
        open();
      }, 400);
    } catch (_) { /* ignore */ }
  }

  return { PIX, open, bind, menuItemHTML, cardHTML, detailsHTML, markAfterLogin, maybeOpenAfterLogin };
})();

window.Contribuicao = Contribuicao;
