/**
 * Termos de Uso — leitura em tela cheia (menu lateral)
 */
(function () {
  const scrollEl = document.getElementById('terms-scroll');
  const readBtn = document.getElementById('btn-terms-read');
  const hintEl = document.getElementById('terms-hint');
  const endMarker = document.getElementById('terms-end-marker');
  const progressBar = document.getElementById('terms-progress-bar');
  const progressWrap = document.getElementById('terms-progress');

  let reachedEnd = false;
  let hasScrolled = false;

  function updateProgress() {
    if (!scrollEl || !progressBar) return;
    const max = scrollEl.scrollHeight - scrollEl.clientHeight;
    const pct = max <= 0 ? 100 : Math.min(100, Math.round((scrollEl.scrollTop / max) * 100));
    progressBar.style.width = pct + '%';
    if (progressWrap) progressWrap.setAttribute('aria-valuenow', String(pct));
  }

  function markRead() {
    if (reachedEnd) return;
    reachedEnd = true;
    if (readBtn) {
      readBtn.disabled = false;
      readBtn.setAttribute('aria-disabled', 'false');
      readBtn.textContent = 'Leitura concluída';
      readBtn.classList.add('terms-actions__read--done');
    }
    if (hintEl) {
      hintEl.textContent = 'Leitura concluída. Toque no botão para voltar ao sistema.';
      hintEl.classList.add('terms-hint--ready');
    }
    if (progressBar) progressBar.style.width = '100%';
  }

  function checkScrollEnd() {
    if (!scrollEl) return;
    if (scrollEl.scrollTop > 8) hasScrolled = true;
    updateProgress();
    const remaining = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    if (remaining <= 28 && (hasScrolled || remaining <= 0)) markRead();
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
            markRead();
          }
        });
      },
      { root: scrollEl, threshold: 0.5 }
    );
    io.observe(endMarker);
  }

  if (scrollEl) scrollEl.scrollTop = 0;
  requestAnimationFrame(() => {
    updateProgress();
    if (scrollEl && scrollEl.scrollHeight <= scrollEl.clientHeight + 8) {
      hasScrolled = true;
      markRead();
    }
  });

  readBtn?.addEventListener('click', () => {
    if (readBtn.disabled || !reachedEnd) return;
    try {
      if (typeof Layout !== 'undefined' && Layout.allowNavigate) Layout.allowNavigate('dashboard.html');
      else {
        const key = 'pas_nav_allowed';
        const raw = sessionStorage.getItem(key);
        const list = raw ? JSON.parse(raw) : [];
        const set = new Set(Array.isArray(list) ? list : []);
        set.add('dashboard.html');
        sessionStorage.setItem(key, JSON.stringify([...set]));
      }
    } catch { /* ignore */ }
    window.location.href = 'dashboard.html';
  });
})();
