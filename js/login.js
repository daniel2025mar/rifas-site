/**
 * Login — PowerApps Sistemas
 * Sempre pede credenciais ao abrir. Suporta 2ª etapa 2FA (TOTP).
 */
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);

  try {
    if (typeof API !== 'undefined' && typeof API.endBrowserSession === 'function') {
      await API.endBrowserSession();
    } else if (typeof API !== 'undefined' && typeof API.logout === 'function') {
      await API.logout();
    } else {
      Store.resetForLoginScreen?.();
    }
  } catch {
    try {
      Store.resetForLoginScreen?.();
    } catch {
      try {
        Store.clearSession?.();
        Store.setRaffles?.([]);
      } catch {
        /* ignore */
      }
    }
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
  if (params.get('motivo') === 'senha-redefinida' && typeof UI !== 'undefined') {
    UI.toast('Senha redefinida. Entre com a nova senha.', 'success');
  }
  if (params.get('motivo') === 'idade' && typeof UI !== 'undefined') {
    let idadeMsg = '';
    try {
      idadeMsg = sessionStorage.getItem('pas_idade_msg') || '';
      sessionStorage.removeItem('pas_idade_msg');
    } catch {
      /* ignore */
    }
    UI.toast(
      idadeMsg ||
        'O uso deste sistema é restrito a maiores de 18 anos. Não é possível continuar com esta conta.',
      'error'
    );
  }

  const form = document.getElementById('login-form');
  const form2fa = document.getElementById('login-2fa-form');
  const formForgot = document.getElementById('forgot-form');
  const errorEl = document.getElementById('login-error');
  const error2faEl = document.getElementById('login-2fa-error');
  const forgotErrorEl = document.getElementById('forgot-error');
  const forgotSuccessEl = document.getElementById('forgot-success');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const forgotEmailInput = document.getElementById('forgot-email');
  const codeInput = document.getElementById('twofa-code');
  const toggleBtn = document.getElementById('toggle-password');
  const lockIcon = document.getElementById('login-lock-icon');
  const back2faBtn = document.getElementById('login-2fa-back');
  const btnForgot = document.getElementById('btn-forgot-password');
  const forgotBackBtn = document.getElementById('forgot-back');
  const createAccountLink = document.getElementById('login-create-account');
  if (!form) return;

  let pendingTempToken = '';
  let wrongPasswordAttempts = 0;
  const WRONG_PASSWORD_FORGOT_THRESHOLD = 5;

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

  function syncForgotVisibility() {
    if (!btnForgot) return;
    // Só na etapa de senha; permanece oculto até 5 senhas incorretas
    const onPasswordStep = !form.hidden;
    btnForgot.hidden = !(onPasswordStep && wrongPasswordAttempts >= WRONG_PASSWORD_FORGOT_THRESHOLD);
  }

  function syncCreateAccountVisibility() {
    if (!createAccountLink) return;
    // Oculta na etapa 2FA (e na recuperação de senha)
    const on2fa = form2fa && !form2fa.hidden;
    const onForgot = formForgot && !formForgot.hidden;
    createAccountLink.hidden = Boolean(on2fa || onForgot);
  }

  function registerWrongPasswordAttempt() {
    wrongPasswordAttempts += 1;
    syncForgotVisibility();
  }

  function resetLoginForm(message) {
    const keptEmail = String(emailInput?.value || '').trim();
    form.reset();
    if (emailInput && keptEmail) emailInput.value = keptEmail;
    setPasswordVisible(false);
    setLockUnlocked(false);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }
    passwordInput?.focus();
    syncForgotVisibility();
    syncCreateAccountVisibility();
  }

  function showPasswordStep() {
    pendingTempToken = '';
    if (form2fa) form2fa.hidden = true;
    if (formForgot) formForgot.hidden = true;
    form.hidden = false;
    if (error2faEl) error2faEl.hidden = true;
    if (forgotErrorEl) forgotErrorEl.hidden = true;
    if (forgotSuccessEl) forgotSuccessEl.hidden = true;
    if (codeInput) codeInput.value = '';
    syncForgotVisibility();
    syncCreateAccountVisibility();
  }

  function showForgotStep() {
    pendingTempToken = '';
    form.hidden = true;
    if (form2fa) form2fa.hidden = true;
    if (formForgot) formForgot.hidden = false;
    if (forgotErrorEl) forgotErrorEl.hidden = true;
    if (forgotSuccessEl) {
      forgotSuccessEl.hidden = true;
      forgotSuccessEl.textContent = '';
    }
    const prefill = String(emailInput?.value || '').trim();
    if (forgotEmailInput) {
      forgotEmailInput.value = prefill;
      forgotEmailInput.focus();
    }
    syncForgotVisibility();
    syncCreateAccountVisibility();
  }

  function show2faStep(tempToken) {
    pendingTempToken = String(tempToken || '');
    form.hidden = true;
    if (formForgot) formForgot.hidden = true;
    if (form2fa) form2fa.hidden = false;
    if (error2faEl) error2faEl.hidden = true;
    if (codeInput) {
      codeInput.value = '';
      codeInput.focus();
    }
    syncForgotVisibility();
    syncCreateAccountVisibility();
  }

  function sanitizeTwoFaCode(raw) {
    return String(raw || '')
      .replace(/\D/g, '')
      .slice(0, 6);
  }

  if (codeInput) {
    codeInput.setAttribute('maxlength', '6');
    codeInput.addEventListener('input', () => {
      const next = sanitizeTwoFaCode(codeInput.value);
      if (codeInput.value !== next) codeInput.value = next;
    });
    codeInput.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      codeInput.value = sanitizeTwoFaCode(text);
    });
    codeInput.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const allowed = [
        'Backspace',
        'Delete',
        'Tab',
        'Escape',
        'Enter',
        'ArrowLeft',
        'ArrowRight',
        'Home',
        'End'
      ];
      if (allowed.includes(e.key)) return;
      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
        return;
      }
      const digits = sanitizeTwoFaCode(codeInput.value);
      const hasSelection =
        codeInput.selectionStart != null &&
        codeInput.selectionEnd != null &&
        codeInput.selectionEnd > codeInput.selectionStart;
      if (digits.length >= 6 && !hasSelection) e.preventDefault();
    });
  }

  function allowPanel(page) {
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
    } catch {
      /* ignore */
    }
  }

  function afterSuccessfulLogin(session) {
    const sess = session || Store.getSession();
    if (!sess?.sessionToken) {
      UI.toast('Login incompleto: sessão não encontrada. Tente novamente.', 'error');
      showPasswordStep();
      return;
    }

    wrongPasswordAttempts = 0;

    if (typeof Store.markAuthenticated === 'function') Store.markAuthenticated();
    try {
      Store.setSession(sess);
      Store.markAuthenticated?.();
    } catch {
      /* ignore */
    }

    // Zera idle antigo para não deslogar na hora ao entrar no painel
    try {
      const uid = sess.userId;
      if (uid != null) localStorage.removeItem(`pas_last_active_at_${uid}`);
      localStorage.removeItem('pas_last_active_at');
    } catch {
      /* ignore */
    }

    setLockUnlocked(true);
    if (typeof Contribuicao !== 'undefined') Contribuicao.markAfterLogin?.();
    try {
      sessionStorage.setItem('pas_show_rating', '1');
    } catch {
      /* ignore */
    }
    if (typeof UI !== 'undefined' && UI.markSystemRatingAfterLogin) UI.markSystemRatingAfterLogin();
    if (typeof SystemBanner !== 'undefined' && SystemBanner.clearSeenKeys) {
      SystemBanner.clearSeenKeys();
    }

    if (typeof API.isDeveloperAccount === 'function' && API.isDeveloperAccount(sess)) {
      setTimeout(() => {
        allowPanel('dashboard.html');
        window.location.href = 'dashboard.html';
      }, 450);
      return;
    }

    // PF sem identidade confirmada → confirmação antes do painel
    const precisaConfirmarIdade =
      sess.idadeBloqueada === true ||
      (typeof API.needsAgeConfirmation === 'function' && API.needsAgeConfirmation(sess));
    if (precisaConfirmarIdade) {
      setTimeout(() => {
        try {
          Store.markAuthenticated?.();
        } catch {
          /* ignore */
        }
        allowPanel('confirmar-idade.html');
        window.location.href = 'confirmar-idade.html';
      }, 450);
      return;
    }

    const status = API.normalizeStatusPagamento?.(sess?.statusPagamento);
    const pending = Boolean(status && status !== 'ativo');
    const isEmpresa = API.normalizeTipoConta?.(sess?.tipoConta) === 'empresa';
    const vendasLocked =
      typeof API.isVendasLocked === 'function'
        ? API.isVendasLocked(sess)
        : !isEmpresa && pending;

    if ((pending || vendasLocked) && !isEmpresa) {
      try {
        sessionStorage.setItem('pas_show_pf_pay', '1');
      } catch {
        /* ignore */
      }
    }

    setTimeout(() => {
      try {
        Store.markAuthenticated?.();
      } catch {
        /* ignore */
      }
      if (pending || vendasLocked) {
        allowPanel('pagamento.html');
        allowPanel('dashboard.html');
        window.location.href = 'pagamento.html';
        return;
      }
      allowPanel('dashboard.html');
      window.location.href = 'dashboard.html';
    }, 450);
  }

  syncForgotVisibility();
  syncCreateAccountVisibility();

  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', () => {
      setPasswordVisible(passwordInput.type !== 'text');
    });
  }

  back2faBtn?.addEventListener('click', () => {
    showPasswordStep();
    emailInput?.focus();
  });

  btnForgot?.addEventListener('click', () => {
    showForgotStep();
  });

  forgotBackBtn?.addEventListener('click', () => {
    showPasswordStep();
    emailInput?.focus();
  });

  formForgot?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (forgotErrorEl) forgotErrorEl.hidden = true;
    if (forgotSuccessEl) forgotSuccessEl.hidden = true;

    const email = String(forgotEmailInput?.value || '').trim();
    if (!email) {
      if (forgotErrorEl) {
        forgotErrorEl.textContent = 'Informe o e-mail cadastrado.';
        forgotErrorEl.hidden = false;
      }
      forgotEmailInput?.focus();
      return;
    }

    UI.showLoading('Enviando e-mail...');
    try {
      const result = await API.requestPasswordReset({ email });
      UI.hideLoading();
      if (!result.ok) {
        const msg = safeErrorMessage(result.error, 'Não foi possível enviar o e-mail.');
        if (forgotErrorEl) {
          forgotErrorEl.textContent = msg;
          forgotErrorEl.hidden = false;
        }
        UI.toast(msg, 'error');
        return;
      }
      const okMsg =
        result.message ||
        'Se o e-mail estiver cadastrado, enviaremos o link de redefinição.';
      if (forgotSuccessEl) {
        forgotSuccessEl.textContent = okMsg;
        forgotSuccessEl.hidden = false;
      }
      UI.toast('Verifique sua caixa de entrada (e o spam).', 'success');
    } catch (err) {
      UI.hideLoading();
      const msg = safeErrorMessage(err && err.message, 'Falha ao enviar o e-mail.');
      if (forgotErrorEl) {
        forgotErrorEl.textContent = msg;
        forgotErrorEl.hidden = false;
      }
      UI.toast(msg, 'error');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.hidden = true;
    setLockUnlocked(false);

    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      if (errorEl) {
        errorEl.textContent = 'Preencha e-mail e senha.';
        errorEl.hidden = false;
      }
      (!email ? emailInput : passwordInput)?.focus();
      return;
    }

    UI.showLoading('Autenticando...');
    try {
      const result = await API.login({ email, password });
      UI.hideLoading();

      if (!result.ok) {
        const reason = String(result.reason || '');
        const isWrongPassword =
          reason === 'wrong_password' ||
          /senha incorreta/i.test(String(result.error || ''));
        if (isWrongPassword) registerWrongPasswordAttempt();
        const msg = safeErrorMessage(result.error, 'Não foi possível entrar.');
        resetLoginForm(msg);
        UI.toast(msg, 'error');
        return;
      }

      if (result.requires2fa) {
        show2faStep(result.tempToken);
        UI.toast('Digite o código de 6 dígitos do autenticador.', 'info');
        return;
      }

      afterSuccessfulLogin(result.session);
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

  form2fa?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (error2faEl) error2faEl.hidden = true;

    const code = sanitizeTwoFaCode(codeInput?.value || '');
    if (codeInput) codeInput.value = code;

    if (!code || code.length !== 6 || !pendingTempToken) {
      if (error2faEl) {
        error2faEl.textContent = 'Informe o código 2FA de 6 dígitos.';
        error2faEl.hidden = false;
      }
      codeInput?.focus();
      return;
    }

    UI.showLoading('Validando 2FA...');
    try {
      const result = await API.verify2fa({ tempToken: pendingTempToken, code });
      UI.hideLoading();

      if (!result.ok) {
        const msg = safeErrorMessage(result.error, 'Código inválido.');
        if (error2faEl) {
          error2faEl.textContent = msg;
          error2faEl.hidden = false;
        }
        UI.toast(msg, 'error');
        if (result.reason === 'expired' || result.reason === 'locked') {
          showPasswordStep();
        }
        return;
      }

      afterSuccessfulLogin(result.session);
    } catch (err) {
      UI.hideLoading();
      const msg = safeErrorMessage(err && err.message, 'Falha ao validar o 2FA.');
      if (error2faEl) {
        error2faEl.textContent = msg;
        error2faEl.hidden = false;
      }
      UI.toast(msg, 'error');
    }
  });
});
