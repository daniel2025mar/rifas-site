/**
 * Tela de pagamento — PowerApps Sistemas
 * Fluxo manual (Pix) com comprovante obrigatório para o admin aprovar.
 * PF: R$ 20,00 único | Empresa: mensal
 */
document.addEventListener('DOMContentLoaded', async () => {
  const PRECOS =
    (typeof API !== 'undefined' && API.PLAN_PRICES) || {
      pessoal_unico: { label: 'Liberar Vendas', valor: 20, sufixo: '(pagamento único)' },
      empresarial_mensal: { label: 'Plano Empresarial', valor: 79.9, sufixo: '/mês' }
    };

  const PIX =
    (typeof Contribuicao !== 'undefined' && Contribuicao.PIX) || {
      nome: 'Daniel Antonio Martins',
      banco: 'Nubank',
      chave: '34998217498'
    };

  const subtitle = document.getElementById('pay-subtitle');
  const statusEl = document.getElementById('pay-status');
  const planTitle = document.getElementById('pay-plan-title');
  const planPrice = document.getElementById('pay-plan-price');
  const planHint = document.getElementById('pay-plan-hint');
  const errorEl = document.getElementById('pay-error');
  const btnCopy = document.getElementById('btn-copy-pix');
  const btnConfirm = document.getElementById('btn-confirm-intent');
  const btnPaid = document.getElementById('btn-already-paid');
  const btnContinue = document.getElementById('btn-continue-panel');
  const btnLogout = document.getElementById('btn-logout');
  const pageTitle = document.querySelector('.auth-card__header h1');
  const proofInput = document.getElementById('pay-proof-input');
  const proofPreview = document.getElementById('pay-proof-preview');
  const proofImg = document.getElementById('pay-proof-img');
  const proofClear = document.getElementById('pay-proof-clear');
  const proofBox = document.getElementById('pay-proof-box');

  let comprovanteDataUrl = '';

  document.getElementById('pix-nome').textContent = PIX.nome;
  document.getElementById('pix-banco').textContent = PIX.banco;
  document.getElementById('pix-chave').textContent = PIX.chave;

  function moneyBR(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = !msg;
  }

  function syncProofUi() {
    const has = Boolean(comprovanteDataUrl);
    if (btnPaid) btnPaid.disabled = !has;
    if (proofPreview) proofPreview.hidden = !has;
    if (proofImg && has) proofImg.src = comprovanteDataUrl;
  }

  function clearProof() {
    comprovanteDataUrl = '';
    if (proofInput) proofInput.value = '';
    if (proofImg) proofImg.removeAttribute('src');
    syncProofUi();
  }

  async function onProofSelected(file) {
    showError('');
    if (!file) {
      clearProof();
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      clearProof();
      showError('O comprovante deve ter no máximo 4 MB.');
      UI.toast('Comprovante muito grande (máx. 4 MB).', 'error');
      return;
    }
    UI.showLoading('Lendo comprovante…');
    try {
      const result = await API.uploadImage(file, { kind: 'comprovante' });
      UI.hideLoading();
      if (!result.ok) {
        clearProof();
        showError(result.error || 'Não foi possível ler a imagem.');
        return;
      }
      comprovanteDataUrl = result.path || result.dataUrl;
      syncProofUi();
      UI.toast('Comprovante anexado. Agora envie para análise.', 'success');
    } catch (err) {
      UI.hideLoading();
      clearProof();
      showError(err.message || 'Falha ao ler o comprovante.');
    }
  }

  function setStatusBanner(profile, isEmpresa) {
    const st = API.normalizeStatusPagamento(profile?.statusPagamento);
    statusEl.hidden = false;
    statusEl.className = 'pay-status';
    if (st === 'ativo') {
      statusEl.classList.add('pay-status--ok');
      statusEl.textContent = 'Pagamento confirmado. Redirecionando…';
      if (proofBox) proofBox.hidden = true;
      if (btnPaid) btnPaid.hidden = true;
      return;
    }
    if (st === 'pendente_revisao') {
      statusEl.classList.add('pay-status--wait');
      statusEl.textContent =
        'Comprovante enviado. Vendas continua bloqueada até o administrador verificar e aprovar.';
      if (proofBox) proofBox.hidden = false;
      return;
    }
    if (st === 'atrasado') {
      statusEl.classList.add('pay-status--warn');
      statusEl.textContent = 'Assinatura atrasada. Renove o pagamento e envie o comprovante.';
      return;
    }
    statusEl.classList.add('pay-status--info');
    statusEl.textContent = isEmpresa
      ? 'Pagamento pendente. Envie o comprovante do Pix para liberar o sistema.'
      : 'Pagamento único pendente: R$ 20,00. Envie o comprovante para análise.';
  }

  function renderPlan(profile) {
    const tipo = API.normalizeTipoConta(profile?.tipoConta);
    const isEmpresa = tipo === 'empresa';
    const key = isEmpresa ? 'empresarial_mensal' : 'pessoal_unico';
    const plan = PRECOS[key];

    if (pageTitle) {
      pageTitle.textContent = isEmpresa ? 'Liberar acesso' : 'Liberar Vendas';
    }

    subtitle.textContent = isEmpresa
      ? 'Assinatura mensal para contas empresariais'
      : 'Pagamento único de R$ 20,00 para liberar a tela de Vendas';

    planTitle.textContent = isEmpresa
      ? `${plan.label} — ${moneyBR(plan.valor)}${plan.sufixo}`
      : `${plan.label} — ${moneyBR(plan.valor)} ${plan.sufixo}`;

    planPrice.textContent = moneyBR(plan.valor);
    planHint.textContent = isEmpresa
      ? 'Anexe o comprovante do Pix. O administrador verifica a imagem e só então libera o acesso por 30 dias.'
      : 'Anexe o comprovante do Pix de R$ 20,00. O administrador verifica e só então libera a tela de Vendas.';

    btnConfirm.textContent = isEmpresa ? 'Ver chave Pix' : 'Ver chave Pix';

    if (btnContinue) {
      btnContinue.hidden = isEmpresa;
      btnContinue.textContent = 'Acessar Sistema';
    }
  }

  async function load() {
    const gate =
      typeof protegerRota === 'function'
        ? await protegerRota({
            page: 'pagamento.html',
            ensurePayment: false,
            showLoading: false
          })
        : null;

    if (gate && !gate.ok) return;

    const session = gate?.session || Store.getSession();
    const gateOk = typeof Store.hasAuthGate === 'function' ? Store.hasAuthGate() : true;
    if (!session || !gateOk) {
      window.location.href =
        typeof ProtecaoRota !== 'undefined'
          ? ProtecaoRota.buildLoginUrl('auth')
          : 'login.html';
      return;
    }

    if (typeof API !== 'undefined' && typeof API.validateSessionRemote === 'function' && !gate) {
      const remote = await API.validateSessionRemote();
      if (!remote.ok && remote.reason !== 'network' && remote.reason !== 'schema') {
        window.location.href =
          typeof ProtecaoRota !== 'undefined'
            ? ProtecaoRota.buildLoginUrl('sessao')
            : 'login.html';
        return;
      }
    }

    syncProofUi();

    UI.showLoading('Carregando…');
    try {
      const result = await API.refreshPaymentProfile();
      UI.hideLoading();

      const profile = result.ok
        ? { ...result.profile }
        : {
            tipoConta: session.tipoConta || 'pessoa_fisica',
            statusPagamento: session.statusPagamento || 'pendente',
            plano: session.plano || 'pessoal_unico'
          };

      const isEmpresa = API.normalizeTipoConta(profile.tipoConta) === 'empresa';

      let forcePfPayScreen = false;
      try {
        forcePfPayScreen = !isEmpresa && sessionStorage.getItem('pas_show_pf_pay') === '1';
      } catch { /* ignore */ }

      if (forcePfPayScreen && API.isPaymentActive(profile.statusPagamento)) {
        profile.statusPagamento = 'pendente';
      } else if (!isEmpresa && session.statusPagamento === 'pendente') {
        profile.statusPagamento = 'pendente';
      }

      renderPlan(profile);
      setStatusBanner(profile, isEmpresa);

      try {
        sessionStorage.setItem('pas_pf_pay_seen', '1');
        if (forcePfPayScreen) sessionStorage.removeItem('pas_show_pf_pay');
      } catch { /* ignore */ }

      if (API.isPaymentActive(profile.statusPagamento) && !forcePfPayScreen) {
        setTimeout(() => {
          try {
            const key = 'pas_nav_allowed';
            const raw = sessionStorage.getItem(key);
            const list = raw ? JSON.parse(raw) : [];
            const set = new Set(Array.isArray(list) ? list : []);
            set.add('dashboard.html');
            sessionStorage.setItem(key, JSON.stringify([...set]));
          } catch { /* ignore */ }
          window.location.href = 'dashboard.html';
        }, 900);
      }
    } catch (err) {
      UI.hideLoading();
      showError(err.message || 'Não foi possível carregar o status de pagamento.');
      renderPlan({
        tipoConta: session.tipoConta || 'pessoa_fisica',
        statusPagamento: session.statusPagamento || 'pendente',
        plano: session.plano
      });
    }
  }

  proofInput?.addEventListener('change', () => {
    const file = proofInput.files && proofInput.files[0];
    onProofSelected(file || null);
  });

  proofClear?.addEventListener('click', () => {
    clearProof();
    UI.toast('Comprovante removido.', 'info');
  });

  btnCopy?.addEventListener('click', async () => {
    try {
      if (window.API?.copyLink) await API.copyLink(PIX.chave);
      else await navigator.clipboard.writeText(PIX.chave);
      UI.toast('Chave PIX copiada! Cole no app do seu banco.', 'success');
    } catch {
      UI.toast(`Chave PIX: ${PIX.chave}`, 'info', 5000);
    }
  });

  btnConfirm?.addEventListener('click', () => {
    UI.toast('Faça o Pix, anexe o comprovante e toque em “Enviar comprovante”.', 'info');
    document.getElementById('pix-chave')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  btnPaid?.addEventListener('click', async () => {
    showError('');
    if (!comprovanteDataUrl) {
      showError('Anexe o comprovante de pagamento antes de enviar.');
      UI.toast('Comprovante obrigatório.', 'error');
      proofInput?.focus();
      return;
    }

    UI.showLoading('Enviando comprovante…');
    try {
      const result = await API.markPaymentForReview({
        comprovanteDataUrl
      });
      UI.hideLoading();
      if (!result.ok) {
        showError(result.error || 'Não foi possível enviar.');
        UI.toast(result.error || 'Falha ao enviar.', 'error');
        return;
      }
      setStatusBanner({ statusPagamento: 'pendente_revisao' }, false);
      UI.toast(
        'Comprovante enviado. Aguarde a verificação do administrador.',
        'success'
      );
      if (result.needsSchema) {
        UI.toast(
          'Dica admin: execute supabase/fix_comprovante_pagamento.sql no Supabase.',
          'info',
          7000
        );
      }
    } catch (err) {
      UI.hideLoading();
      showError(err.message || 'Falha de conexão.');
    }
  });

  btnContinue?.addEventListener('click', () => {
    try {
      sessionStorage.setItem('pas_pf_pay_seen', '1');
      sessionStorage.removeItem('pas_show_pf_pay');
      const key = 'pas_nav_allowed';
      const raw = sessionStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      const set = new Set(Array.isArray(list) ? list : []);
      set.add('dashboard.html');
      sessionStorage.setItem(key, JSON.stringify([...set]));
    } catch { /* ignore */ }
    UI.toast('Você pode usar o painel. Vendas fica bloqueada até a aprovação do comprovante.', 'info');
    window.location.href = 'dashboard.html';
  });

  btnLogout?.addEventListener('click', async () => {
    try {
      await API.logout();
    } catch { /* ignore */ }
    try { sessionStorage.removeItem('pas_nav_allowed'); } catch { /* ignore */ }
    window.location.href =
      typeof ProtecaoRota !== 'undefined' && ProtecaoRota.LOGIN_URL
        ? ProtecaoRota.LOGIN_URL
        : 'login.html';
  });

  await load();
});
