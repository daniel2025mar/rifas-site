/**
 * Cadastro — PowerApps Sistemas
 */
document.addEventListener('DOMContentLoaded', () => {
  if (Store.getSession()) {
    window.location.href = 'index.html';
    return;
  }

  const form = document.getElementById('cadastro-form');
  const errorEl = document.getElementById('cadastro-error');
  const success = document.getElementById('success-banner');
  const empresaFields = document.getElementById('empresa-fields');
  const pfIdadeFields = document.getElementById('pf-idade-fields');
  const cnpjInput = document.getElementById('cnpj');
  const cpfInput = document.getElementById('cpf');
  const birthInput = document.getElementById('dataNascimento');
  const consentInput = document.getElementById('idadeDeclaracao');
  const submitBtn = document.getElementById('btn-cadastrar') || form?.querySelector('button[type="submit"]');
  const nameInput = form?.name || document.getElementById('name');

  if (nameInput) {
    (window.NomeCompleto || API)?.bindFullNameInput?.(nameInput);
  }

  function selectedTipoConta() {
    const checked = form.querySelector('input[name="tipoConta"]:checked');
    return (checked && checked.value) || 'pessoa_fisica';
  }

  function todayIsoLocal() {
    const n = new Date();
    const y = n.getFullYear();
    const m = String(n.getMonth() + 1).padStart(2, '0');
    const d = String(n.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  PasDatePicker?.attachAll?.('.pas-date-picker');

  function syncSubmitEnabled() {
    if (!submitBtn) return;
    const isEmpresa = selectedTipoConta() === 'empresa';
    if (isEmpresa) {
      submitBtn.disabled = false;
      return;
    }
    submitBtn.disabled = !(consentInput && consentInput.checked);
  }

  function syncEmpresaFields() {
    const isEmpresa = selectedTipoConta() === 'empresa';
    if (empresaFields) empresaFields.hidden = !isEmpresa;
    if (pfIdadeFields) pfIdadeFields.hidden = isEmpresa;
    if (form.razaoSocial) form.razaoSocial.required = isEmpresa;
    if (cnpjInput) cnpjInput.required = isEmpresa;
    if (birthInput) {
      birthInput.required = !isEmpresa;
      if (isEmpresa) birthInput.value = '';
    }
    if (cpfInput) {
      cpfInput.required = !isEmpresa;
      if (isEmpresa) cpfInput.value = '';
    }
    if (consentInput && isEmpresa) consentInput.checked = false;
    syncSubmitEnabled();
  }

  form.querySelectorAll('input[name="tipoConta"]').forEach((el) => {
    el.addEventListener('change', syncEmpresaFields);
  });
  consentInput?.addEventListener('change', syncSubmitEnabled);
  syncEmpresaFields();

  if (cnpjInput) {
    cnpjInput.addEventListener('input', () => {
      const format = API.formatCnpjMask || ((v) => v);
      cnpjInput.value = format(cnpjInput.value);
    });
  }

  if (cpfInput) {
    cpfInput.addEventListener('input', () => {
      const format = API.formatCpfMask || ((v) => v);
      cpfInput.value = format(cpfInput.value);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const tipoConta = selectedTipoConta();
    const nameCheck = (window.NomeCompleto || API).validateFullName(form.name.value);
    if (!nameCheck.ok) {
      errorEl.textContent = nameCheck.error;
      errorEl.hidden = false;
      nameInput?.focus();
      return;
    }
    const name = nameCheck.value;
    form.name.value = name;
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirm = form.confirm.value;
    const razaoSocial = (form.razaoSocial?.value || '').trim();
    const cnpj = (cnpjInput?.value || '').trim();
    const cpf = (cpfInput?.value || '').trim();
    const dataNascimento = (birthInput?.value || '').trim();

    if (!email || !password || !confirm) {
      errorEl.textContent = 'Preencha todos os campos.';
      errorEl.hidden = false;
      return;
    }

    if (tipoConta === 'empresa') {
      if (!razaoSocial) {
        errorEl.textContent = 'Informe a razão social ou nome fantasia.';
        errorEl.hidden = false;
        return;
      }
      if (!API.isCnpjFormatValid(cnpj)) {
        errorEl.textContent = 'Informe um CNPJ válido (14 dígitos).';
        errorEl.hidden = false;
        return;
      }
    } else {
      if (!API.isCpfChecksumValid?.(cpf)) {
        errorEl.textContent = 'Informe um CPF válido.';
        errorEl.hidden = false;
        cpfInput?.focus();
        return;
      }
      const ageCheck = API.validateAdultBirthDate
        ? API.validateAdultBirthDate(dataNascimento)
        : { ok: Boolean(dataNascimento), error: 'Informe a data de nascimento.' };
      if (!ageCheck.ok) {
        errorEl.textContent =
          ageCheck.error || 'É necessário ter 18 anos ou mais para se cadastrar no sistema.';
        errorEl.hidden = false;
        document.getElementById('dataNascimento-trigger')?.focus();
        return;
      }
      if (!consentInput?.checked) {
        errorEl.textContent = 'Confirme a declaração de maioridade para continuar.';
        errorEl.hidden = false;
        return;
      }
    }

    if (password.length < 6) {
      errorEl.textContent = 'A senha deve ter no mínimo 6 caracteres.';
      errorEl.hidden = false;
      return;
    }

    if (password !== confirm) {
      errorEl.textContent = 'As senhas não coincidem.';
      errorEl.hidden = false;
      return;
    }

    UI.showLoading('Verificando e-mail...');
    const submitLabel = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verificando e-mail...';
    }

    let emailVerificado = false;
    try {
      const emailCheck = await (API.validateEmail
        ? API.validateEmail(email)
        : { ok: true, valido: true, motivo: 'fallback_api' });
      if (emailCheck && emailCheck.valido === false) {
        UI.hideLoading();
        if (submitBtn) submitBtn.textContent = submitLabel || 'Cadastrar';
        syncSubmitEnabled();
        errorEl.hidden = true;
        errorEl.textContent = '';
        UI.toast(
          'Esse e-mail parece inválido ou não existe. Confira o endereço e tente de novo.',
          'error'
        );
        form.email?.focus?.();
        return;
      }
      emailVerificado = emailCheck && emailCheck.valido === true && emailCheck.motivo !== 'fallback_api';
    } catch {
      emailVerificado = false;
    }

    if (tipoConta !== 'empresa') {
      if (submitBtn) submitBtn.textContent = 'Verificando CPF...';
      UI.showLoading('Verificando CPF...');
      const cpfCheck = await API.verifyCpf({ cpf, dataNascimento });
      if (!cpfCheck.ok || cpfCheck.valido !== true) {
        UI.hideLoading();
        if (submitBtn) submitBtn.textContent = submitLabel || 'Cadastrar';
        syncSubmitEnabled();
        const msg =
          cpfCheck.error ||
          API.cpfVerifyErrorMessage?.(cpfCheck.motivo) ||
          'Não foi possível confirmar seus dados no momento. Tente novamente em instantes.';
        errorEl.textContent = msg;
        errorEl.hidden = false;
        UI.toast(msg, 'error');
        if (cpfCheck.motivo === 'data_nascimento_incorreta') {
          document.getElementById('dataNascimento-trigger')?.focus();
        }
        return;
      }
    }

    if (submitBtn) submitBtn.textContent = 'Cadastrar';
    UI.showLoading('Criando conta...');
    try {
      const result = await createUser({
        name,
        email,
        password,
        tipoConta,
        razaoSocial: tipoConta === 'empresa' ? razaoSocial : '',
        cnpj: tipoConta === 'empresa' ? cnpj : '',
        emailVerificado,
        dataNascimento: tipoConta === 'empresa' ? '' : dataNascimento,
        cpf: tipoConta === 'empresa' ? '' : cpf
      });
      UI.hideLoading();
      if (submitBtn) submitBtn.textContent = submitLabel || 'Cadastrar';
      syncSubmitEnabled();

      if (!result.ok) {
        const msg = String(result.error || 'Erro ao cadastrar.');
        const emailInvalid = /e-mail parece inválido|não existe|email_nao_existe|confirmar que esse endereço/i.test(msg);
        const safe = msg.length > 280 || /PNG|IHDR|IDAT/i.test(msg)
          ? 'Erro ao cadastrar. Tente novamente.'
          : msg;
        if (emailInvalid) {
          errorEl.hidden = true;
          errorEl.textContent = '';
          UI.toast(
            'Esse e-mail parece inválido ou não existe. Confira o endereço e tente de novo.',
            'error'
          );
          form.email?.focus?.();
          return;
        }
        errorEl.textContent = safe;
        errorEl.hidden = false;
        UI.toast(safe, 'error');
        return;
      }

      success.classList.add('show');
      UI.toast('Cadastro realizado com sucesso.', 'success');

      UI.showLoading('Entrando...');
      const loginResult = await API.login({ email, password });
      UI.hideLoading();

      if (loginResult.ok) {
        Store.markAuthenticated?.();
        try {
          if (typeof AvisoSistema !== 'undefined' && AvisoSistema.clearSeenCache) {
            AvisoSistema.clearSeenCache();
          } else {
            sessionStorage.removeItem('pas_aviso_visto_token');
          }
        } catch { /* ignore */ }
        const session = loginResult.session || Store.getSession() || {};
        const isEmpresa = API.normalizeTipoConta?.(session.tipoConta || tipoConta) === 'empresa';
        try {
          Store.setSession({
            ...session,
            tipoConta: isEmpresa ? 'empresa' : 'pessoa_fisica',
            statusPagamento: session.statusPagamento || 'pendente',
            plano: session.plano || (isEmpresa ? 'empresarial_mensal' : 'pessoal_unico'),
            idadePendente: session.idadePendente === true,
            idadeConfirmada: session.idadeConfirmada === true,
            cpfVerificado: session.cpfVerificado === true
          });
        } catch { /* ignore */ }
        if (!isEmpresa) {
          try {
            sessionStorage.setItem('pas_show_pf_pay', '1');
            sessionStorage.setItem('pas_pf_pay_seen', '0');
          } catch { /* ignore */ }
        }
        try {
          const key = 'pas_nav_allowed';
          const raw = sessionStorage.getItem(key);
          const list = raw ? JSON.parse(raw) : [];
          const set = new Set(Array.isArray(list) ? list : []);
          set.add('pagamento.html');
          set.add('dashboard.html');
          set.add('confirmar-idade.html');
          sessionStorage.setItem(key, JSON.stringify([...set]));
        } catch { /* ignore */ }
        if (session.idadePendente === true) {
          window.location.href = 'confirmar-idade.html';
          return;
        }
        window.location.href = 'pagamento.html';
        return;
      }

      form.reset();
      syncEmpresaFields();
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1200);
    } catch (err) {
      UI.hideLoading();
      const submitBtnCatch = form.querySelector('button[type="submit"]');
      if (submitBtnCatch) {
        if (!submitBtnCatch.textContent || /Verificando/.test(submitBtnCatch.textContent)) {
          submitBtnCatch.textContent = 'Cadastrar';
        }
      }
      syncSubmitEnabled();
      let msg = err.message || 'Falha de conexão com o servidor.';
      if (String(msg).length > 280 || /PNG|IHDR|IDAT/i.test(String(msg))) {
        msg = 'Falha de conexão com o servidor.';
      }
      errorEl.textContent = msg;
      errorEl.hidden = false;
      UI.toast(msg, 'error');
    }
  });
});
