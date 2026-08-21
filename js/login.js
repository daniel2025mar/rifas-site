/**
 * Login — PowerApps Sistemas
 * Sempre pede credenciais ao abrir (não entra automático).
 */
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);

  // Sempre limpa sessão ao abrir a tela de login
  try {
    Store.resetForLoginScreen();
  } catch {
    try {
      Store.clearSession();
      Store.setRaffles([]);
    } catch { /* ignore */ }
  }

  if (params.get('motivo') === 'inatividade' && typeof UI !== 'undefined') {
    UI.toast('Sessão encerrada por inatividade. Faça login novamente.', 'info');
  }
  if (params.get('motivo') === 'outro-dispositivo' && typeof UI !== 'undefined') {
    UI.toast('Sua conta entrou em outro dispositivo. Só é permitido um login por vez.', 'info');
  }
  if (params.get('motivo') === 'sessao-invalida' && typeof UI !== 'undefined') {
    UI.toast('Não foi possível validar a sessão. Faça login novamente.', 'info');
  }

  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const toggleBtn = document.getElementById('toggle-password');
  const lockIcon = document.getElementById('login-lock-icon');
  if (!form) return;

  /** Evita exibir binário (ex.: PNG) quando a API devolve corpo inválido. */
  function safeErrorMessage(msg, fallback) {
    const s = String(msg == null ? '' : msg).trim();
    const fb = fallback || 'Falha de conexão. Tente novamente.';
    if (!s) return fb;
    if (s.length > 280) return fb;
    if (/PNG|IHDR|pHYs|cHRM|IDAT|IEND/i.test(s)) return fb;
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(s)) return fb;
    if ((s.match(/\uFFFD/g) || []).length >= 3) return fb;
    return s;
  }

  function setLockUnlocked(unlocked) {
    if (!lockIcon) return;
    lockIcon.classList.toggle('is-unlocked', !!unlocked);
    const closed = lockIcon.querySelector('.lock-icon--closed');
    const open = lockIcon.querySelector('.lock-icon--open');
    if (closed) closed.hidden = !!unlocked;
    if (open) open.hidden = !unlocked;
  }

  function setPasswordVisible(visible) {
    if (!passwordInput || !toggleBtn) return;
    passwordInput.type = visible ? 'text' : 'password';
    toggleBtn.classList.toggle('is-visible', visible);
    const label = visible ? 'Ocultar senha' : 'Mostrar senha';
    toggleBtn.setAttribute('aria-label', label);
    toggleBtn.setAttribute('title', label);
  }

  function resetLoginForm(message) {
    form.reset();
    setPasswordVisible(false);
    setLockUnlocked(false);
    errorEl.textContent = message;
    errorEl.hidden = false;
    emailInput?.focus();
  }

  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', () => {
      setPasswordVisible(passwordInput.type !== 'text');
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    setLockUnlocked(false);

    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      errorEl.textContent = 'Preencha e-mail e senha.';
      errorEl.hidden = false;
      (!email ? emailInput : passwordInput)?.focus();
      return;
    }

    UI.showLoading('Autenticando...');
    try {
      const result = await API.login({ email, password });
      UI.hideLoading();

      if (!result.ok) {
        const msg = safeErrorMessage(result.error, 'Não foi possível entrar.');
        resetLoginForm(msg);
        UI.toast(msg, 'error');
        return;
      }

      Store.markAuthenticated();
      setLockUnlocked(true);
      if (result.needsSessionSchema) {
        UI.toast('Execute supabase/sessao_unica.sql no Supabase para ativar 1 login por dispositivo.', 'info');
      }
      if (typeof Contribuicao !== 'undefined') Contribuicao.markAfterLogin();
      try {
        sessionStorage.setItem('pas_show_rating', '1');
      } catch { /* ignore */ }
      if (typeof UI !== 'undefined' && UI.markSystemRatingAfterLogin) UI.markSystemRatingAfterLogin();
      if (typeof SystemBanner !== 'undefined' && SystemBanner.clearSeenKeys) {
        SystemBanner.clearSeenKeys();
      } else {
        try {
          sessionStorage.removeItem('pas_promo_banner_seen');
          sessionStorage.removeItem('pas_promo_banner_seen_v2');
          sessionStorage.removeItem('pas_promo_banner_seen_v3');
          sessionStorage.removeItem('pas_promo_banner_seen_v4');
        } catch { /* ignore */ }
      }
      try {
        if (typeof AvisoSistema !== 'undefined' && AvisoSistema.clearSeenCache) {
          AvisoSistema.clearSeenCache();
        } else {
          sessionStorage.removeItem('pas_aviso_visto_token');
        }
      } catch { /* ignore */ }

      const session = result.session || Store.getSession();
      const allowPanel = (page) => {
        try {
          if (typeof Layout !== 'undefined' && Layout.allowNavigate) {
            Layout.allowNavigate(page);
          } else {
            const key = 'pas_nav_allowed';
            const raw = sessionStorage.getItem(key);
            const list = raw ? JSON.parse(raw) : [];
            const set = new Set(Array.isArray(list) ? list : []);
            set.add(String(page).toLowerCase());
            sessionStorage.setItem(key, JSON.stringify([...set]));
          }
        } catch { /* ignore */ }
      };

      if (typeof API.isDeveloperAccount === 'function' && API.isDeveloperAccount(session)) {
        setTimeout(() => {
          allowPanel('dashboard.html');
          window.location.href = 'dashboard.html';
        }, 450);
        return;
      }

      const status = API.normalizeStatusPagamento?.(session?.statusPagamento);
      const pending = Boolean(status && status !== 'ativo');
      const isEmpresa = API.normalizeTipoConta?.(session?.tipoConta) === 'empresa';
      const vendasLocked =
        typeof API.isVendasLocked === 'function'
          ? API.isVendasLocked(session)
          : (!isEmpresa && pending);

      // Sem pagamento ativo: mostra a tela com o valor (PF = R$ 20) antes do painel.
      if ((pending || vendasLocked) && !isEmpresa) {
        try {
          sessionStorage.setItem('pas_show_pf_pay', '1');
        } catch { /* ignore */ }
      }

      setTimeout(() => {
        if (pending || vendasLocked) {
          allowPanel('pagamento.html');
          allowPanel('dashboard.html');
          window.location.href = 'pagamento.html';
          return;
        }
        allowPanel('dashboard.html');
        window.location.href = 'dashboard.html';
      }, 450);
    } catch (err) {
      UI.hideLoading();
      const msg = safeErrorMessage(
        err && err.message,
        'Falha de conexão com o banco de dados na nuvem.'
      );
      resetLoginForm(msg);
      UI.toast(msg, 'error');
    }
  });
});
