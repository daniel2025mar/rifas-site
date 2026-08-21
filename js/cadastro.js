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
  const cnpjInput = document.getElementById('cnpj');
  const nameInput = form?.name || document.getElementById('name');

  if (nameInput) {
    (window.NomeCompleto || API)?.bindFullNameInput?.(nameInput);
  }

  function selectedTipoConta() {
    const checked = form.querySelector('input[name="tipoConta"]:checked');
    return (checked && checked.value) || 'pessoa_fisica';
  }

  function syncEmpresaFields() {
    const isEmpresa = selectedTipoConta() === 'empresa';
    if (empresaFields) empresaFields.hidden = !isEmpresa;
    if (form.razaoSocial) form.razaoSocial.required = isEmpresa;
    if (cnpjInput) cnpjInput.required = isEmpresa;
  }

  form.querySelectorAll('input[name="tipoConta"]').forEach((el) => {
    el.addEventListener('change', syncEmpresaFields);
  });
  syncEmpresaFields();

  if (cnpjInput) {
    cnpjInput.addEventListener('input', () => {
      const format = API.formatCnpjMask || ((v) => v);
      cnpjInput.value = format(cnpjInput.value);
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

    UI.showLoading('Criando conta...');
    try {
      const result = await createUser({
        name,
        email,
        password,
        tipoConta,
        razaoSocial: tipoConta === 'empresa' ? razaoSocial : '',
        cnpj: tipoConta === 'empresa' ? cnpj : ''
      });
      UI.hideLoading();

      if (!result.ok) {
        const msg = String(result.error || 'Erro ao cadastrar.');
        const safe = msg.length > 280 || /PNG|IHDR|IDAT/i.test(msg)
          ? 'Erro ao cadastrar. Tente novamente.'
          : msg;
        errorEl.textContent = safe;
        errorEl.hidden = false;
        UI.toast(safe, 'error');
        return;
      }

      success.classList.add('show');
      UI.toast('Cadastro realizado com sucesso.', 'success');

      // Após cadastro: mostra a tela de pagamento antes de abrir o painel.
      // PF vê o valor único de R$ 20,00; empresa vê o plano mensal.
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
        // Garante dados de cobrança na sessão mesmo se o perfil ainda não veio do banco
        try {
          Store.setSession({
            ...session,
            tipoConta: isEmpresa ? 'empresa' : 'pessoa_fisica',
            statusPagamento: session.statusPagamento || 'pendente',
            plano: session.plano || (isEmpresa ? 'empresarial_mensal' : 'pessoal_unico')
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
          sessionStorage.setItem(key, JSON.stringify([...set]));
        } catch { /* ignore */ }
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
