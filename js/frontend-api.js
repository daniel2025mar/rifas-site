/**
 * PowerApps Sistemas — API (backend Node/Express + MySQL)
 * Endpoints: /api/auth | /api/rifas | /api/vendas | /api/notificacoes | /api/banner | /api/avaliacoes
 */

const API = (() => {
  function baseUrl() {
    const cfg = (typeof window !== 'undefined' && window.PAS_CONFIG) || {};
    return String(cfg.API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
  }

  /** Token Bearer: prioriza sessão do portal DevAuth (não misturar com usuário do painel). */
  function getAuthToken() {
    try {
      if (typeof DevAuth !== 'undefined' && typeof DevAuth.isLoggedIn === 'function' && DevAuth.isLoggedIn()) {
        const dev = DevAuth.getSession?.();
        if (dev?.sessionToken) return String(dev.sessionToken);
      }
    } catch {
      /* ignore */
    }
    try {
      const session = typeof Store !== 'undefined' ? Store.getSession() : null;
      if (session?.sessionToken) return String(session.sessionToken);
    } catch {
      /* ignore */
    }
    return '';
  }

  /** Sessão efetiva para APIs: DevAuth (portal) ou Store (painel). */
  function resolveAuthSession() {
    try {
      if (typeof DevAuth !== 'undefined' && DevAuth.isLoggedIn?.()) {
        const d = DevAuth.getSession?.() || {};
        const userId = Number(d.userId || d.id || 0);
        if (userId || d.sessionToken) {
          return {
            ...d,
            userId: userId || Number(d.userId) || 0,
            email: d.email || '',
            sessionToken: d.sessionToken || '',
            isDev: d.isDev === true
          };
        }
      }
    } catch {
      /* ignore */
    }
    try {
      const s = typeof Store !== 'undefined' ? Store.getSession() : null;
      if (s?.userId) {
        return {
          ...s,
          isDev: isDeveloperAccount(s)
        };
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  /** Chamada HTTP JSON com Bearer token da sessão local */
  async function request(method, path, body) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const response = await fetch(`${baseUrl()}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (
        response.status === 401 &&
        token &&
        !/\/api\/auth\/(login|register|logout|validate-session)\b/i.test(String(path || ''))
      ) {
        const reason = data?.reason || 'cleared';
        if (['cleared', 'replaced', 'expired', 'no-token'].includes(reason)) {
          lastSessionValidation = null;
          try {
            window.dispatchEvent(new CustomEvent('pas-session-invalid', { detail: { reason } }));
          } catch {
            /* ignore */
          }
        }
      }

      if (data && typeof data === 'object') return data;
      if (response.ok) return { ok: true };
      return { ok: false, error: 'Erro inesperado no servidor.', status: response.status };
    } catch (err) {
      return {
        ok: false,
        error: 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.',
        networkError: true,
        detail: err?.message || ''
      };
    }
  }

  function isNetworkFailure(res) {
    return Boolean(res && res.ok === false && res.networkError);
  }

  // ─── Rifas: helpers de modelo ───────────────────────────

  function normalizePurpose(value) {
    const raw = String(value || 'beneficente').trim().toLowerCase();
    if (raw === 'empresarial' || raw === 'empresa') return 'empresarial';
    if (raw === 'outros' || raw === 'outro') return 'outros';
    return 'beneficente';
  }

  function purposeMeta(value) {
    const key = normalizePurpose(value);
    if (key === 'empresarial') {
      return { key, label: 'Empresarial', badge: 'SORTEIO EMPRESARIAL' };
    }
    if (key === 'outros') {
      return { key, label: 'Outros', badge: 'SORTEIO' };
    }
    return { key: 'beneficente', label: 'Beneficente', badge: 'AÇÃO BENEFICENTE' };
  }

  function generateNumbers(quantity) {
    const slots = [];
    const total = Number(quantity) || 0;
    for (let i = 1; i <= total; i += 1) {
      slots.push({
        number: Store.padNumber(i, total),
        status: 'disponivel',
        buyerName: null,
        buyerPhone: null,
        buyerCity: null,
        observation: null,
        date: null,
        time: null,
        saleId: null
      });
    }
    return slots;
  }

  /** DATE do MySQL pode chegar como ISO; grava sempre YYYY-MM-DD */
  function toDateInput(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
    const br = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
    if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
    return raw;
  }

  // ─── Auth ───────────────────────────────────────────────

  function normalizeTipoConta(value) {
    const v = String(value || '').trim().toLowerCase();
    return v === 'empresa' ? 'empresa' : 'pessoa_fisica';
  }

  function normalizeCnpjDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function isCnpjFormatValid(value) {
    return normalizeCnpjDigits(value).length === 14;
  }

  function formatCnpjMask(value) {
    const d = normalizeCnpjDigits(value).slice(0, 14);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
    if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
    if (d.length <= 12) {
      return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
    }
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }

  /** NULL/vazio = ativo (usuários anteriores à cobrança) */
  function normalizeStatusPagamento(value) {
    const v = String(value || '').trim().toLowerCase();
    if (!v) return 'ativo';
    return v;
  }

  function isPaymentActive(status) {
    return normalizeStatusPagamento(status) === 'ativo';
  }

  function mapPaymentProfile(row) {
    if (!row) return null;
    const tipoConta = normalizeTipoConta(row.tipoConta || row.tipo_conta);
    return {
      id: row.id ?? row.userId,
      name: row.name || row.nome || '',
      email: row.email || '',
      tipoConta,
      razaoSocial: row.razaoSocial || row.razao_social || '',
      cnpj: row.cnpj || '',
      statusPagamento: normalizeStatusPagamento(row.statusPagamento || row.status_pagamento),
      plano:
        row.plano ||
        (tipoConta === 'empresa' ? 'empresarial_mensal' : 'pessoal_unico'),
      pagoEm: row.pagoEm || row.pago_em || null,
      proximoVencimento: row.proximoVencimento || row.proximo_vencimento || null,
      comprovantePagamento: row.comprovantePagamento || row.comprovante_pagamento || '',
      hasComprovante: Boolean(
        row.hasComprovante ||
          row.comprovantePagamento ||
          row.comprovante_pagamento ||
          row.comprovanteEm ||
          row.comprovante_em
      ),
      comprovanteEm: row.comprovanteEm || row.comprovante_em || null,
      sessionActive: Boolean(row.sessao_token || row.sessionActive || row.sessionToken),
      sessionAt: row.sessao_em || row.sessionAt || null,
      lastSeen: row.ultimo_acesso || row.lastSeen || row.sessao_em || row.sessionAt || null
    };
  }

  function mergeSessionFlag(incoming, camelKey, snakeKey, previous) {
    if (incoming[camelKey] === true || incoming[snakeKey] === true) return true;
    if (incoming[camelKey] === false || incoming[snakeKey] === false) return false;
    return previous === true;
  }

  function applyPaymentToSession(profileOrSession) {
    const session = Store.getSession();
    if (!session || !profileOrSession) return session;
    const profile = mapPaymentProfile(profileOrSession);
    const prev = session || {};
    const idadeConfirmada = mergeSessionFlag(
      profileOrSession,
      'idadeConfirmada',
      'idade_confirmada',
      prev.idadeConfirmada
    );
    const idadeBloqueada = mergeSessionFlag(
      profileOrSession,
      'idadeBloqueada',
      'idade_bloqueada',
      prev.idadeBloqueada
    );
    const cpfVerificado = mergeSessionFlag(
      profileOrSession,
      'cpfVerificado',
      'cpf_verificado',
      prev.cpfVerificado
    );
    const identidadeRegistrada = mergeSessionFlag(
      profileOrSession,
      'identidadeRegistrada',
      'identidade_registrada',
      prev.identidadeRegistrada
    );
    let idadePendente;
    if (profileOrSession.idadePendente === false || profileOrSession.idade_pendente === false) {
      idadePendente = false;
    } else if (profileOrSession.idadePendente === true || profileOrSession.idade_pendente === true) {
      idadePendente = true;
    } else if (
      identidadeRegistrada ||
      (cpfVerificado && idadeConfirmada && !idadeBloqueada)
    ) {
      idadePendente = false;
    } else {
      idadePendente = prev.idadePendente === true;
    }
    Store.setSession({
      ...session,
      tipoConta: profile.tipoConta,
      razaoSocial: profile.razaoSocial,
      cnpj: profile.cnpj,
      statusPagamento: profile.statusPagamento,
      plano: profile.plano,
      pagoEm: profile.pagoEm,
      proximoVencimento: profile.proximoVencimento,
      idadePendente,
      idadeConfirmada,
      idadeBloqueada,
      cpfVerificado,
      identidadeRegistrada
    });
    return Store.getSession();
  }

  function todayIsoLocal() {
    const n = new Date();
    const y = n.getFullYear();
    const m = String(n.getMonth() + 1).padStart(2, '0');
    const d = String(n.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function normalizeBirthDateInput(value) {
    const s = String(value || '').trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() + 1 !== mo || dt.getDate() !== d) return null;
    return `${m[1]}-${m[2]}-${m[3]}`;
  }

  function calcAgeYears(isoDate, today = new Date()) {
    const normalized = normalizeBirthDateInput(isoDate);
    if (!normalized) return null;
    const [y, m, d] = normalized.split('-').map(Number);
    let age = today.getFullYear() - y;
    const nowM = today.getMonth() + 1;
    const nowD = today.getDate();
    if (nowM < m || (nowM === m && nowD < d)) age -= 1;
    return age;
  }

  /**
   * Validação client-side de data de nascimento (18+).
   * @returns {{ ok: true, date: string, age: number } | { ok: false, error: string, underage?: boolean, date?: string }}
   */
  function validateAdultBirthDate(raw, { minAge = 18 } = {}) {
    const date = normalizeBirthDateInput(raw);
    if (!date) {
      return { ok: false, error: 'Informe uma data de nascimento válida.' };
    }
    if (date > todayIsoLocal()) {
      return { ok: false, error: 'A data de nascimento não pode ser no futuro.' };
    }
    const age = calcAgeYears(date);
    if (age == null || age < 0 || age > 130) {
      return { ok: false, error: 'Informe uma data de nascimento válida.' };
    }
    if (age < minAge) {
      return {
        ok: false,
        underage: true,
        date,
        age,
        error: 'É necessário ter 18 anos ou mais para se cadastrar no sistema.'
      };
    }
    return { ok: true, date, age };
  }

  function needsAgeConfirmation(sessionOrProfile) {
    const src = sessionOrProfile || Store.getSession();
    if (!src) return false;
    if (normalizeTipoConta(src.tipoConta || src.tipo_conta) === 'empresa') return false;
    if (src.idadeBloqueada === true) return true;
    if (src.identidadeRegistrada === true) return false;
    if (src.cpfVerificado === true && src.idadeConfirmada === true) return false;
    if (src.idadePendente === false) return false;
    return true;
  }

  function normalizeCpfDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function formatCpfMask(value) {
    const d = normalizeCpfDigits(value).slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  function isCpfChecksumValid(raw) {
    const cpf = normalizeCpfDigits(raw);
    if (!/^\d{11}$/.test(cpf)) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
    let dig = (sum * 10) % 11;
    if (dig === 10) dig = 0;
    if (dig !== Number(cpf[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
    dig = (sum * 10) % 11;
    if (dig === 10) dig = 0;
    return dig === Number(cpf[10]);
  }

  function cpfVerifyErrorMessage(motivo, fallback) {
    if (motivo === 'data_nascimento_incorreta') {
      return 'A data de nascimento informada está incorreta para este CPF. Verifique e tente novamente. Seus dados não foram salvos.';
    }
    if (motivo === 'dados_nao_conferem') {
      return 'Não foi possível confirmar o CPF informado. Verifique os dados e tente novamente. Seus dados não foram salvos.';
    }
    if (motivo === 'menor_de_idade') {
      return 'É necessário ter 18 anos ou mais para se cadastrar no sistema.';
    }
    if (motivo === 'cpf_ja_cadastrado') {
      return 'Este CPF já está associado a uma conta.';
    }
    if (motivo === 'cpf_invalido' || motivo === 'data_invalida') {
      return 'Informe um CPF e uma data de nascimento válidos.';
    }
    if (motivo === 'verificacao_indisponivel') {
      return 'Não foi possível confirmar seus dados no momento. Tente novamente em instantes.';
    }
    return fallback || 'Não foi possível confirmar seus dados no momento. Tente novamente em instantes.';
  }

  async function verifyCpf({ cpf, dataNascimento }) {
    if (!isCpfChecksumValid(cpf)) {
      return {
        ok: false,
        valido: false,
        motivo: 'cpf_invalido',
        error: cpfVerifyErrorMessage('cpf_invalido')
      };
    }
    const res = await request('POST', '/api/auth/verificar-cpf', {
      cpf: normalizeCpfDigits(cpf),
      dataNascimento: String(dataNascimento || '').trim()
    });
    if (res?.valido === true) {
      return { ok: true, valido: true, motivo: null };
    }
    const motivo = res?.motivo || (res?.networkError ? 'verificacao_indisponivel' : 'dados_nao_conferem');
    return {
      ok: false,
      valido: false,
      motivo,
      reason: res?.reason || (motivo === 'data_nascimento_incorreta' ? 'birth_date' : ''),
      error: res?.error || cpfVerifyErrorMessage(motivo)
    };
  }
  async function validateEmail(email) {
    const res = await request('POST', '/api/auth/validar-email', {
      email: String(email || '').trim().toLowerCase()
    });
    // Rede/API fora: não bloqueia cadastro (fallback)
    if (!res || res.networkError) {
      return { ok: true, valido: true, motivo: 'fallback_api' };
    }
    if (typeof res.valido === 'boolean') {
      return { ok: true, valido: res.valido === true, motivo: res.motivo || null };
    }
    return { ok: true, valido: true, motivo: 'fallback_api' };
  }

  async function createUser({
    name,
    email,
    password,
    tipoConta = 'pessoa_fisica',
    razaoSocial = '',
    cnpj = '',
    emailVerificado = false,
    dataNascimento = '',
    cpf = ''
  }) {
    const tipo = normalizeTipoConta(tipoConta);
    const razao = String(razaoSocial || '').trim();
    const cnpjDigits = normalizeCnpjDigits(cnpj);
    const cpfDigits = normalizeCpfDigits(cpf);
    const nomeCheck = (typeof window !== 'undefined' && window.NomeCompleto?.validateFullName)
      ? window.NomeCompleto.validateFullName(name)
      : { ok: Boolean(String(name || '').trim()), value: String(name || '').trim(), error: 'Informe o nome completo.' };
    if (!nomeCheck.ok) return { ok: false, error: nomeCheck.error || 'Informe o nome completo.' };

    if (tipo === 'empresa') {
      if (!razao) return { ok: false, error: 'Informe a razão social ou nome fantasia.' };
      if (!isCnpjFormatValid(cnpjDigits)) {
        return { ok: false, error: 'Informe um CNPJ válido (14 dígitos).' };
      }
    } else {
      const birth = validateAdultBirthDate(dataNascimento);
      if (!birth.ok) {
        return {
          ok: false,
          error: birth.error || 'É necessário ter 18 anos ou mais para se cadastrar no sistema.',
          reason: birth.underage ? 'underage' : 'birth_date'
        };
      }
      if (!isCpfChecksumValid(cpfDigits)) {
        return {
          ok: false,
          error: cpfVerifyErrorMessage('cpf_invalido'),
          motivo: 'cpf_invalido'
        };
      }
    }

    const res = await request('POST', '/api/auth/register', {
      name: nomeCheck.value,
      email: String(email || '').trim().toLowerCase(),
      password: String(password || ''),
      tipoConta: tipo,
      razaoSocial: tipo === 'empresa' ? razao : '',
      cnpj: tipo === 'empresa' ? cnpjDigits : '',
      emailVerificado: emailVerificado === true,
      dataNascimento: tipo === 'empresa' ? undefined : String(dataNascimento || '').trim(),
      cpf: tipo === 'empresa' ? undefined : cpfDigits
    });
    if (!res.ok) {
      return {
        ok: false,
        error: res.error || cpfVerifyErrorMessage(res.motivo, 'Erro ao cadastrar.'),
        reason: res.reason || '',
        motivo: res.motivo || ''
      };
    }
    return { ok: true, user: mapPaymentProfile(res.user) || res.user };
  }

  async function login({ email, password }) {
    const res = await request('POST', '/api/auth/login', {
      email: String(email || '').trim().toLowerCase(),
      password: String(password || '')
    });

    if (res && res.ok && res.requires2fa === true) {
      return {
        ok: true,
        requires2fa: true,
        tempToken: res.tempToken || '',
        email: res.email || email
      };
    }

    if (!res.ok || !res.session) {
      return {
        ok: false,
        error: res.error || 'Não foi possível entrar.',
        reason: res.reason || ''
      };
    }

    Store.setSession({
      userId: res.session.userId,
      email: res.session.email,
      name: res.session.name,
      photo: res.session.photo || '',
      sessionToken: res.session.sessionToken,
      nivelAcesso: res.session.nivelAcesso || res.session.nivel_acesso || 'usuario',
      isDev: res.session.isDev === true
    });
    applyPaymentToSession(res.session);
    if (typeof Store.markAuthenticated === 'function') Store.markAuthenticated();
    lastSessionValidation = null;
    sessionValidationPromise = null;

    return { ok: true, session: Store.getSession() };
  }

  async function requestPasswordReset({ email }) {
    const res = await request('POST', '/api/auth/recuperar-senha', {
      email: String(email || '').trim().toLowerCase()
    });
    if (!res || res.networkError) {
      return { ok: false, error: res?.error || 'Falha de rede.' };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: res.error || 'Não foi possível enviar o e-mail.',
        needsMigration: !!res.needsMigration
      };
    }
    return {
      ok: true,
      message:
        res.message ||
        'Se o e-mail estiver cadastrado, enviaremos instruções para redefinir a senha.'
    };
  }

  async function resetPassword({ token, password }) {
    const res = await request('POST', '/api/auth/redefinir-senha', {
      token: String(token || '').trim(),
      password: String(password || '')
    });
    if (!res || res.networkError) {
      return { ok: false, error: res?.error || 'Falha de rede.' };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: res.error || 'Não foi possível redefinir a senha.',
        reason: res.reason || '',
        needsMigration: !!res.needsMigration
      };
    }
    return { ok: true, message: res.message || 'Senha redefinida com sucesso.' };
  }

  function applySessionFromApi(session) {
    if (!session || !session.sessionToken) return null;
    Store.setSession({
      userId: session.userId,
      email: session.email,
      name: session.name,
      photo: session.photo || '',
      sessionToken: session.sessionToken,
      nivelAcesso: session.nivelAcesso || session.nivel_acesso || 'usuario',
      isDev: session.isDev === true
    });
    applyPaymentToSession(session);
    if (typeof Store.markAuthenticated === 'function') Store.markAuthenticated();
    return Store.getSession();
  }

  async function verify2fa({ tempToken, code }) {
    const res = await request('POST', '/api/2fa/verificar', {
      tempToken: String(tempToken || ''),
      code: String(code || '').trim()
    });
    if (!res.ok || !res.session || !res.session.sessionToken) {
      return {
        ok: false,
        error: res.error || 'Código inválido.',
        reason: res.reason || '',
        attemptsLeft: res.attemptsLeft,
        retryAfterSec: res.retryAfterSec
      };
    }
    const session = applySessionFromApi(res.session);
    if (!session?.sessionToken) {
      return { ok: false, error: 'Sessão não foi gravada após o 2FA. Tente novamente.' };
    }
    return { ok: true, session };
  }

  async function get2faStatus() {
    const res = await request('GET', '/api/2fa/status');
    if (!res || res.networkError) {
      return { ok: false, error: res?.error || 'Falha de rede.', ativo: false };
    }
    return {
      ok: true,
      ativo: res.ativo === true,
      needsMigration: !!res.needsMigration,
      error: res.error || ''
    };
  }

  async function start2fa() {
    const res = await request('POST', '/api/2fa/iniciar', {});
    if (!res.ok) {
      return { ok: false, error: res.error || 'Não foi possível iniciar o 2FA.', needsMigration: !!res.needsMigration };
    }
    return {
      ok: true,
      otpauthUrl: res.otpauthUrl,
      qrCodeDataUrl: res.qrCodeDataUrl,
      manualSecret: res.manualSecret
    };
  }

  async function confirm2fa({ code }) {
    const res = await request('POST', '/api/2fa/confirmar', {
      code: String(code || '').trim()
    });
    if (!res.ok) {
      return { ok: false, error: res.error || 'Não foi possível confirmar o 2FA.' };
    }
    return {
      ok: true,
      backupCodes: Array.isArray(res.backupCodes) ? res.backupCodes : [],
      warning: res.warning || ''
    };
  }

  async function disable2fa({ password }) {
    const res = await request('POST', '/api/2fa/desativar', {
      senha: String(password || ''),
      password: String(password || '')
    });
    if (!res.ok) {
      return { ok: false, error: res.error || 'Não foi possível desativar o 2FA.' };
    }
    return { ok: true };
  }

  async function getPaymentProfile() {
    const res = await request('GET', '/api/auth/payment-status');
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao consultar pagamento.' };
    const profile = mapPaymentProfile(res.profile || res.session || res);
    return { ok: true, profile };
  }

  async function refreshPaymentProfile() {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };
    const result = await getPaymentProfile();
    if (!result.ok) return result;
    applyPaymentToSession(result.profile);
    return { ok: true, profile: result.profile, session: Store.getSession() };
  }

  /**
   * Usuário clicou "Já paguei".
   * Gateway futuro: aqui entraria a confirmação automática (webhook/Pix checkout).
   * Hoje só marca pendente_revisao para o admin confirmar manualmente.
   */
  async function markPaymentForReview(opts = {}) {
    const comprovante = String(opts.comprovanteDataUrl || opts.comprovante || '').trim();
    if (!comprovante || comprovante.length < 32) {
      return { ok: false, error: 'Envie a foto ou print do comprovante de pagamento.' };
    }
    if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(comprovante)) {
      return { ok: false, error: 'Comprovante inválido. Use JPG, PNG ou WEBP.' };
    }
    const res = await request('POST', '/api/auth/payment-review', {
      comprovanteDataUrl: comprovante
    });
    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível registrar.' };
    const profile = mapPaymentProfile(res.profile);
    if (profile) applyPaymentToSession(profile);
    return {
      ok: true,
      statusPagamento: profile?.statusPagamento || 'pendente_revisao',
      session: Store.getSession()
    };
  }

  async function listPendingPaymentReviews() {
    const res = await request('GET', '/api/auth/admin/pending-payments');
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao listar.', users: [] };
    return {
      ok: true,
      users: (res.users || []).map(mapPaymentProfile)
    };
  }

  async function confirmUserPayment(userId) {
    const res = await request('POST', '/api/auth/admin/confirm-payment', {
      userId: Number(userId)
    });
    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível confirmar.' };
    return { ok: true, profile: mapPaymentProfile(res.profile) };
  }

  const PLAN_PRICES = {
    pessoal_unico: { label: 'Liberar Vendas', valor: 20, sufixo: '(pagamento único)' },
    empresarial_mensal: { label: 'Plano Empresarial', valor: 79.9, sufixo: '/mês' }
  };

  function getPlanPrice(tipoContaOrPlano) {
    const tipo = normalizeTipoConta(tipoContaOrPlano);
    if (tipo === 'empresa' || tipoContaOrPlano === 'empresarial_mensal') {
      return PLAN_PRICES.empresarial_mensal;
    }
    return PLAN_PRICES.pessoal_unico;
  }

  function isVendasLocked(profileOrSession) {
    const src = profileOrSession || Store.getSession();
    if (!src) return false;
    if (isPaymentActive(src.statusPagamento)) return false;
    return normalizeTipoConta(src.tipoConta) !== 'empresa';
  }

  function isFreePlan(profileOrSession) {
    const src = profileOrSession || Store.getSession();
    if (!src) return false;
    return !isPaymentActive(src.statusPagamento);
  }

  const FREE_RAFFLE_LIMIT = 1;

  async function countUserRaffles() {
    const usage = await getRaffleUsage();
    if (!usage.ok) return { ok: false, error: usage.error || 'Erro ao listar rifas.', count: 0 };
    return { ok: true, count: Number(usage.ativa) || 0 };
  }

  async function getRaffleUsage() {
    const gate = await guardSession();
    if (!gate.ok) return { ok: false, error: gate.error || 'Não autenticado.', ativa: 0 };
    const res = await request('GET', '/api/rifas/usage');
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao consultar uso.', ativa: 0 };
    return {
      ok: true,
      ativa: Number(res.ativa) || 0,
      limitFree: Number(res.limitFree) || FREE_RAFFLE_LIMIT,
      config: res.config || null
    };
  }

  async function checkRaffleCreateLimit(profileOrSession) {
    const src = profileOrSession || Store.getSession();
    if (!src?.userId) return { ok: false, reason: 'none' };
    if (!isFreePlan(src)) return { ok: true, unlimited: true };

    const usage = await getRaffleUsage();
    if (!usage.ok) {
      return { ok: false, reason: 'error', error: usage.error || 'Não foi possível verificar suas rifas.' };
    }
    const limit = Number(usage.limitFree) || FREE_RAFFLE_LIMIT;
    if (usage.ativa >= limit) {
      return {
        ok: false,
        reason: 'free-limit',
        count: usage.ativa,
        limit,
        profile: src
      };
    }
    return { ok: true, count: usage.ativa, limit };
  }

  function isEmpresaPaymentRequired(profileOrSession) {
    const src = profileOrSession || Store.getSession();
    if (!src) return false;
    if (isPaymentActive(src.statusPagamento)) return false;
    return normalizeTipoConta(src.tipoConta) === 'empresa';
  }

  /** true se a página atual pode ser usada sem pagamento ativo */
  function isPaymentExemptPage(pathname = window.location.pathname) {
    const file = String(pathname || '').split('/').pop() || '';
    const exempt = new Set([
      '',
      'index.html',
      'login.html',
      'cadastro.html',
      'pagamento.html',
      'admin-pagamentos.html',
      'compartilhar.html',
      'offline.html',
      'termos.html'
    ]);
    return exempt.has(file);
  }

  function isAgeExemptPage(pathname = window.location.pathname) {
    const file = String(pathname || '').split('/').pop() || '';
    const exempt = new Set([
      '',
      'index.html',
      'login.html',
      'cadastro.html',
      'confirmar-idade.html',
      'compartilhar.html',
      'offline.html',
      'termos.html'
    ]);
    return exempt.has(file);
  }

  const AGE_STATUS_CACHE_MS = 60 * 1000;
  let lastAgeStatus = null;
  let ageStatusPromise = null;

  async function getAgeStatus({ force = false } = {}) {
    const session = Store.getSession();
    const userId = session?.userId;
    if (
      !force &&
      userId &&
      lastAgeStatus?.userId === userId &&
      Date.now() - lastAgeStatus.checkedAt < AGE_STATUS_CACHE_MS
    ) {
      return lastAgeStatus.result;
    }
    if (!force && ageStatusPromise?.userId === userId) {
      return ageStatusPromise.promise;
    }

    const promise = (async () => {
      const res = await request('GET', '/api/auth/idade-status');
      if (res?.blocked || res?.reason === 'underage') {
        return {
          ok: false,
          blocked: true,
          reason: 'underage',
          error:
            res.error ||
            'O uso deste sistema é restrito a maiores de 18 anos. Não é possível continuar com esta conta.',
          idadePendente: true,
          idadeBloqueada: true,
          identidadeRegistrada: false
        };
      }
      if (!res?.ok) {
        return {
          ok: false,
          error: res?.error || 'Não foi possível verificar a idade.',
          reason: res?.reason || ''
        };
      }
      if (res.session) applyPaymentToSession(res.session);
      const result = {
        ok: true,
        idadePendente: res.idadePendente === true,
        idadeConfirmada: res.idadeConfirmada === true,
        idadeBloqueada: res.idadeBloqueada === true,
        cpfVerificado: res.cpfVerificado === true,
        identidadeRegistrada: res.identidadeRegistrada === true,
        session: Store.getSession()
      };
      if (userId && !result.idadePendente) {
        lastAgeStatus = { userId, checkedAt: Date.now(), result };
      }
      return result;
    })();

    ageStatusPromise = { userId, promise };
    try {
      return await promise;
    } finally {
      if (ageStatusPromise?.promise === promise) ageStatusPromise = null;
    }
  }

  function clearAgeStatusCache() {
    lastAgeStatus = null;
    ageStatusPromise = null;
  }

  async function confirmAge({ dataNascimento, cpf }) {
    const res = await request('POST', '/api/auth/confirmar-idade', {
      dataNascimento: String(dataNascimento || '').trim(),
      cpf: normalizeCpfDigits(cpf)
    });
    if (res?.blocked || res?.reason === 'underage' || res?.motivo === 'menor_de_idade') {
      return {
        ok: false,
        blocked: true,
        reason: 'underage',
        motivo: res.motivo || 'menor_de_idade',
        error:
          res.error ||
          'O uso deste sistema é restrito a maiores de 18 anos. Não é possível continuar com esta conta.'
      };
    }
    // Só aceita se o backend confirmou o cruzamento CPF + data (valido === true)
    if (!res?.ok || res.valido !== true) {
      return {
        ok: false,
        valido: false,
        error:
          res?.error ||
          cpfVerifyErrorMessage(res?.motivo, 'CPF e data de nascimento não conferem. Não foi possível salvar.'),
        reason: res?.reason || '',
        motivo: res?.motivo || '',
        needsMigration: !!res?.needsMigration
      };
    }
    const tipoSessao = normalizeTipoConta(res.session?.tipoConta || res.session?.tipo_conta);
    if (tipoSessao !== 'empresa' && res.session?.identidadeRegistrada !== true && res.session?.cpfVerificado !== true) {
      return {
        ok: false,
        valido: false,
        error: 'A verificação do CPF não foi concluída. Os dados não foram salvos.',
        motivo: 'dados_nao_conferem'
      };
    }
    if (res.session) applyPaymentToSession(res.session);
    clearAgeStatusCache();
    const session = Store.getSession();
    if (session) {
      Store.setSession({
        ...session,
        idadePendente: false,
        idadeConfirmada: true,
        idadeBloqueada: res.session?.idadeBloqueada === true,
        cpfVerificado: true,
        identidadeRegistrada: true
      });
    }
    return { ok: true, valido: true, session: Store.getSession() };
  }

  async function ensureAgeAccess() {
    if (isAgeExemptPage()) return { ok: true, exempt: true };

    const session = Store.getSession();
    if (!session?.userId) return { ok: false, reason: 'none' };
    if (normalizeTipoConta(session.tipoConta) === 'empresa') {
      return { ok: true, skipped: true };
    }
    if (isDeveloperAccount(session)) return { ok: true, skipped: true };

    if (!needsAgeConfirmation(session)) {
      return { ok: true, session };
    }

    const status = await getAgeStatus();
    if (status.blocked) {
      window.location.replace('confirmar-idade.html');
      return { ok: false, reason: 'underage', session: Store.getSession() };
    }
    if (status.ok && status.idadePendente !== true) {
      return { ok: true, session: Store.getSession() };
    }
    if (status.ok && status.idadePendente === true) {
      window.location.replace('confirmar-idade.html');
      return { ok: false, reason: 'age', session: Store.getSession() };
    }

    if (!needsAgeConfirmation(Store.getSession())) {
      return { ok: true, session: Store.getSession(), skipped: true };
    }
    return { ok: true, skipped: true, reason: status.reason || 'network' };
  }

  async function ensurePaymentAccess() {
    if (isPaymentExemptPage()) return { ok: true, exempt: true };

    const session = Store.getSession();
    if (!session?.userId) return { ok: false, reason: 'none' };

    const result = await refreshPaymentProfile();
    if (!result.ok) {
      // Sem schema / rede: não bloqueia quem já usava o sistema
      return { ok: true, skipped: true };
    }

    if (isPaymentActive(result.profile?.statusPagamento)) {
      return { ok: true, session: Store.getSession() };
    }

    const tipo = normalizeTipoConta(result.profile?.tipoConta);
    if (tipo !== 'empresa') {
      return { ok: true, vendasLocked: true, session: Store.getSession() };
    }

    window.location.href = 'pagamento.html';
    return { ok: false, reason: 'payment', session: Store.getSession() };
  }

  async function ensureVendasAccess() {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, reason: 'none' };

    const result = await refreshPaymentProfile();
    const profile = result.ok ? result.profile : session;
    if (!isVendasLocked(profile)) {
      return { ok: true, session: Store.getSession() };
    }
    return {
      ok: false,
      reason: 'vendas-locked',
      profile,
      session: Store.getSession()
    };
  }

  const SESSION_VALIDATION_CACHE_MS = 5 * 1000;
  let lastSessionValidation = null;
  let sessionValidationPromise = null;

  async function validateActiveSession({ strict = true, force = false } = {}) {
    const session = resolveAuthSession() || Store.getSession();
    if (!session?.userId) return { ok: false, reason: 'none' };
    // Desenvolvedor: sem bloqueio de sessão única entre dispositivos
    if (session.isDev || isDeveloperAccount(session)) {
      return { ok: true, skipped: true, reason: 'developer-multi-device' };
    }
    if (!session.sessionToken) {
      return strict ? { ok: false, reason: 'no-token' } : { ok: true, skipped: true };
    }

    const token = String(session.sessionToken);
    if (
      !force &&
      lastSessionValidation?.token === token &&
      Date.now() - lastSessionValidation.checkedAt < SESSION_VALIDATION_CACHE_MS
    ) {
      return { ok: true, cached: true };
    }
    if (sessionValidationPromise?.token === token) return sessionValidationPromise.promise;

    const promise = (async () => {
      const res = await request('POST', '/api/auth/validate-session', {
        userId: Number(session.userId),
        sessionToken: token
      });

      if (isNetworkFailure(res)) {
        return { ok: false, reason: 'network', error: res.error };
      }
      if (res.ok) {
        lastSessionValidation = { token, checkedAt: Date.now() };
        return { ok: true };
      }
      return {
        ok: false,
        reason: res.reason || 'network',
        error: res.error || 'Não foi possível validar a sessão.'
      };
    })();
    sessionValidationPromise = { token, promise };
    try {
      return await promise;
    } finally {
      if (sessionValidationPromise?.promise === promise) sessionValidationPromise = null;
    }
  }

  /**
   * Online = sessão ativa no banco (sessao_token).
   * Offline só após logout (ou troca de dispositivo que limpa o token).
   * Não depende de heartbeat / último acesso.
   */
  function isUserOnline(user) {
    if (!user) return false;
    if (Object.prototype.hasOwnProperty.call(user, 'sessionActive')) {
      return Boolean(user.sessionActive);
    }
    return Boolean(user.sessionToken || user.sessao_token);
  }

  async function touchPresence() {
    const session = Store.getSession();
    if (!session?.sessionToken || !session?.userId) {
      return { ok: false, skipped: true };
    }
    const res = await request('POST', '/api/auth/presenca', {});
    if (!res.ok) {
      return {
        ok: false,
        needsSchema: Boolean(res.needsSchema),
        error: res.error || 'Falha ao atualizar presença.'
      };
    }
    return { ok: true, lastSeen: res.lastSeen || new Date().toISOString() };
  }

  function redirectToLogin(reason) {
    const target = reason ? `index.html?motivo=${reason}` : 'index.html';
    window.location.href = target;
  }

  function resetLocalSession() {
    try {
      if (typeof Store.resetForLoginScreen === 'function') Store.resetForLoginScreen();
      else Store.clearSession();
    } catch { /* ignore */ }
  }

  /**
   * Encerra sessao_token no banco com o token do painel (Store), sem usar DevAuth.
   * keepalive: sobrevive a navegação (ex.: redirect para login no celular).
   */
  async function revokePanelSessionToken(sessionToken) {
    const token = String(sessionToken || '').trim();
    if (!token) return { ok: false, skipped: true };
    try {
      await fetch(`${baseUrl()}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: '{}',
        keepalive: true
      });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  /**
   * Quando o app exige login de novo (gate sessionStorage sumiu no celular, etc.),
   * encerra a sessão no banco antes de limpar o localStorage.
   */
  async function endBrowserSession() {
    let token = '';
    try {
      token = String(Store.getSession()?.sessionToken || '').trim();
    } catch {
      /* ignore */
    }
    if (token) {
      await revokePanelSessionToken(token);
    }
    resetLocalSession();
    return { ok: true };
  }

  function requireAuth() {
    const session = Store.getSession();
    const gateOk = typeof Store.hasAuthGate === 'function' ? Store.hasAuthGate() : true;
    if (!session || !gateOk) {
      const token = session?.sessionToken;
      if (token) {
        void revokePanelSessionToken(token).finally(() => {
          resetLocalSession();
          redirectToLogin();
        });
      } else {
        resetLocalSession();
        redirectToLogin();
      }
      return null;
    }
    return session;
  }

  async function requireActiveSession() {
    const session = Store.getSession();
    const gateOk = typeof Store.hasAuthGate === 'function' ? Store.hasAuthGate() : true;
    if (!session || !gateOk) {
      await endBrowserSession();
      redirectToLogin();
      return { ok: false, session: null };
    }

    const check = await validateActiveSession({ strict: true });
    if (check.ok || check.reason === 'schema' || check.reason === 'network') {
      return { ok: true, session };
    }

    try {
      await logout();
    } catch {
      try { Store.clearSession(); } catch { /* ignore */ }
    }
    redirectToLogin('outro-dispositivo');
    return { ok: false, session: null };
  }

  /** Garante sessão válida antes de operações autenticadas */
  async function guardSession() {
    const check = await validateActiveSession({ strict: true });
    if (check.ok || check.reason === 'schema') return { ok: true };
    if (check.reason === 'network') {
      return { ok: false, error: 'Não foi possível validar a sessão. Tente novamente.' };
    }
    try {
      await logout();
    } catch {
      try { Store.clearSession(); } catch { /* ignore */ }
    }
    redirectToLogin('outro-dispositivo');
    return { ok: false, error: 'Sessão encerrada: conta em uso em outro dispositivo.' };
  }

  async function updateProfile({ name, currentPassword, newPassword, photo } = {}) {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };

    const nomeCheck = (typeof window !== 'undefined' && window.NomeCompleto?.validateFullName)
      ? window.NomeCompleto.validateFullName(name)
      : { ok: Boolean(String(name || '').trim()), value: String(name || '').trim(), error: 'Informe o nome completo.' };
    if (!nomeCheck.ok) return { ok: false, error: nomeCheck.error || 'Informe o nome completo.' };
    const nome = nomeCheck.value;

    const wantsPassword = Boolean(String(newPassword || '').trim());
    if (wantsPassword) {
      if (!currentPassword) {
        return { ok: false, error: 'Informe a senha atual para redefinir.' };
      }
      if (String(newPassword).length < 6) {
        return { ok: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' };
      }
    }

    const payload = {
      name: nome,
      currentPassword: currentPassword ? String(currentPassword) : '',
      newPassword: wantsPassword ? String(newPassword) : ''
    };
    if (photo !== undefined) payload.photo = photo;

    const res = await request('PUT', '/api/auth/profile', payload);

    if (!res.ok || !res.session) {
      return { ok: false, error: res.error || 'Não foi possível atualizar o perfil.' };
    }

    Store.setSession({
      userId: res.session.userId,
      email: res.session.email,
      name: res.session.name,
      photo: res.session.photo || '',
      sessionToken: res.session.sessionToken || session.sessionToken || undefined
    });
    applyPaymentToSession(res.session);

    return {
      ok: true,
      session: Store.getSession(),
      passwordChanged: Boolean(res.passwordChanged ?? wantsPassword),
      needsSchema: Boolean(res.needsSchema)
    };
  }

  async function logout() {
    let token = '';
    try {
      token = String(Store.getSession()?.sessionToken || '').trim();
    } catch {
      /* ignore */
    }
    if (token) {
      await revokePanelSessionToken(token);
    } else {
      try {
        await request('POST', '/api/auth/logout', {});
      } catch {
        /* ignore */
      }
    }

    Store.clearSession();
    Store.setRaffles([]);
    try {
      sessionStorage.removeItem('pas_promo_banner_seen');
      sessionStorage.removeItem('pas_promo_banner_seen_v2');
      sessionStorage.removeItem('pas_promo_banner_seen_v3');
      sessionStorage.removeItem('pas_promo_banner_seen_v4');
      sessionStorage.removeItem('pas_aviso_visto_token');
      sessionStorage.removeItem('pas_show_rating');
      sessionStorage.removeItem('pas_show_contribuicao');
      sessionStorage.removeItem('pas_auth_ok');
      sessionStorage.removeItem('pas_nav_allowed');
    } catch { /* ignore */ }
    return { ok: true };
  }

  // ─── Rifas ──────────────────────────────────────────────

  async function listRaffles({ ownerId, status = 'ativa' } = {}) {
    const gate = await guardSession();
    if (!gate.ok) return { ok: false, error: gate.error || 'Não autenticado.', raffles: [] };

    const session = Store.getSession();
    void ownerId;
    if (!session?.userId) return { ok: false, error: 'Não autenticado.', raffles: [] };

    const st = String(status || 'ativa').trim() || 'ativa';
    const res = await request('GET', `/api/rifas?status=${encodeURIComponent(st)}`);
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao listar rifas.', raffles: [] };

    const raffles = res.raffles || [];
    Store.setRaffles(raffles);
    return { ok: true, raffles };
  }

  async function setRaffleCycle(id, status) {
    const gate = await guardSession();
    if (!gate.ok) return { ok: false, error: gate.error || 'Não autenticado.' };
    const res = await request('POST', `/api/rifas/${encodeURIComponent(id)}/ciclo`, { status });
    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível atualizar o ciclo da rifa.' };
    if (res.raffle) Store.upsertRaffle(res.raffle);
    return { ok: true, raffle: res.raffle };
  }

  async function getRaffle(id) {
    const res = await request('GET', `/api/rifas/${encodeURIComponent(id)}`);
    if (!res.ok || !res.raffle) {
      return { ok: false, error: res.error || 'Recurso não encontrado.' };
    }
    const raffle = res.raffle;
    if (raffle.ownerId) Store.upsertRaffle(raffle);
    return { ok: true, raffle };
  }

  async function lookupBuyerSlots(raffleId, phone) {
    const res = await request('POST', `/api/rifas/${encodeURIComponent(raffleId)}/buyer-slots`, {
      phone: String(phone || '')
    });
    if (!res.ok) {
      return { ok: false, error: res.error || 'Recurso não encontrado.', slots: [] };
    }
    return { ok: true, slots: res.slots || [] };
  }

  function buildRaffleForm(form) {
    return {
      name: String(form.name ?? '').trim(),
      description: String(form.description ?? '').trim(),
      prize: String(form.prize ?? '').trim(),
      price: Number(form.price) || 0,
      quantity: Number(form.quantity) || 0,
      drawDate: toDateInput(form.drawDate),
      drawTime: form.drawTime ?? '',
      winnersCount: Math.max(1, Number(form.winnersCount || form.quantidade_sorteios) || 1),
      purpose: normalizePurpose(form.purpose || form.finalidade),
      segment: String(form.segment ?? form.segmento ?? '').trim(),
      raffleType: String(form.raffleType ?? form.tipo_rifa ?? '').trim(),
      colorPrimary: String(form.colorPrimary ?? form.cor_principal ?? '').trim(),
      colorSecondary: String(form.colorSecondary ?? form.cor_secundaria ?? '').trim(),
      pixKey: String(form.pixKey ?? form.chavePix ?? '').trim(),
      pixName: String(form.pixName ?? form.pixNome ?? '').trim(),
      pixBank: String(form.pixBank ?? form.pixBanco ?? '').trim(),
      pixType: String(form.pixType ?? form.pixTipo ?? 'cpf').trim().toLowerCase(),
      image: form.image ?? '',
      benefitImage: form.benefitImage ?? '',
      bgImage: form.bgImage ?? form.imagem_fundo ?? ''
    };
  }

  async function createRaffle(form) {
    const gate = await guardSession();
    if (!gate.ok) return { ok: false, error: gate.error || 'Não autenticado.' };

    const session = Store.getSession();
    if (!session) return { ok: false, error: 'Não autenticado.' };

    const limitCheck = await checkRaffleCreateLimit(session);
    if (!limitCheck.ok && limitCheck.reason === 'free-limit') {
      return {
        ok: false,
        freeLimit: true,
        error:
          'No plano Free você pode criar apenas 1 rifa. Torne-se Pro (pagamento ativo) para criar rifas ilimitadas.'
      };
    }
    if (!limitCheck.ok && limitCheck.reason === 'error') {
      return { ok: false, error: limitCheck.error || 'Não foi possível verificar o limite de rifas.' };
    }

    const payload = buildRaffleForm(form || {});
    if (payload.purpose === 'beneficente' && !payload.pixKey) {
      return { ok: false, error: 'Informe a chave PIX da rifa.' };
    }

    const res = await request('POST', '/api/rifas', payload);
    if (!res.ok || !res.raffle) {
      return { ok: false, error: res.error || 'Erro ao criar rifa.' };
    }

    Store.upsertRaffle(res.raffle);
    return { ok: true, raffle: res.raffle };
  }

  async function editRaffle(id, updates) {
    const gate = await guardSession();
    if (!gate.ok) return { ok: false, error: gate.error || 'Não autenticado.' };

    const changes = updates || {};

    // O backend regrava a rifa inteira: mescla com o estado atual
    const current = Store.getRaffleById ? Store.getRaffleById(id) : null;
    let base = current;
    if (!base) {
      const loaded = await getRaffle(id);
      if (!loaded.ok) return loaded;
      base = loaded.raffle;
    }

    const merged = {
      name: changes.name != null ? changes.name : base.name,
      description: changes.description != null ? changes.description : base.description,
      prize: changes.prize != null ? changes.prize : base.prize,
      price: changes.price != null ? changes.price : base.price,
      quantity: changes.quantity != null ? changes.quantity : base.quantity,
      drawDate: changes.drawDate != null ? changes.drawDate : base.drawDate,
      drawTime: changes.drawTime != null ? changes.drawTime : base.drawTime,
      purpose: changes.purpose ?? changes.finalidade ?? base.purpose,
      segment: changes.segment ?? changes.segmento ?? base.segment,
      pixKey: changes.pixKey != null ? changes.pixKey : base.pixKey,
      pixName: changes.pixName != null ? changes.pixName : base.pixName,
      pixBank: changes.pixBank != null ? changes.pixBank : base.pixBank,
      pixType: changes.pixType != null ? changes.pixType : base.pixType,
      winnersCount: changes.winnersCount ?? changes.quantidade_sorteios ?? 1,
      raffleType: changes.raffleType ?? changes.tipo_rifa ?? '',
      colorPrimary: changes.colorPrimary ?? changes.cor_principal ?? '',
      colorSecondary: changes.colorSecondary ?? changes.cor_secundaria ?? '',
      benefitImage: changes.benefitImage != null ? changes.benefitImage : base.benefitImage
    };

    // imagem/fundo só são enviados quando realmente mudam (backend usa COALESCE)
    if (changes.image != null) merged.image = changes.image;
    if (changes.bgImage != null) merged.bgImage = changes.bgImage;

    const payload = buildRaffleForm(merged);
    if (changes.image == null) delete payload.image;
    if (changes.bgImage == null) delete payload.bgImage;
    if (changes.status != null) payload.status = changes.status;

    if (payload.purpose === 'beneficente' && !payload.pixKey) {
      return { ok: false, error: 'Informe a chave PIX da rifa.' };
    }

    const res = await request('PUT', `/api/rifas/${encodeURIComponent(id)}`, payload);
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao editar rifa.' };
    if (res.raffle) {
      Store.upsertRaffle(res.raffle);
      return { ok: true, raffle: res.raffle };
    }
    return getRaffle(id);
  }

  /** Remove a rifa e todas as vendas/reservas vinculadas */
  async function deleteRaffle(id) {
    const gate = await guardSession();
    if (!gate.ok) return { ok: false, error: gate.error || 'Não autenticado.' };

    const session = Store.getSession();
    if (!session) return { ok: false, error: 'Não autenticado.' };

    const raffleId = Number(id);
    if (!Number.isFinite(raffleId) || raffleId <= 0) {
      return { ok: false, error: 'Rifa inválida.' };
    }

    const res = await request('DELETE', `/api/rifas/${raffleId}`);
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao excluir a rifa.' };

    Store.removeRaffle(raffleId);
    return { ok: true };
  }

  /**
   * Sorteia ganhadores entre os números vendidos e grava o resultado na rifa.
   */
  async function drawWinners(raffleId, count = 1) {
    const session = Store.getSession();
    if (!session) return { ok: false, error: 'Não autenticado.' };

    const res = await request('POST', `/api/rifas/${encodeURIComponent(raffleId)}/sortear`, {
      count: Math.max(1, Number(count) || 1)
    });

    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível salvar o sorteio.' };
    if (res.raffle) Store.upsertRaffle(res.raffle);

    return {
      ok: true,
      raffle: res.raffle,
      winners: res.winners || [],
      poolSize: Number(res.poolSize) || 0,
      drawnAt: res.drawnAt || null
    };
  }

  // ─── Vendas / Reservas ──────────────────────────────────

  async function saveSale(raffleId, number, buyer, status) {
    const res = await request('POST', `/api/vendas/${encodeURIComponent(raffleId)}`, {
      number: Number(number),
      status,
      buyer: {
        name: buyer?.name || '',
        phone: buyer?.phone || '',
        city: buyer?.city || '',
        observation: buyer?.observation || ''
      }
    });

    if (!res.ok) {
      return {
        ok: false,
        error: res.error || (status === 'reservado' ? 'Erro ao reservar número.' : 'Erro ao registrar venda.')
      };
    }

    if (res.raffle) Store.upsertRaffle(res.raffle);
    const slot = res.slot
      || (res.raffle?.numbers || []).find((n) => Number(n.number) === Number(number));
    return { ok: true, slot, raffle: res.raffle };
  }

  async function reserveNumber(raffleId, number, buyer) {
    if (!buyer?.name || !buyer?.phone) {
      return { ok: false, error: 'Informe nome e telefone.' };
    }
    return saveSale(raffleId, number, buyer, 'reservado');
  }

  async function sellNumber(raffleId, number, buyer) {
    let buyerData = buyer;

    if (!buyerData?.name || !buyerData?.phone) {
      // Confirmação de reserva: reaproveita os dados já cadastrados
      const current = await getRaffle(raffleId);
      if (!current.ok) return current;
      const slot = (current.raffle.numbers || []).find(
        (n) => n.number === number || Number(n.number) === Number(number)
      );
      if (!slot) return { ok: false, error: 'Número inválido.' };
      if (slot.status === 'vendido') return { ok: false, error: 'Número já vendido.' };
      buyerData = {
        name: slot.buyerName,
        phone: slot.buyerPhone,
        city: slot.buyerCity,
        observation: slot.observation
      };
    }

    if (!buyerData?.name || !buyerData?.phone) {
      return { ok: false, error: 'Informe nome e telefone.' };
    }

    return saveSale(raffleId, number, buyerData, 'vendido');
  }

  async function removeSale(raffleId, number, status) {
    const path = `/api/vendas/${encodeURIComponent(raffleId)}/${Number(number)}?status=${status}`;
    const res = await request('DELETE', path);

    if (!res.ok) {
      const fallback = status === 'reservado' ? 'Reserva não encontrada.' : 'Venda não encontrada.';
      return { ok: false, error: res.error || fallback };
    }

    if (res.raffle) Store.upsertRaffle(res.raffle);
    const slot = res.slot
      || (res.raffle?.numbers || []).find((n) => Number(n.number) === Number(number));
    return { ok: true, slot, raffle: res.raffle };
  }

  async function cancelReservation(raffleId, number) {
    return removeSale(raffleId, number, 'reservado');
  }

  async function cancelSale(raffleId, number) {
    return removeSale(raffleId, number, 'vendido');
  }

  /** Últimas vendas/reservas das rifas do usuário logado */
  async function listOwnerSales({ limit = 40 } = {}) {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.', sales: [] };

    const res = await request('GET', `/api/vendas/owner?limit=${Number(limit) || 40}`);
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao listar vendas.', sales: [] };
    return { ok: true, sales: res.sales || [] };
  }

  // ─── Gráfico de vendas ──────────────────────────────────

  /** Normaliza data_registro (pt-BR, ISO, etc.) → YYYY-MM-DD */
  function dayKeyFromRaw(rawInput) {
    const raw = String(rawInput || '').trim();
    if (!raw) return null;

    // ISO / SQL: 2026-08-01 ou 2026-08-01T12:00:00
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

    // pt-BR: 1/8/2026, 01/08/2026, 1-8-2026
    const br = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
    if (br) {
      const dd = br[1].padStart(2, '0');
      const mm = br[2].padStart(2, '0');
      const yyyy = br[3];
      return `${yyyy}-${mm}-${dd}`;
    }

    // Evita new Date('1/8/2026') (interpretação americana)
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dayKeyFromSale(sale) {
    return dayKeyFromRaw(sale?.date) || dayKeyFromRaw(sale?.createdAt);
  }

  function labelDay(isoKey) {
    const [, m, d] = String(isoKey).split('-');
    return `${d}/${m}`;
  }

  const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  function labelMonth(ymKey) {
    const [y, m] = String(ymKey).split('-');
    const idx = Math.max(0, Math.min(11, (Number(m) || 1) - 1));
    return `${MONTH_SHORT[idx]}/${String(y).slice(-2)}`;
  }

  function buildDayKeys(span) {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const keys = [];
    for (let i = span - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      keys.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      );
    }
    return keys;
  }

  function buildMonthKeys(span) {
    const now = new Date();
    now.setDate(1);
    now.setHours(12, 0, 0, 0);
    const keys = [];
    for (let i = span - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return keys;
  }

  function isReservedStatus(status) {
    const st = String(status || 'vendido').toLowerCase().trim();
    return st === 'reservado' || st === 'reserva';
  }

  async function fetchOwnerSaleRows({ detailed = false } = {}) {
    const session = Store.getSession();
    if (!session?.userId) {
      return { ok: false, error: 'Não autenticado.', rows: [], nameById: new Map() };
    }

    const res = await request('GET', `/api/vendas/chart-rows${detailed ? '?detailed=1' : ''}`);
    if (!res.ok) {
      return {
        ok: false,
        error: res.error || 'Erro ao carregar vendas.',
        rows: [],
        nameById: new Map()
      };
    }

    const nameById = new Map(Object.entries(res.nameById || {}));
    return { ok: true, rows: res.rows || [], nameById };
  }

  /**
   * Conta registros de vendas_rifa por dia/mês.
   * Cada linha = 1 número (vendido ou reservado).
   * period: '7d' | 'month'
   */
  async function getSalesChartData({ period = '7d', days = 7 } = {}) {
    const session = Store.getSession();
    if (!session?.userId) {
      return {
        ok: false,
        error: 'Não autenticado.',
        period: '7d',
        keys: [],
        labels: [],
        vendidos: [],
        reservados: []
      };
    }

    const mode = String(period || '7d').toLowerCase() === 'month' ? 'month' : '7d';
    const keys = mode === 'month'
      ? buildMonthKeys(12)
      : buildDayKeys(Math.max(1, Math.min(31, Number(days) || 7)));
    const labelFn = mode === 'month' ? labelMonth : labelDay;
    const toBucket = (dayKey) => (mode === 'month' ? dayKey.slice(0, 7) : dayKey);
    const empty = (ok = true, error) => ({
      ok,
      error,
      period: mode,
      keys: [...keys],
      labels: keys.map(labelFn),
      vendidos: keys.map(() => 0),
      reservados: keys.map(() => 0)
    });

    const fetched = await fetchOwnerSaleRows({ detailed: false });
    if (!fetched.ok) return empty(false, fetched.error);

    const soldMap = Object.fromEntries(keys.map((k) => [k, 0]));
    const reservedMap = Object.fromEntries(keys.map((k) => [k, 0]));
    const keySet = new Set(keys);

    (fetched.rows || []).forEach((row) => {
      const dayKey = dayKeyFromRaw(row.data_registro) || dayKeyFromRaw(row.created_at);
      if (!dayKey) return;
      const key = toBucket(dayKey);
      if (!keySet.has(key)) return;
      if (isReservedStatus(row.status)) reservedMap[key] += 1;
      else soldMap[key] += 1;
    });

    return {
      ok: true,
      period: mode,
      keys: [...keys],
      labels: keys.map(labelFn),
      vendidos: keys.map((k) => soldMap[k]),
      reservados: keys.map((k) => reservedMap[k])
    };
  }

  /**
   * Detalhe resumido ao clicar numa barra do gráfico.
   * kind: 'vendido' | 'reservado'
   * key: YYYY-MM-DD (7d) ou YYYY-MM (month)
   */
  async function getSalesChartBucketDetails({ period = '7d', key, kind = 'vendido', limit = 40 } = {}) {
    const bucket = String(key || '').trim();
    if (!bucket) return { ok: false, error: 'Período inválido.', items: [], total: 0 };

    const mode = String(period || '7d').toLowerCase() === 'month' ? 'month' : '7d';
    const wantReserved = String(kind || '').toLowerCase() === 'reservado';
    const toBucket = (dayKey) => (mode === 'month' ? dayKey.slice(0, 7) : dayKey);

    const fetched = await fetchOwnerSaleRows({ detailed: true });
    if (!fetched.ok) return { ok: false, error: fetched.error, items: [], total: 0 };

    const items = [];
    (fetched.rows || []).forEach((row) => {
      const dayKey = dayKeyFromRaw(row.data_registro) || dayKeyFromRaw(row.created_at);
      if (!dayKey || toBucket(dayKey) !== bucket) return;
      const reserved = isReservedStatus(row.status);
      if (wantReserved !== reserved) return;
      items.push({
        id: row.id,
        raffleId: String(row.rifa_id),
        raffleName: fetched.nameById.get(String(row.rifa_id)) || 'Rifa',
        number: row.numero,
        buyerName: row.nome || 'Comprador',
        status: reserved ? 'reservado' : 'vendido',
        date: row.data_registro || null,
        time: row.hora_registro || null,
        value: Number(row.valor) || 0
      });
    });

    items.sort((a, b) => {
      const ta = `${a.date || ''} ${a.time || ''}`;
      const tb = `${b.date || ''} ${b.time || ''}`;
      return tb.localeCompare(ta);
    });

    const total = items.length;
    const capped = items.slice(0, Math.max(1, Number(limit) || 40));
    const label = mode === 'month' ? labelMonth(bucket) : labelDay(bucket);

    return {
      ok: true,
      period: mode,
      key: bucket,
      label,
      kind: wantReserved ? 'reservado' : 'vendido',
      total,
      items: capped
    };
  }

  // ─── Compartilhamento ───────────────────────────────────

  function generateShareLink(raffleId) {
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    return `${base}compartilhar.html?id=${raffleId}`;
  }

  function shareRaffle(raffleId) {
    return {
      ok: true,
      link: generateShareLink(raffleId),
      displayLink: `https://powerappssistemas.com/rifa/${raffleId}`
    };
  }

  async function copyLink(text) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    } catch {
      const input = document.createElement('textarea');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
      return { ok: true };
    }
  }

  function shareWhatsApp(link, name) {
    const text = encodeURIComponent(`Participe da rifa: ${name}\n${link}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  function shareTelegram(link, name) {
    const text = encodeURIComponent(`Participe da rifa: ${name}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`, '_blank');
  }

  function shareFacebook(link) {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, '_blank');
  }

  // ─── Busca / Filtros / Stats ────────────────────────────

  async function searchRaffle(query, { status = 'all' } = {}) {
    const listed = await listRaffles({ status });
    if (!listed.ok) {
      const err = new Error(listed.error || 'Erro ao listar rifas.');
      err.code = 'list_raffles_failed';
      throw err;
    }
    const q = (query || '').trim().toLowerCase();
    if (!q) return listed.raffles;
    return listed.raffles.filter((r) => {
      const dateBr = (r.drawDate || '').split('-').reverse().join('/');
      return (
        (r.name || '').toLowerCase().includes(q) ||
        (r.prize || '').toLowerCase().includes(q) ||
        (r.drawDate || '').includes(q) ||
        dateBr.includes(q)
      );
    });
  }

  function filterNumbers(numbers, filter) {
    if (!filter || filter === 'todas') return numbers;
    const map = {
      disponiveis: 'disponivel',
      vendidas: 'vendido',
      reservadas: 'reservado'
    };
    const status = map[filter];
    return numbers.filter((n) => n.status === status);
  }

  function calculateStatistics(rafflesInput) {
    const raffles = rafflesInput || Store.getRaffles();
    let totalNumbers = 0;
    let sold = 0;
    let reserved = 0;
    let available = 0;
    let raised = 0;
    let expected = 0;

    raffles.forEach((r) => {
      expected += (Number(r.price) || 0) * (Number(r.quantity) || 0);
      const nums = r.numbers || [];
      if (nums.length) {
        nums.forEach((n) => {
          totalNumbers += 1;
          if (n.status === 'vendido') {
            sold += 1;
            raised += Number(r.price) || 0;
          } else if (n.status === 'reservado') {
            reserved += 1;
          } else {
            available += 1;
          }
        });
      } else {
        const qty = Number(r.quantity) || 0;
        const soldN = Number(r.soldCount) || 0;
        const reservedN = Number(r.reservedCount) || 0;
        sold += soldN;
        reserved += reservedN;
        totalNumbers += qty;
        available += Math.max(0, qty - soldN - reservedN);
        raised += soldN * (Number(r.price) || 0);
      }
    });

    const soldPercent = totalNumbers ? Math.round((sold / totalNumbers) * 100) : 0;
    return {
      totalRaffles: raffles.length,
      totalNumbers,
      sold,
      reserved,
      available,
      raised,
      expected,
      soldPercent
    };
  }

  async function updateDashboard() {
    const listed = await listRaffles();
    if (!listed.ok) return calculateStatistics([]);
    return calculateStatistics(listed.raffles);
  }

  async function getPendingReservations() {
    const session = Store.getSession();
    if (!session) return [];
    const res = await request('GET', '/api/vendas/by-status?status=reservado');
    if (!res.ok) return [];
    return res.items || [];
  }

  /** Números com status vendido (vendas realizadas) */
  async function getCompletedSales() {
    const session = Store.getSession();
    if (!session) return [];
    const res = await request('GET', '/api/vendas/by-status?status=vendido');
    if (!res.ok) return [];
    return res.items || [];
  }

  // ─── Notificações ───────────────────────────────────────

  async function listNotifications({ limit = 30, sync = false } = {}) {
    const session = resolveAuthSession();
    if (!session?.userId && !session?.sessionToken) {
      return { ok: false, error: 'Não autenticado.', notifications: [] };
    }

    // A rota exige authRequired; evitar uma validação duplicada antes de cada leitura.
    const params = new URLSearchParams({
      limit: String(Number(limit) || 30)
    });
    if (sync) params.set('sync', '1');
    const res = await request('GET', `/api/notificacoes?${params.toString()}`);
    if (!res.ok) {
      return {
        ok: false,
        error: res.error || 'Erro ao listar notificações.',
        notifications: []
      };
    }

    return {
      ok: true,
      notifications: res.notifications || [],
      newSystemKeys: res.newSystemKeys || []
    };
  }

  async function markNotificationRead(id) {
    const session = resolveAuthSession();
    if (!session?.userId && !session?.sessionToken) return { ok: false, error: 'Não autenticado.' };

    const res = await request('PATCH', `/api/notificacoes/${encodeURIComponent(id)}/lida`, {});
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao marcar como lida.' };
    return { ok: true };
  }

  async function markAllNotificationsRead() {
    const session = resolveAuthSession();
    if (!session?.userId && !session?.sessionToken) return { ok: false, error: 'Não autenticado.' };

    const res = await request('POST', '/api/notificacoes/marcar-todas', {});
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao marcar notificações.' };
    return { ok: true };
  }

  async function clearNotifications() {
    const session = resolveAuthSession();
    if (!session?.userId && !session?.sessionToken) return { ok: false, error: 'Não autenticado.' };

    const res = await request('POST', '/api/notificacoes/limpar', {});
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao limpar notificações.' };
    return { ok: true };
  }

  /** Portal do desenvolvedor: publica aviso modal global */
  async function publishSystemAviso({ title = '', message = '' } = {}) {
    const titulo = String(title || '').trim();
    const mensagem = String(message || '').trim();

    if (titulo.length < 3) {
      return { ok: false, error: 'Informe um título (mínimo 3 caracteres).' };
    }
    if (mensagem.length < 5) {
      return { ok: false, error: 'Informe a mensagem (mínimo 5 caracteres).' };
    }

    const res = await request('POST', '/api/aviso/publish', {
      title: titulo,
      message: mensagem
    });
    if (!res.ok) {
      return { ok: false, error: res.error || 'Não foi possível publicar o aviso.' };
    }
    return { ok: true, aviso: res.aviso || null };
  }

  async function getSystemAviso() {
    const res = await request('GET', '/api/aviso');
    if (!res.ok) {
      return { ok: false, error: res.error || 'Erro ao carregar aviso.', aviso: null };
    }
    return { ok: true, aviso: res.aviso || null };
  }

  async function markSystemAvisoRead(token = '') {
    const session = resolveAuthSession();
    if (!session?.userId && !session?.sessionToken) {
      return { ok: false, error: 'Não autenticado.' };
    }
    const res = await request('POST', '/api/aviso/lido', { token: String(token || '').trim() });
    if (!res.ok) {
      return { ok: false, error: res.error || 'Erro ao marcar aviso como lido.' };
    }
    return { ok: true, token: res.token || token };
  }

  async function broadcastSystemNotification(payload = {}) {
    return publishSystemAviso(payload);
  }

  /**
   * Atualizações em tempo quase real via polling do endpoint /api/notificacoes/ping.
   * Dispara onChange quando mudam vendas, notificações ou rifas do usuário (usuario_id).
   */
  function subscribeLiveUpdates(userId, onChange) {
    const uid = Number(userId);
    if (!uid || typeof onChange !== 'function') {
      return { ok: false, unsubscribe() {} };
    }

    const POLL_MS = 30 * 1000;
    let stopped = false;
    let timer = null;
    let lastVenda = null;
    let lastNotif = null;
    let lastRifa = null;
    let lastRifaCount = null;

    async function tick() {
      if (stopped) return;
      if (document.hidden) {
        if (!stopped) timer = setTimeout(tick, POLL_MS);
        return;
      }
      const res = await request('GET', '/api/notificacoes/ping');
      if (stopped) return;

      if (res.ok) {
        const maxVenda = Number(res.maxVenda) || 0;
        const maxNotif = Number(res.maxNotif) || 0;
        const maxRifa = Number(res.maxRifa) || 0;
        const rifaCount = Number(res.rifaCount) || 0;

        if (lastVenda === null || lastNotif === null || lastRifa === null || lastRifaCount === null) {
          lastVenda = maxVenda;
          lastNotif = maxNotif;
          lastRifa = maxRifa;
          lastRifaCount = rifaCount;
        } else if (
          maxVenda !== lastVenda ||
          maxNotif !== lastNotif ||
          maxRifa !== lastRifa ||
          rifaCount !== lastRifaCount
        ) {
          let source = 'notificacoes';
          if (maxRifa !== lastRifa || rifaCount !== lastRifaCount) source = 'rifas';
          else if (maxVenda !== lastVenda) source = 'vendas_rifa';
          lastVenda = maxVenda;
          lastNotif = maxNotif;
          lastRifa = maxRifa;
          lastRifaCount = rifaCount;
          try {
            onChange(source);
          } catch (err) {
            console.warn('Live update handler', err);
          }
        }
      }

      if (!stopped) timer = setTimeout(tick, POLL_MS);
    }

    tick();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (timer) clearTimeout(timer);
        timer = null;
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return {
      ok: true,
      unsubscribe() {
        stopped = true;
        if (timer) clearTimeout(timer);
        timer = null;
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }

  // ─── Banner do sistema ──────────────────────────────────

  async function getSystemBanner() {
    const res = await request('GET', '/api/banner');
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao carregar banner.', banner: null };
    return { ok: true, banner: res.banner || null };
  }

  async function saveSystemBanner({ image = '', title = '', link = '', active = true } = {}) {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };

    const imagem = String(image || '').trim();
    if (!imagem) return { ok: false, error: 'Selecione uma imagem do banner.' };

    const res = await request('PUT', '/api/banner', {
      image: imagem,
      title: String(title || '').trim(),
      link: String(link || '').trim(),
      active: !!active
    });

    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível salvar o banner.' };
    return { ok: true, banner: res.banner || null };
  }

  async function clearSystemBanner() {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };

    const res = await request('DELETE', '/api/banner');
    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível remover o banner.' };
    return { ok: true, banner: res.banner || null };
  }

  // ─── Avaliações do sistema ──────────────────────────────

  async function getMySystemRating() {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.', rating: null };

    const res = await request('GET', '/api/avaliacoes/minha');
    if (!res.ok) {
      return { ok: false, error: res.error || 'Erro ao carregar avaliação.', rating: null };
    }
    return { ok: true, rating: res.rating || null };
  }

  async function listSystemRatings() {
    const res = await request('GET', '/api/avaliacoes');
    if (!res.ok) {
      return { ok: false, error: res.error || 'Erro ao listar avaliações.', ratings: [] };
    }
    return { ok: true, ratings: res.ratings || [] };
  }

  async function submitSystemRating({ stars, liked, reason = '' } = {}) {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };

    let estrelas = Number(stars);
    if (!Number.isFinite(estrelas) || estrelas < 1 || estrelas > 5) {
      if (liked === true) estrelas = 5;
      else if (liked === false) estrelas = 1;
      else return { ok: false, error: 'Escolha de 1 a 5 estrelas.' };
    }
    estrelas = Math.round(estrelas);

    const motivo = String(reason || '').trim();
    if (estrelas <= 3 && motivo.length < 5) {
      return { ok: false, error: 'Descreva o motivo (mínimo 5 caracteres).' };
    }

    const res = await request('PUT', '/api/avaliacoes', {
      stars: estrelas,
      liked: estrelas >= 4,
      reason: motivo
    });

    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível salvar a avaliação.' };
    return { ok: true, rating: res.rating || null };
  }

  async function updateSystemRatingAdmin({
    id,
    status,
    reply,
    internalNotes,
    notifyUser = true
  } = {}) {
    const res = await request('PATCH', `/api/avaliacoes/${encodeURIComponent(id)}`, {
      status,
      reply,
      internalNotes,
      notifyUser
    });
    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível atualizar a avaliação.' };
    return { ok: true, rating: res.rating || null };
  }

  function normalizeRatingStatus(value, stars) {
    const raw = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    if (['em_aberto', 'em_andamento', 'resolvido', 'positiva'].includes(raw)) return raw;
    const n = Number(stars);
    return Number.isFinite(n) && n > 0 && n <= 3 ? 'em_aberto' : 'positiva';
  }

  // ─── Recursos auxiliares ────────────────────────────────

  async function uploadImage(file, _opts = {}) {
    if (!file) return { ok: false, error: 'Selecione uma imagem.' };
    const type = String(file.type || '').toLowerCase();
    if (!/^image\/(jpeg|jpg|png|webp)$/.test(type)) {
      return { ok: false, error: 'Use uma imagem JPG, PNG ou WEBP.' };
    }
    if (file.size > 8 * 1024 * 1024) {
      return { ok: false, error: 'A imagem deve ter no máximo 8 MB.' };
    }

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
        reader.readAsDataURL(file);
      });
      if (!dataUrl || !/^data:image\//i.test(dataUrl)) {
        return { ok: false, error: 'Falha ao processar a foto.' };
      }
      return {
        ok: true,
        dataUrl,
        url: '',
        path: '',
        fileName: file.name || 'upload.jpg',
        stored: false,
        legacy: true
      };
    } catch (err) {
      return { ok: false, error: err.message || 'Falha ao processar a foto.' };
    }
  }

  async function generatePDF(_raffleId) {
    return { ok: false, message: 'Geração de PDF preparada para implementação futura.' };
  }

  async function generatePix(_raffleId, _number) {
    return { ok: false, message: 'PIX preparado para integração futura.' };
  }

  async function generateQRCode(_link) {
    return { ok: false, message: 'QR Code preparado para implementação futura.' };
  }

  function printRaffle(_raffleId) {
    window.print();
  }

  async function sendNotification(_payload) {
    return { ok: false, message: 'Notificações push preparadas para FCM.' };
  }

  // ─── Compat: métodos usados pelas páginas (dev / manutenção / suporte / sorteios) ──

  /**
   * No cliente, privilégio NUNCA depende de allowlist de e-mail (isso vaza quem é admin).
   * Fonte da verdade: nivelAcesso / portal devolvidos pela API após login.
   */
  function isAdminEmail(_email) {
    return false;
  }

  function getAccessLevel(userOrEmail) {
    if (!userOrEmail) return 'usuario';
    if (typeof userOrEmail === 'object') {
      if (userOrEmail.isDev === true) return 'super_admin';
      let from = String(userOrEmail.nivelAcesso || userOrEmail.nivel_acesso || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s-]+/g, '_');
      if (from === 'super_admin' || from === 'superadmin' || from === 'super_administrador') {
        return 'super_admin';
      }
      if (from === 'admin' || from === 'administrador' || from === 'administradora') return 'admin';
      if (from === 'gerente') return 'gerente';
      if (from === 'funcionarios' || from === 'funcionario' || from === 'funcionaria') {
        return 'funcionarios';
      }
    }
    return 'usuario';
  }

  function hasMinAccessLevel(userOrEmail, required) {
    const rank = { usuario: 1, funcionarios: 1, admin: 2, gerente: 2, super_admin: 3 };
    const have = rank[getAccessLevel(userOrEmail)] || 0;
    const need = rank[String(required || 'usuario').trim().toLowerCase()] || 0;
    return have >= need;
  }

  function isDeveloperAccount(userOrSession) {
    if (!userOrSession || typeof userOrSession !== 'object') return false;
    if (userOrSession.isDev === true) return true;
    return getAccessLevel(userOrSession) === 'super_admin';
  }

  function isProAccount(userOrSession) {
    if (!userOrSession) return false;
    if (isDeveloperAccount(userOrSession)) return true;
    const pago = userOrSession.pagoEm ?? userOrSession.pago_em;
    if (pago != null && String(pago).trim() && String(pago).toLowerCase() !== 'null') return true;
    return normalizeStatusPagamento(userOrSession.statusPagamento || userOrSession.status_pagamento) === 'ativo';
  }

  function requireRole(minLevel) {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };
    if (!hasMinAccessLevel(session, minLevel)) {
      return { ok: false, error: 'Acesso negado.' };
    }
    return { ok: true, session };
  }

  /**
   * Login do portal: dono (super_admin) ou equipe com cargo (gerente/financeiro/vendas).
   */
  async function loginDeveloperPortal({ email, password } = {}) {
    const mail = String(email || '').trim().toLowerCase();
    const pass = String(password || '');
    if (!mail || !pass) return { ok: false, error: 'Preencha e-mail e senha.' };

    const result = await login({ email: mail, password: pass });
    if (!result.ok) return result;

    const nivel = String(result.session?.nivelAcesso || result.session?.nivel_acesso || '')
      .trim()
      .toLowerCase();
    const cargoDev = String(result.session?.cargoDev || result.session?.cargo_dev || '')
      .trim()
      .toLowerCase();
    const portalOk =
      result.session?.isDev === true ||
      result.session?.portalDev === true ||
      nivel === 'super_admin' ||
      nivel === 'superadmin' ||
      nivel === 'admin' ||
      nivel === 'administrador' ||
      nivel === 'gerente' ||
      nivel === 'funcionarios' ||
      ['gerente', 'financeiro', 'vendas', 'funcionarios'].includes(cargoDev);

    if (!portalOk) {
      try {
        Store.clearSession?.();
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        error: 'Acesso negado. Esta conta não tem permissão no portal do desenvolvedor.'
      };
    }

    if (result.session) {
      result.session.cargoDev = cargoDev || null;
      const nivelFinal =
        result.session.isDev === true ||
        nivel === 'super_admin' ||
        nivel === 'superadmin'
          ? 'super_admin'
          : nivel === 'admin' ||
              nivel === 'administrador' ||
              nivel === 'gerente' ||
              nivel === 'funcionarios'
            ? nivel === 'administrador'
              ? 'admin'
              : nivel
            : result.session.nivelAcesso || 'usuario';
      const defaultTabs =
        nivelFinal === 'super_admin'
          ? [
              'dashboard',
              'usuarios',
              'assinaturas',
              'pagamentos',
              'avaliacoes',
              'planos',
              'relatorios',
              'configuracoes',
              'logs'
            ]
          : nivelFinal === 'admin' || nivelFinal === 'gerente'
            ? [
                'dashboard',
                'usuarios',
                'assinaturas',
                'pagamentos',
                'avaliacoes',
                'planos',
                'relatorios'
              ]
            : nivelFinal === 'funcionarios'
              ? ['dashboard', 'usuarios', 'avaliacoes']
              : [];
      result.session.permissoesDev =
        Array.isArray(result.session.permissoesDev) && result.session.permissoesDev.length
          ? result.session.permissoesDev
          : defaultTabs;
      result.session.portalDev = true;
      if (nivelFinal === 'super_admin') {
        result.session.nivelAcesso = 'super_admin';
        result.session.isDev = true;
      } else if (nivelFinal === 'admin' || nivelFinal === 'gerente' || nivelFinal === 'funcionarios') {
        result.session.nivelAcesso = nivelFinal;
        result.session.isDev = false;
      }
    }
    return result;
  }

  async function getSystemMaintenance() {
    const res = await request('GET', '/api/maintenance');
    if (!res.ok) {
      return {
        ok: false,
        error: res.error || 'Erro ao carregar manutenção.',
        maintenance: res.maintenance || { active: false, message: '' }
      };
    }
    return { ok: true, maintenance: res.maintenance || { active: false, message: '' } };
  }

  async function activateSystemMaintenance({ message } = {}) {
    const res = await request('POST', '/api/maintenance/activate', { message });
    if (!res.ok) return { ok: false, error: res.error || 'Falha ao ativar manutenção.' };
    return { ok: true, maintenance: res.maintenance };
  }

  async function deactivateSystemMaintenance() {
    const res = await request('POST', '/api/maintenance/deactivate', {});
    if (!res.ok) return { ok: false, error: res.error || 'Falha ao desativar manutenção.' };
    return { ok: true, maintenance: res.maintenance };
  }

  async function listUsersForDev({ limit = 200 } = {}) {
    const res = await request('GET', `/api/dev/users?limit=${encodeURIComponent(limit)}`);
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao listar.', users: [] };
    return { ok: true, users: res.users || [] };
  }

  async function updateUserForDev(userId, patch = {}) {
    const res = await request('PATCH', `/api/dev/users/${encodeURIComponent(userId)}`, patch);
    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível atualizar.' };
    return { ok: true, user: res.user || null };
  }

  async function getDeveloperProfile() {
    const res = await request('GET', '/api/dev/profile');
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao carregar perfil.' };
    const profile = res.profile || null;
    // Garante que não misturou sessão de outro usuário do painel
    try {
      const devEmail = String(DevAuth?.getSession?.()?.email || '').trim().toLowerCase();
      const profileEmail = String(profile?.email || '').trim().toLowerCase();
      if (devEmail && profileEmail && devEmail !== profileEmail) {
        return {
          ok: false,
          error: 'Sessão do portal não corresponde ao perfil retornado. Faça login novamente.'
        };
      }
    } catch {
      /* ignore */
    }
    return { ok: true, profile, needsSchema: !!res.needsSchema };
  }

  async function updateDeveloperProfile({
    name,
    currentPassword,
    newPassword,
    photo
  } = {}) {
    const res = await request('PUT', '/api/dev/profile', {
      name,
      currentPassword,
      newPassword,
      photo
    });
    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível salvar.' };

    if (res.session) {
      if (typeof DevAuth !== 'undefined' && DevAuth.getSession?.()) {
        const s = DevAuth.getSession() || {};
        DevAuth.setSession?.({
          ...s,
          userId: res.session.userId,
          email: res.session.email,
          name: res.session.name,
          photo: res.session.photo || '',
          sessionToken: res.session.sessionToken || s.sessionToken || null,
          role: 'developer',
          nivelAcesso: 'super_admin'
        });
      }
    }

    return {
      ok: true,
      profile: res.profile || null,
      session: res.session || DevAuth?.getSession?.() || null,
      passwordChanged: !!res.passwordChanged,
      needsSchema: !!res.needsSchema
    };
  }

  async function getDevStats() {
    const res = await request('GET', '/api/dev/stats');
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao carregar stats.' };
    return { ok: true, stats: res.stats || {} };
  }

  async function getUsageConfig() {
    const res = await request('GET', '/api/dev/usage-config');
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao carregar configuração.', config: null, usage: null };
    return { ok: true, config: res.config || null, usage: res.usage || null };
  }

  async function updateUsageConfig(patch) {
    const res = await request('PATCH', '/api/dev/usage-config', patch);
    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível salvar.' };
    return { ok: true, config: res.config || null };
  }

  async function getNeonUsage({ period = 'this_month', from, to, refresh = false } = {}) {
    const q = new URLSearchParams();
    if (period) q.set('period', period);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    if (refresh) q.set('refresh', '1');
    const res = await request('GET', `/api/admin/neon/usage?${q.toString()}`);
    if (!res.ok) return { ok: false, error: res.error || 'Acesso negado.', status: res.status };
    return res;
  }

  async function refreshNeonUsage({ period = 'this_month', from, to } = {}) {
    const res = await request('POST', '/api/admin/neon/usage/refresh', { period, from, to });
    if (!res.ok) return { ok: false, error: res.error || 'Acesso negado.' };
    return res;
  }

  async function getNeonUsageHistory({ limit = 14 } = {}) {
    const res = await request('GET', `/api/admin/neon/usage/history?limit=${encodeURIComponent(limit)}`);
    if (!res.ok) return { ok: false, error: res.error || 'Acesso negado.', history: [] };
    return { ok: true, history: res.history || [] };
  }

  async function getNeonUsageSettings() {
    const res = await request('GET', '/api/admin/neon/usage/settings');
    if (!res.ok) return { ok: false, error: res.error || 'Acesso negado.', config: null };
    return { ok: true, config: res.config || null };
  }

  async function saveNeonUsageSettings(patch) {
    const res = await request('PUT', '/api/admin/neon/usage/settings', patch);
    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível salvar.' };
    return { ok: true, config: res.config || null };
  }

  async function sendPublicFeedback(payload = {}) {
    const res = await request('POST', '/api/feedback', {
      subject: payload.subject,
      message: payload.message,
      context: payload.context,
      replyTo: payload.replyTo || payload.email,
      senderName: payload.senderName || payload.name
    });
    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível enviar.' };
    return { ok: true };
  }

  async function getCloudflareStatus() {
    const res = await request('GET', '/api/dev/cloudflare/status');
    if (!res.ok) return { ok: false, error: res.error || 'Acesso negado.' };
    return res;
  }

  async function listCloudflareEvents(limit = 40) {
    const res = await request('GET', `/api/dev/cloudflare/events?limit=${encodeURIComponent(limit)}`);
    if (!res.ok) return { ok: false, error: res.error || 'Acesso negado.', events: [] };
    return { ok: true, events: res.events || [] };
  }

  async function getSecuritySummary() {
    const res = await request('GET', '/api/dev/security/summary');
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao carregar o resumo de segurança.', summary: {}, blocks: [] };
    return { ok: true, summary: res.summary || {}, blocks: res.blocks || [] };
  }

  async function listSecurityIncidents(filters = {}) {
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v != null && String(v).trim() !== '') q.set(k, String(v).trim());
    });
    const qs = q.toString();
    const res = await request('GET', `/api/dev/security/incidents${qs ? `?${qs}` : ''}`);
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao listar incidentes.', incidents: [] };
    return { ok: true, incidents: res.incidents || [] };
  }

  async function listSecurityBlocks() {
    const res = await request('GET', '/api/dev/security/blocks');
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao listar bloqueios.', blocks: [] };
    return { ok: true, blocks: res.blocks || [] };
  }

  async function liftSecurityBlock(ip) {
    const res = await request('POST', '/api/dev/security/blocks/lift', { ip });
    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível encerrar o bloqueio.' };
    return { ok: true };
  }

  async function getSecurityIncident(id) {
    const res = await request('GET', `/api/dev/security/incidents/${encodeURIComponent(id)}`);
    if (!res.ok) return { ok: false, error: res.error || 'Incidente não encontrado.' };
    return { ok: true, ...res };
  }

  async function resolveSecurityIncident({ href, ref } = {}) {
    const q = new URLSearchParams();
    if (href) q.set('href', href);
    if (ref) q.set('ref', ref);
    const res = await request('GET', `/api/dev/security/incidents/resolve?${q.toString()}`);
    if (!res.ok) return { ok: false, error: res.error || 'Incidente não encontrado.' };
    return { ok: true, ...res };
  }

  async function listRelatedSecurityIncidents(id) {
    const res = await request('GET', `/api/dev/security/incidents/${encodeURIComponent(id)}/related`);
    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível listar relacionados.', items: [], total: 0 };
    return { ok: true, items: res.items || [], total: Number(res.total || 0) };
  }

  async function updateSecurityIncident(id, patch = {}) {
    const res = await request('PATCH', `/api/dev/security/incidents/${encodeURIComponent(id)}`, {
      workflow_status: patch.workflow_status,
      nota: patch.nota
    });
    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível atualizar.' };
    return { ok: true, ...res };
  }

  async function listSupportThreads({ limit = 100, unreadOnly = false } = {}) {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (unreadOnly) qs.set('unreadOnly', '1');
    const res = await request('GET', `/api/suporte/threads?${qs.toString()}`);
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao listar.', threads: [] };
    return { ok: true, threads: res.threads || [] };
  }

  async function listSupportMessages(userId, { limit = 200 } = {}) {
    const res = await request(
      'GET',
      `/api/suporte/messages/${encodeURIComponent(userId)}?limit=${encodeURIComponent(limit)}`
    );
    if (!res.ok) {
      return { ok: false, error: res.error || 'Erro ao carregar mensagens.', messages: [] };
    }
    const messages = (res.messages || []).map((m) => ({
      ...m,
      from: m.from || m.sender || 'usuario',
      sender: m.sender || m.from || 'usuario',
      body: m.body || m.corpo || '',
      read: Boolean(m.read ?? m.lida),
      edited: Boolean(m.edited ?? m.editedAt ?? m.editado_em),
      editedAt: m.editedAt || m.editado_em || null
    }));
    return {
      ok: true,
      thread: res.thread,
      messages,
      typingUser: !!res.typingUser,
      typingDev: !!res.typingDev,
      signature:
        res.signature ||
        messages
          .map((m) => `${m.id}:${m.read ? 1 : 0}:${m.editedAt || ''}:${String(m.body || '').length}`)
          .join('|')
    };
  }

  async function getSupportUnread() {
    const res = await request('GET', '/api/suporte/unread');
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao consultar mensagens não lidas.', unread: 0 };
    return { ok: true, unread: Number(res.unread) || 0 };
  }

  async function sendSupportMessage({ userId, body, asDev = false } = {}) {
    const res = await request('POST', '/api/suporte/messages', { userId, body, asDev });
    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível enviar.' };
    return { ok: true, message: res.message, thread: res.thread };
  }

  async function editSupportMessage({ id, body, asDev = false } = {}) {
    const res = await request('PATCH', `/api/suporte/messages/${encodeURIComponent(id)}`, {
      body,
      asDev
    });
    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível editar a mensagem.' };
    return { ok: true, message: res.message };
  }

  async function markSupportMessagesRead({ userId, asDev = false } = {}) {
    const res = await request('POST', '/api/suporte/read', { userId, asDev });
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao marcar como lidas.' };
    return { ok: true };
  }

  async function setSupportTyping({ userId, asDev = false, typing = true } = {}) {
    const res = await request('POST', '/api/suporte/typing', { userId, asDev, typing: !!typing });
    if (!res.ok) return { ok: false, error: res.error || 'Falha ao atualizar digitação.' };
    return {
      ok: true,
      typingUser: !!res.typingUser,
      typingDev: !!res.typingDev
    };
  }

  async function getSupportLive(userId, { sig = '' } = {}) {
    const qs = sig ? `?sig=${encodeURIComponent(sig)}` : '';
    const res = await request('GET', `/api/suporte/live/${encodeURIComponent(userId)}${qs}`);
    if (!res.ok) {
      return { ok: false, error: res.error || 'Erro ao sincronizar.', messages: [] };
    }
    if (res.unchanged) {
      return {
        ok: true,
        unchanged: true,
        thread: res.thread,
        messages: null,
        typingUser: !!res.typingUser,
        typingDev: !!res.typingDev,
        signature: res.signature || sig
      };
    }
    const messages = (res.messages || []).map((m) => ({
      ...m,
      from: m.from || m.sender || 'usuario',
      sender: m.sender || m.from || 'usuario',
      body: m.body || m.corpo || '',
      read: Boolean(m.read ?? m.lida),
      edited: Boolean(m.edited ?? m.editedAt ?? m.editado_em),
      editedAt: m.editedAt || m.editado_em || null
    }));
    return {
      ok: true,
      unchanged: false,
      thread: res.thread,
      messages,
      typingUser: !!res.typingUser,
      typingDev: !!res.typingDev,
      signature:
        res.signature ||
        messages
          .map((m) => `${m.id}:${m.read ? 1 : 0}:${m.editedAt || ''}:${String(m.body || '').length}`)
          .join('|')
    };
  }

  async function ensureSupportThread(userId) {
    const res = await listSupportMessages(userId, { limit: 1 });
    if (!res.ok) return res;
    return { ok: true, thread: res.thread };
  }

  function subscribeSupportChat(_userId, onChange) {
    const timer = setInterval(() => {
      try {
        if (typeof onChange === 'function') onChange({ type: 'poll' });
      } catch {
        /* ignore */
      }
    }, 8000);
    return {
      ok: true,
      unsubscribe() {
        clearInterval(timer);
      }
    };
  }

  async function listInstagramDraws() {
    const res = await request('GET', '/api/sorteios');
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao listar.', draws: [] };
    return { ok: true, draws: res.sorteios || res.draws || [] };
  }

  async function getInstagramDraw(id) {
    const res = await request('GET', `/api/sorteios/${encodeURIComponent(id)}`);
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao carregar.' };
    return { ok: true, draw: res.sorteio || res.draw };
  }

  async function createInstagramDraw(payload) {
    const res = await request('POST', '/api/sorteios', payload || {});
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao criar.' };
    return { ok: true, draw: res.sorteio || res.draw };
  }

  async function updateInstagramDraw(id, payload) {
    const res = await request('PUT', `/api/sorteios/${encodeURIComponent(id)}`, payload || {});
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao atualizar.' };
    return { ok: true, draw: res.sorteio || res.draw };
  }

  async function deleteInstagramDraw(id) {
    const res = await request('DELETE', `/api/sorteios/${encodeURIComponent(id)}`);
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao excluir.' };
    return { ok: true };
  }

  async function importInstagramComments(id, opts) {
    const res = await request('POST', `/api/sorteios/${encodeURIComponent(id)}/importar`, opts || {});
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao importar.' };
    return { ok: true, ...res };
  }

  async function validateInstagramParticipants(id) {
    const res = await request('POST', `/api/sorteios/${encodeURIComponent(id)}/validar`, {});
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao validar.' };
    return { ok: true, draw: res.sorteio || res.draw };
  }

  async function drawInstagramWinners(id, opts) {
    const res = await request('POST', `/api/sorteios/${encodeURIComponent(id)}/sortear`, opts || {});
    if (!res.ok) return { ok: false, error: res.error || 'Erro ao sortear.' };
    return { ok: true, draw: res.sorteio || res.draw, ...res };
  }

  async function listInstagramPosts() {
    return { ok: true, posts: [] };
  }

  async function resolveInstagramPost() {
    return { ok: false, error: 'Configure o Instagram na API.' };
  }

  async function publishInstagramDraw() {
    return { ok: false, error: 'Publicação Instagram ainda não disponível via API.' };
  }

  async function uploadInstagramImage() {
    return { ok: false, error: 'Upload Instagram ainda não disponível via API.' };
  }

  function parseInstagramUrl(url) {
    const raw = String(url || '').trim();
    const m = raw.match(/instagram\.com\/(?:p|reel)\/([^/?#]+)/i);
    return m ? { ok: true, shortcode: m[1] } : { ok: false, error: 'URL inválida.' };
  }

  async function getInstagramConnection() {
    return { ok: true, connected: false };
  }

  async function connectInstagram() {
    return { ok: false, error: 'OAuth Instagram ainda não configurado na API.' };
  }

  async function disconnectInstagram() {
    return { ok: true };
  }

  function resolveMediaSrc(value) {
    return String(value || '').trim();
  }

  async function resolveSignedMediaUrl(value) {
    return { ok: true, url: resolveMediaSrc(value) };
  }

  async function getPaymentProof(userId) {
    const uid = Number(userId);
    if (!uid) return { ok: false, error: 'Usuário inválido.', url: '' };
    const res = await request('GET', `/api/dev/users/${encodeURIComponent(uid)}/comprovante`);
    if (!res.ok) {
      return {
        ok: false,
        error: res.error || 'Comprovante não encontrado.',
        url: '',
        comprovanteEm: res.comprovanteEm || null
      };
    }
    const url = String(res.url || res.proof || '').trim();
    if (!url) {
      return {
        ok: false,
        error: res.error || 'Sem comprovante.',
        url: '',
        comprovanteEm: res.comprovanteEm || null
      };
    }
    return {
      ok: true,
      url,
      comprovanteEm: res.comprovanteEm || null,
      legacy: !!res.legacy
    };
  }

  return {
    createUser,
    validateEmail,
    login,
    requestPasswordReset,
    resetPassword,
    verify2fa,
    get2faStatus,
    start2fa,
    confirm2fa,
    disable2fa,
    updateProfile,
    logout,
    endBrowserSession,
    revokePanelSessionToken,
    requireAuth,
    requireActiveSession,
    validateActiveSession,
    touchPresence,
    isUserOnline,
    guardSession,
    normalizeTipoConta,
    normalizeCnpjDigits,
    isCnpjFormatValid,
    formatCnpjMask,
    normalizeStatusPagamento,
    isPaymentActive,
    isAdminEmail,
    isDeveloperAccount,
    isProAccount,
    getAccessLevel,
    hasMinAccessLevel,
    requireRole,
    loginDeveloperPortal,
    PLAN_PRICES,
    getPlanPrice,
    isVendasLocked,
    isFreePlan,
    FREE_RAFFLE_LIMIT,
    countUserRaffles,
    getRaffleUsage,
    checkRaffleCreateLimit,
    isEmpresaPaymentRequired,
    getPaymentProfile,
    refreshPaymentProfile,
    markPaymentForReview,
    listPendingPaymentReviews,
    confirmUserPayment,
    getPaymentProof,
    resolveSignedMediaUrl,
    resolveMediaSrc,
    isPaymentExemptPage,
    ensurePaymentAccess,
    ensureAgeAccess,
    validateAdultBirthDate,
    calcAgeYears,
    needsAgeConfirmation,
    normalizeCpfDigits,
    formatCpfMask,
    isCpfChecksumValid,
    verifyCpf,
    cpfVerifyErrorMessage,
    confirmAge,
    getAgeStatus,
    ensureVendasAccess,
    listRaffles,
    setRaffleCycle,
    getRaffle,
    lookupBuyerSlots,
    createRaffle,
    editRaffle,
    deleteRaffle,
    purposeMeta,
    normalizePurpose,
    generateNumbers,
    reserveNumber,
    sellNumber,
    cancelReservation,
    cancelSale,
    shareRaffle,
    generateShareLink,
    copyLink,
    shareWhatsApp,
    shareTelegram,
    shareFacebook,
    updateDashboard,
    searchRaffle,
    filterNumbers,
    calculateStatistics,
    getPendingReservations,
    getCompletedSales,
    listOwnerSales,
    getSalesChartData,
    getSalesChartBucketDetails,
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    broadcastSystemNotification,
    publishSystemAviso,
    getSystemAviso,
    markSystemAvisoRead,
    subscribeLiveUpdates,
    getSystemBanner,
    saveSystemBanner,
    clearSystemBanner,
    getSystemMaintenance,
    activateSystemMaintenance,
    deactivateSystemMaintenance,
    getMySystemRating,
    listSystemRatings,
    submitSystemRating,
    updateSystemRatingAdmin,
    normalizeRatingStatus,
    listUsersForDev,
    updateUserForDev,
    getDeveloperProfile,
    updateDeveloperProfile,
    getDevStats,
    getUsageConfig,
    updateUsageConfig,
    getNeonUsage,
    refreshNeonUsage,
    getNeonUsageHistory,
    getNeonUsageSettings,
    saveNeonUsageSettings,
    sendPublicFeedback,
    getCloudflareStatus,
    listCloudflareEvents,
    getSecuritySummary,
    listSecurityIncidents,
    listSecurityBlocks,
    liftSecurityBlock,
    getSecurityIncident,
    resolveSecurityIncident,
    listRelatedSecurityIncidents,
    updateSecurityIncident,
    listSupportThreads,
    listSupportMessages,
    getSupportUnread,
    sendSupportMessage,
    editSupportMessage,
    markSupportMessagesRead,
    setSupportTyping,
    getSupportLive,
    ensureSupportThread,
    subscribeSupportChat,
    listInstagramDraws,
    getInstagramDraw,
    createInstagramDraw,
    updateInstagramDraw,
    deleteInstagramDraw,
    importInstagramComments,
    validateInstagramParticipants,
    drawInstagramWinners,
    listInstagramPosts,
    resolveInstagramPost,
    publishInstagramDraw,
    uploadInstagramImage,
    parseInstagramUrl,
    getInstagramConnection,
    connectInstagram,
    disconnectInstagram,
    uploadImage,
    generatePDF,
    generatePix,
    generateQRCode,
    printRaffle,
    sendNotification,
    drawWinners,
    dayKeyFromSale
  };
})();

window.API = API;
window.createUser = (...a) => API.createUser(...a);
window.validateEmail = (...a) => API.validateEmail(...a);
window.login = (...a) => API.login(...a);
window.updateProfile = (...a) => API.updateProfile(...a);
window.logout = (...a) => API.logout(...a);
window.createRaffle = (...a) => API.createRaffle(...a);
window.editRaffle = (...a) => API.editRaffle(...a);
window.deleteRaffle = (...a) => API.deleteRaffle(...a);
window.generateNumbers = (...a) => API.generateNumbers(...a);
window.reserveNumber = (...a) => API.reserveNumber(...a);
window.sellNumber = (...a) => API.sellNumber(...a);
window.cancelReservation = (...a) => API.cancelReservation(...a);
window.cancelSale = (...a) => API.cancelSale(...a);
window.shareRaffle = (...a) => API.shareRaffle(...a);
window.generateShareLink = (...a) => API.generateShareLink(...a);
window.copyLink = (...a) => API.copyLink(...a);
window.shareWhatsApp = (...a) => API.shareWhatsApp(...a);
window.shareTelegram = (...a) => API.shareTelegram(...a);
window.shareFacebook = (...a) => API.shareFacebook(...a);
window.updateDashboard = (...a) => API.updateDashboard(...a);
window.drawWinners = (...a) => API.drawWinners(...a);
window.searchRaffle = (...a) => API.searchRaffle(...a);
window.filterNumbers = (...a) => API.filterNumbers(...a);
window.calculateStatistics = (...a) => API.calculateStatistics(...a);
