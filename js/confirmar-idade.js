/**
 * Confirmação de idade + CPF (usuários PF existentes) — PowerApps Sistemas
 * Só salva no sistema após cruzamento CPF + data via CPFHub (backend).
 */
document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('confirmar-idade-form');
  const errorEl = document.getElementById('idade-error');
  const blockedEl = document.getElementById('idade-blocked');
  const cpfInput = document.getElementById('cpf');
  const birthInput = document.getElementById('dataNascimento');
  const consentInput = document.getElementById('idadeDeclaracao');
  const submitBtn = document.getElementById('btn-confirmar-idade');
  const logoutBtn = document.getElementById('btn-idade-sair');

  PasDatePicker?.attachAll?.('.pas-date-picker');

  const session = Store.getSession?.();
  if (!session?.userId || !session?.sessionToken) {
    window.location.replace('index.html');
    return;
  }

  function todayIsoLocal() {
    const n = new Date();
    const y = n.getFullYear();
    const m = String(n.getMonth() + 1).padStart(2, '0');
    const d = String(n.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function focusBirthField() {
    document.getElementById('dataNascimento-trigger')?.focus();
  }

  if (cpfInput) {
    cpfInput.addEventListener('input', () => {
      const format = API.formatCpfMask || ((v) => v);
      cpfInput.value = format(cpfInput.value);
    });
  }

  function syncSubmit() {
    if (submitBtn) submitBtn.disabled = !(consentInput && consentInput.checked);
  }
  consentInput?.addEventListener('change', syncSubmit);
  syncSubmit();

  async function endAndGoLogin(message) {
    try {
      if (typeof API !== 'undefined' && typeof API.endBrowserSession === 'function') {
        await API.endBrowserSession();
      } else if (typeof API !== 'undefined' && typeof API.logout === 'function') {
        await API.logout();
      } else {
        Store.resetForLoginScreen?.() || Store.clearSession?.();
      }
    } catch {
      try {
        Store.resetForLoginScreen?.() || Store.clearSession?.();
      } catch {
        /* ignore */
      }
    }
    if (message) {
      try {
        sessionStorage.setItem('pas_idade_msg', message);
      } catch {
        /* ignore */
      }
    }
    window.location.replace('index.html?motivo=idade');
  }

  function showBlocked(message) {
    const msg =
      message ||
      'O uso deste sistema é restrito a maiores de 18 anos. Não é possível continuar com esta conta.';
    if (form) form.hidden = true;
    if (blockedEl) {
      blockedEl.textContent = msg;
      blockedEl.hidden = false;
    }
    if (typeof UI !== 'undefined') UI.toast(msg, 'error');
    setTimeout(() => {
      void endAndGoLogin(msg);
    }, 2200);
  }

  function showError(message) {
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }
    UI.toast?.(message, 'error');
  }

  try {
    UI.showLoading?.('Verificando...');
    const status = await API.getAgeStatus?.();
    UI.hideLoading?.();
    if (status?.blocked || status?.reason === 'underage') {
      showBlocked(status.error);
      return;
    }
    if (status?.ok && status.idadePendente !== true) {
      const sess = status.session || Store.getSession();
      const pendingPay =
        API.normalizeStatusPagamento?.(sess?.statusPagamento) &&
        API.normalizeStatusPagamento(sess.statusPagamento) !== 'ativo';
      window.location.replace(pendingPay ? 'pagamento.html' : 'dashboard.html');
      return;
    }
  } catch {
    UI.hideLoading?.();
  }

  logoutBtn?.addEventListener('click', () => {
    void endAndGoLogin();
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.hidden = true;

    const cpf = String(cpfInput?.value || '').trim();
    const dataNascimento = String(birthInput?.value || '').trim();

    if (!consentInput?.checked) {
      showError('Confirme a declaração de maioridade para continuar.');
      return;
    }

    if (!API.isCpfChecksumValid?.(cpf)) {
      showError('Informe um CPF válido.');
      cpfInput?.focus();
      return;
    }

    if (!dataNascimento) {
      showError('Informe a data de nascimento.');
      focusBirthField();
      return;
    }

    if (dataNascimento > todayIsoLocal()) {
      showError('A data de nascimento não pode ser no futuro.');
      focusBirthField();
      return;
    }

    // Backend consulta CPFHub e só grava a data real retornada pela API
    UI.showLoading?.('Verificando CPF e data de nascimento...');
    if (submitBtn) submitBtn.disabled = true;
    const res = await API.confirmAge({ dataNascimento, cpf });
    UI.hideLoading?.();
    syncSubmit();

    if (res?.blocked || res?.reason === 'underage' || res?.motivo === 'menor_de_idade') {
      showBlocked(res.error);
      return;
    }

    if (!res?.ok || res.valido !== true) {
      const msg =
        res?.error ||
        (res?.motivo === 'data_nascimento_incorreta'
          ? 'A data de nascimento informada está incorreta para este CPF. Seus dados não foram salvos.'
          : 'CPF e data de nascimento não conferem. Seus dados não foram salvos.');
      showError(msg);
      if (res?.motivo === 'data_nascimento_incorreta' || res?.reason === 'birth_date') {
        focusBirthField();
      }
      return;
    }

    const sess = res.session || Store.getSession() || {};
    if (sess.cpfVerificado !== true) {
      showError('A verificação do CPF não foi concluída. Tente novamente.');
      return;
    }

    Store.setSession?.({
      ...sess,
      idadePendente: false,
      idadeConfirmada: true,
      cpfVerificado: true
    });
    Store.markAuthenticated?.();

    const payStatus = API.normalizeStatusPagamento?.(sess.statusPagamento);
    const pending = Boolean(payStatus && payStatus !== 'ativo');
    try {
      const key = 'pas_nav_allowed';
      const raw = sessionStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      const set = new Set(Array.isArray(list) ? list : []);
      set.add('dashboard.html');
      set.add('pagamento.html');
      sessionStorage.setItem(key, JSON.stringify([...set]));
    } catch {
      /* ignore */
    }
    window.location.href = pending ? 'pagamento.html' : 'dashboard.html';
  });
});
