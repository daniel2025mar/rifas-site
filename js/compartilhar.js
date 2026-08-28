/**
 * Compartilhar / Tela do comprador — Supabase
 */
const CompartilharPage = (() => {
  let buyerCountdownTimer = null;

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const shareMode = params.get('share') === '1';
    const session = Store.getSession();

    if (!id) {
      document.body.innerHTML = `
        <div class="landing">
          <main class="landing-main">
            <div class="card empty-state" style="max-width:480px;">
              <img class="logo-badge logo-badge--sm" src="assets/logo.png" alt="" width="44" height="44" style="margin:0 auto 1rem;display:block;background:#e11d2e;padding:6px;border-radius:12px;object-fit:contain;">
              <h3>Rifa não encontrada</h3>
              <p>Informe um id válido no link.</p>
              <a class="btn btn-primary ripple" href="index.html" style="margin-top:1rem;">Ir para o login</a>
            </div>
          </main>
        </div>`;
      return;
    }

    UI.showLoading('Carregando rifa...');
    try {
      const result = await API.getRaffle(id);
      UI.hideLoading();
      if (!result.ok) {
        document.body.innerHTML = `
          <div class="landing">
            <main class="landing-main">
              <div class="card empty-state" style="max-width:480px;">
                <h3>Rifa não encontrada</h3>
                <p>${UI.escapeHtml(result.error)}</p>
                <a class="btn btn-primary ripple" href="index.html" style="margin-top:1rem;">Ir para o login</a>
              </div>
            </main>
          </div>`;
        return;
      }

      const raffle = result.raffle;
      const sessionOwns =
        shareMode &&
        session &&
        raffle.ownerId != null &&
        String(session.userId) === String(raffle.ownerId);
      if (sessionOwns) {
        await renderShareAdmin(raffle);
        return;
      }
      await renderBuyer(raffle);
    } catch (err) {
      UI.hideLoading();
      UI.toast(err.message || 'Erro ao carregar.', 'error');
    }
  }

  async function renderShareAdmin(raffle) {
    const session = await Layout.render({
      active: 'compartilhamentos',
      title: 'Compartilhar',
      showBottomNav: false
    });
    if (!session) return;

    const share = shareRaffle(raffle.id);
    const realLink = share.link;
    const displayLink = share.displayLink;
    const purpose = (typeof API !== 'undefined' && API.purposeMeta)
      ? API.purposeMeta(raffle.purpose)
      : { key: 'beneficente', label: 'Beneficente' };
    const typeLabel = purpose.key === 'empresarial'
      ? 'Rifa empresarial'
      : (purpose.key === 'outros' ? purpose.label : 'Rifa beneficente');

    Layout.setContent(`
      <div class="slide-up" style="max-width:640px;">
        <h1 class="page-title">Compartilhar Rifa</h1>
        <p class="page-subtitle">
          <span class="pill pill--purpose pill--purpose-${UI.escapeHtml(purpose.key)}">${UI.escapeHtml(typeLabel)}</span>
          ${UI.escapeHtml(raffle.name)} · #${raffle.id}
        </p>

        <div class="card" style="margin-top:1.25rem;">
          <p style="font-weight:600;margin-bottom:.5rem;">Link fictício</p>
          <div class="share-box" id="display-link">${UI.escapeHtml(displayLink)}</div>
          <p style="font-weight:600;margin:1rem 0 .5rem;">Link funcional</p>
          <div class="share-box" id="real-link">${UI.escapeHtml(realLink)}</div>

          <div class="share-actions" style="margin-top:1.25rem;">
            <button class="btn btn-primary ripple" type="button" id="btn-copy">Copiar Link</button>
            <button class="btn btn-success ripple" type="button" id="btn-wa">Compartilhar WhatsApp</button>
            <button class="btn btn-secondary ripple" type="button" id="btn-tg">Compartilhar Telegram</button>
            <button class="btn btn-facebook ripple" type="button" id="btn-fb">Compartilhar Facebook</button>
          </div>

          <div style="margin-top:1.25rem;display:flex;gap:.5rem;flex-wrap:wrap;">
            <a class="btn btn-ghost ripple" href="visualizar-rifa.html?id=${raffle.id}">Voltar à rifa</a>
            <a class="btn btn-outline ripple" href="${realLink}" target="_blank" rel="noopener">Abrir visão do comprador</a>
          </div>
        </div>
      </div>
    `);

    document.getElementById('btn-copy')?.addEventListener('click', async () => {
      await copyLink(realLink);
      UI.toast('Link copiado!', 'success');
    });
    document.getElementById('btn-wa')?.addEventListener('click', () => shareWhatsApp(realLink, raffle.name));
    document.getElementById('btn-tg')?.addEventListener('click', () => shareTelegram(realLink, raffle.name));
    document.getElementById('btn-fb')?.addEventListener('click', () => shareFacebook(realLink));
  }

  async function renderBuyer(raffle) {
    if (typeof Theme !== 'undefined') Theme.followSystem();
    else document.documentElement.setAttribute('data-theme', 'light');

    const savedPhone = normalizePhone(loadBuyerReserve(raffle.id)?.phone || '');
    if (savedPhone && typeof API.lookupBuyerSlots === 'function') {
      try {
        const mine = await API.lookupBuyerSlots(raffle.id, savedPhone);
        if (mine.ok && mine.slots?.length) {
          const byNum = new Map(mine.slots.map((s) => [String(Number(s.number)), s]));
          raffle.numbers = (raffle.numbers || []).map((n) => {
            const hit = byNum.get(String(Number(n.number)));
            return hit ? { ...n, ...hit } : n;
          });
        }
      } catch { /* ignore */ }
    }

    const isCorporate = raffle.purpose === 'empresarial';
    const showPrice = !isCorporate || Number(raffle.price) > 0;
    const selected = new Set();
    const share = shareRaffle(raffle.id);
    const publicLink = share.link;
    const heroStyle = raffle.image
      ? `background-image:url('${UI.escapeHtml(raffle.image)}')`
      : '';
    const myPhoneDigits = normalizePhone(loadBuyerReserve(raffle.id)?.phone || '');
    const selectionClosed = isBuyerSelectionClosed(raffle);
    const drawLabel = [
      UI.formatDateBR(raffle.drawDate),
      formatDrawTime(raffle.drawTime) ? `às ${formatDrawTime(raffle.drawTime)}` : ''
    ].filter(Boolean).join(' ');
    const closedMessage = selectionClosed
      ? (isCorporate
        ? `Não é possível participar nesta campanha. O prazo foi encerrado em ${drawLabel || 'data/hora do sorteio'}. Agradecemos o seu interesse e compreensão.`
        : `Não é possível reservar números nesta rifa. O prazo para participação foi encerrado em ${drawLabel || 'data/hora do sorteio'}. Agradecemos o seu interesse e compreensão.`)
      : '';

    document.body.className = '';
    document.body.innerHTML = `
      <div class="public-page public-page--buyer${isCorporate ? ' public-page--empresarial' : ' public-page--beneficente'}">
        <header class="app-header public-header${isCorporate ? ' public-header--corp' : ''}">
          <div class="header-left">
            <span class="logo-badge logo-badge--sm">
              <img src="assets/logo.png" alt="PowerApps" width="28" height="28">
            </span>
            <strong>POWERAPPS</strong>
          </div>
          <div class="header-right">
            <span class="badge${isCorporate ? ' badge--corp' : ''}">
              ${isCorporate
                ? '<span class="badge__full">Sorteio empresarial</span><span class="badge__short">Empresarial</span>'
                : 'Rifa Pública'}
            </span>
            <button type="button"
              class="buyer-mine-icon"
              id="buyer-mine-open"
              title="Meus números"
              aria-label="Ver meus números">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
                <path d="M9 12h6M9 16h4"/>
              </svg>
            </button>
          </div>
        </header>

        <main class="content public-content public-buyer">
          <div class="buyer-countdown ${selectionClosed ? 'is-ended' : ''}" id="buyer-countdown" hidden>
            <span class="buyer-countdown__label" id="buyer-countdown-label">${selectionClosed ? 'Sorteio' : 'Falta para o sorteio'}</span>
            <strong class="buyer-countdown__time" id="buyer-countdown-time" aria-live="polite">00:00:00</strong>
          </div>

          ${isCorporate ? `
          <section class="buyer-hero buyer-hero--corp slide-up">
            <div class="buyer-hero__media-wrap">
              <button type="button" class="buyer-hero__media ${raffle.image ? '' : 'is-empty'}" id="buyer-hero-photo" style="${heroStyle}" aria-label="Ampliar imagem da campanha">
                ${raffle.image ? '<span class="buyer-hero__zoom">Ampliar</span>' : '<span class="buyer-hero__placeholder">Sem imagem da campanha</span>'}
              </button>
              ${raffle.image ? '<p class="buyer-hero__caption">Imagem da campanha</p>' : ''}
            </div>
            <div class="buyer-hero__copy">
              <p class="buyer-hero__brand">Sorteio empresarial · #${UI.escapeHtml(String(raffle.id))}</p>
              <h1 class="buyer-hero__prize">${UI.escapeHtml(raffle.name)}</h1>
              ${raffle.segment ? `<p class="buyer-hero__segment">Para: ${UI.escapeHtml(raffle.segment)}</p>` : ''}
              <div class="buyer-hero__corp-prize">
                <span class="buyer-hero__tag">Brinde</span>
                <strong>${UI.escapeHtml(raffle.prize || 'Brinde da campanha')}</strong>
              </div>
              ${showPrice ? `
              <div class="buyer-hero__price">
                <strong>${UI.money(raffle.price)}</strong>
                <span>por numero</span>
              </div>` : `
              <p class="buyer-hero__free">Participação sem pagamento nesta página</p>`}
            </div>
          </section>` : `
          <section class="buyer-hero slide-up">
            <div class="buyer-hero__media-wrap">
              <button type="button" class="buyer-hero__media ${raffle.image ? '' : 'is-empty'}" id="buyer-hero-photo" style="${heroStyle}" aria-label="Ampliar foto do prêmio">
                ${raffle.image ? '<span class="buyer-hero__zoom">Ampliar</span>' : '<span class="buyer-hero__placeholder">Sem foto do prêmio</span>'}
              </button>
              ${raffle.benefitImage ? `
                <button type="button" class="buyer-hero__avatar" id="buyer-benefit-avatar" aria-label="Ampliar foto de quem precisa da rifa" title="Quem precisa da rifa">
                  <img src="${UI.escapeHtml(raffle.benefitImage)}" alt="Quem precisa da rifa">
                </button>` : ''}
              ${raffle.image ? '<p class="buyer-hero__caption">Foto ilustrativa</p>' : ''}
            </div>
            <div class="buyer-hero__copy">
              <p class="buyer-hero__brand">${UI.escapeHtml((typeof API !== 'undefined' && API.purposeMeta ? API.purposeMeta(raffle.purpose).badge : 'RIFA'))} · #${UI.escapeHtml(String(raffle.id))}</p>
              <span class="buyer-hero__tag">Premio</span>
              <h1 class="buyer-hero__prize">${UI.escapeHtml(raffle.prize || raffle.name)}</h1>
              <p class="buyer-hero__name">${UI.escapeHtml(raffle.name)}</p>
              <div class="buyer-hero__price">
                <strong>${UI.money(raffle.price)}</strong>
                <span>por numero</span>
              </div>
            </div>
          </section>`}

          ${(raffle.winners && raffle.winners.length) ? `
          <button type="button" class="buyer-result-cta slide-up" id="buyer-open-winners">
            <span class="buyer-result-cta__badge">PowerApps</span>
            <strong>Resultado do sorteio</strong>
            <span>Toque para ver o${raffle.winners.length > 1 ? 's' : ''} ganhador${raffle.winners.length > 1 ? 'es' : ''}</span>
          </button>` : ''}

          <section class="buyer-info${isCorporate ? ' buyer-info--corp' : ''}">
            ${isCorporate ? '<h2 class="buyer-info__title">Dados da campanha</h2>' : ''}
            <div class="buyer-info__grid">
              <div class="buyer-info__item">
                <span class="buyer-info__label">Data</span>
                <strong>${UI.formatDateBR(raffle.drawDate)}</strong>
              </div>
              <div class="buyer-info__item">
                <span class="buyer-info__label">Horário</span>
                <strong>${UI.escapeHtml(formatDrawTime(raffle.drawTime) || '—')}</strong>
              </div>
              <div class="buyer-info__item">
                <span class="buyer-info__label">Números</span>
                <strong>${raffle.quantity}</strong>
              </div>
              <div class="buyer-info__item">
                <span class="buyer-info__label">${isCorporate ? 'Público' : 'Realização'}</span>
                <strong>${isCorporate ? UI.escapeHtml(raffle.segment || 'Geral') : 'PowerApps'}</strong>
              </div>
            </div>
          </section>

          ${raffle.description ? `
            <section class="buyer-story${isCorporate ? ' buyer-story--corp' : ''}">
              <h2>${isCorporate ? 'Sobre a campanha' : 'Sobre a rifa'}</h2>
              <p class="buyer-story__text" id="buyer-story-text">${UI.escapeHtml(raffle.description)}</p>
              <button type="button" class="buyer-story__more" id="buyer-story-more" hidden>Ver mais</button>
            </section>` : ''}

          <section class="buyer-pick${isCorporate ? ' buyer-pick--corp' : ''}">
            <div class="buyer-pick__head">
              <h2>${isCorporate ? 'Escolha e participe' : 'Escolha seus números'}</h2>
              <p>${selectionClosed
                ? (isCorporate
                  ? 'A participação foi encerrada após o horário do sorteio.'
                  : 'As reservas foram encerradas após o horário do sorteio.')
                : (isCorporate
                  ? 'Toque nos números livres e confirme com Participar. Seus números ficam no ícone ao lado de Sorteio empresarial.'
                  : 'Toque para selecionar e reserve em seguida. Seus números ficam no ícone ao lado de Rifa Pública.')}</p>
            </div>
            ${selectionClosed ? `
              <div class="buyer-closed" role="alert">
                <strong>Participação encerrada</strong>
                <p>${UI.escapeHtml(closedMessage)}</p>
              </div>` : ''}
            <div class="buyer-legend">
              <span><i class="buyer-dot buyer-dot--available"></i> Livre</span>
              <span><i class="buyer-dot buyer-dot--selected"></i> Seu</span>
              <span><i class="buyer-dot buyer-dot--reserved"></i>${isCorporate ? 'Participando' : 'Reservado'}</span>
              <span><i class="buyer-dot buyer-dot--sold"></i>${isCorporate ? 'Confirmado' : 'Vendido'}</span>
            </div>
            <div class="buyer-grid ${selectionClosed ? 'buyer-grid--closed' : ''}" id="public-numbers">
              ${raffle.numbers.map((n) => buyerNumberHTML(n, myPhoneDigits, selectionClosed)).join('')}
            </div>
          </section>

          ${selectionClosed ? `
            <section class="buyer-cart buyer-cart--closed${isCorporate ? ' buyer-cart--corp' : ''}" id="buyer-cart" aria-live="polite">
              <div class="buyer-cart__summary">
                <div class="buyer-cart__nums">
                  <span class="buyer-cart__label">Status</span>
                  <strong>${isCorporate ? 'Participação encerrada' : 'Reservas encerradas'}</strong>
                </div>
              </div>
              <button type="button" class="btn btn-primary buyer-cart__cta" id="buyer-reserve-btn" disabled>
                Indisponível
                <small>Horário do sorteio ultrapassado</small>
              </button>
            </section>` : `
            <section class="buyer-cart${isCorporate ? ' buyer-cart--corp' : ''}" id="buyer-cart" aria-live="polite">
              <div class="buyer-cart__summary">
                <div class="buyer-cart__nums">
                  <span class="buyer-cart__label">Escolhidos</span>
                  <strong id="buyer-selected-list">Nenhum</strong>
                </div>
                ${showPrice ? `
                <div class="buyer-cart__total">
                  <span class="buyer-cart__label">Total</span>
                  <strong id="buyer-total">${UI.money(0)}</strong>
                </div>` : `
                <div class="buyer-cart__total">
                  <span class="buyer-cart__label">Quantidade</span>
                  <strong id="buyer-total">0</strong>
                </div>`}
              </div>
              <button type="button" class="btn btn-primary buyer-cart__cta" id="buyer-reserve-btn" disabled>
                ${isCorporate ? 'Participar' : 'Reservar agora'}
                <small>${isCorporate ? 'Confirmar números' : 'Finalizar participação'}</small>
              </button>
            </section>`}

          <section class="buyer-share${isCorporate ? ' buyer-share--corp' : ''}">
            <h3>${isCorporate ? 'Convide colegas e clientes' : 'Compartilhe esta rifa'}</h3>
            <p>${isCorporate
              ? 'Envie o link da campanha e aumente a participação.'
              : 'Ajude a divulgar e aumente as chances da causa!'}</p>
            <div class="buyer-share__actions">
              <button type="button" class="btn btn-success" id="buyer-share-wa">WhatsApp</button>
              <button type="button" class="btn btn-facebook" id="buyer-share-fb">Facebook</button>
              <button type="button" class="btn btn-outline" id="buyer-share-copy">Copiar link</button>
            </div>
          </section>

          <section class="buyer-trust${isCorporate ? ' buyer-trust--corp' : ''}">
            ${isCorporate ? `
            <article>
              <span class="buyer-trust__step">01</span>
              <strong>Escolha os números</strong>
              <p>Selecione quantos quiser entre os livres.</p>
            </article>
            <article>
              <span class="buyer-trust__step">02</span>
              <strong>Confirme a participação</strong>
              <p>Informe nome e telefone para registrar seus números.</p>
            </article>
            <article>
              <span class="buyer-trust__step">03</span>
              <strong>Aguarde o sorteio</strong>
              <p>O resultado fica disponível aqui após a realização.</p>
            </article>` : `
            <article>
              <strong>Reserva segura</strong>
              <p>Seus dados ficam protegidos e usados só para a rifa.</p>
            </article>
            <article>
              <strong>Sorteio transparente</strong>
              <p>${(raffle.winners && raffle.winners.length)
                ? 'O resultado do sorteio está disponível no modal PowerApps para todos.'
                : 'O sorteio é feito no painel com números já confirmados.'}</p>
            </article>
            <article>
              <strong>Sua ajuda faz diferença</strong>
              <p>Participe e contribua com esta causa beneficente.</p>
            </article>`}
          </section>
        </main>

        <footer class="public-footer">
          <div class="public-footer__inner">
            <div class="public-footer__brand">
              <div class="public-footer__brand-text">
                <strong>PowerApps Sistemas</strong>
                <span>Softwares e apps completos e organizados</span>
              </div>
            </div>
            <div class="public-footer__actions">
              <button type="button" class="public-footer__link" id="btn-quem-somos">Quem somos</button>
              <button type="button" class="public-footer__mail" id="btn-sugestoes"
                title="Enviar sugestões ou reclamações">
                <span class="public-footer__mail-label">Sugestões e reclamações</span>
                <span class="public-footer__mail-value">Fale conosco</span>
              </button>
            </div>
          </div>
        </footer>
      </div>
    `;

    function syncCart() {
      const list = [...selected].sort();
      const listEl = document.getElementById('buyer-selected-list');
      const totalEl = document.getElementById('buyer-total');
      const btn = document.getElementById('buyer-reserve-btn');
      if (listEl) listEl.textContent = list.length ? list.join(', ') : 'Nenhum';
      if (totalEl) {
        totalEl.textContent = showPrice
          ? UI.money(list.length * Number(raffle.price || 0))
          : String(list.length);
      }
      if (btn) btn.disabled = list.length === 0;
    }

    async function getMySlots(phoneHint) {
      const phone = normalizePhone(phoneHint || loadBuyerReserve(raffle.id)?.phone || '');
      if (!phone) return { phone: '', slots: [], saved: null };
      let slots = [];
      if (typeof API.lookupBuyerSlots === 'function') {
        const res = await API.lookupBuyerSlots(raffle.id, phone);
        if (res.ok) slots = res.slots || [];
      } else {
        slots = (raffle.numbers || []).filter((n) => {
          const st = n.status === 'reservado' || n.status === 'vendido';
          return st && normalizePhone(n.buyerPhone) === phone;
        });
      }
      return { phone, slots, saved: loadBuyerReserve(raffle.id) };
    }

    async function openMineFlow() {
      const mine = await getMySlots();
      if (mine.slots.length) {
        openMyNumbersModal(raffle, mine.slots, mine.saved);
        return;
      }
      openLookupModal(raffle, async (phone) => {
        const digits = normalizePhone(phone);
        let slots = [];
        if (typeof API.lookupBuyerSlots === 'function') {
          const res = await API.lookupBuyerSlots(raffle.id, digits);
          if (!res.ok) {
            UI.toast(res.error || 'Não foi possível consultar.', 'error');
            return;
          }
          slots = res.slots || [];
        } else {
          slots = (raffle.numbers || []).filter((n) => {
            const st = n.status === 'reservado' || n.status === 'vendido';
            return st && normalizePhone(n.buyerPhone) === digits;
          });
        }
        if (!slots.length) {
          UI.toast(isCorporate
            ? 'Nenhuma participação encontrada com este telefone.'
            : 'Nenhuma reserva encontrada com este telefone.', 'info');
          return;
        }
        const buyer = {
          name: slots[0].buyerName || '',
          phone: slots[0].buyerPhone || phone,
          numbers: slots.map((s) => s.number)
        };
        saveBuyerReserve(raffle.id, buyer);
        // Mescla slots do comprador na rifa pública (sem PII de terceiros)
        const byNum = new Map(slots.map((s) => [String(Number(s.number)), s]));
        raffle.numbers = (raffle.numbers || []).map((n) => {
          const hit = byNum.get(String(Number(n.number)));
          return hit ? { ...n, ...hit } : n;
        });
        renderBuyer(raffle);
        setTimeout(() => openMyNumbersModal(raffle, slots, buyer), 120);
        UI.toast(isCorporate ? 'Participação encontrada!' : 'Reserva encontrada!', 'success');
      });
    }

    document.querySelectorAll('#public-numbers .buyer-num').forEach((btn) => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-number');
        const status = btn.getAttribute('data-status');
        const slot = (raffle.numbers || []).find((n) => String(n.number) === String(num));

        if (status === 'disponivel') {
          if (selectionClosed) {
            notifyBuyerSelectionClosed(raffle, closedMessage);
            return;
          }
          if (selected.has(num)) {
            selected.delete(num);
            btn.classList.remove('is-selected');
          } else {
            selected.add(num);
            btn.classList.add('is-selected');
          }
          syncCart();
          return;
        }

        if ((status === 'reservado' || status === 'vendido') && slot) {
          const isMine = myPhoneDigits && normalizePhone(slot.buyerPhone) === myPhoneDigits;
          openNumberDetailModal(raffle, slot, isMine);
        }
      });
    });

    document.getElementById('buyer-reserve-btn')?.addEventListener('click', () => {
      if (selectionClosed) {
        notifyBuyerSelectionClosed(raffle, closedMessage);
        return;
      }
      const nums = [...selected].sort();
      if (!nums.length) return;
      openReserveModal(raffle, nums);
    });

    document.getElementById('buyer-mine-open')?.addEventListener('click', openMineFlow);

    document.getElementById('buyer-share-wa')?.addEventListener('click', () => {
      shareWhatsApp(publicLink, raffle.name);
    });
    document.getElementById('buyer-share-fb')?.addEventListener('click', () => {
      shareFacebook(publicLink);
    });
    document.getElementById('buyer-share-copy')?.addEventListener('click', async () => {
      await copyLink(publicLink);
      UI.toast('Link copiado!', 'success');
    });

    document.getElementById('buyer-hero-photo')?.addEventListener('click', () => {
      if (!raffle.image) return;
      openImageModal(raffle.image, isCorporate ? 'Imagem da campanha' : 'Foto do prêmio');
    });
    const openBenefitPhoto = () => {
      if (!raffle.benefitImage) return;
      openImageModal(raffle.benefitImage, 'Quem precisa da rifa');
    };
    document.getElementById('buyer-benefit-avatar')?.addEventListener('click', openBenefitPhoto);

    const storyText = document.getElementById('buyer-story-text');
    const storyMore = document.getElementById('buyer-story-more');
    if (storyText && storyMore) {
      requestAnimationFrame(() => {
        const longText = (storyText.textContent || '').trim().length > 160;
        const clipped = storyText.scrollHeight > storyText.clientHeight + 2;
        if (longText || clipped) {
          storyMore.hidden = false;
          storyMore.addEventListener('click', () => {
            const open = storyText.classList.toggle('is-expanded');
            storyMore.textContent = open ? 'Ver menos' : 'Ver mais';
          });
        }
      });
    }

    document.getElementById('btn-quem-somos')?.addEventListener('click', openQuemSomosModal);
    document.getElementById('btn-sugestoes')?.addEventListener('click', () => {
      UI.openFeedbackMailModal({
        context: `Rifa #${raffle.id} — ${raffle.name || ''}`
      });
    });
    document.getElementById('buyer-open-winners')?.addEventListener('click', () => {
      openWinnersModal(raffle);
    });
    UI.bindRipple();
    syncCart();
    startBuyerCountdown(raffle);

    if (raffle.winners && raffle.winners.length) {
      setTimeout(() => openWinnersModal(raffle), 280);
    }
  }

  function openWinnersModal(raffle) {
    const winners = Array.isArray(raffle?.winners) ? raffle.winners : [];
    if (!winners.length) return;

    const body = document.createElement('div');
    body.className = 'winner-modal';
    body.innerHTML = `
      <div class="winner-modal__hero">
        <span class="winner-modal__badge">PowerApps</span>
        <h4>Resultado do sorteio</h4>
        <p>${UI.escapeHtml(raffle.name || 'Rifa')}</p>
      </div>
      <div class="winner-modal__list">
        ${winners.map((w) => `
          <article class="winner-modal__card">
            <span class="winner-modal__place">${Number(w.place) || 1}º lugar</span>
            <strong class="winner-modal__num">${UI.escapeHtml(String(w.number || '—'))}</strong>
            <div class="winner-modal__row"><span>Nome</span><strong>${UI.escapeHtml(w.name || '—')}</strong></div>
            <div class="winner-modal__row"><span>Telefone</span><strong>${w.phone && w.phone !== '—' ? UI.escapeHtml(UI.maskPhone(w.phone)) : '—'}</strong></div>
            <div class="winner-modal__row"><span>Cidade</span><strong>${UI.escapeHtml(w.city || '—')}</strong></div>
          </article>`).join('')}
      </div>
    `;

    UI.modal({
      title: 'PowerApps Sistemas',
      dialogClass: 'modal-dialog--winner',
      body
    });
  }

  function normalizePhone(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function buyerReserveKey(raffleId) {
    return `pas_buyer_reserve_${raffleId}`;
  }

  function loadBuyerReserve(raffleId) {
    try {
      const raw = localStorage.getItem(buyerReserveKey(raffleId));
      const data = raw ? JSON.parse(raw) : null;
      if (!data || !data.phone) return null;
      return data;
    } catch {
      return null;
    }
  }

  function saveBuyerReserve(raffleId, buyer) {
    try {
      localStorage.setItem(buyerReserveKey(raffleId), JSON.stringify({
        name: buyer.name || '',
        phone: buyer.phone || '',
        numbers: Array.isArray(buyer.numbers) ? buyer.numbers : [],
        savedAt: new Date().toISOString()
      }));
    } catch { /* ignore */ }
  }

  function openMyNumbersModal(raffle, slots, saved) {
    const isCorporate = raffle.purpose === 'empresarial';
    const showPrice = !isCorporate || Number(raffle.price) > 0;
    const name = saved?.name || slots[0]?.buyerName || '—';
    const phone = saved?.phone || slots[0]?.buyerPhone || '—';
    const reserved = slots.filter((s) => s.status === 'reservado').sort((a, b) => String(a.number).localeCompare(String(b.number), 'pt-BR', { numeric: true }));
    const sold = slots.filter((s) => s.status === 'vendido').sort((a, b) => String(a.number).localeCompare(String(b.number), 'pt-BR', { numeric: true }));
    const total = slots.length * Number(raffle.price || 0);

    const groupHTML = (title, items, boxClass) => {
      if (!items.length) return '';
      return `
        <div class="buyer-mine-modal__group">
          <h4>${UI.escapeHtml(title)} <span>(${items.length})</span></h4>
          <ul class="buyer-mine-modal__list">
            ${items.map((s) => {
              const meta = UI.statusMeta(s.status);
              const label = isCorporate
                ? (s.status === 'reservado' ? 'Participando' : (s.status === 'vendido' ? 'Confirmado' : meta.label))
                : meta.label;
              return `
                <li>
                  <button type="button" class="buyer-mine-modal__item ${boxClass}" data-mine-number="${UI.escapeHtml(s.number)}">
                    <span class="buyer-mine-modal__num">Nº ${UI.escapeHtml(s.number)}</span>
                    <span class="pill ${meta.className}">${UI.escapeHtml(label)}</span>
                  </button>
                </li>`;
            }).join('')}
          </ul>
        </div>`;
    };

    const body = document.createElement('div');
    body.className = 'buyer-mine-modal';
    body.innerHTML = `
      <div class="buyer-mine-modal__summary">
        <div class="buyer-mine-modal__row"><span>Nome</span><strong>${UI.escapeHtml(name)}</strong></div>
        <div class="buyer-mine-modal__row"><span>Telefone</span><strong>${UI.escapeHtml(phone)}</strong></div>
        ${showPrice
          ? `<div class="buyer-mine-modal__row"><span>Total</span><strong>${UI.money(total)}</strong></div>`
          : `<div class="buyer-mine-modal__row"><span>Quantidade</span><strong>${slots.length}</strong></div>`}
      </div>
      ${groupHTML(isCorporate ? 'Participando' : 'Reservados', reserved, 'is-reserved')}
      ${groupHTML(isCorporate ? 'Confirmados' : 'Comprados', sold, 'is-sold')}
      ${!reserved.length && !sold.length ? '<p class="buyer-mine__empty">Nenhum número encontrado.</p>' : ''}
    `;

    UI.modal({
      title: 'Meus números',
      body,
      actions: [{ label: 'Fechar', className: 'btn-primary', onClick: (c) => c() }]
    });

    body.querySelectorAll('[data-mine-number]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-mine-number');
        const slot = slots.find((s) => String(s.number) === String(num));
        if (slot) openNumberDetailModal(raffle, slot, true);
      });
    });
  }

  function openNumberDetailModal(raffle, slot, isMine) {
    const isCorporate = raffle.purpose === 'empresarial';
    const showPrice = !isCorporate || Number(raffle.price) > 0;
    const meta = UI.statusMeta(slot.status);
    const statusLabel = isCorporate
      ? (slot.status === 'reservado' ? 'Participando' : (slot.status === 'vendido' ? 'Confirmado' : meta.label))
      : meta.label;
    const body = isMine
      ? `
        <div class="detail-box detail-box--reserved">
          <p><strong>Número:</strong> ${UI.escapeHtml(slot.number)}</p>
          <p><strong>Status:</strong> ${UI.escapeHtml(statusLabel)}</p>
          <p><strong>Nome:</strong> ${UI.escapeHtml(slot.buyerName || '—')}</p>
          <p><strong>Telefone:</strong> ${UI.escapeHtml(slot.buyerPhone || '—')}</p>
          <p><strong>Cidade:</strong> ${UI.escapeHtml(slot.buyerCity || '—')}</p>
          ${slot.observation ? `<p><strong>Observação:</strong> ${UI.escapeHtml(slot.observation)}</p>` : ''}
          <p><strong>Data:</strong> ${UI.escapeHtml(slot.date || '—')} ${UI.escapeHtml(slot.time || '')}</p>
          <p style="margin-top:.75rem;"><strong>${isCorporate ? 'Campanha' : 'Rifa'}:</strong> ${UI.escapeHtml(raffle.name)}</p>
          ${showPrice ? `<p><strong>Valor:</strong> ${UI.money(raffle.price)}</p>` : ''}
        </div>`
      : `
        <div class="detail-box">
          <p><strong>Número:</strong> ${UI.escapeHtml(slot.number)}</p>
          <p><strong>Status:</strong> ${UI.escapeHtml(statusLabel)}</p>
          <p style="margin-top:.75rem;color:var(--muted);">
            Este número já ${isCorporate ? 'foi escolhido' : 'foi reservado'} por outra pessoa.
            Para ver os seus, toque no ícone ao lado de <strong>${isCorporate ? 'Sorteio empresarial' : 'Rifa Pública'}</strong>.
          </p>
        </div>`;

    UI.modal({
      title: isMine ? `Seu número ${slot.number}` : `Número ${slot.number}`,
      body,
      actions: [{ label: 'Fechar', className: 'btn-primary', onClick: (c) => c() }]
    });
  }

  function openLookupModal(raffle, onFound) {
    const isCorporate = raffle.purpose === 'empresarial';
    const body = document.createElement('div');
    body.innerHTML = `
      <p style="margin-bottom:1rem;color:var(--muted);">
        Digite o mesmo telefone usado na ${isCorporate ? 'participação' : 'reserva'} para ver seus números nesta ${isCorporate ? 'campanha' : 'rifa'}.
      </p>
      <div class="form-group">
        <label for="lookup-phone">Telefone / WhatsApp</label>
        <input id="lookup-phone" type="tel" inputmode="tel" placeholder="(00) 00000-0000" required>
      </div>`;

    UI.modal({
      title: isCorporate ? 'Consultar minha participação' : 'Consultar minha reserva',
      body,
      actions: [
        { label: 'Cancelar', className: 'btn-ghost', onClick: (c) => c() },
        {
          label: 'Buscar',
          className: 'btn-primary',
          onClick: async (c) => {
            const phone = body.querySelector('#lookup-phone')?.value || '';
            if (normalizePhone(phone).length < 10) {
              UI.toast('Informe um telefone válido.', 'error');
              return;
            }
            c();
            await onFound(phone);
          }
        }
      ]
    });

    const phoneInput = body.querySelector('#lookup-phone');
    phoneInput?.addEventListener('input', () => {
      if (typeof UI.formatPhoneBR === 'function') {
        phoneInput.value = UI.formatPhoneBR(phoneInput.value);
      }
    });
  }

  function formatDrawTime(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (!m) return raw;
    return `${m[1].padStart(2, '0')}:${m[2]}`;
  }

  function formatCountdown(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    if (days > 0) return `${days}d ${hh}:${mm}:${ss}`;
    return `${hh}:${mm}:${ss}`;
  }

  function clearBuyerCountdown() {
    if (buyerCountdownTimer) {
      clearInterval(buyerCountdownTimer);
      buyerCountdownTimer = null;
    }
  }

  function startBuyerCountdown(raffle) {
    clearBuyerCountdown();
    const wrap = document.getElementById('buyer-countdown');
    const timeEl = document.getElementById('buyer-countdown-time');
    const labelEl = document.getElementById('buyer-countdown-label');
    const deadline = parseDrawDateTime(raffle?.drawDate, raffle?.drawTime);
    if (!wrap || !timeEl || !deadline) return;

    wrap.hidden = false;
    const startedOpen = Date.now() <= deadline.getTime();
    let endedHandled = false;

    const tick = () => {
      const remaining = deadline.getTime() - Date.now();
      if (remaining <= 0) {
        timeEl.textContent = '00:00:00';
        wrap.classList.add('is-ended');
        if (labelEl) labelEl.textContent = 'Sorteio';
        clearBuyerCountdown();
        if (startedOpen && !endedHandled) {
          endedHandled = true;
          setTimeout(() => renderBuyer(raffle), 350);
        }
        return;
      }
      wrap.classList.remove('is-ended');
      if (labelEl) labelEl.textContent = 'Falta para o sorteio';
      timeEl.textContent = formatCountdown(remaining);
    };

    tick();
    if (Date.now() <= deadline.getTime()) {
      buyerCountdownTimer = setInterval(tick, 1000);
    }
  }

  function parseDrawDateTime(dateRaw, timeRaw) {
    const d = String(dateRaw || '').trim();
    const t = String(timeRaw || '').trim();
    if (!d) return null;

    let year;
    let month;
    let day;
    const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const br = d.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (iso) {
      year = Number(iso[1]);
      month = Number(iso[2]);
      day = Number(iso[3]);
    } else if (br) {
      day = Number(br[1]);
      month = Number(br[2]);
      year = Number(br[3]);
    } else {
      return null;
    }

    let hour = 0;
    let minute = 0;
    let second = 0;
    const tm = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (tm) {
      hour = Number(tm[1]);
      minute = Number(tm[2]);
      second = Number(tm[3] || 0);
    }

    const dt = new Date(year, month - 1, day, hour, minute, second, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  function isBuyerSelectionClosed(raffle) {
    const deadline = parseDrawDateTime(raffle?.drawDate, raffle?.drawTime);
    if (!deadline) return false;
    return Date.now() > deadline.getTime();
  }

  function notifyBuyerSelectionClosed(raffle, message) {
    const isCorporate = raffle?.purpose === 'empresarial';
    const drawLabel = [
      UI.formatDateBR(raffle?.drawDate),
      formatDrawTime(raffle?.drawTime) ? `às ${formatDrawTime(raffle.drawTime)}` : ''
    ].filter(Boolean).join(' ');
    const text = message || (isCorporate
      ? `Não é possível participar nesta campanha. O prazo foi encerrado em ${drawLabel || 'data/hora do sorteio'}. Agradecemos o seu interesse e compreensão.`
      : `Não é possível reservar números nesta rifa. O prazo para participação foi encerrado em ${drawLabel || 'data/hora do sorteio'}. Agradecemos o seu interesse e compreensão.`);
    UI.modal({
      title: 'Participação encerrada',
      body: `<p style="margin:0;line-height:1.55;color:var(--text);">${UI.escapeHtml(text)}</p>`,
      actions: []
    });
  }

  function buyerNumberHTML(slot, myPhoneDigits = '', selectionClosed = false) {
    const status = slot.status || 'disponivel';
    const locked = status !== 'disponivel';
    const isMine = locked && myPhoneDigits && normalizePhone(slot.buyerPhone) === myPhoneDigits;
    const closedAvail = !locked && selectionClosed;
    return `
      <button type="button"
        class="buyer-num buyer-num--${status}${isMine ? ' is-mine' : ''}${closedAvail ? ' is-closed' : ''}"
        data-number="${UI.escapeHtml(slot.number)}"
        data-status="${status}"
        ${closedAvail ? 'aria-disabled="true"' : ''}
        title="${closedAvail ? 'Participação encerrada' : (isMine ? 'Ver minha reserva' : (locked ? 'Ver status' : 'Selecionar'))}">
        ${UI.escapeHtml(slot.number)}
      </button>`;
  }

  function openImageModal(src, title) {
    UI.modal({
      title: title || 'Foto',
      body: `<div class="buyer-lightbox"><img src="${UI.escapeHtml(src)}" alt="${UI.escapeHtml(title || 'Foto')}"></div>`,
      actions: []
    });
  }

  function openQuemSomosModal() {
    UI.modal({
      title: 'Quem somos',
      body: `
        <div class="about-modal">
          <p class="about-modal__lead">
            A <strong>PowerApps Sistemas</strong> cria softwares e aplicativos completos,
            organizados e pensados para o dia a dia.
          </p>
          <p>
            Desenvolvemos soluções digitais para facilitar a gestão, melhorar a experiência
            de quem usa e tornar processos mais simples, seguros e profissionais.
          </p>
          <p>
            Este sistema de rifas beneficentes é um exemplo do nosso trabalho:
            interface clara, organização e foco em quem precisa vender e quem deseja participar.
          </p>
          <div class="about-modal__contact">
            <span>Fale conosco</span>
            <a href="#" id="about-mail-link">
              Enviar mensagem
            </a>
          </div>
        </div>
      `,
      actions: []
    });

    document.getElementById('about-mail-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      UI.openFeedbackMailModal({ context: 'Origem: Quem somos (página pública)' });
    });
  }

  function openReserveModal(raffle, numbers) {
    if (isBuyerSelectionClosed(raffle)) {
      notifyBuyerSelectionClosed(raffle);
      return;
    }
    const isCorporate = raffle.purpose === 'empresarial';
    const showPrice = !isCorporate || Number(raffle.price) > 0;
    const raffleId = raffle.id;
    const unitPrice = raffle.price;
    const nums = Array.isArray(numbers) ? numbers : [numbers];
    const total = nums.length * Number(unitPrice || 0);
    const body = document.createElement('div');
    body.innerHTML = `
      <p style="margin-bottom:1rem;color:var(--muted);">
        Você está ${isCorporate ? 'participando com' : 'reservando'} <strong>${nums.length}</strong> número(s):
        <strong>${UI.escapeHtml(nums.join(', '))}</strong>
      </p>
      ${showPrice ? `<p style="margin-bottom:1rem;"><strong>Total:</strong> ${UI.money(total)}</p>` : ''}
      ${UI.buyerFormFields({ includeNumber: false })}`;

    UI.modal({
      title: isCorporate ? 'Participar' : 'Reservar números',
      body,
      actions: [
        { label: 'Cancelar', className: 'btn-ghost', onClick: (c) => c() },
        {
          label: isCorporate ? 'Confirmar participação' : 'Confirmar reserva',
          className: 'btn-primary',
          onClick: async (c) => {
            const buyer = UI.readBuyerForm();
            if (buyer.nameError || !buyer.phone) {
              UI.toast(buyer.nameError || 'Informe nome e telefone.', 'error');
              return;
            }
            UI.showLoading(isCorporate ? 'Participando...' : 'Reservando...');
            try {
              const okNums = [];
              const errors = [];
              let lastRaffle = null;
              for (const number of nums) {
                const result = await reserveNumber(raffleId, number, buyer);
                if (!result.ok) {
                  errors.push(`${number}: ${result.error}`);
                  continue;
                }
                okNums.push(number);
                lastRaffle = result.raffle;
              }
              UI.hideLoading();
              c();
              if (okNums.length) {
                saveBuyerReserve(raffleId, {
                  name: buyer.name,
                  phone: buyer.phone,
                  numbers: okNums
                });
                UI.toast(
                  isCorporate
                    ? `${okNums.length} número(s) — participação registrada!`
                    : `${okNums.length} número(s) reservado(s)!`,
                  'success'
                );
                const nextRaffle = lastRaffle || (await API.getRaffle(raffleId)).raffle;
                if (nextRaffle) await renderBuyer(nextRaffle);
                setTimeout(async () => {
                  let mineSlots = [];
                  if (typeof API.lookupBuyerSlots === 'function') {
                    const res = await API.lookupBuyerSlots(raffleId, buyer.phone);
                    if (res.ok) mineSlots = res.slots || [];
                  }
                  if (!mineSlots.length) {
                    mineSlots = (nextRaffle?.numbers || []).filter((n) => {
                      const st = n.status === 'reservado' || n.status === 'vendido';
                      return st && normalizePhone(n.buyerPhone) === normalizePhone(buyer.phone);
                    });
                  }
                  openMyNumbersModal(nextRaffle || raffle, mineSlots.length ? mineSlots : okNums.map((number) => ({
                    number,
                    status: 'reservado',
                    buyerName: buyer.name,
                    buyerPhone: buyer.phone,
                    buyerCity: buyer.city || '',
                    date: '',
                    time: ''
                  })), buyer);
                }, 300);
              } else {
                UI.toast(
                  errors[0] || (isCorporate ? 'Não foi possível participar.' : 'Não foi possível reservar.'),
                  'error'
                );
              }
            } catch (err) {
              UI.hideLoading();
              UI.toast(
                err.message || (isCorporate ? 'Erro ao participar.' : 'Erro ao reservar.'),
                'error'
              );
            }
          }
        }
      ]
    });
  }

  async function initList() {
    const session = await Layout.render({
      active: 'compartilhamentos',
      title: 'Compartilhamentos',
      showBottomNav: false
    });
    if (!session) return;

    UI.showLoading('Carregando...');
    try {
      const raffles = await searchRaffle('');
      UI.hideLoading();
      Layout.setContent(`
        <div class="slide-up">
          <h1 class="page-title">Compartilhamentos</h1>
          <p class="page-subtitle">Gere e envie links das suas rifas.</p>
          <div class="raffles-grid" style="margin-top:1.25rem;">
            ${raffles.length ? raffles.map((r) => {
              const share = shareRaffle(r.id);
              const meta = (typeof API !== 'undefined' && API.purposeMeta)
                ? API.purposeMeta(r.purpose)
                : { key: 'beneficente', label: 'Beneficente' };
              const typeLabel = meta.key === 'empresarial'
                ? 'Rifa empresarial'
                : (meta.key === 'outros' ? meta.label : 'Rifa beneficente');
              return `
                <article class="card raffle-card">
                  <div class="raffle-card__meta">
                    <span class="pill pill--purpose pill--purpose-${UI.escapeHtml(meta.key)}">${UI.escapeHtml(typeLabel)}</span>
                    <span class="badge">#${UI.escapeHtml(String(r.id))}</span>
                  </div>
                  <h3>${UI.escapeHtml(r.name)}</h3>
                  <p>${UI.escapeHtml(share.displayLink)}</p>
                  <div class="raffle-card__actions">
                    <a class="btn btn-primary btn-sm ripple" href="compartilhar.html?id=${r.id}&share=1">Compartilhar</a>
                    <a class="btn btn-outline btn-sm ripple" href="${share.link}" target="_blank" rel="noopener">Ver público</a>
                  </div>
                </article>`;
            }).join('') : `
              <div class="card empty-state" style="grid-column:1/-1;">
                <h3>Nenhuma rifa para compartilhar</h3>
                <a class="btn btn-primary ripple" href="nova-rifa.html" style="margin-top:1rem;">Criar Rifa</a>
              </div>`}
          </div>
        </div>
      `);
    } catch (err) {
      UI.hideLoading();
      UI.toast(err.message || 'Erro ao carregar.', 'error');
    }
  }

  return { init, initList };
})();

window.CompartilharPage = CompartilharPage;
