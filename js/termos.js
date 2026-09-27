/**
 * Termos de Uso — painel com menu lateral e toolbar
 */
const TermosPage = (() => {
  let reachedEnd = false;
  let hasScrolled = false;

  function mountContent() {
    const tpl = document.getElementById('terms-body-template');
    const body = tpl ? tpl.innerHTML.trim() : '';
    Layout.setContent(`<div class="terms-page slide-up">${body}</div>`);
  }

  function updateProgress(scrollEl, progressBar, progressWrap) {
    if (!scrollEl || !progressBar) return;
    const max = scrollEl.scrollHeight - scrollEl.clientHeight;
    const pct = max <= 0 ? 100 : Math.min(100, Math.round((scrollEl.scrollTop / max) * 100));
    progressBar.style.width = pct + '%';
    if (progressWrap) progressWrap.setAttribute('aria-valuenow', String(pct));
  }

  function markRead(readBtn, hintEl, progressBar) {
    if (reachedEnd) return;
    reachedEnd = true;
    if (readBtn) {
      readBtn.disabled = false;
      readBtn.setAttribute('aria-disabled', 'false');
      readBtn.textContent = 'Leitura concluída';
      readBtn.classList.add('terms-actions__read--done');
    }
    if (hintEl) {
      hintEl.textContent = 'Leitura concluída. Toque no botão para voltar ao painel.';
      hintEl.classList.add('terms-hint--ready');
    }
    if (progressBar) progressBar.style.width = '100%';
  }

  function bindScrollLogic() {
    const scrollEl = document.getElementById('terms-scroll');
    const readBtn = document.getElementById('btn-terms-read');
    const hintEl = document.getElementById('terms-hint');
    const endMarker = document.getElementById('terms-end-marker');
    const progressBar = document.getElementById('terms-progress-bar');
    const progressWrap = document.getElementById('terms-progress');

    function checkScrollEnd() {
      if (!scrollEl) return;
      if (scrollEl.scrollTop > 8) hasScrolled = true;
      updateProgress(scrollEl, progressBar, progressWrap);
      const remaining = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
      if (remaining <= 28 && (hasScrolled || remaining <= 0)) {
        markRead(readBtn, hintEl, progressBar);
      }
    }

    if (progressWrap) {
      progressWrap.setAttribute('role', 'progressbar');
      progressWrap.setAttribute('aria-valuemin', '0');
      progressWrap.setAttribute('aria-valuemax', '100');
      progressWrap.setAttribute('aria-valuenow', '0');
      progressWrap.setAttribute('aria-label', 'Progresso da leitura');
    }

    scrollEl?.addEventListener('scroll', checkScrollEnd, { passive: true });
    window.addEventListener('resize', checkScrollEnd);

    if (endMarker && 'IntersectionObserver' in window && scrollEl) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && (hasScrolled || scrollEl.scrollHeight <= scrollEl.clientHeight + 8)) {
              markRead(readBtn, hintEl, progressBar);
            }
          });
        },
        { root: scrollEl, threshold: 0.5 }
      );
      io.observe(endMarker);
    }

    if (scrollEl) scrollEl.scrollTop = 0;
    requestAnimationFrame(() => {
      updateProgress(scrollEl, progressBar, progressWrap);
      if (scrollEl && scrollEl.scrollHeight <= scrollEl.clientHeight + 8) {
        hasScrolled = true;
        markRead(readBtn, hintEl, progressBar);
      }
    });

    readBtn?.addEventListener('click', () => {
      if (readBtn.disabled || !reachedEnd) return;
      Layout.allowNavigate('dashboard.html');
      window.location.href = 'dashboard.html';
    });
  }

  async function init() {
    const session = await Layout.render({ active: 'termos', title: 'Termos de Uso' });
    if (!session) return;
    mountContent();
    bindScrollLogic();
  }

  return { init };
})();
