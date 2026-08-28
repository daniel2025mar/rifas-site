/**
 * PowerApps Sistemas — API com Supabase
 * Tabelas: usuarios | rifas | vendas_rifa
 */

const API = (() => {
  const IMG_PACK = '__pas_imgs';

  function db() {
    if (!window.supabaseClient) {
      throw new Error('Conexão com o banco de dados na nuvem indisponível.');
    }
    return window.supabaseClient;
  }

  function errMsg(error, fallback = 'Erro inesperado.') {
    const raw = (error && (error.message || error.details || error.hint || error.error)) || '';
    const s = String(raw).trim();
    if (!s) return fallback;
    // Projeto Supabase bloqueado por cota (Fair Use) — não é bug do formulário
    if (/exceed_egress_quota|exceeded_.*_quota|service for this project is restricted/i.test(s)) {
      return (
        'O banco na nuvem está temporariamente bloqueado por excesso de tráfego (egress). ' +
        'No Supabase: Billing → faça upgrade do plano ou remova o Spend Cap. ' +
        'Depois execute supabase/storage_media_egress.sql e faça deploy da função media.'
      );
    }
    if (/402|payment required/i.test(s) && /quota|restricted|egress/i.test(s)) {
      return (
        'Serviço do Supabase restrito por cota. Libere em Billing (Pro / sem Spend Cap) e tente de novo.'
      );
    }
    // Resposta binária (ex.: PNG do service worker) nunca deve virar mensagem de UI
    if (s.length > 280 || /PNG|IHDR|pHYs|IDAT|IEND/i.test(s) || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(s)) {
      return fallback;
    }
    if ((s.match(/\uFFFD/g) || []).length >= 3) return fallback;
    return s;
  }

  /** Colunas leves — listas sem base64 de imagens */
  const RAFFLE_LIST_COLS =
    'id, usuario_id, motivo, descricao, premio, valor, quantidade, quantidade_sorteios, data_sorteio, hora_sorteio, status, finalidade, segmento, tipo_rifa, cor_principal, cor_secundaria, chave_pix, pix_nome, pix_banco, pix_tipo, created_at, sorteado_em, resultado_sorteio';
  const RAFFLE_DETAIL_COLS =
    RAFFLE_LIST_COLS + ', imagem, imagem_beneficio, imagem_fundo';

  function isStoragePath(value) {
    const v = String(value || '').trim();
    if (!v || /^data:image\//i.test(v) || /^https?:\/\//i.test(v)) return false;
    return /^(rifas-media|avatars|banners|comprovantes)\//i.test(v) ||
      /^[0-9]+\/[a-zA-Z0-9._/-]+\.(jpe?g|png|webp)$/i.test(v);
  }

  function publicStorageUrl(pathOrUrl) {
    const raw = String(pathOrUrl || '').trim();
    if (!raw) return '';
    if (/^data:image\//i.test(raw) || /^https?:\/\//i.test(raw)) return raw;
    if (!isStoragePath(raw) && !raw.includes('/')) return raw;
    let bucket = 'rifas-media';
    let objectPath = raw;
    const m = raw.match(/^(rifas-media|avatars|banners|comprovantes)\/(.+)$/i);
    if (m) {
      bucket = m[1];
      objectPath = m[2];
    }
    try {
      const { data } = db().storage.from(bucket).getPublicUrl(objectPath);
      return data?.publicUrl || raw;
    } catch {
      return raw;
    }
  }

  function resolveMediaSrc(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^data:image\//i.test(raw) || /^https?:\/\//i.test(raw)) return raw;
    if (/^(rifas-media|avatars|banners)\//i.test(raw) || isStoragePath(raw)) {
      return publicStorageUrl(raw);
    }
    if (/^comprovantes\//i.test(raw)) return raw;
    return raw;
  }

  function resolveAuthSessionToken() {
    const auth = resolveAuthSession();
    if (auth?.sessionToken) return String(auth.sessionToken);
    try {
      if (typeof DevAuth !== 'undefined' && DevAuth.getSession) {
        const d = DevAuth.getSession();
        if (d?.sessionToken) return String(d.sessionToken);
      }
    } catch { /* ignore */ }
    return null;
  }

  /** Mensagens genéricas anti-IDOR (não revelam existência do recurso). */
  const IDOR_NOT_FOUND = 'Recurso não encontrado.';
  const IDOR_FORBIDDEN = 'Acesso negado.';

  function idorDeny(kind = 'not_found') {
    return { ok: false, error: kind === 'forbidden' ? IDOR_FORBIDDEN : IDOR_NOT_FOUND };
  }

  function nomeCompletoApi() {
    return window.NomeCompleto || null;
  }

  function validateFullName(raw) {
    const api = nomeCompletoApi();
    if (api?.validateFullName) return api.validateFullName(raw);
    const nome = String(raw || '').trim();
    if (!nome) return { ok: false, error: 'Informe o nome completo.' };
    return { ok: true, value: nome };
  }

  function bindFullNameInput(input) {
    const api = nomeCompletoApi();
    if (api?.bindFullNameInput) return api.bindFullNameInput(input);
    return input;
  }

  function normalizePhoneDigits(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function phonesMatch(a, b) {
    const da = normalizePhoneDigits(a);
    const db = normalizePhoneDigits(b);
    if (da.length < 10 || db.length < 10) return false;
    const ta = da.length > 11 ? da.slice(-11) : da;
    const tb = db.length > 11 ? db.slice(-11) : db;
    return ta === tb || ta.slice(-10) === tb.slice(-10);
  }

  function isRaffleOwner(raffle, userId) {
    if (!raffle || userId == null || userId === '') return false;
    return Number(raffle.ownerId) === Number(userId);
  }

  function toPublicRaffle(raffle) {
    if (!raffle) return null;
    const clone = { ...raffle };
    delete clone.ownerId;
    clone.numbers = (raffle.numbers || []).map((slot) => ({
      number: slot.number,
      status: slot.status,
      buyerName: null,
      buyerPhone: null,
      buyerCity: null,
      observation: null,
      date: null,
      time: null,
      saleId: null
    }));
    clone.winners = (raffle.winners || []).map((w) => ({
      place: w.place,
      number: w.number,
      name: w.name || '—',
      phone: '—',
      city: w.city && w.city !== '—' ? w.city : '—',
      date: w.date || '—',
      time: w.time || '—'
    }));
    return clone;
  }

  function raffleForViewer(raffle, session) {
    if (!raffle) return null;
    if (session && isRaffleOwner(raffle, session.userId)) return raffle;
    return toPublicRaffle(raffle);
  }

  function sessionTokenOrNull() {
    const session = Store.getSession();
    return session?.sessionToken ? String(session.sessionToken) : null;
  }

  /** Sessão do painel do usuário OU do portal do desenvolvedor */
  function resolveAuthSession() {
    const store = typeof Store !== 'undefined' ? Store.getSession() : null;
    if (store?.userId) {
      return {
        userId: Number(store.userId),
        email: store.email || '',
        name: store.name || '',
        role: store.role || 'user',
        sessionToken: store.sessionToken || null,
        isDev: false
      };
    }
    if (typeof DevAuth !== 'undefined' && DevAuth.isLoggedIn?.()) {
      const dev = DevAuth.getSession() || {};
      if (dev.userId) {
        return {
          userId: Number(dev.userId),
          email: dev.email || '',
          name: dev.name || '',
          role: 'developer',
          sessionToken: dev.sessionToken || null,
          isDev: true
        };
      }
    }
    return null;
  }

  function isMissingBenefitColumn(error) {
    return /imagem_beneficio|column|schema cache|Could not find/i.test(error?.message || '');
  }

  function isMissingPixColumn(error) {
    return /chave_pix|pix_nome|pix_banco|pix_tipo|column|schema cache|Could not find/i.test(error?.message || '');
  }

  function isMissingColumnError(error) {
    return /column|schema cache|Could not find/i.test(error?.message || '');
  }

  function packImages(prize, benefit) {
    const premio = prize || '';
    const beneficio = benefit || '';
    if (!beneficio) return premio;
    return JSON.stringify({ [IMG_PACK]: 1, premio, beneficio });
  }

  function unpackImages(row) {
    const benefitCol = row?.imagem_beneficio || '';
    const raw = row?.imagem || '';

    if (typeof raw === 'string' && raw.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed[IMG_PACK]) {
          return {
            image: resolveMediaSrc(parsed.premio || ''),
            benefitImage: resolveMediaSrc(benefitCol || parsed.beneficio || '')
          };
        }
      } catch (_) {
        /* imagem normal */
      }
    }

    return {
      image: resolveMediaSrc(raw || ''),
      benefitImage: resolveMediaSrc(benefitCol || '')
    };
  }

  /** Converte linha de rifas → modelo da UI */
  function mapRaffleRow(row, vendas = []) {
    const quantity = Number(row.quantidade) || 0;
    const numbers = generateNumbers(quantity);
    const byNum = new Map();
    const photos = unpackImages(row);

    (vendas || []).forEach((v) => {
      const key = Store.padNumber(Number(v.numero), quantity || Number(v.numero));
      byNum.set(String(Number(v.numero)), v);
      byNum.set(key, v);
    });

    numbers.forEach((slot) => {
      const venda = byNum.get(slot.number) || byNum.get(String(Number(slot.number)));
      if (!venda) return;
      const st = (venda.status || 'vendido').toLowerCase();
      slot.status = st === 'reservado' ? 'reservado' : 'vendido';
      slot.buyerName = venda.nome || null;
      slot.buyerPhone = venda.telefone || null;
      slot.buyerCity = venda.cidade || null;
      slot.observation = venda.observacao || null;
      slot.date = venda.data_registro || null;
      slot.time = venda.hora_registro || null;
      slot.saleId = venda.id || null;
    });

    return {
      id: String(row.id),
      ownerId: String(row.usuario_id),
      name: row.motivo || '',
      description: row.descricao || '',
      prize: row.premio || '',
      price: Number(row.valor) || 0,
      quantity,
      drawDate: row.data_sorteio || '',
      drawTime: row.hora_sorteio || '',
      image: photos.image,
      benefitImage: photos.benefitImage,
      bgImage: resolveMediaSrc(row.imagem_fundo || ''),
      pixKey: String(row.chave_pix || '').trim(),
      pixName: String(row.pix_nome || '').trim(),
      pixBank: String(row.pix_banco || '').trim(),
      pixType: String(row.pix_tipo || '').trim().toLowerCase() || inferPixType(row.chave_pix),
      purpose: normalizePurpose(row.finalidade),
      segment: String(row.segmento || '').trim(),
      createdAt: row.created_at || '',
      status: row.status || 'ativa',
      winners: parseDrawWinners(row.resultado_sorteio),
      drawnAt: row.sorteado_em || null,
      numbers
    };
  }

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

  function parseDrawWinners(raw) {
    if (!raw) return [];
    let list = raw;
    if (typeof raw === 'string') {
      try {
        list = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(list)) return [];
    return list.map((w, index) => ({
      place: Number(w.place) || index + 1,
      number: w.number != null ? String(w.number) : '',
      name: w.name || '—',
      phone: w.phone || '—',
      city: w.city || '—',
      date: w.date || '—',
      time: w.time || '—'
    })).filter((w) => w.number);
  }

  function inferPixType(key) {
    const raw = String(key || '').trim();
    if (!raw) return 'cpf';
    if (raw.includes('@')) return 'email';
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 11 && !raw.includes('.')) return 'telefone';
    if (digits.length === 11) return 'cpf';
    if (digits.length === 10 || digits.length === 11) return 'telefone';
    return 'cpf';
  }

  async function fetchVendas(raffleId) {
    const session = Store.getSession();
    const token = session?.sessionToken ? String(session.sessionToken) : '';
    const rid = Number(raffleId);

    // Dono autenticado: PII só via RPC com sessão (anti-IDOR)
    if (token && session?.userId) {
      const { data, error } = await db().rpc('pas_vendas_da_rifa', {
        p_session_token: token,
        p_raffle_id: rid
      });
      if (!error) return Array.isArray(data) ? data : [];
      if (!isMissingRpc(error)) throw error;
    }

    // Público: somente status (sem PII)
    const statusRpc = await db().rpc('pas_status_numeros_rifa', { p_raffle_id: rid });
    if (!statusRpc.error) {
      return (Array.isArray(statusRpc.data) ? statusRpc.data : []).map((v) => ({
        numero: v.numero,
        status: v.status,
        nome: null,
        telefone: null,
        cidade: null,
        observacao: null,
        data_registro: null,
        hora_registro: null,
        id: null
      }));
    }

    // Fallback: view sem PII (idor_protection.sql)
    const { data: viewRows, error: viewErr } = await db()
      .from('vendas_rifa_status')
      .select('numero, status')
      .eq('rifa_id', rid);
    if (!viewErr) {
      return (viewRows || []).map((v) => ({
        ...v,
        nome: null,
        telefone: null,
        cidade: null,
        observacao: null,
        data_registro: null,
        hora_registro: null,
        id: null
      }));
    }

    // Schema antigo (sem RLS): nunca devolver PII a não-donos
    const { data, error } = await db()
      .from('vendas_rifa')
      .select('numero, status')
      .eq('rifa_id', rid);
    if (error) throw error;
    return (data || []).map((v) => ({
      ...v,
      nome: null,
      telefone: null,
      cidade: null,
      observacao: null,
      data_registro: null,
      hora_registro: null,
      id: null
    }));
  }

  /**
   * Últimas vendas/reservas das rifas do usuário logado (tabela vendas_rifa).
   * Usa colunas nome e numero diretamente do banco.
   */
  async function listOwnerSales({ limit = 40 } = {}) {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.', sales: [] };

    const token = sessionTokenOrNull();
    if (token) {
      const rpc = await db().rpc('pas_minhas_vendas', {
        p_session_token: token,
        p_limit: Number(limit) || 40
      });
      if (!rpc.error) {
        const rows = Array.isArray(rpc.data) ? rpc.data : [];
        const raffleIds = [...new Set(rows.map((r) => r.rifa_id).filter(Boolean))];
        let nameById = new Map();
        if (raffleIds.length) {
          const { data: rifas } = await db()
            .from('rifas')
            .select('id, motivo')
            .in('id', raffleIds)
            .eq('usuario_id', Number(session.userId));
          nameById = new Map((rifas || []).map((r) => [String(r.id), r.motivo || 'Rifa']));
        }
        const sales = rows.map((row) => ({
          id: row.id,
          raffleId: row.rifa_id,
          raffleName: nameById.get(String(row.rifa_id)) || 'Rifa',
          number: row.numero,
          buyerName: row.nome,
          status: String(row.status || 'vendido').toLowerCase(),
          date: row.data_registro,
          time: row.hora_registro,
          createdAt: row.created_at || null
        }));
        return { ok: true, sales };
      }
      if (!isMissingRpc(rpc.error)) {
        return { ok: false, error: errMsg(rpc.error), sales: [] };
      }
    }

    return {
      ok: false,
      error: 'Execute supabase/idor_protection.sql no Supabase para listar vendas com segurança.',
      sales: [],
      needsSchema: true
    };
  }

  /** Normaliza data_registro (pt-BR, ISO, etc.) → YYYY-MM-DD */
  function dayKeyFromRaw(rawInput) {
    const raw = String(rawInput || '').trim();
    if (!raw) return null;

    // ISO / SQL: 2026-08-01 ou 2026-08-01T12:00:00
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

    // pt-BR: 1/8/2026, 01/08/2026, 1-8-2026
    const br = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
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

  async function fetchOwnerSaleRows({ detailed = false } = {}) {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.', rows: [], nameById: new Map() };

    const ownerId = Number(session.userId);
    const token = sessionTokenOrNull();
    const nameById = new Map();

    if (token) {
      const rpc = await db().rpc('pas_minhas_vendas', {
        p_session_token: token,
        p_limit: 8000
      });
      if (!rpc.error) {
        const rows = Array.isArray(rpc.data) ? rpc.data : [];
        const raffleIds = [...new Set(rows.map((r) => r.rifa_id).filter(Boolean))];
        if (raffleIds.length) {
          const { data: rifas } = await db()
            .from('rifas')
            .select('id, motivo')
            .in('id', raffleIds)
            .eq('usuario_id', ownerId);
          (rifas || []).forEach((r) => nameById.set(String(r.id), r.motivo || 'Rifa'));
        }
        return { ok: true, rows, nameById };
      }
      if (!isMissingRpc(rpc.error)) {
        return { ok: false, error: errMsg(rpc.error), rows: [], nameById };
      }
    }

    return {
      ok: false,
      error: 'Execute supabase/idor_protection.sql no Supabase para carregar o gráfico com segurança.',
      rows: [],
      nameById,
      needsSchema: true
    };
  }

  function isReservedStatus(status) {
    const st = String(status || 'vendido').toLowerCase().trim();
    return st === 'reservado' || st === 'reserva';
  }

  /**
   * Conta registros da tabela vendas_rifa por dia/mês.
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

  async function hydrateRaffle(row) {
    const vendas = await fetchVendas(row.id);
    return mapRaffleRow(row, vendas);
  }

  // ─── Auth (tabela usuarios — compatível com o sistema antigo) ───

  function isMissingRpc(error) {
    const msg = String(error?.message || error || '');
    return /function .*does not exist|Could not find the function|schema cache|404/i.test(msg);
  }

  async function createUser({
    name,
    email,
    password,
    tipoConta = 'pessoa_fisica',
    razaoSocial = '',
    cnpj = ''
  }) {
    const emailNorm = String(email || '').trim().toLowerCase();
    const nomeCheck = validateFullName(name);
    if (!nomeCheck.ok) return { ok: false, error: nomeCheck.error };
    const nome = nomeCheck.value;
    const tipo = normalizeTipoConta(tipoConta);
    const razao = String(razaoSocial || '').trim();
    const cnpjDigits = normalizeCnpjDigits(cnpj);

    if (tipo === 'empresa') {
      if (!razao) return { ok: false, error: 'Informe a razão social ou nome fantasia.' };
      if (!isCnpjFormatValid(cnpjDigits)) {
        return { ok: false, error: 'Informe um CNPJ válido (14 dígitos).' };
      }
    }

    // Caminho preferido: RPC com hash bcrypt (cadastro_tipo_conta_pagamento.sql)
    const rpc = await db().rpc('pas_registrar_usuario_v2', {
      p_nome: nome,
      p_email: emailNorm,
      p_senha: String(password || ''),
      p_tipo_conta: tipo,
      p_razao_social: tipo === 'empresa' ? razao : null,
      p_cnpj: tipo === 'empresa' ? cnpjDigits : null
    });

    if (!rpc.error) {
      const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
      if (row) return { ok: true, user: mapPaymentProfile(row) };
    } else if (!isMissingRpc(rpc.error)) {
      return { ok: false, error: errMsg(rpc.error, 'Erro ao cadastrar.') };
    }

    // Fallback: banco ainda sem a RPC v2 (schema antigo)
    const { data: existing, error: findErr } = await db()
      .from('usuarios')
      .select('id')
      .eq('email', emailNorm)
      .maybeSingle();

    if (findErr) return { ok: false, error: errMsg(findErr) };
    if (existing) return { ok: false, error: 'Este e-mail já está cadastrado.' };

    const fullRow = {
      nome,
      email: emailNorm,
      senha: password,
      tipo_conta: tipo,
      razao_social: tipo === 'empresa' ? razao : null,
      cnpj: tipo === 'empresa' ? cnpjDigits : null,
      status_pagamento: 'pendente',
      plano: tipo === 'empresa' ? 'empresarial_mensal' : 'pessoal_unico'
    };

    let { data, error } = await db()
      .from('usuarios')
      .insert([fullRow])
      .select('id, nome, email')
      .single();

    if (error && isMissingColumnError(error)) {
      ({ data, error } = await db()
        .from('usuarios')
        .insert([{ nome, email: emailNorm, senha: password }])
        .select('id, nome, email')
        .single());
    }

    if (error) return { ok: false, error: errMsg(error, 'Erro ao cadastrar.') };
    return { ok: true, user: { id: data.id, name: data.nome, email: data.email } };
  }

  async function login({ email, password }) {
    const emailNorm = email.trim().toLowerCase();

    let data = null;
    let error = null;

    // Sem foto_perfil no login — avatar sob demanda (economiza egress)
    ({ data, error } = await db()
      .from('usuarios')
      .select(
        'id, nome, email, senha, tipo_conta, razao_social, cnpj, status_pagamento, plano, pago_em, proximo_vencimento'
      )
      .eq('email', emailNorm)
      .eq('senha', password)
      .maybeSingle());

    if (error && isMissingColumnError(error)) {
      ({ data, error } = await db()
        .from('usuarios')
        .select('id, nome, email, senha')
        .eq('email', emailNorm)
        .eq('senha', password)
        .maybeSingle());
    }

    if (error) return { ok: false, error: errMsg(error) };
    if (!data) {
      // Senha ainda em bcrypt (resto do script seguranca_usuarios.sql)
      const { data: hashedUser } = await db()
        .from('usuarios')
        .select('id')
        .eq('email', emailNorm)
        .like('senha', '$2a$%')
        .maybeSingle();
      if (hashedUser) {
        return {
          ok: false,
          error: 'Esta conta precisa redefinir a senha no banco (senha ainda está em hash). Use supabase/redefinir_senhas_texto.sql.'
        };
      }
      return { ok: false, error: 'E-mail ou senha inválidos.' };
    }

    const sessionToken = generateSessionToken();
    let tokErr = null;
    {
      const upd = await db()
        .from('usuarios')
        .update({
          sessao_token: sessionToken,
          sessao_em: new Date().toISOString(),
          ultimo_acesso: new Date().toISOString()
        })
        .eq('id', data.id);
      tokErr = upd.error;
      if (tokErr && /ultimo_acesso|column|schema cache|Could not find/i.test(tokErr.message || '')) {
        const retry = await db()
          .from('usuarios')
          .update({
            sessao_token: sessionToken,
            sessao_em: new Date().toISOString()
          })
          .eq('id', data.id);
        tokErr = retry.error;
      }
    }

    const paymentFromRow = mapPaymentProfile(data);
    // Avatar não vem no login (evita baixar base64 legado). UI usa placeholder até carregar.
    const photo = '';

    if (tokErr && /sessao_token|sessao_em|column|schema cache|Could not find/i.test(tokErr.message || '')) {
      Store.setSession({
        userId: data.id,
        email: data.email,
        name: data.nome,
        photo,
        ...(paymentFromRow
          ? {
              tipoConta: paymentFromRow.tipoConta,
              razaoSocial: paymentFromRow.razaoSocial,
              cnpj: paymentFromRow.cnpj,
              statusPagamento: paymentFromRow.statusPagamento,
              plano: paymentFromRow.plano,
              pagoEm: paymentFromRow.pagoEm,
              proximoVencimento: paymentFromRow.proximoVencimento
            }
          : {})
      });
      return {
        ok: true,
        session: Store.getSession(),
        needsSessionSchema: true
      };
    }

    if (tokErr) return { ok: false, error: errMsg(tokErr, 'Não foi possível iniciar a sessão.') };

    Store.setSession({
      userId: data.id,
      email: data.email,
      name: data.nome,
      photo,
      sessionToken,
      ...(paymentFromRow
        ? {
            tipoConta: paymentFromRow.tipoConta,
            razaoSocial: paymentFromRow.razaoSocial,
            cnpj: paymentFromRow.cnpj,
            statusPagamento: paymentFromRow.statusPagamento,
            plano: paymentFromRow.plano,
            pagoEm: paymentFromRow.pagoEm,
            proximoVencimento: paymentFromRow.proximoVencimento
          }
        : {})
    });

    // Reforça perfil via RPC (não bloqueia se indisponível)
    try {
      const profile = await getPaymentProfile(data.id);
      if (profile.ok) applyPaymentToSession(profile.profile);
    } catch { /* schema antigo: segue com dados da linha */ }

    return { ok: true, session: Store.getSession() };
  }

  function generateSessionToken() {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
    } catch { /* ignore */ }
    return `pas_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
  }

  function loginRedirectUrl(motivo) {
    if (typeof ProtecaoRota !== 'undefined' && typeof ProtecaoRota.buildLoginUrl === 'function') {
      return ProtecaoRota.buildLoginUrl(motivo);
    }
    const q = motivo ? `?motivo=${encodeURIComponent(motivo)}` : '';
    return `login.html${q}`;
  }

  /**
   * Valida sessão no Supabase pelo token real (RPC preferencial).
   * Não confia apenas em localStorage — compara sessao_token no servidor.
   */
  async function validateSessionRemote() {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, reason: 'none' };
    if (!session.sessionToken) return { ok: false, reason: 'no-token' };

    const token = String(session.sessionToken);

    try {
      const { data, error } = await db().rpc('pas_validar_sessao', {
        p_session_token: token
      });

      if (!error && data != null) {
        const row = Array.isArray(data) ? data[0] : data;
        if (!row || row.ok === false) {
          return { ok: false, reason: row?.reason || 'cleared' };
        }
        const remoteId = Number(row.id || row.user_id || row.usuario_id);
        if (remoteId && remoteId !== Number(session.userId)) {
          return { ok: false, reason: 'replaced' };
        }
        const nivelAcesso =
          row.nivel_acesso || row.nivelAcesso || session.nivelAcesso || 'usuario';
        const next = {
          ...session,
          name: row.nome || row.name || session.name,
          email: row.email || session.email,
          nivelAcesso: String(nivelAcesso).toLowerCase(),
          sessionToken: token
        };
        try { Store.setSession(next); } catch { /* ignore */ }
        return { ok: true, session: Store.getSession(), via: 'rpc' };
      }

      if (error && !/pas_validar_sessao|Could not find|schema cache|function/i.test(error.message || '')) {
        return { ok: false, reason: 'network', error: errMsg(error) };
      }
    } catch {
      /* RPC ausente — fallback abaixo */
    }

    const check = await validateActiveSession({ strict: true });
    if (check.ok || check.reason === 'schema' || check.reason === 'network') {
      return { ok: true, session: Store.getSession(), skipped: check.skipped, reason: check.reason };
    }
    return { ok: false, reason: check.reason || 'invalid' };
  }

  async function validateActiveSession({ strict = true } = {}) {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, reason: 'none' };
    if (!session.sessionToken) {
      return strict ? { ok: false, reason: 'no-token' } : { ok: true, skipped: true };
    }

    const { data, error } = await db()
      .from('usuarios')
      .select('sessao_token, nivel_acesso, email, nome')
      .eq('id', Number(session.userId))
      .maybeSingle();

    if (error) {
      if (/sessao_token|column|schema cache|Could not find/i.test(error.message || '')) {
        // Tenta só sessao_token se nivel_acesso ainda não existe
        if (/nivel_acesso/i.test(error.message || '')) {
          const retry = await db()
            .from('usuarios')
            .select('sessao_token')
            .eq('id', Number(session.userId))
            .maybeSingle();
          if (!retry.error && retry.data) {
            const remote = retry.data.sessao_token == null ? '' : String(retry.data.sessao_token);
            if (!remote) return { ok: false, reason: 'cleared' };
            if (remote !== String(session.sessionToken)) return { ok: false, reason: 'replaced' };
            return { ok: true };
          }
        }
        return { ok: true, skipped: true, reason: 'schema' };
      }
      return { ok: false, reason: 'network', error: errMsg(error) };
    }

    if (!data) return { ok: false, reason: 'missing-user' };

    const remote = data.sessao_token == null ? '' : String(data.sessao_token);
    if (!remote) return { ok: false, reason: 'cleared' };
    if (remote !== String(session.sessionToken)) {
      return { ok: false, reason: 'replaced' };
    }

    if (data.nivel_acesso || data.email || data.nome) {
      try {
        Store.setSession({
          ...session,
          name: data.nome || session.name,
          email: data.email || session.email,
          nivelAcesso: data.nivel_acesso
            ? String(data.nivel_acesso).toLowerCase()
            : session.nivelAcesso
        });
      } catch { /* ignore */ }
    }
    return { ok: true };
  }

  async function requireActiveSession() {
    const session = Store.getSession();
    const gateOk = typeof Store.hasAuthGate === 'function' ? Store.hasAuthGate() : true;
    if (!session || !gateOk) {
      try {
        if (typeof Store.resetForLoginScreen === 'function') Store.resetForLoginScreen();
        else Store.clearSession();
      } catch { /* ignore */ }
      window.location.href = loginRedirectUrl('auth');
      return { ok: false, session: null };
    }

    const check = await validateSessionRemote();
    if (check.ok || check.reason === 'schema' || check.reason === 'network') {
      return { ok: true, session: check.session || Store.getSession() };
    }

    try {
      await logout();
    } catch {
      try { Store.clearSession(); } catch { /* ignore */ }
    }
    window.location.href = loginRedirectUrl(
      check.reason === 'replaced' ? 'outro-dispositivo' : 'sessao'
    );
    return { ok: false, session: null };
  }

  /** Garante sessão válida antes de operações autenticadas */
  async function guardSession() {
    const check = await validateSessionRemote();
    if (check.ok || check.reason === 'schema') return { ok: true };
    if (check.reason === 'network') {
      return { ok: false, error: 'Não foi possível validar a sessão. Tente novamente.' };
    }
    try {
      await logout();
    } catch {
      try { Store.clearSession(); } catch { /* ignore */ }
    }
    window.location.href = loginRedirectUrl('outro-dispositivo');
    return { ok: false, error: 'Sessão encerrada: conta em uso em outro dispositivo.' };
  }

  function getAccessLevel(sessionOrEmail) {
    if (typeof ProtecaoRota !== 'undefined' && typeof ProtecaoRota.resolverNivelAcesso === 'function') {
      return ProtecaoRota.resolverNivelAcesso(sessionOrEmail || Store.getSession());
    }
    const src = sessionOrEmail || Store.getSession();
    if (isAdminEmail(typeof src === 'string' ? src : src?.email)) return 'super_admin';
    return 'usuario';
  }

  function hasMinAccessLevel(required, sessionOrEmail) {
    if (typeof ProtecaoRota !== 'undefined' && typeof ProtecaoRota.temPermissao === 'function') {
      return ProtecaoRota.temPermissao(getAccessLevel(sessionOrEmail), required);
    }
    const have = getAccessLevel(sessionOrEmail);
    if (required === 'usuario') return Boolean(have);
    if (required === 'admin') return have === 'admin' || have === 'super_admin';
    if (required === 'super_admin') return have === 'super_admin';
    return true;
  }

  function requireRole(required, { redirect = true } = {}) {
    const session = Store.getSession();
    const gateOk = typeof Store.hasAuthGate === 'function' ? Store.hasAuthGate() : true;
    if (!session || !gateOk) {
      if (redirect) window.location.href = loginRedirectUrl('auth');
      return { ok: false, reason: 'auth', session: null };
    }
    if (!hasMinAccessLevel(required, session)) {
      if (redirect) window.location.href = 'dashboard.html';
      return { ok: false, reason: 'forbidden', session };
    }
    return { ok: true, session, nivel: getAccessLevel(session) };
  }

  async function updateProfile({ name, currentPassword, newPassword, photo } = {}) {
    const gate = await guardSession();
    if (!gate.ok) return { ok: false, error: gate.error || 'Não autenticado.' };

    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };

    const nomeCheck = validateFullName(name);
    if (!nomeCheck.ok) return { ok: false, error: nomeCheck.error };
    const nome = nomeCheck.value;

    const wantsPassword = Boolean(String(newPassword || '').trim());
    if (wantsPassword) {
      if (!currentPassword) {
        return { ok: false, error: 'Informe a senha atual para redefinir.' };
      }
      if (String(newPassword).length < 6) {
        return { ok: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' };
      }

      const { data: user, error: checkErr } = await db()
        .from('usuarios')
        .select('id, senha')
        .eq('id', Number(session.userId))
        .maybeSingle();

      if (checkErr) return { ok: false, error: errMsg(checkErr) };
      if (!user || String(user.senha) !== String(currentPassword)) {
        return { ok: false, error: 'Senha atual incorreta.' };
      }
    }

    const payload = { nome };
    if (wantsPassword) payload.senha = String(newPassword);
    if (photo !== undefined) {
      payload.foto_perfil = photo ? String(photo) : null;
    }

    let { data, error } = await db()
      .from('usuarios')
      .update(payload)
      .eq('id', Number(session.userId))
      .select('id, nome, email, foto_perfil')
      .single();

    if (error && /foto_perfil|column|schema cache|Could not find/i.test(error.message || '')) {
      delete payload.foto_perfil;
      ({ data, error } = await db()
        .from('usuarios')
        .update(payload)
        .eq('id', Number(session.userId))
        .select('id, nome, email')
        .single());
      if (!error && data) {
        const nextPhoto =
          photo !== undefined ? String(photo || '').trim() : String(session.photo || '').trim();
        Store.setSession({
          ...session,
          userId: data.id,
          email: data.email,
          name: data.nome,
          photo: nextPhoto,
          sessionToken: session.sessionToken || undefined
        });
        return {
          ok: true,
          session: Store.getSession(),
          passwordChanged: wantsPassword,
          needsSchema: photo !== undefined
        };
      }
    }

    if (error) return { ok: false, error: errMsg(error, 'Não foi possível atualizar o perfil.') };

    Store.setSession({
      ...session,
      userId: data.id,
      email: data.email,
      name: data.nome,
      photo: data.foto_perfil || '',
      sessionToken: session.sessionToken || undefined
    });

    return { ok: true, session: Store.getSession(), passwordChanged: wantsPassword };
  }

  async function logout() {
    const session = Store.getSession();
    if (session?.userId && session?.sessionToken) {
      try {
        await db()
          .from('usuarios')
          .update({ sessao_token: null, sessao_em: null })
          .eq('id', Number(session.userId))
          .eq('sessao_token', session.sessionToken);
      } catch { /* ignore */ }
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
      sessionStorage.removeItem('pas_nav_allowed');
    } catch { /* ignore */ }
    try {
      await db().auth.signOut();
    } catch {
      /* auth opcional */
    }
    return { ok: true };
  }

  function requireAuth() {
    const session = Store.getSession();
    const gateOk = typeof Store.hasAuthGate === 'function' ? Store.hasAuthGate() : true;
    if (!session || !gateOk) {
      try {
        if (typeof Store.resetForLoginScreen === 'function') Store.resetForLoginScreen();
        else Store.clearSession();
      } catch { /* ignore */ }
      window.location.href = loginRedirectUrl('auth');
      return null;
    }
    return session;
  }

  // ─── Rifas ──────────────────────────────────────────────

  async function listRaffles({ ownerId } = {}) {
    const gate = await guardSession();
    if (!gate.ok) return { ok: false, error: gate.error || 'Não autenticado.', raffles: [] };

    const session = Store.getSession();
    // Nunca confiar em ownerId do cliente — escopo sempre da sessão autenticada
    const uid = session?.userId;
    if (!uid) return { ok: false, error: 'Não autenticado.', raffles: [] };
    void ownerId;

    const { data, error } = await db()
      .from('rifas')
      .select(RAFFLE_LIST_COLS)
      .eq('usuario_id', Number(uid))
      .order('id', { ascending: false });

    if (error) return { ok: false, error: errMsg(error), raffles: [] };

    const raffles = [];
    for (const row of data || []) {
      raffles.push(await hydrateRaffle(row));
    }
    Store.setRaffles(raffles);
    return { ok: true, raffles };
  }

  async function getRaffle(id) {
    const rid = Number(id);
    const { data, error } = await db()
      .from('rifas')
      .select(RAFFLE_DETAIL_COLS)
      .eq('id', Number.isFinite(rid) && rid > 0 ? rid : id)
      .maybeSingle();

    if (error) return { ok: false, error: errMsg(error) };
    if (!data) return idorDeny();

    const session = Store.getSession();
    const token = sessionTokenOrNull();
    const isOwner =
      session?.userId != null && Number(data.usuario_id) === Number(session.userId);

    // Dono da rifa: sempre devolver modelo com ownerId (a lista de Minhas Rifas depende disso).
    // PII de vendas só via RPC com sessão; se a RPC falhar, cai para status sem PII.
    if (isOwner) {
      if (token) {
        const owned = await db().rpc('pas_vendas_da_rifa', {
          p_session_token: token,
          p_raffle_id: Number(data.id)
        });
        if (!owned.error) {
          const raffle = mapRaffleRow(data, Array.isArray(owned.data) ? owned.data : []);
          Store.upsertRaffle(raffle);
          return { ok: true, raffle };
        }
        if (
          !isMissingRpc(owned.error) &&
          /não autenticado|Não autenticado/i.test(owned.error?.message || '')
        ) {
          return { ok: false, error: 'Não autenticado.' };
        }
      }

      let vendas = [];
      try {
        vendas = await fetchVendas(data.id);
      } catch {
        vendas = [];
      }
      const raffle = mapRaffleRow(data, vendas);
      Store.upsertRaffle(raffle);
      return { ok: true, raffle };
    }

    // Visitante / não-dono: visão pública (sem ownerId nem PII)
    let vendas = [];
    try {
      vendas = await fetchVendas(data.id);
    } catch (err) {
      return { ok: false, error: errMsg(err) };
    }
    const raffle = toPublicRaffle(mapRaffleRow(data, vendas));
    return { ok: true, raffle };
  }

  async function lookupBuyerSlots(raffleId, phone) {
    if (normalizePhoneDigits(phone).length < 10) {
      return { ok: false, error: 'Informe um telefone válido.', slots: [] };
    }

    const { data, error } = await db().rpc('pas_meus_numeros_rifa', {
      p_raffle_id: Number(raffleId),
      p_telefone: String(phone || '')
    });

    if (!error) {
      const slots = Array.isArray(data) ? data : [];
      return {
        ok: true,
        slots: slots.map((s) => ({
          number: Store.padNumber(Number(s.number), String(s.number).length),
          status: String(s.status || 'reservado').toLowerCase(),
          buyerName: s.buyerName || null,
          buyerPhone: s.buyerPhone || null,
          buyerCity: s.buyerCity || null,
          observation: s.observation || null,
          date: s.date || null,
          time: s.time || null,
          saleId: null
        }))
      };
    }

    // Sem RPC: não fazer SELECT * em vendas (IDOR / vazamento de PII)
    const msg = errMsg(error, IDOR_NOT_FOUND);
    if (/não encontrado|not found|Recurso/i.test(msg)) return idorDeny();
    if (isMissingRpc(error)) {
      return {
        ok: false,
        error: 'Execute supabase/idor_protection.sql no Supabase para consultar seus números com segurança.',
        slots: []
      };
    }
    return { ok: false, error: msg, slots: [] };
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

    const quantity = Number(form.quantity);
    const prizeImage = form.image || '';
    const benefitImage = form.benefitImage || '';
    const purpose = normalizePurpose(form.purpose || form.finalidade);
    const segment = String(form.segment || form.segmento || '').trim();
    let pixKey = String(form.pixKey || form.chavePix || '').trim();
    let pixName = String(form.pixName || form.pixNome || '').trim();
    let pixBank = String(form.pixBank || form.pixBanco || '').trim();
    let pixType = String(form.pixType || form.pixTipo || 'cpf').trim().toLowerCase();

    if (purpose === 'beneficente' && !pixKey) {
      return { ok: false, error: 'Informe a chave PIX da rifa.' };
    }
    if (purpose === 'empresarial') {
      pixKey = '';
      pixName = '';
      pixBank = '';
      pixType = 'cpf';
    }

    const payload = {
      usuario_id: Number(session.userId),
      motivo: form.name.trim(),
      descricao: form.description.trim(),
      valor: Number(form.price) || 0,
      premio: form.prize.trim(),
      data_sorteio: form.drawDate,
      hora_sorteio: form.drawTime,
      quantidade: quantity,
      quantidade_sorteios: Math.max(1, Number(form.winnersCount || form.quantidade_sorteios) || 1),
      status: 'ativa',
      finalidade: purpose,
      segmento: segment || null,
      tipo_rifa: String(form.raffleType || form.tipo_rifa || '').trim() || null,
      cor_principal: String(form.colorPrimary || form.cor_principal || '').trim() || null,
      cor_secundaria: String(form.colorSecondary || form.cor_secundaria || '').trim() || null,
      chave_pix: pixKey || null,
      pix_nome: pixName || null,
      pix_banco: pixBank || null,
      pix_tipo: pixKey ? pixType : null
    };
    if (prizeImage) payload.imagem = prizeImage;
    if (purpose === 'beneficente' && benefitImage) payload.imagem_beneficio = benefitImage;
    if (form.bgImage) payload.imagem_fundo = form.bgImage;

    const token = sessionTokenOrNull();
    if (token) {
      const created = await db().rpc('pas_criar_rifa', {
        p_session_token: token,
        p_payload: payload
      });
      if (!created.error) {
        const rid = Number(created.data?.id);
        if (rid) {
          const loaded = await getRaffle(rid);
          if (loaded.ok) {
            Store.upsertRaffle(loaded.raffle);
            return loaded;
          }
        }
        return { ok: false, error: 'Rifa criada, mas falhou ao carregar.' };
      }
      if (!isMissingRpc(created.error)) {
        return { ok: false, error: errMsg(created.error, 'Erro ao criar rifa.') };
      }
    }

    let { data, error } = await db()
      .from('rifas')
      .insert([payload])
      .select('id')
      .single();

    // Fallback se colunas novas de personalizacao ainda nao existem
    if (error && /tipo_rifa|cor_principal|cor_secundaria|imagem_fundo|column|schema cache|Could not find/i.test(error.message || '')) {
      delete payload.tipo_rifa;
      delete payload.cor_principal;
      delete payload.cor_secundaria;
      delete payload.imagem_fundo;
      ({ data, error } = await db().from('rifas').insert([payload]).select('id').single());
    }

    if (error && /finalidade|segmento|column|schema cache|Could not find/i.test(error.message || '')) {
      return {
        ok: false,
        needsSchema: true,
        error: 'Execute supabase/add_rifas_finalidade.sql no Supabase para ativar Beneficente/Empresarial.'
      };
    }

    // Fallback: coluna imagem_beneficio ainda não existe no banco
    if (error && benefitImage && isMissingBenefitColumn(error)) {
      payload.imagem = packImages(prizeImage, benefitImage);
      delete payload.imagem_beneficio;
      ({ data, error } = await db().from('rifas').insert([payload]).select('id').single());
    }

    if (error && isMissingPixColumn(error) && purpose === 'beneficente') {
      return {
        ok: false,
        error: 'Execute o SQL add_rifas_pix.sql no Supabase para habilitar o PIX da rifa.',
        needsSchema: true
      };
    }

    if (error && isMissingPixColumn(error) && purpose !== 'beneficente') {
      delete payload.chave_pix;
      delete payload.pix_nome;
      delete payload.pix_banco;
      delete payload.pix_tipo;
      ({ data, error } = await db().from('rifas').insert([payload]).select('id').single());
    }

    if (error) return { ok: false, error: errMsg(error, 'Erro ao criar rifa.') };

    if (data?.id) {
      const loaded = await getRaffle(data.id);
      if (loaded.ok) {
        Store.upsertRaffle(loaded.raffle);
        return loaded;
      }
    }
    const raffle = mapRaffleRow({ ...payload, id: data?.id, usuario_id: session.userId }, []);
    Store.upsertRaffle(raffle);
    return { ok: true, raffle };
  }

  async function editRaffle(id, updates) {
    const gate = await guardSession();
    if (!gate.ok) return { ok: false, error: gate.error || 'Não autenticado.' };
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };
    const payload = {};
    if (updates.name != null) payload.motivo = updates.name;
    if (updates.description != null) payload.descricao = updates.description;
    if (updates.prize != null) payload.premio = updates.prize;
    if (updates.price != null) payload.valor = Number(updates.price);
    if (updates.drawDate != null) payload.data_sorteio = updates.drawDate;
    if (updates.drawTime != null) payload.hora_sorteio = updates.drawTime;
    if (updates.quantity != null) payload.quantidade = Number(updates.quantity);
    if (updates.status != null) payload.status = updates.status;
    if (updates.purpose != null || updates.finalidade != null) {
      payload.finalidade = normalizePurpose(updates.purpose || updates.finalidade);
    }
    if (updates.segment != null || updates.segmento != null) {
      payload.segmento = String(updates.segment || updates.segmento || '').trim() || null;
    }
    if (updates.pixKey != null) payload.chave_pix = String(updates.pixKey).trim();
    if (updates.pixName != null) payload.pix_nome = String(updates.pixName).trim();
    if (updates.pixBank != null) payload.pix_banco = String(updates.pixBank).trim();
    if (updates.pixType != null) payload.pix_tipo = String(updates.pixType).trim().toLowerCase();

    const purpose = payload.finalidade
      || (updates.purpose != null || updates.finalidade != null
        ? normalizePurpose(updates.purpose || updates.finalidade)
        : null);

    if (purpose === 'beneficente' && updates.pixKey != null && !String(updates.pixKey).trim()) {
      return { ok: false, error: 'Informe a chave PIX da rifa.' };
    }
    if (purpose === 'empresarial') {
      payload.chave_pix = null;
      payload.pix_nome = null;
      payload.pix_banco = null;
      payload.pix_tipo = null;
      if (updates.benefitImage != null) payload.imagem_beneficio = null;
    }

    const hasPrize = updates.image != null;
    const hasBenefit = updates.benefitImage != null;
    const prizeImage = hasPrize ? (updates.image || '') : null;
    const benefitImage = hasBenefit ? (updates.benefitImage || '') : null;

    if (hasPrize) payload.imagem = prizeImage;
    if (hasBenefit) payload.imagem_beneficio = benefitImage;

    const token = sessionTokenOrNull();
    if (token) {
      const updated = await db().rpc('pas_atualizar_rifa', {
        p_session_token: token,
        p_raffle_id: Number(id),
        p_payload: payload
      });
      if (!updated.error) {
        return getRaffle(id);
      }
      if (!isMissingRpc(updated.error)) {
        const msg = errMsg(updated.error, IDOR_NOT_FOUND);
        if (/não encontrado|Recurso|not found/i.test(msg)) return idorDeny();
        return { ok: false, error: msg };
      }
    }

    let { data, error } = await db()
      .from('rifas')
      .update(payload)
      .eq('id', id)
      .eq('usuario_id', Number(session.userId))
      .select('id')
      .maybeSingle();

    // Fallback: grava as duas fotos na coluna imagem (JSON) se imagem_beneficio não existir
    if (error && hasBenefit && isMissingBenefitColumn(error)) {
      let prize = prizeImage;
      let benefit = benefitImage;
      if (prize == null || benefit == null) {
        const { data: row } = await db()
          .from('rifas')
          .select('imagem')
          .eq('id', id)
          .eq('usuario_id', Number(session.userId))
          .maybeSingle();
        const photos = unpackImages(row || {});
        if (prize == null) prize = photos.image;
        if (benefit == null) benefit = photos.benefitImage;
      }
      const packed = { ...payload };
      delete packed.imagem_beneficio;
      packed.imagem = packImages(prize || '', benefit || '');
      ({ data, error } = await db()
        .from('rifas')
        .update(packed)
        .eq('id', id)
        .eq('usuario_id', Number(session.userId))
        .select('id')
        .maybeSingle());
    }

    if (error && isMissingPixColumn(error)) {
      return {
        ok: false,
        error: 'Execute o SQL add_rifas_pix.sql no Supabase para habilitar o PIX da rifa.',
        needsSchema: true
      };
    }

    if (error) return { ok: false, error: errMsg(error) };
    if (!data) return idorDeny();
    return getRaffle(data.id);
  }

  /**
   * Remove a rifa e todas as vendas/reservas vinculadas (vendas_rifa).
   * Exclusão permanente no Supabase.
   */
  async function deleteRaffle(id) {
    const gate = await guardSession();
    if (!gate.ok) return { ok: false, error: gate.error || 'Não autenticado.' };

    const session = Store.getSession();
    if (!session) return { ok: false, error: 'Não autenticado.' };

    const raffleId = Number(id);
    if (!Number.isFinite(raffleId) || raffleId <= 0) {
      return { ok: false, error: 'Rifa inválida.' };
    }

    const token = sessionTokenOrNull();
    if (token) {
      const deleted = await db().rpc('pas_excluir_rifa', {
        p_session_token: token,
        p_raffle_id: raffleId
      });
      if (!deleted.error) {
        Store.removeRaffle(raffleId);
        return { ok: true };
      }
      if (!isMissingRpc(deleted.error)) {
        const msg = errMsg(deleted.error, IDOR_NOT_FOUND);
        if (/não encontrado|Recurso|not found/i.test(msg)) return idorDeny();
        return { ok: false, error: msg };
      }
    }

    const ownerId = Number(session.userId);

    // Confirma que a rifa existe e pertence ao usuário
    const { data: existing, error: findError } = await db()
      .from('rifas')
      .select('id, usuario_id')
      .eq('id', raffleId)
      .maybeSingle();

    if (findError) return { ok: false, error: errMsg(findError, 'Erro ao localizar a rifa.') };
    if (!existing || Number(existing.usuario_id) !== ownerId) return idorDeny();

    // 1) Apaga vendas vinculadas (somente da rifa do dono)
    const { error: vendasError } = await db()
      .from('vendas_rifa')
      .delete()
      .eq('rifa_id', raffleId)
      .eq('usuario_id', ownerId);

    if (vendasError) {
      return { ok: false, error: errMsg(vendasError, 'Erro ao excluir vendas da rifa.') };
    }

    // 2) Apaga a rifa
    const { data: deleted, error } = await db()
      .from('rifas')
      .delete()
      .eq('id', raffleId)
      .eq('usuario_id', ownerId)
      .select('id');

    if (error) return { ok: false, error: errMsg(error, 'Erro ao excluir a rifa.') };

    // RLS pode “aceitar” o delete sem apagar → valida se ainda existe
    const { data: stillThere } = await db()
      .from('rifas')
      .select('id')
      .eq('id', raffleId)
      .maybeSingle();

    if (stillThere) {
      return {
        ok: false,
        error: 'A exclusão foi bloqueada por permissão. Contate o administrador do sistema.'
      };
    }

    if (!deleted || !deleted.length) {
      // Delete pode ter funcionado sem retornar linhas
      Store.removeRaffle(raffleId);
      return { ok: true };
    }

    Store.removeRaffle(raffleId);
    return { ok: true };
  }

  function generateNumbers(quantity) {
    const slots = [];
    for (let i = 1; i <= quantity; i += 1) {
      slots.push({
        number: Store.padNumber(i, quantity),
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

  async function upsertSale(raffleId, number, buyer, status) {
    const session = Store.getSession();
    const wanted = String(status || '').toLowerCase() === 'reservado' ? 'reservado' : 'vendido';

    const { data: raffleRow, error: raffleErr } = await db()
      .from('rifas')
      .select('id, usuario_id, motivo, valor, quantidade')
      .eq('id', Number(raffleId))
      .maybeSingle();
    if (raffleErr) return { ok: false, error: errMsg(raffleErr) };
    if (!raffleRow) return idorDeny();

    const ownerId = Number(raffleRow.usuario_id);

    if (wanted === 'vendido') {
      if (!session?.userId || !session?.sessionToken) {
        return { ok: false, error: 'Não autenticado.' };
      }
      if (Number(session.userId) !== ownerId) return idorDeny();

      const { error: rpcErr } = await db().rpc('pas_confirmar_venda', {
        p_session_token: String(session.sessionToken),
        p_raffle_id: Number(raffleId),
        p_numero: Number(number),
        p_nome: buyer?.name || null,
        p_telefone: buyer?.phone || null,
        p_cidade: buyer?.city || null,
        p_observacao: buyer?.observation || null
      });

      if (!rpcErr) {
        return getRaffle(raffleId);
      }
      if (!isMissingRpc(rpcErr)) {
        return { ok: false, error: errMsg(rpcErr, IDOR_NOT_FOUND) };
      }
    } else {
      const { error: rpcErr } = await db().rpc('pas_reservar_numero', {
        p_raffle_id: Number(raffleId),
        p_numero: Number(number),
        p_nome: String(buyer?.name || '').trim(),
        p_telefone: String(buyer?.phone || '').trim(),
        p_cidade: String(buyer?.city || '').trim(),
        p_observacao: String(buyer?.observation || '').trim()
      });
      if (!rpcErr) {
        const refreshed = await getRaffle(raffleId);
        if (!refreshed.ok) return refreshed;
        if (buyer?.phone && refreshed.raffle) {
          const mine = await lookupBuyerSlots(raffleId, buyer.phone);
          if (mine.ok && mine.slots?.length) {
            const byNum = new Map(mine.slots.map((s) => [String(Number(s.number)), s]));
            refreshed.raffle.numbers = (refreshed.raffle.numbers || []).map((n) => {
              const hit = byNum.get(String(Number(n.number)));
              return hit ? { ...n, ...hit } : n;
            });
          }
        }
        return refreshed;
      }
      if (!isMissingRpc(rpcErr)) {
        return { ok: false, error: errMsg(rpcErr, 'Erro ao reservar número.') };
      }
    }

    // Sem RPC: não gravar direto em vendas_rifa (IDOR / bypass de dono)
    return {
      ok: false,
      error: 'Execute supabase/idor_protection.sql no Supabase para registrar vendas com segurança.',
      needsSchema: true
    };
  }

  async function notifyOwnerOfSale({
    ownerId,
    raffleId,
    raffleName,
    saleId,
    number,
    buyerName,
    status
  }) {
    if (!ownerId || !saleId) return { ok: false };

    const kind = String(status || '').toLowerCase() === 'reservado' ? 'reserva' : 'venda';
    const action = kind === 'reserva' ? 'reservou' : 'comprou';
    const numero = formatSaleNumber(number);
    const nome = String(buyerName || 'Comprador').trim() || 'Comprador';
    const rifa = String(raffleName || 'Rifa').trim() || 'Rifa';
    const refKey = `venda-${saleId}`;

    const { data: existing } = await db()
      .from('notificacoes')
      .select('id')
      .eq('usuario_id', Number(ownerId))
      .eq('ref_key', refKey)
      .maybeSingle();

    if (existing) return { ok: true, skipped: true };

    const row = {
      usuario_id: Number(ownerId),
      tipo: kind,
      titulo: kind === 'reserva' ? 'Nova reserva' : 'Nova compra',
      corpo: `${nome} ${action} o número ${numero} da rifa "${rifa}".`,
      href: `visualizar-rifa.html?id=${raffleId}`,
      ref_key: refKey,
      lida: false,
      apagada: false
    };

    const { error } = await db().from('notificacoes').insert([row]);
    if (error && !/duplicate|unique/i.test(error.message || '')) {
      if (isMissingNotifTable(error)) return { ok: false, needsSchema: true };
      return { ok: false, error: errMsg(error) };
    }
    return { ok: true };
  }

  async function reserveNumber(raffleId, number, buyer) {
    if (!buyer?.phone) {
      return { ok: false, error: 'Informe nome e telefone.' };
    }
    const nomeCheck = validateFullName(buyer?.name);
    if (!nomeCheck.ok) return { ok: false, error: nomeCheck.error };
    buyer = { ...buyer, name: nomeCheck.value };
    const current = await getRaffle(raffleId);
    if (!current.ok) return current;
    const slot = current.raffle.numbers.find((n) => n.number === number);
    if (!slot) return { ok: false, error: 'Número inválido.' };
    if (slot.status !== 'disponivel') return { ok: false, error: 'Número indisponível.' };

    const result = await upsertSale(raffleId, number, buyer, 'reservado');
    if (!result.ok) return result;
    const updatedSlot = result.raffle.numbers.find((n) => n.number === number);
    return { ok: true, slot: updatedSlot, raffle: result.raffle };
  }

  async function sellNumber(raffleId, number, buyer) {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };

    const { data: raffleRow, error } = await db()
      .from('rifas')
      .select('id, usuario_id')
      .eq('id', Number(raffleId))
      .maybeSingle();
    if (error) return { ok: false, error: errMsg(error) };
    if (!raffleRow || Number(raffleRow.usuario_id) !== Number(session.userId)) {
      return idorDeny();
    }

    const current = await getRaffle(raffleId);
    if (!current.ok) return current;
    const slot = current.raffle.numbers.find((n) => n.number === number);
    if (!slot) return { ok: false, error: 'Número inválido.' };
    if (slot.status === 'vendido') return { ok: false, error: 'Número já vendido.' };

    let buyerData = buyer || {
      name: slot.buyerName,
      phone: slot.buyerPhone,
      city: slot.buyerCity,
      observation: slot.observation
    };
    if (!buyerData?.phone) {
      return { ok: false, error: 'Informe nome e telefone.' };
    }
    const nomeCheck = validateFullName(buyerData?.name);
    if (!nomeCheck.ok) return { ok: false, error: nomeCheck.error };
    buyerData = { ...buyerData, name: nomeCheck.value };

    const result = await upsertSale(raffleId, number, buyerData, 'vendido');
    if (!result.ok) return result;
    const updatedSlot = result.raffle.numbers.find((n) => n.number === number);
    return { ok: true, slot: updatedSlot, raffle: result.raffle };
  }

  async function assertOwnedRaffleId(raffleId) {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };

    const token = sessionTokenOrNull();
    if (token) {
      const owned = await db().rpc('pas_vendas_da_rifa', {
        p_session_token: token,
        p_raffle_id: Number(raffleId)
      });
      if (!owned.error) {
        return { ok: true, session, ownerId: Number(session.userId) };
      }
      if (!isMissingRpc(owned.error)) {
        return idorDeny();
      }
    }

    const { data, error } = await db()
      .from('rifas')
      .select('id, usuario_id')
      .eq('id', Number(raffleId))
      .maybeSingle();
    if (error) return { ok: false, error: errMsg(error) };
    if (!data || Number(data.usuario_id) !== Number(session.userId)) return idorDeny();
    return { ok: true, session, ownerId: Number(data.usuario_id) };
  }

  async function cancelReservation(raffleId, number) {
    const owned = await assertOwnedRaffleId(raffleId);
    if (!owned.ok) return owned;

    const token = sessionTokenOrNull();
    if (token) {
      const { error: rpcErr } = await db().rpc('pas_cancelar_numero', {
        p_session_token: token,
        p_raffle_id: Number(raffleId),
        p_numero: Number(number),
        p_status: 'reservado'
      });
      if (!rpcErr) {
        const refreshed = await getRaffle(raffleId);
        if (!refreshed.ok) return refreshed;
        const slot = refreshed.raffle.numbers.find((n) => Number(n.number) === Number(number));
        return { ok: true, slot, raffle: refreshed.raffle };
      }
      if (!isMissingRpc(rpcErr)) {
        return { ok: false, error: errMsg(rpcErr, IDOR_NOT_FOUND) };
      }
    }

    return {
      ok: false,
      error: 'Execute supabase/idor_protection.sql no Supabase para cancelar com segurança.',
      needsSchema: true
    };
  }

  async function cancelSale(raffleId, number) {
    const owned = await assertOwnedRaffleId(raffleId);
    if (!owned.ok) return owned;

    const token = sessionTokenOrNull();
    if (token) {
      const { error: rpcErr } = await db().rpc('pas_cancelar_numero', {
        p_session_token: token,
        p_raffle_id: Number(raffleId),
        p_numero: Number(number),
        p_status: 'vendido'
      });
      if (!rpcErr) {
        const refreshed = await getRaffle(raffleId);
        if (!refreshed.ok) return refreshed;
        const slot = refreshed.raffle.numbers.find((n) => Number(n.number) === Number(number));
        return { ok: true, slot, raffle: refreshed.raffle };
      }
      if (!isMissingRpc(rpcErr)) {
        return { ok: false, error: errMsg(rpcErr, IDOR_NOT_FOUND) };
      }
    }

    return {
      ok: false,
      error: 'Execute supabase/idor_protection.sql no Supabase para cancelar com segurança.',
      needsSchema: true
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

  async function searchRaffle(query) {
    const listed = await listRaffles();
    if (!listed.ok) return [];
    const q = (query || '').trim().toLowerCase();
    if (!q) return listed.raffles;
    return listed.raffles.filter((r) => {
      const dateBr = (r.drawDate || '').split('-').reverse().join('/');
      return (
        r.name.toLowerCase().includes(q) ||
        r.prize.toLowerCase().includes(q) ||
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
      expected += r.price * r.quantity;
      (r.numbers || []).forEach((n) => {
        totalNumbers += 1;
        if (n.status === 'vendido') {
          sold += 1;
          raised += r.price;
        } else if (n.status === 'reservado') {
          reserved += 1;
        } else {
          available += 1;
        }
      });
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

    const listed = await listRaffles();
    if (!listed.ok) return [];

    const items = [];
    listed.raffles.forEach((r) => {
      r.numbers
        .filter((n) => n.status === 'reservado')
        .forEach((n) => {
          items.push({
            raffleId: r.id,
            raffleName: r.name,
            number: n.number,
            buyerName: n.buyerName,
            buyerPhone: n.buyerPhone,
            buyerCity: n.buyerCity,
            date: n.date,
            time: n.time,
            observation: n.observation,
            value: r.price
          });
        });
    });
    return items.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  }

  /** Números com status vendido (vendas realizadas) */
  async function getCompletedSales() {
    const session = Store.getSession();
    if (!session) return [];

    const listed = await listRaffles();
    if (!listed.ok) return [];

    const items = [];
    listed.raffles.forEach((r) => {
      r.numbers
        .filter((n) => n.status === 'vendido')
        .forEach((n) => {
          items.push({
            raffleId: r.id,
            raffleName: r.name,
            number: n.number,
            buyerName: n.buyerName,
            buyerPhone: n.buyerPhone,
            buyerCity: n.buyerCity,
            date: n.date,
            time: n.time,
            observation: n.observation,
            value: Number(r.price) || 0
          });
        });
    });
    return items.sort((a, b) => `${b.date || ''} ${b.time || ''}`.localeCompare(`${a.date || ''} ${a.time || ''}`));
  }

  async function uploadImage(file, opts = {}) {
    if (!file) return { ok: false, error: 'Selecione uma imagem.' };
    const type = String(file.type || '').toLowerCase();
    if (!/^image\/(jpeg|jpg|png|webp)$/.test(type)) {
      return { ok: false, error: 'Use uma imagem JPG, PNG ou WEBP.' };
    }
    if (file.size > 8 * 1024 * 1024) {
      return { ok: false, error: 'A imagem deve ter no máximo 8 MB.' };
    }

    const kind = String(opts.kind || 'raffle').toLowerCase();
    const sessionToken = resolveAuthSessionToken();

    // Preferência: Storage via Edge Function (sem base64 no banco)
    if (sessionToken) {
      try {
        const { data, error } = await db().functions.invoke('media', {
          body: {
            action: 'upload',
            kind,
            sessionToken,
            fileName: file.name || 'upload.jpg',
            dataUrl: await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ''));
              reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
              reader.readAsDataURL(file);
            })
          }
        });
        if (!error && data?.ok) {
          const ref = data.url || data.path || '';
          return {
            ok: true,
            dataUrl: ref,
            url: data.url || '',
            path: data.path || '',
            fileName: file.name || 'sorteio.jpg',
            stored: true
          };
        }
        if (error && !isFunctionUnavailable(error)) {
          let detalhe = '';
          try {
            detalhe = (await error.context?.json())?.error || '';
          } catch { /* ignore */ }
          if (detalhe || data?.error) {
            return { ok: false, error: detalhe || data.error || errMsg(error) };
          }
        }
        // Função ainda não publicada: cai no fallback comprimido abaixo
      } catch (err) {
        if (!isFunctionUnavailable(err)) {
          return { ok: false, error: err.message || 'Falha no upload.' };
        }
      }
    }

    // Fallback legado (só se Storage indisponível) — comprime e limita tamanho
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
      reader.readAsDataURL(file);
    });
    if (dataUrl.length > 120000) {
      return {
        ok: false,
        needsDeploy: true,
        error:
          'Imagem grande exige Storage. Faça o deploy da Edge Function media e execute supabase/storage_media_egress.sql.'
      };
    }
    return {
      ok: true,
      dataUrl,
      fileName: file.name || 'sorteio.jpg',
      stored: false,
      legacy: true
    };
  }

  async function resolveSignedMediaUrl(path) {
    const raw = String(path || '').trim();
    if (!raw) return { ok: false, error: 'Caminho vazio.', url: '' };
    if (/^data:image\//i.test(raw) || /^https?:\/\//i.test(raw)) {
      return { ok: true, url: raw };
    }
    if (!/^comprovantes\//i.test(raw) && !isStoragePath(raw)) {
      return { ok: true, url: resolveMediaSrc(raw) };
    }
    const sessionToken = resolveAuthSessionToken();
    if (!sessionToken) return { ok: false, error: 'Não autenticado.', url: '' };
    try {
      const { data, error } = await db().functions.invoke('media', {
        body: { action: 'signed-url', sessionToken, path: raw }
      });
      if (error) return { ok: false, error: errMsg(error), url: '' };
      if (!data?.ok) return { ok: false, error: data?.error || 'Falha ao obter URL.', url: '' };
      return { ok: true, url: data.url || '', path: data.path || raw };
    } catch (err) {
      return { ok: false, error: err.message || 'Falha ao obter URL.', url: '' };
    }
  }

  async function uploadInstagramImage(file) {
    return uploadImage(file);
  }

  async function publishInstagramDraw(form) {
    const titulo = String(form.titulo || '').trim();
    if (!titulo) return { ok: false, error: 'Informe o título do sorteio.' };
    if (!form.imageDataUrl && !form.imageUrl) {
      return { ok: false, error: 'Envie a foto do sorteio.' };
    }
    return callDrawFunction('publicar-post', {
      titulo,
      descricao: form.descricao,
      dataSorteio: form.dataSorteio,
      textoExtra: form.textoExtra,
      pedirCurtir: form.pedirCurtir !== false,
      pedirSeguir: form.pedirSeguir !== false,
      imageUrl: form.imageUrl || undefined,
      imageDataUrl: form.imageDataUrl || undefined,
      regras: normalizeDrawRules(form.rules)
    });
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
    return { ok: false, message: 'Notificações preparadas para FCM.' };
  }

  /**
   * Sorteia ganhadores entre números cadastrados em vendas_rifa (status vendido).
   * Persiste o resultado em rifas.resultado_sorteio para exibir na rifa pública.
   */
  async function drawWinners(raffleId, count = 1) {
    const session = Store.getSession();
    if (!session) return { ok: false, error: 'Não autenticado.' };

    const result = await getRaffle(raffleId);
    if (!result.ok) return result;

    const raffle = result.raffle;
    const token = sessionTokenOrNull();
    if (!token) return { ok: false, error: 'Não autenticado.' };

    // Ownership real é validado no RPC; não confiar só no userId local
    const pool = (raffle.numbers || []).filter((n) => n.status === 'vendido');
    if (!pool.length) {
      return { ok: false, error: 'Não há números vendidos cadastrados para sortear.' };
    }

    const winnersCount = Math.min(Math.max(1, Number(count) || 1), pool.length);
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }

    const drawnAt = new Date().toISOString();
    const winners = shuffled.slice(0, winnersCount).map((slot, index) => ({
      place: index + 1,
      number: slot.number,
      name: slot.buyerName || '—',
      phone: slot.buyerPhone || '—',
      city: slot.buyerCity || '—',
      date: slot.date || '—',
      time: slot.time || '—'
    }));

    const { error: rpcErr } = await db().rpc('pas_salvar_resultado_sorteio', {
      p_session_token: token,
      p_raffle_id: Number(raffleId),
      p_resultado: winners,
      p_sorteado_em: drawnAt
    });

    if (!rpcErr) {
      const updated = await getRaffle(raffleId);
      if (!updated.ok) return updated;
      return {
        ok: true,
        raffle: updated.raffle,
        winners,
        poolSize: pool.length,
        drawnAt
      };
    }

    if (!isMissingRpc(rpcErr)) {
      const msg = errMsg(rpcErr, IDOR_NOT_FOUND);
      if (/não encontrado|Recurso|not found/i.test(msg)) return idorDeny();
      return { ok: false, error: msg };
    }

    const payload = {
      resultado_sorteio: winners,
      sorteado_em: drawnAt,
      status: 'sorteada'
    };

    const { data, error } = await db()
      .from('rifas')
      .update(payload)
      .eq('id', Number(raffleId))
      .eq('usuario_id', Number(session.userId))
      .select('*')
      .single();

    if (error) {
      if (/resultado_sorteio|sorteado_em|column|schema cache|Could not find/i.test(error.message || '')) {
        return {
          ok: false,
          needsSchema: true,
          error: 'Execute supabase/add_resultado_sorteio.sql no Supabase para gravar o resultado na rifa pública.'
        };
      }
      return { ok: false, error: errMsg(error, 'Não foi possível salvar o sorteio.') };
    }

    const updated = await hydrateRaffle(data);
    Store.upsertRaffle(updated);

    return {
      ok: true,
      raffle: updated,
      winners,
      poolSize: pool.length,
      drawnAt
    };
  }

  // ─── Sorteios por comentários do Instagram ───────────────

  /**
   * A lib do Supabase lança "Failed to send a request to the Edge Function"
   * quando a função ainda não foi publicada (deploy) ou está fora do ar.
   */
  function isFunctionUnavailable(error) {
    const name = error?.name || '';
    const msg = error?.message || '';
    return (
      name === 'FunctionsFetchError' ||
      /failed to send a request|failed to fetch|networkerror|não foi possível conectar/i.test(msg)
    );
  }

  const FN_NOT_DEPLOYED =
    'Recurso de Instagram ainda não publicado no servidor. Faça o deploy das Edge Functions (instagram-oauth e sorteio-instagram) no Supabase.';

  /**
   * Ações que exigem servidor: buscar comentários (token do Instagram) e
   * sortear (o seed não pode ser gerado no navegador). Ver
   * supabase/functions/sorteio-instagram.
   */
  async function callDrawFunction(action, payload = {}) {
    const session = Store.getSession();
    if (!session?.sessionToken) return { ok: false, error: 'Não autenticado.' };

    try {
      const { data, error } = await db().functions.invoke('sorteio-instagram', {
        body: { action, sessionToken: session.sessionToken, ...payload }
      });

      if (error) {
        if (isFunctionUnavailable(error)) {
          return { ok: false, needsDeploy: true, error: FN_NOT_DEPLOYED };
        }
        // Erros de negócio vêm no corpo da resposta, não só na mensagem HTTP
        let detalhe = '';
        try {
          detalhe = (await error.context?.json())?.error || '';
        } catch { /* ignore */ }
        return { ok: false, error: detalhe || errMsg(error, 'Falha ao falar com o servidor do sorteio.') };
      }
      if (data && data.ok === false) return { ok: false, error: data.error || 'Erro no sorteio.' };
      return { ok: true, ...(data || {}) };
    } catch (err) {
      if (isFunctionUnavailable(err)) {
        return { ok: false, needsDeploy: true, error: FN_NOT_DEPLOYED };
      }
      return { ok: false, error: err.message || 'Servidor do sorteio indisponível.' };
    }
  }

  async function callInstagramOAuth(action, payload = {}) {
    const session = Store.getSession();
    if (!session?.sessionToken) return { ok: false, error: 'Não autenticado.' };

    try {
      const { data, error } = await db().functions.invoke('instagram-oauth', {
        body: { action, sessionToken: session.sessionToken, ...payload }
      });
      if (error) {
        if (isFunctionUnavailable(error)) {
          return { ok: false, needsDeploy: true, error: FN_NOT_DEPLOYED };
        }
        let detalhe = '';
        try {
          detalhe = (await error.context?.json())?.error || '';
        } catch { /* ignore */ }
        return {
          ok: false,
          error: detalhe || errMsg(error, 'Não foi possível acessar a conexão do Instagram.')
        };
      }
      if (data?.ok === false) return { ok: false, error: data.error || 'Erro no Instagram.' };
      return { ok: true, ...(data || {}) };
    } catch (err) {
      if (isFunctionUnavailable(err)) {
        return { ok: false, needsDeploy: true, error: FN_NOT_DEPLOYED };
      }
      return { ok: false, error: err.message || 'Serviço do Instagram indisponível.' };
    }
  }

  async function getInstagramConnection() {
    return callInstagramOAuth('status');
  }

  async function connectInstagram(onStarted) {
    // Abre imediatamente para não ser bloqueado pelo navegador enquanto
    // aguardamos a Edge Function gerar a URL segura com state.
    const popup = window.open(
      'about:blank',
      'pas-instagram-oauth',
      'popup=yes,width=520,height=720,resizable=yes,scrollbars=yes'
    );
    if (!popup) {
      return {
        ok: false,
        error: 'O navegador bloqueou a janela do Instagram. Libere pop-ups para este site.'
      };
    }

    try {
      popup.document.title = 'Conectar Instagram';
      popup.document.body.innerHTML =
        '<p style="font-family:system-ui;text-align:center;padding:40px">Abrindo o Instagram...</p>';
    } catch { /* ignore */ }

    const result = await callInstagramOAuth('start', {
      returnUrl: `${window.location.origin}/configuracoes.html`
    });
    if (!result.ok || !result.authorizationUrl) {
      popup.close();
      return result.ok
        ? { ok: false, error: 'O servidor não retornou a URL de autorização.' }
        : result;
    }

    return new Promise((resolve) => {
      let finished = false;
      let closedTimer = null;
      let timeoutTimer = null;
      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        clearInterval(closedTimer);
        clearTimeout(timeoutTimer);
      };
      const finish = (value) => {
        if (finished) return;
        finished = true;
        cleanup();
        resolve(value);
      };
      const onMessage = (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== 'pas-instagram-oauth') return;
        if (event.data.status === 'conectado') {
          finish({ ok: true, connected: true });
        } else {
          finish({
            ok: false,
            error: event.data.motivo || 'Autorização do Instagram cancelada.'
          });
        }
      };

      window.addEventListener('message', onMessage);
      popup.location.href = result.authorizationUrl;
      if (typeof onStarted === 'function') onStarted();

      closedTimer = setInterval(() => {
        if (popup.closed) {
          finish({
            ok: false,
            cancelled: true,
            error: 'A janela do Instagram foi fechada antes de concluir.'
          });
        }
      }, 500);
      timeoutTimer = setTimeout(() => {
        try { popup.close(); } catch { /* ignore */ }
        finish({ ok: false, error: 'A autorização do Instagram demorou demais. Tente novamente.' });
      }, 5 * 60 * 1000);
    });
  }

  async function disconnectInstagram() {
    return callInstagramOAuth('disconnect');
  }

  function normalizeDrawRules(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    return {
      minCaracteres: Math.max(0, Number(r.minCaracteres) || 0),
      marcarAmigos: Math.max(0, Number(r.marcarAmigos) || 0),
      palavraChave: String(r.palavraChave || '').trim(),
      umPorUsuario: r.umPorUsuario !== undefined ? !!r.umPorUsuario : true
    };
  }

  function mapDrawRow(row, participantes = []) {
    return {
      id: String(row.id),
      ownerId: String(row.usuario_id),
      titulo: row.titulo || '',
      postUrl: row.post_instagram_url || '',
      mediaId: row.media_id || '',
      rules: normalizeDrawRules(row.regras),
      status: row.status || 'rascunho',
      result: row.resultado || null,
      drawnAt: row.sorteado_em || null,
      totalValid: Number(row.total_validos) || 0,
      createdAt: row.created_at || null,
      participants: (participantes || []).map((p) => ({
        id: String(p.id),
        commentId: p.comment_id || '',
        username: p.nome_instagram || '',
        comment: p.comentario || '',
        commentedAt: p.commentado_em || null,
        valid: !!p.validado,
        reason: p.motivo_invalidacao || null
      }))
    };
  }

  /** Extrai o shortcode do link — serve para exibir, não é o media_id da Graph API */
  function parseInstagramUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return { url: '', shortcode: '' };
    try {
      const u = new URL(raw);
      const parts = u.pathname.split('/').filter(Boolean);
      const idx = parts.findIndex((p) => p === 'p' || p === 'reel' || p === 'tv');
      return { url: raw, shortcode: idx >= 0 ? parts[idx + 1] || '' : '' };
    } catch {
      return { url: raw, shortcode: '' };
    }
  }

  async function listInstagramDraws() {
    const gate = await guardSession();
    if (!gate.ok) return { ok: false, error: gate.error || 'Não autenticado.', draws: [] };

    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.', draws: [] };

    const { data, error } = await db()
      .from('sorteios')
      .select('*')
      .eq('usuario_id', Number(session.userId))
      .order('id', { ascending: false });

    if (error) {
      if (isMissingColumnError(error) || /sorteios/i.test(error.message || '')) {
        return {
          ok: false,
          needsSchema: true,
          error: 'Tabelas de sorteio ainda não criadas. Rode supabase/sorteios_instagram.sql.',
          draws: []
        };
      }
      return { ok: false, error: errMsg(error), draws: [] };
    }

    return { ok: true, draws: (data || []).map((row) => mapDrawRow(row)) };
  }

  async function getInstagramDraw(id) {
    const gate = await guardSession();
    if (!gate.ok) return { ok: false, error: gate.error || 'Não autenticado.' };

    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };

    const { data, error } = await db()
      .from('sorteios')
      .select('*')
      .eq('id', Number(id) || id)
      .eq('usuario_id', Number(session.userId))
      .maybeSingle();

    if (error) return { ok: false, error: errMsg(error) };
    if (!data) return { ok: false, error: 'Sorteio não encontrado.' };

    const { data: parts, error: partsErr } = await db()
      .from('participantes')
      .select('*')
      .eq('sorteio_id', Number(id) || id)
      .order('id', { ascending: true });

    if (partsErr) return { ok: false, error: errMsg(partsErr) };

    return { ok: true, draw: mapDrawRow(data, parts || []) };
  }

  async function listInstagramPosts(limit = 24) {
    return callDrawFunction('listar-posts', { limit });
  }

  async function resolveInstagramPost(postUrl) {
    return callDrawFunction('resolver-post', { postUrl: String(postUrl || '').trim() });
  }

  async function createInstagramDraw(form) {
    const gate = await guardSession();
    if (!gate.ok) return { ok: false, error: gate.error || 'Não autenticado.' };

    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };

    const titulo = String(form.titulo || '').trim();
    if (!titulo) return { ok: false, error: 'Informe o título do sorteio.' };

    let mediaId = String(form.mediaId || '').trim();
    let postUrl = String(form.postUrl || '').trim();

    if (!mediaId && postUrl) {
      const resolved = await resolveInstagramPost(postUrl);
      if (!resolved.ok) return { ok: false, error: resolved.error };
      mediaId = resolved.post?.id || '';
      postUrl = resolved.post?.permalink || postUrl;
    }

    if (!mediaId || !/^\d+$/.test(mediaId)) {
      return { ok: false, error: 'Selecione um post do Instagram para o sorteio.' };
    }

    const { data, error } = await db()
      .from('sorteios')
      .insert({
        usuario_id: Number(session.userId),
        titulo,
        post_instagram_url: postUrl || null,
        media_id: mediaId,
        regras: normalizeDrawRules(form.rules),
        status: 'rascunho'
      })
      .select()
      .maybeSingle();

    if (error) return { ok: false, error: errMsg(error, 'Erro ao criar sorteio.') };
    return { ok: true, draw: mapDrawRow(data) };
  }

  async function updateInstagramDraw(id, form) {
    const gate = await guardSession();
    if (!gate.ok) return { ok: false, error: gate.error || 'Não autenticado.' };

    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };

    const titulo = String(form.titulo || '').trim();
    if (!titulo) return { ok: false, error: 'Informe o título do sorteio.' };

    let mediaId = String(form.mediaId || '').trim();
    let postUrl = String(form.postUrl || '').trim();

    if (!mediaId && postUrl) {
      const resolved = await resolveInstagramPost(postUrl);
      if (!resolved.ok) return { ok: false, error: resolved.error };
      mediaId = resolved.post?.id || '';
      postUrl = resolved.post?.permalink || postUrl;
    }

    if (mediaId && !/^\d+$/.test(mediaId)) {
      return { ok: false, error: 'O post selecionado é inválido.' };
    }
    if (!mediaId) {
      return { ok: false, error: 'Selecione um post do Instagram para o sorteio.' };
    }

    const { data, error } = await db()
      .from('sorteios')
      .update({
        titulo,
        post_instagram_url: postUrl || null,
        media_id: mediaId,
        regras: normalizeDrawRules(form.rules)
      })
      .eq('id', Number(id))
      .eq('usuario_id', Number(session.userId))
      .select()
      .maybeSingle();

    if (error) return { ok: false, error: errMsg(error, 'Erro ao salvar sorteio.') };
    if (!data) return { ok: false, error: 'Sorteio não encontrado.' };
    return { ok: true, draw: mapDrawRow(data) };
  }

  async function deleteInstagramDraw(id) {
    const gate = await guardSession();
    if (!gate.ok) return { ok: false, error: gate.error || 'Não autenticado.' };

    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };

    const { error } = await db()
      .from('sorteios')
      .delete()
      .eq('id', Number(id))
      .eq('usuario_id', Number(session.userId));

    if (error) return { ok: false, error: errMsg(error, 'Erro ao excluir sorteio.') };
    return { ok: true };
  }

  async function importInstagramComments(drawId, mediaId, postUrl) {
    return callDrawFunction('importar', {
      sorteioId: Number(drawId),
      mediaId,
      postUrl: postUrl || undefined
    });
  }

  async function validateInstagramParticipants(drawId, rules) {
    return callDrawFunction('validar', {
      sorteioId: Number(drawId),
      regras: normalizeDrawRules(rules)
    });
  }

  async function drawInstagramWinners(drawId, quantidade = 1) {
    return callDrawFunction('sortear', {
      sorteioId: Number(drawId),
      quantidade: Math.max(1, Number(quantidade) || 1)
    });
  }

  // ─── Notificações (por usuário, na nuvem) ────────────────

  const SYSTEM_NOTIFS = [
    {
      ref_key: 'sys-notif-por-usuario',
      tipo: 'sistema',
      titulo: 'Atualização do sistema',
      corpo: 'Agora somente você consegue ver as suas notificações. Você será avisado quando um comprador reservar ou adquirir um número nas suas rifas.',
      href: null
    },
    {
      ref_key: 'sys-pix-por-rifa',
      tipo: 'sistema',
      titulo: 'Nova melhoria: PIX na rifa',
      corpo: 'Agora você cadastra a chave PIX (CPF, telefone ou e-mail) ao criar ou editar a rifa, para o comprador pagar com mais facilidade.',
      href: 'nova-rifa.html'
    },
    {
      ref_key: 'sys-sessao-unica',
      tipo: 'sistema',
      titulo: 'Segurança: 1 dispositivo por vez',
      corpo: 'Não é possível usar a mesma conta em vários dispositivos ao mesmo tempo. Se você entrar em outro celular ou computador, a sessão anterior será encerrada automaticamente.',
      href: null
    }
  ];

  const LEGACY_SYSTEM_REF_KEYS = ['sys-central-notif'];

  /** 2º domingo de agosto — Dia dos Pais (Brasil) */
  function fathersDayDate(year) {
    const y = Number(year) || new Date().getFullYear();
    const aug1 = new Date(y, 7, 1);
    const weekday = aug1.getDay();
    const firstSunday = weekday === 0 ? 1 : (8 - weekday);
    return new Date(y, 7, firstSunday + 7);
  }

  function isFathersDayToday(date = new Date()) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('pas_force_fathers_day') === '1') {
        return true;
      }
    } catch { /* ignore */ }
    if (typeof SystemBanner !== 'undefined' && typeof SystemBanner.isFathersDay === 'function') {
      return SystemBanner.isFathersDay(date);
    }
    const ref = date instanceof Date ? date : new Date();
    const fd = fathersDayDate(ref.getFullYear());
    return ref.getFullYear() === fd.getFullYear()
      && ref.getMonth() === fd.getMonth()
      && ref.getDate() === fd.getDate();
  }

  function fathersDaySystemNotif() {
    const year = new Date().getFullYear();
    return {
      ref_key: `sys-dia-dos-pais-${year}`,
      tipo: 'sistema',
      titulo: 'Feliz Dia dos Pais!',
      corpo: 'A PowerApps Sistemas deseja um feliz Dia dos Pais a todos os pais. Hoje é dia de homenagear quem ensina, protege e incentiva — você faz a diferença!',
      href: null
    };
  }

  function mapNotifRow(row) {
    return {
      id: String(row.id),
      type: row.tipo || 'sistema',
      title: row.titulo || '',
      body: row.corpo || '',
      href: row.href || null,
      refKey: row.ref_key || null,
      read: !!row.lida,
      createdAt: row.created_at || null
    };
  }

  function isMissingNotifTable(error) {
    return /notificacoes|notif_last_sale_id|relation|schema cache|Could not find|does not exist/i.test(error?.message || '');
  }

  async function getNotifCursor(userId) {
    const { data, error } = await db()
      .from('usuarios')
      .select('notif_last_sale_id')
      .eq('id', Number(userId))
      .maybeSingle();
    if (error) throw error;
    const n = data?.notif_last_sale_id;
    return n == null || n === '' ? null : Number(n);
  }

  async function setNotifCursor(userId, saleId) {
    const { error } = await db()
      .from('usuarios')
      .update({ notif_last_sale_id: Number(saleId) })
      .eq('id', Number(userId));
    if (error) throw error;
  }

  async function ensureSystemNotifications(userId) {
    const uid = Number(userId);
    const insertedKeys = [];

    // Arquiva aviso antigo (se existir)
    if (LEGACY_SYSTEM_REF_KEYS.length) {
      await db()
        .from('notificacoes')
        .update({ apagada: true, lida: true })
        .eq('usuario_id', uid)
        .in('ref_key', LEGACY_SYSTEM_REF_KEYS)
        .eq('apagada', false);
    }

    const seasonal = [];
    if (isFathersDayToday()) {
      seasonal.push(fathersDaySystemNotif());
    }

    for (const s of [...SYSTEM_NOTIFS, ...seasonal]) {
      const row = {
        usuario_id: uid,
        tipo: s.tipo,
        titulo: s.titulo,
        corpo: s.corpo,
        href: s.href,
        ref_key: s.ref_key,
        lida: false,
        apagada: false
      };

      const { data: existing } = await db()
        .from('notificacoes')
        .select('id, apagada')
        .eq('usuario_id', uid)
        .eq('ref_key', s.ref_key)
        .maybeSingle();

      if (existing) {
        // Mantém texto atualizado; se o usuário limpou, não recria
        if (!existing.apagada) {
          await db()
            .from('notificacoes')
            .update({ titulo: s.titulo, corpo: s.corpo, tipo: s.tipo, href: s.href })
            .eq('id', existing.id)
            .eq('usuario_id', uid);
        }
        continue;
      }

      const { error } = await db().from('notificacoes').insert([row]);
      if (error && !/duplicate|unique/i.test(error.message || '')) throw error;
      if (!error) insertedKeys.push(s.ref_key);
    }

    return { insertedKeys };
  }

  function formatSaleNumber(num) {
    const n = Number(num);
    if (!Number.isFinite(n)) return String(num ?? '');
    return String(n).padStart(2, '0');
  }

  async function syncSaleNotifications(userId) {
    const listed = await listOwnerSales({ limit: 25 });
    if (!listed.ok) return { ok: false, error: listed.error };

    const sales = listed.sales || [];
    let cursor = await getNotifCursor(userId);

    if (!sales.length) {
      if (cursor == null) await setNotifCursor(userId, 0);
      return { ok: true };
    }

    const newestId = Number(sales[0].id);
    if (cursor == null) {
      // Primeira sincronização: ancora sem notificar o histórico antigo
      await setNotifCursor(userId, newestId);
      return { ok: true };
    }

    const novos = sales
      .filter((s) => Number(s.id) > Number(cursor))
      .sort((a, b) => Number(a.id) - Number(b.id));

    if (novos.length) {
      const rows = novos.map((sale) => {
        const kind = sale.status === 'reservado' ? 'reserva' : 'venda';
        const action = kind === 'reserva' ? 'reservou' : 'comprou';
        const numero = formatSaleNumber(sale.number);
        const nome = sale.buyerName || 'Comprador';
        return {
          usuario_id: Number(userId),
          tipo: kind,
          titulo: kind === 'reserva' ? 'Nova reserva' : 'Nova compra',
          corpo: `${nome} ${action} o número ${numero} da rifa "${sale.raffleName}".`,
          href: `visualizar-rifa.html?id=${sale.raffleId}`,
          ref_key: `venda-${sale.id}`,
          lida: false,
          apagada: false
        };
      });

      for (const row of rows) {
        const { data: existing } = await db()
          .from('notificacoes')
          .select('id')
          .eq('usuario_id', row.usuario_id)
          .eq('ref_key', row.ref_key)
          .maybeSingle();
        if (existing) continue;
        const { error } = await db().from('notificacoes').insert([row]);
        if (error && !/duplicate|unique/i.test(error.message || '')) throw error;
      }
    }

    if (newestId > Number(cursor)) await setNotifCursor(userId, newestId);
    return { ok: true };
  }

  async function ensureDrawDayNotifications(userId) {
    const uid = Number(userId);
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayIso = `${y}-${m}-${d}`;
    const todayBr = `${d}/${m}/${y}`;

    function isDrawToday(rawDate) {
      const raw = String(rawDate || '').trim();
      if (!raw) return false;
      if (raw === todayIso || raw === todayBr) return true;
      if (raw.startsWith(`${todayIso}T`) || raw.startsWith(`${todayIso} `)) return true;
      const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (br) return `${br[3]}-${br[2]}-${br[1]}` === todayIso;
      const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}` === todayIso;
      return false;
    }

    function formatDrawTimeLabel(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      const match = raw.match(/^(\d{1,2}):(\d{2})/);
      if (!match) return raw;
      return `${match[1].padStart(2, '0')}:${match[2]}`;
    }

    // Inclui rifas antigas (criadas antes de existir a tabela notificacoes)
    const { data: rifas, error } = await db()
      .from('rifas')
      .select('id, motivo, data_sorteio, hora_sorteio, status')
      .eq('usuario_id', uid);

    if (error) throw error;

    for (const r of rifas || []) {
      if (!isDrawToday(r.data_sorteio)) continue;

      const status = String(r.status || 'ativa').toLowerCase();
      if (['encerrada', 'finalizada', 'cancelada', 'sorteada'].includes(status)) continue;

      const raffleId = r.id;
      const refKey = `sorteio-dia-${raffleId}-${todayIso}`;
      const nome = String(r.motivo || 'Rifa').trim() || 'Rifa';
      const hora = formatDrawTimeLabel(r.hora_sorteio);
      const corpo = hora
        ? `Hoje é dia de fazer o sorteio da rifa "${nome}" às ${hora}.`
        : `Hoje é dia de fazer o sorteio da rifa "${nome}".`;
      const href = `visualizar-rifa.html?id=${raffleId}`;

      const { data: existing } = await db()
        .from('notificacoes')
        .select('id, apagada')
        .eq('usuario_id', uid)
        .eq('ref_key', refKey)
        .maybeSingle();

      if (existing) {
        // Restaura se o usuário limpou a lista, sem duplicar
        if (existing.apagada) {
          await db()
            .from('notificacoes')
            .update({
              apagada: false,
              lida: false,
              tipo: 'sorteio',
              titulo: 'Dia do sorteio',
              corpo,
              href
            })
            .eq('id', existing.id)
            .eq('usuario_id', uid);
        }
        continue;
      }

      const row = {
        usuario_id: uid,
        tipo: 'sorteio',
        titulo: 'Dia do sorteio',
        corpo,
        href,
        ref_key: refKey,
        lida: false,
        apagada: false
      };

      const { error: insErr } = await db().from('notificacoes').insert([row]);
      if (insErr && !/duplicate|unique/i.test(insErr.message || '')) throw insErr;
    }
  }

  async function upsertUserNotification({
    userId,
    tipo = 'sistema',
    titulo,
    corpo,
    href = null,
    refKey,
    bumpUnread = true
  } = {}) {
    const uid = Number(userId);
    const key = String(refKey || '').trim();
    if (!uid || !key || !titulo) return { ok: false, error: 'Dados inválidos.' };

    const nowIso = new Date().toISOString();
    try {
      const { data: existing } = await db()
        .from('notificacoes')
        .select('id, apagada')
        .eq('usuario_id', uid)
        .eq('ref_key', key)
        .maybeSingle();

      if (existing?.id) {
        if (existing.apagada && !bumpUnread) return { ok: true, skipped: true };
        const patch = {
          tipo,
          titulo,
          corpo: corpo || '',
          href,
          apagada: false
        };
        if (bumpUnread) {
          patch.lida = false;
          patch.created_at = nowIso;
        }
        const { error: updErr } = await db()
          .from('notificacoes')
          .update(patch)
          .eq('id', existing.id);
        if (updErr) {
          if (isMissingNotifTable(updErr)) return { ok: false, needsSchema: true };
          return { ok: false, error: errMsg(updErr) };
        }
        return { ok: true, updated: true, refKey: key };
      }

      const row = {
        usuario_id: uid,
        tipo,
        titulo,
        corpo: corpo || '',
        href,
        ref_key: key,
        lida: false,
        apagada: false,
        created_at: nowIso
      };
      const { error } = await db().from('notificacoes').insert([row]);
      if (error) {
        if (isMissingNotifTable(error)) return { ok: false, needsSchema: true };
        if (/duplicate|unique/i.test(error.message || '')) return { ok: true, updated: true, refKey: key };
        return { ok: false, error: errMsg(error) };
      }
      return { ok: true, created: true, refKey: key };
    } catch (err) {
      if (isMissingNotifTable(err)) return { ok: false, needsSchema: true };
      return { ok: false, error: err.message || 'Falha ao notificar.' };
    }
  }

  async function resolveDeveloperUserId() {
    if (typeof DevAuth !== 'undefined' && DevAuth.isLoggedIn?.()) {
      const s = DevAuth.getSession() || {};
      if (s.userId) return Number(s.userId);
    }

    const ensured = await ensureDeveloperUser();
    if (ensured.ok && ensured.user?.id) return Number(ensured.user.id);

    const cfg =
      (typeof DevAuth !== 'undefined' && DevAuth.getConfig?.()) ||
      window.PAS_CONFIG?.DEV_PORTAL ||
      {};
    const email = String(cfg.email || '').trim().toLowerCase();
    if (!email) return null;

    const { data } = await db()
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    return data?.id ? Number(data.id) : null;
  }

  async function notifyDeveloperPaymentReview(userOrProfile = {}) {
    const uid = Number(userOrProfile.id || userOrProfile.userId || 0);
    const name = userOrProfile.name || userOrProfile.nome || userOrProfile.email || 'Usuário';
    if (!uid) return { ok: false, error: 'Usuário inválido.' };

    const devId = await resolveDeveloperUserId();
    if (!devId) return { ok: false, error: 'Desenvolvedor não encontrado.' };

    return upsertUserNotification({
      userId: devId,
      tipo: 'sistema',
      titulo: 'Comprovante aguardando revisão',
      corpo: `${name} enviou comprovante de pagamento.`,
      href: 'dev.html#pagamentos',
      refKey: `dev-pay-review-${uid}`,
      bumpUnread: true
    });
  }

  async function notifyDeveloperSupportMessage({
    userId,
    userName = '',
    preview = ''
  } = {}) {
    const uid = Number(userId);
    if (!uid) return { ok: false, error: 'Usuário inválido.' };

    const devId = await resolveDeveloperUserId();
    if (!devId) return { ok: false, error: 'Desenvolvedor não encontrado.' };

    const name = String(userName || '').trim() || 'Usuário';
    const snippet = String(preview || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    return upsertUserNotification({
      userId: devId,
      tipo: 'sistema',
      titulo: 'Nova mensagem no suporte',
      corpo: snippet ? `${name}: ${snippet}` : `${name} enviou uma mensagem no chat de suporte.`,
      href: 'dev.html#suporte',
      refKey: `dev-support-${uid}`,
      bumpUnread: true
    });
  }

  async function notifyUserSupportReply({ userId, preview = '' } = {}) {
    const uid = Number(userId);
    if (!uid) return { ok: false, error: 'Usuário inválido.' };

    const snippet = String(preview || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    return upsertUserNotification({
      userId: uid,
      tipo: 'sistema',
      titulo: 'Resposta do suporte',
      corpo: snippet || 'O suporte enviou uma nova mensagem.',
      href: 'suporte.html',
      refKey: `user-support-reply-${uid}`,
      bumpUnread: true
    });
  }

  async function syncDeveloperSupportNotifications(devUserId) {
    const uid = Number(devUserId);
    if (!uid) return { insertedKeys: [] };

    const { data, error } = await db()
      .from('suporte_conversas')
      .select('usuario_id, nao_lidas_dev, ultima_mensagem_em, atualizado_em')
      .gt('nao_lidas_dev', 0)
      .order('atualizado_em', { ascending: false })
      .limit(40);

    if (error) {
      if (isMissingSupportChat(error) || isMissingNotifTable(error)) {
        return { insertedKeys: [], needsSchema: true };
      }
      console.warn('syncDeveloperSupportNotifications', error);
      return { insertedKeys: [] };
    }

    const insertedKeys = [];
    for (const row of data || []) {
      const userId = Number(row.usuario_id);
      if (!userId) continue;

      let name = 'Usuário';
      const { data: userRow } = await db()
        .from('usuarios')
        .select('id, nome, email')
        .eq('id', userId)
        .maybeSingle();
      if (userRow) name = userRow.nome || userRow.email || name;

      const unread = Number(row.nao_lidas_dev || 0) || 0;
      const refKey = `dev-support-${userId}`;
      const result = await upsertUserNotification({
        userId: uid,
        tipo: 'sistema',
        titulo: 'Nova mensagem no suporte',
        corpo:
          unread > 1
            ? `${name} enviou ${unread} mensagens no chat de suporte.`
            : `${name} enviou uma mensagem no chat de suporte.`,
        href: 'dev.html#suporte',
        refKey,
        bumpUnread: false
      });
      if (result.created) insertedKeys.push(refKey);
    }

    return { insertedKeys };
  }

  async function syncDeveloperAdminNotifications(devUserId) {
    const uid = Number(devUserId);
    if (!uid) return { insertedKeys: [] };

    const insertedKeys = [];
    let { data, error } = await db()
      .from('usuarios')
      .select('id, nome, email, status_pagamento, comprovante_em')
      .in('status_pagamento', ['pendente_revisao', 'pendente', 'atrasado'])
      .order('id', { ascending: false })
      .limit(40);

    if (error && /comprovante_em|column|schema cache|Could not find/i.test(error.message || '')) {
      ({ data, error } = await db()
        .from('usuarios')
        .select('id, nome, email, status_pagamento')
        .in('status_pagamento', ['pendente_revisao', 'pendente', 'atrasado'])
        .order('id', { ascending: false })
        .limit(40));
    }
    if (error) {
      if (isMissingNotifTable(error)) return { insertedKeys: [], needsSchema: true };
      console.warn('syncDeveloperAdminNotifications', error);
      return { insertedKeys: [] };
    }

    for (const row of data || []) {
      if (isDeveloperAccount(row)) continue;
      const st = normalizeStatusPagamento(row.status_pagamento);
      const name = row.nome || row.email || 'Usuário';
      const userId = Number(row.id);
      if (!userId) continue;

      let refKey = '';
      let titulo = '';
      let corpo = '';
      if (st === 'pendente_revisao') {
        refKey = `dev-pay-review-${userId}`;
        titulo = 'Comprovante aguardando revisão';
        corpo = `${name} enviou comprovante de pagamento.`;
      } else if (st === 'pendente') {
        refKey = `dev-pay-pending-${userId}`;
        titulo = 'Pagamento pendente';
        corpo = `${name} ainda não concluiu o pagamento.`;
      } else if (st === 'atrasado') {
        refKey = `dev-pay-late-${userId}`;
        titulo = 'Pagamento atrasado';
        corpo = `Assinatura de ${name} está atrasada.`;
      } else {
        continue;
      }

      const result = await upsertUserNotification({
        userId: uid,
        tipo: 'sistema',
        titulo,
        corpo,
        href: 'dev.html#pagamentos',
        refKey,
        bumpUnread: false
      });
      if (result.created) insertedKeys.push(refKey);
    }

    return { insertedKeys };
  }

  async function listNotifications({ limit = 30 } = {}) {
    const session = resolveAuthSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.', notifications: [] };

    if (!session.isDev) {
      const gate = await guardSession();
      if (!gate.ok) return { ok: false, error: gate.error || 'Não autenticado.', notifications: [] };
    }

    const userId = Number(session.userId);
    try {
      let systemSync = { insertedKeys: [] };
      if (session.isDev) {
        const paySync = await syncDeveloperAdminNotifications(userId);
        const supportSync = await syncDeveloperSupportNotifications(userId);
        systemSync = {
          insertedKeys: [
            ...(paySync.insertedKeys || []),
            ...(supportSync.insertedKeys || [])
          ]
        };
      } else {
        systemSync = await ensureSystemNotifications(userId);
        await syncSaleNotifications(userId);
        try {
          await ensureDrawDayNotifications(userId);
        } catch (drawErr) {
          console.warn('Falha ao sincronizar avisos de sorteio', drawErr);
        }
      }

      const { data, error } = await db()
        .from('notificacoes')
        .select('id, tipo, titulo, corpo, href, ref_key, lida, created_at')
        .eq('usuario_id', userId)
        .eq('apagada', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        if (isMissingNotifTable(error)) {
          return {
            ok: false,
            needsSchema: true,
            error: 'Execute supabase/notificacoes.sql no Supabase para ativar as notificações na nuvem.',
            notifications: []
          };
        }
        return { ok: false, error: errMsg(error), notifications: [] };
      }

      return {
        ok: true,
        notifications: (data || []).map(mapNotifRow),
        newSystemKeys: systemSync?.insertedKeys || []
      };
    } catch (err) {
      if (isMissingNotifTable(err)) {
        return {
          ok: false,
          needsSchema: true,
          error: 'Execute supabase/notificacoes.sql no Supabase para ativar as notificações na nuvem.',
          notifications: []
        };
      }
      return { ok: false, error: errMsg(err), notifications: [] };
    }
  }

  async function markNotificationRead(id) {
    const session = resolveAuthSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };

    const notifId = Number(id);
    if (!Number.isFinite(notifId) || notifId <= 0) return idorDeny();

    if (!session.isDev) {
      const token = sessionTokenOrNull();
      if (token) {
        const { error: rpcErr } = await db().rpc('pas_marcar_notif_lida', {
          p_session_token: token,
          p_notif_id: notifId
        });
        if (!rpcErr) return { ok: true };
        if (!isMissingRpc(rpcErr)) {
          const msg = errMsg(rpcErr, IDOR_NOT_FOUND);
          if (/não encontrado|Recurso|not found/i.test(msg)) return idorDeny();
          return { ok: false, error: msg };
        }
      }
    }

    const { data, error } = await db()
      .from('notificacoes')
      .update({ lida: true })
      .eq('id', notifId)
      .eq('usuario_id', Number(session.userId))
      .eq('apagada', false)
      .select('id');

    if (error) return { ok: false, error: errMsg(error) };
    if (!data?.length) return idorDeny();
    return { ok: true };
  }

  async function markAllNotificationsRead() {
    const session = resolveAuthSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };

    const { error } = await db()
      .from('notificacoes')
      .update({ lida: true })
      .eq('usuario_id', Number(session.userId))
      .eq('apagada', false)
      .eq('lida', false);

    if (error) return { ok: false, error: errMsg(error) };
    return { ok: true };
  }

  async function clearNotifications() {
    const session = resolveAuthSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };

    const { error } = await db()
      .from('notificacoes')
      .update({ apagada: true, lida: true })
      .eq('usuario_id', Number(session.userId))
      .eq('apagada', false);

    if (error) return { ok: false, error: errMsg(error) };
    return { ok: true };
  }

  function isMissingBannerTable(error) {
    const msg = String(error?.message || error || '');
    return /banner_sistema|schema cache|Could not find|relation/i.test(msg);
  }

  function mapBannerRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      image: resolveMediaSrc(row.imagem || ''),
      title: row.titulo || '',
      link: row.link || '',
      active: !!row.ativo,
      updatedAt: row.updated_at || ''
    };
  }

  async function getSystemBanner() {
    const { data, error } = await db()
      .from('banner_sistema')
      .select('id, imagem, titulo, link, ativo, updated_at')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      if (isMissingBannerTable(error)) {
        return { ok: false, error: 'Execute o SQL banner_sistema.sql no Supabase.', needsSchema: true, banner: null };
      }
      return { ok: false, error: errMsg(error), banner: null };
    }
    return { ok: true, banner: mapBannerRow(data) };
  }

  async function saveSystemBanner({ image = '', title = '', link = '', active = true } = {}) {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };
    if (!isAdminEmail(session.email)) return idorDeny('forbidden');

    const imagem = String(image || '').trim();
    if (!imagem) return { ok: false, error: 'Selecione uma imagem do banner.' };

    const row = {
      id: 1,
      imagem,
      titulo: String(title || '').trim() || null,
      link: String(link || '').trim() || null,
      ativo: !!active,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await db()
      .from('banner_sistema')
      .upsert([row], { onConflict: 'id' })
      .select('id, imagem, titulo, link, ativo, updated_at')
      .single();

    if (error) {
      if (isMissingBannerTable(error)) {
        return { ok: false, error: 'Execute o SQL banner_sistema.sql no Supabase.', needsSchema: true };
      }
      return { ok: false, error: errMsg(error, 'Não foi possível salvar o banner.') };
    }
    return { ok: true, banner: mapBannerRow(data) };
  }

  async function clearSystemBanner() {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };
    if (!isAdminEmail(session.email)) return idorDeny('forbidden');

    const { data, error } = await db()
      .from('banner_sistema')
      .upsert([{
        id: 1,
        imagem: null,
        titulo: null,
        link: null,
        ativo: false,
        updated_at: new Date().toISOString()
      }], { onConflict: 'id' })
      .select('id, imagem, titulo, link, ativo, updated_at')
      .single();

    if (error) {
      if (isMissingBannerTable(error)) {
        return { ok: false, error: 'Execute o SQL banner_sistema.sql no Supabase.', needsSchema: true };
      }
      return { ok: false, error: errMsg(error, 'Não foi possível remover o banner.') };
    }
    return { ok: true, banner: mapBannerRow(data) };
  }

  function isMissingMaintenanceTable(error) {
    const msg = String(error?.message || error || '');
    return /sistema_manutencao|pas_status_manutencao|pas_desativar_sistema|pas_reativar_sistema|mensagem_bloqueio|schema cache|Could not find|relation|does not exist|column .* does not exist/i.test(
      msg
    );
  }

  function mapMaintenanceRow(row) {
    if (!row) {
      return {
        active: false,
        message: '',
        disabledAt: '',
        updatedAt: '',
        affected: 0
      };
    }
    const active =
      row.em_manutencao != null
        ? !!row.em_manutencao
        : row.ativo != null
          ? !!row.ativo
          : false;
    return {
      active,
      message: String(row.mensagem || row.mensagem_bloqueio || row.message || '').trim(),
      disabledAt: row.desativado_em || row.disabledAt || '',
      updatedAt: row.updated_at || row.desativado_em || '',
      affected: Number(row.afetados || row.affected || 0) || 0
    };
  }

  /** Status da manutenção (lê usuarios.ativo / mensagem_bloqueio). */
  async function getSystemMaintenance() {
    const rpc = await db().rpc('pas_status_manutencao');
    if (!rpc.error) {
      const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
      return { ok: true, maintenance: mapMaintenanceRow(row) };
    }

    if (!isMissingMaintenanceTable(rpc.error) && !isMissingRpc(rpc.error)) {
      return { ok: false, error: errMsg(rpc.error), maintenance: mapMaintenanceRow(null) };
    }

    // Fallback: lê usuários desativados diretamente
    const { data, error } = await db()
      .from('usuarios')
      .select('ativo, mensagem_bloqueio, desativado_em')
      .eq('ativo', false)
      .order('desativado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingMaintenanceTable(error)) {
        return {
          ok: false,
          error: 'Execute o SQL sistema_manutencao.sql no Supabase.',
          needsSchema: true,
          maintenance: mapMaintenanceRow(null)
        };
      }
      return { ok: false, error: errMsg(error), maintenance: mapMaintenanceRow(null) };
    }

    if (!data) {
      return { ok: true, maintenance: mapMaintenanceRow(null) };
    }

    return {
      ok: true,
      maintenance: mapMaintenanceRow({
        em_manutencao: true,
        mensagem: data.mensagem_bloqueio,
        desativado_em: data.desativado_em
      })
    };
  }

  /** Desativa usuarios.ativo (exceto o e-mail do desenvolvedor) e grava a mensagem. */
  async function activateSystemMaintenance({ message = '' } = {}) {
    const gate = requireDevOrAdmin();
    if (!gate.ok) return { ok: false, error: gate.error || 'Acesso negado.' };

    const mensagem = String(message || '').trim();
    if (mensagem.length < 5) {
      return { ok: false, error: 'Digite o motivo da manutenção (mínimo 5 caracteres).' };
    }

    const rpc = await db().rpc('pas_desativar_sistema', { p_mensagem: mensagem });
    if (!rpc.error) {
      const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
      return { ok: true, maintenance: mapMaintenanceRow(row) };
    }

    if (!isMissingMaintenanceTable(rpc.error) && !isMissingRpc(rpc.error)) {
      return { ok: false, error: errMsg(rpc.error, 'Não foi possível desativar o sistema.') };
    }

    const now = new Date().toISOString();
    // Não trava super_admin (sem expor e-mail no cliente)
    const { data, error } = await db()
      .from('usuarios')
      .update({
        ativo: false,
        mensagem_bloqueio: mensagem,
        desativado_em: now
      })
      .neq('nivel_acesso', 'super_admin')
      .select('id');

    if (error) {
      if (isMissingMaintenanceTable(error)) {
        return {
          ok: false,
          error: 'Execute o SQL sistema_manutencao.sql no Supabase.',
          needsSchema: true
        };
      }
      return { ok: false, error: errMsg(error, 'Não foi possível desativar o sistema.') };
    }

    await db()
      .from('usuarios')
      .update({
        ativo: true,
        mensagem_bloqueio: null,
        desativado_em: null
      })
      .eq('nivel_acesso', 'super_admin');

    return {
      ok: true,
      maintenance: mapMaintenanceRow({
        em_manutencao: true,
        mensagem,
        desativado_em: now,
        afetados: (data || []).length
      })
    };
  }

  /** Reativa usuarios.ativo e limpa mensagem_bloqueio. */
  async function deactivateSystemMaintenance() {
    const gate = requireDevOrAdmin();
    if (!gate.ok) return { ok: false, error: gate.error || 'Acesso negado.' };

    const rpc = await db().rpc('pas_reativar_sistema');
    if (!rpc.error) {
      const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
      return { ok: true, maintenance: mapMaintenanceRow(row) };
    }

    if (!isMissingMaintenanceTable(rpc.error) && !isMissingRpc(rpc.error)) {
      return { ok: false, error: errMsg(rpc.error, 'Não foi possível reativar o sistema.') };
    }

    const { data, error } = await db()
      .from('usuarios')
      .update({
        ativo: true,
        mensagem_bloqueio: null,
        desativado_em: null
      })
      .eq('ativo', false)
      .select('id');

    if (error) {
      if (isMissingMaintenanceTable(error)) {
        return {
          ok: false,
          error: 'Execute o SQL sistema_manutencao.sql no Supabase.',
          needsSchema: true
        };
      }
      return { ok: false, error: errMsg(error, 'Não foi possível reativar o sistema.') };
    }

    return {
      ok: true,
      maintenance: mapMaintenanceRow({
        em_manutencao: false,
        mensagem: null,
        desativado_em: null,
        afetados: (data || []).length
      })
    };
  }

  /**
   * Aviso modal global (não usa o sino).
   * Preferência: RPC pas_publicar_aviso_sistema; fallback: upsert em aviso_sistema.
   */
  function isMissingAvisoTable(error) {
    return /aviso_sistema|pas_publicar_aviso_sistema|relation|schema cache|Could not find|does not exist/i.test(
      error?.message || ''
    );
  }

  function mapAvisoRow(row) {
    if (!row) return null;
    return {
      title: String(row.titulo || row.title || '').trim(),
      message: String(row.mensagem || row.message || '').trim(),
      active: !!(row.ativo ?? row.active),
      token: String(row.token || '').trim(),
      updatedAt: row.updated_at || row.updatedAt || ''
    };
  }

  async function getSystemAviso() {
    const { data, error } = await db()
      .from('aviso_sistema')
      .select('id, titulo, mensagem, ativo, token, updated_at')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      if (isMissingAvisoTable(error)) {
        return {
          ok: false,
          error: 'Execute supabase/aviso_geral.sql no Supabase.',
          needsSchema: true,
          aviso: null
        };
      }
      return { ok: false, error: errMsg(error), aviso: null };
    }

    const aviso = mapAvisoRow(data);
    if (aviso) {
      aviso.seen = false;
      const session = typeof Store !== 'undefined' ? Store.getSession() : null;
      const userId = Number(session?.userId || 0);
      const token = String(aviso.token || '').trim();
      if (userId && token) {
        const lido = await db()
          .from('aviso_sistema_lido')
          .select('token')
          .eq('usuario_id', userId)
          .eq('token', token)
          .maybeSingle();
        if (!lido.error) aviso.seen = !!lido.data;
      }
    }

    return { ok: true, aviso };
  }

  async function markSystemAvisoRead(token = '') {
    const session = typeof Store !== 'undefined' ? Store.getSession() : null;
    const userId = Number(session?.userId || 0);
    if (!userId) return { ok: false, error: 'Não autenticado.' };

    let avisoToken = String(token || '').trim();
    if (!avisoToken) {
      const current = await getSystemAviso();
      avisoToken = String(current?.aviso?.token || '').trim();
    }
    if (!avisoToken) return { ok: false, error: 'Não há aviso para marcar como lido.' };

    const { error } = await db()
      .from('aviso_sistema_lido')
      .upsert(
        [{ usuario_id: userId, token: avisoToken, lido_em: new Date().toISOString() }],
        { onConflict: 'usuario_id,token' }
      );

    if (error) {
      if (isMissingAvisoTable(error) || /aviso_sistema_lido/i.test(error?.message || '')) {
        return {
          ok: false,
          error: 'Execute supabase/aviso_geral.sql no Supabase.',
          needsSchema: true
        };
      }
      return { ok: false, error: errMsg(error, 'Erro ao marcar aviso como lido.') };
    }

    return { ok: true, token: avisoToken };
  }

  async function publishSystemAviso({ title = '', message = '' } = {}) {
    const gate = requireDevOrAdmin();
    if (!gate.ok) return { ok: false, error: gate.error || 'Acesso negado.' };

    const titulo = String(title || '').trim();
    const mensagem = String(message || '').trim();

    if (titulo.length < 3) {
      return { ok: false, error: 'Informe um título (mínimo 3 caracteres).' };
    }
    if (mensagem.length < 5) {
      return { ok: false, error: 'Informe a mensagem (mínimo 5 caracteres).' };
    }

    const rpc = await db().rpc('pas_publicar_aviso_sistema', {
      p_admin_email: String(gate.email),
      p_titulo: titulo,
      p_mensagem: mensagem
    });

    if (!rpc.error) {
      const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
      return { ok: true, aviso: mapAvisoRow(row) };
    }

    if (!isMissingRpc(rpc.error) && !isMissingAvisoTable(rpc.error)) {
      return { ok: false, error: errMsg(rpc.error, 'Não foi possível publicar o aviso.') };
    }

    const token = `aviso-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const row = {
      id: 1,
      titulo,
      mensagem,
      ativo: true,
      token,
      updated_at: nowIso
    };

    const { data, error } = await db()
      .from('aviso_sistema')
      .upsert([row], { onConflict: 'id' })
      .select('id, titulo, mensagem, ativo, token, updated_at')
      .single();

    if (error) {
      if (isMissingAvisoTable(error)) {
        return {
          ok: false,
          error: 'Execute supabase/aviso_geral.sql no Supabase.',
          needsSchema: true
        };
      }
      return { ok: false, error: errMsg(error, 'Não foi possível publicar o aviso.') };
    }

    return { ok: true, aviso: mapAvisoRow(data) };
  }

  /** Compat: antigo broadcast por notificação — agora publica aviso modal */
  async function broadcastSystemNotification(payload = {}) {
    return publishSystemAviso(payload);
  }

  function isMissingRatingTable(error) {
    return /avaliacoes_sistema|relation|schema cache|Could not find|does not exist/i.test(error?.message || '');
  }

  function isMissingRatingStatusCols(error) {
    return /status|resposta_dev|respondido_em|notas_internas|column|schema cache|Could not find/i.test(
      error?.message || ''
    );
  }

  const RATING_STATUS_VALUES = ['em_aberto', 'em_andamento', 'resolvido', 'positiva'];
  const RATING_SELECT_FULL =
    'id, usuario_id, gostou, estrelas, motivo, usuario_nome, usuario_email, status, resposta_dev, respondido_em, notas_internas, created_at, updated_at';
  const RATING_SELECT_BASIC =
    'id, usuario_id, gostou, estrelas, motivo, usuario_nome, usuario_email, created_at, updated_at';

  function normalizeRatingStatus(value, stars) {
    const raw = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    if (RATING_STATUS_VALUES.includes(raw)) return raw;
    const n = Number(stars);
    return Number.isFinite(n) && n > 0 && n <= 3 ? 'em_aberto' : 'positiva';
  }

  function defaultRatingStatusForStars(stars) {
    const n = Number(stars);
    return Number.isFinite(n) && n > 0 && n <= 3 ? 'em_aberto' : 'positiva';
  }

  function mapRatingRow(row) {
    if (!row) return null;
    const stars = Number(row.estrelas);
    const resolvedStars =
      Number.isFinite(stars) && stars >= 1 && stars <= 5 ? stars : row.gostou ? 5 : 1;
    return {
      id: String(row.id),
      userId: row.usuario_id != null ? Number(row.usuario_id) : null,
      stars: resolvedStars,
      liked: !!row.gostou,
      reason: row.motivo || '',
      userName: row.nome || row.usuario_nome || '',
      userEmail: row.email || row.usuario_email || '',
      photo: row.foto_perfil || row.photo || '',
      status: normalizeRatingStatus(row.status, resolvedStars),
      reply: row.resposta_dev || '',
      repliedAt: row.respondido_em || null,
      internalNotes: row.notas_internas || '',
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null
    };
  }

  async function fetchRatingRows(selectCols, { userId = null } = {}) {
    let q = db().from('avaliacoes_sistema').select(selectCols);
    if (userId != null) {
      q = q.eq('usuario_id', Number(userId)).maybeSingle();
    } else {
      q = q.order('created_at', { ascending: false });
    }
    return q;
  }

  async function getMySystemRating() {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.', rating: null };

    let { data, error } = await fetchRatingRows(RATING_SELECT_FULL, {
      userId: session.userId
    });

    if (error && isMissingRatingStatusCols(error) && !isMissingRatingTable(error)) {
      ({ data, error } = await fetchRatingRows(RATING_SELECT_BASIC, {
        userId: session.userId
      }));
    }

    if (error) {
      if (isMissingRatingTable(error)) {
        return {
          ok: false,
          needsSchema: true,
          error: 'Execute supabase/avaliacoes_sistema.sql no Supabase para ativar as avaliações.',
          rating: null
        };
      }
      return { ok: false, error: errMsg(error), rating: null };
    }
    return { ok: true, rating: mapRatingRow(data) };
  }

  /** Lista todas as avaliações do sistema (portal do desenvolvedor). */
  async function listSystemRatings() {
    const gate = requireDevOrAdmin();
    if (!gate.ok) return { ok: false, error: gate.error || 'Acesso negado.', ratings: [] };

    let { data, error } = await fetchRatingRows(RATING_SELECT_FULL);

    if (error && isMissingRatingStatusCols(error) && !isMissingRatingTable(error)) {
      ({ data, error } = await fetchRatingRows(RATING_SELECT_BASIC));
    }

    if (error) {
      if (isMissingRatingTable(error)) {
        return {
          ok: false,
          needsSchema: true,
          error: 'Execute supabase/avaliacoes_sistema.sql no Supabase.',
          ratings: []
        };
      }
      return { ok: false, error: errMsg(error), ratings: [] };
    }

    const ratings = (data || []).map(mapRatingRow).filter(Boolean);
    const ids = [
      ...new Set(
        ratings
          .map((r) => Number(r.userId))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    ];

    if (ids.length) {
      const usersRes = await db().from('usuarios').select('id, nome, email').in('id', ids);

      if (!usersRes.error && Array.isArray(usersRes.data)) {
        const byId = new Map(usersRes.data.map((u) => [Number(u.id), u]));
        ratings.forEach((r) => {
          const u = byId.get(Number(r.userId));
          if (!u) return;
          r.photo = '';
          // Sempre preferir nome/email atuais de `usuarios` (fonte correta no Aiven).
          if (u.nome) r.userName = u.nome;
          else if (!r.userName) r.userName = '';
          if (u.email) r.userEmail = u.email;
          else if (!r.userEmail) r.userEmail = '';
        });
      }
    }

    return { ok: true, ratings };
  }

  async function notifyRatingReply(userId, replyText) {
    const uid = Number(userId);
    const corpo = String(replyText || '').trim();
    if (!uid || !corpo) return { ok: false, skipped: true };

    const nowIso = new Date().toISOString();
    const refKey = `avaliacao-resposta-${uid}`;
    const titulo = 'Resposta à sua avaliação';
    const href = 'dashboard.html';

    try {
      const { data: existing } = await db()
        .from('notificacoes')
        .select('id')
        .eq('usuario_id', uid)
        .eq('ref_key', refKey)
        .maybeSingle();

      if (existing?.id) {
        const { error: updErr } = await db()
          .from('notificacoes')
          .update({
            tipo: 'sistema',
            titulo,
            corpo,
            href,
            lida: false,
            apagada: false,
            created_at: nowIso
          })
          .eq('id', existing.id);
        if (updErr) return { ok: false, error: errMsg(updErr) };
        return { ok: true, updated: true };
      }

      const { error } = await db().from('notificacoes').insert([
        {
          usuario_id: uid,
          tipo: 'sistema',
          titulo,
          corpo,
          href,
          ref_key: refKey,
          lida: false,
          apagada: false,
          created_at: nowIso
        }
      ]);
      if (error) return { ok: false, error: errMsg(error) };
      return { ok: true, created: true };
    } catch (err) {
      return { ok: false, error: err.message || 'Falha ao notificar.' };
    }
  }

  /** Atualiza status/resposta de uma avaliação (portal do desenvolvedor). */
  async function updateSystemRatingAdmin({
    id,
    status,
    reply,
    internalNotes,
    notifyUser = true
  } = {}) {
    const gate = requireDevOrAdmin();
    if (!gate.ok) return { ok: false, error: gate.error || 'Acesso negado.' };

    const ratingId = Number(id);
    if (!Number.isFinite(ratingId) || ratingId <= 0) {
      return { ok: false, error: 'Avaliação inválida.' };
    }

    const rawStatus = String(status || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    if (!RATING_STATUS_VALUES.includes(rawStatus)) {
      return { ok: false, error: 'Status inválido.' };
    }
    const nextStatus = rawStatus;

    const resposta = String(reply ?? '').trim();
    const notas = String(internalNotes ?? '').trim();
    const nowIso = new Date().toISOString();
    const patch = {
      status: nextStatus,
      resposta_dev: resposta || null,
      notas_internas: notas || null,
      updated_at: nowIso
    };
    if (resposta) patch.respondido_em = nowIso;

    const { data, error } = await db()
      .from('avaliacoes_sistema')
      .update(patch)
      .eq('id', ratingId)
      .select(RATING_SELECT_FULL)
      .maybeSingle();

    if (error) {
      if (isMissingRatingTable(error) || isMissingRatingStatusCols(error)) {
        return {
          ok: false,
          needsSchema: true,
          error: 'Execute supabase/avaliacoes_sistema.sql no Supabase para ativar status e respostas.'
        };
      }
      return { ok: false, error: errMsg(error, 'Não foi possível atualizar a avaliação.') };
    }
    if (!data) return { ok: false, error: 'Avaliação não encontrada.' };

    const rating = mapRatingRow(data);
    if (notifyUser && resposta && rating.userId) {
      await notifyRatingReply(rating.userId, resposta);
    }
    return { ok: true, rating };
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
    const needsReason = estrelas <= 3;
    if (needsReason && motivo.length < 5) {
      return { ok: false, error: 'Descreva o motivo (mínimo 5 caracteres).' };
    }

    const status = defaultRatingStatusForStars(estrelas);
    const row = {
      usuario_id: Number(session.userId),
      gostou: estrelas >= 4,
      estrelas,
      motivo: needsReason ? motivo : null,
      usuario_nome: String(session.name || '').trim() || null,
      usuario_email: String(session.email || '').trim() || null,
      status,
      updated_at: new Date().toISOString()
    };
    if (needsReason) {
      row.resposta_dev = null;
      row.respondido_em = null;
    }

    let { data, error } = await db()
      .from('avaliacoes_sistema')
      .upsert([row], { onConflict: 'usuario_id' })
      .select(RATING_SELECT_FULL)
      .single();

    if (error && isMissingRatingStatusCols(error) && !isMissingRatingTable(error)) {
      const basicRow = {
        usuario_id: row.usuario_id,
        gostou: row.gostou,
        estrelas: row.estrelas,
        motivo: row.motivo,
        usuario_nome: row.usuario_nome,
        usuario_email: row.usuario_email,
        updated_at: row.updated_at
      };
      ({ data, error } = await db()
        .from('avaliacoes_sistema')
        .upsert([basicRow], { onConflict: 'usuario_id' })
        .select(RATING_SELECT_BASIC)
        .single());
    }

    if (error) {
      if (isMissingRatingTable(error) || /estrelas|column/i.test(error.message || '')) {
        return {
          ok: false,
          needsSchema: true,
          error: 'Execute supabase/avaliacoes_sistema.sql no Supabase para ativar as avaliações com estrelas.'
        };
      }
      return { ok: false, error: errMsg(error, 'Não foi possível salvar a avaliação.') };
    }
    return { ok: true, rating: mapRatingRow(data) };
  }

  /**
   * Escuta mudanças em vendas_rifa, notificacoes e status do usuário.
   * Requer: supabase/realtime_vendas_notificacoes.sql
   */
  function subscribeLiveUpdates(userId, onChange) {
    const uid = Number(userId);
    const client = typeof window !== 'undefined' ? window.supabaseClient : null;
    if (!uid || !client || typeof onChange !== 'function') {
      return { unsubscribe() {}, ok: false };
    }

    let timer = null;
    const emit = (source) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try { onChange(source); } catch (err) { console.warn('Live update handler', err); }
      }, 250);
    };

    const channel = client
      .channel(`pas-live-${uid}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendas_rifa', filter: `usuario_id=eq.${uid}` },
        () => emit('vendas_rifa')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notificacoes', filter: `usuario_id=eq.${uid}` },
        () => emit('notificacoes')
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'usuarios', filter: `id=eq.${uid}` },
        () => emit('usuarios')
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Realtime indisponível. Use o SQL realtime_vendas_notificacoes.sql e o polling de backup.');
        }
      });

    return {
      ok: true,
      unsubscribe() {
        if (timer) clearTimeout(timer);
        try { client.removeChannel(channel); } catch { /* ignore */ }
      }
    };
  }

  /**
   * Portal do desenvolvedor: escuta INSERT/UPDATE/DELETE em usuarios
   * (ex.: foto_perfil) para atualizar avatares sem F5.
   * Requer: supabase/realtime_vendas_notificacoes.sql (tabela usuarios na publication).
   */
  function subscribeDevUsersLive(onChange) {
    const gate = requireDevOrAdmin();
    const client = typeof window !== 'undefined' ? window.supabaseClient : null;
    if (!gate.ok || !client || typeof onChange !== 'function') {
      return { unsubscribe() {}, ok: false };
    }

    let timer = null;
    const emit = (payload) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          onChange(payload);
        } catch (err) {
          console.warn('Dev users live update', err);
        }
      }, 120);
    };

    const channel = client
      .channel(`pas-dev-users-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'usuarios' },
        (payload) =>
          emit({
            type: payload.eventType || payload.event || 'UPDATE',
            new: payload.new || null,
            old: payload.old || null,
            source: 'realtime',
            presenceTouch: Boolean(
              payload?.new &&
                (Object.prototype.hasOwnProperty.call(payload.new, 'ultimo_acesso') ||
                  Object.prototype.hasOwnProperty.call(payload.new, 'sessao_token') ||
                  Object.prototype.hasOwnProperty.call(payload.new, 'sessao_em'))
            )
          })
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(
            'Realtime de usuarios indisponível. Confirme supabase/realtime_vendas_notificacoes.sql; polling de backup ativo.'
          );
        }
      });

    return {
      ok: true,
      unsubscribe() {
        if (timer) clearTimeout(timer);
        try {
          client.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }

  // ─── Tipo de conta + pagamento (RPCs do Supabase) ────────
  // SQL: supabase/cadastro_tipo_conta_pagamento.sql

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

  /** NULL/vazio = ativo (contas anteriores à cobrança não são bloqueadas) */
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
    const tipoConta = normalizeTipoConta(row.tipo_conta ?? row.tipoConta);
    const rawProof =
      row.comprovante_pagamento || row.comprovantePagamento || '';
    const hasFlag =
      row.has_comprovante === true ||
      row.hasComprovante === true ||
      Boolean(String(rawProof || '').trim()) ||
      Boolean(row.comprovante_em || row.comprovanteEm);
    const proofRef = String(rawProof || '').trim();
    // Nunca devolve base64 legado nas listas — só refs curtas / URLs
    const safeProof =
      !proofRef ||
      proofRef === '[legado-base64]' ||
      /^data:image\//i.test(proofRef)
        ? ''
        : resolveMediaSrc(proofRef);
    return {
      id: row.id ?? row.userId,
      name: row.nome || row.name || '',
      email: row.email || '',
      photo: resolveMediaSrc(row.foto_perfil || row.photo || ''),
      tipoConta,
      razaoSocial: row.razao_social || row.razaoSocial || '',
      cnpj: row.cnpj || '',
      statusPagamento: normalizeStatusPagamento(row.status_pagamento ?? row.statusPagamento),
      plano:
        row.plano ||
        (tipoConta === 'empresa' ? 'empresarial_mensal' : 'pessoal_unico'),
      pagoEm: row.pago_em || row.pagoEm || null,
      proximoVencimento: row.proximo_vencimento || row.proximoVencimento || null,
      comprovantePagamento: safeProof,
      hasComprovante: hasFlag,
      comprovanteEm: row.comprovante_em || row.comprovanteEm || null,
      sessionActive: Boolean(row.sessao_token || row.sessionActive),
      sessionAt: row.sessao_em || row.sessionAt || null,
      lastSeen: row.ultimo_acesso || row.lastSeen || row.sessao_em || row.sessionAt || null
    };
  }

  /** Usuário online enquanto houver sessão ativa (token); offline só no logout. */
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

    const token = String(session.sessionToken);

    const rpc = await db().rpc('pas_atualizar_presenca', {
      p_session_token: token
    });

    if (!rpc.error) {
      const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
      if (row && row.ok === false) return { ok: false, reason: 'invalid' };
      return { ok: true, lastSeen: row?.ultimo_acesso || new Date().toISOString() };
    }

    if (!isMissingRpc(rpc.error)) {
      return { ok: false, error: errMsg(rpc.error) };
    }

    const nowIso = new Date().toISOString();
    const { error } = await db()
      .from('usuarios')
      .update({ ultimo_acesso: nowIso })
      .eq('id', Number(session.userId))
      .eq('sessao_token', token);

    if (error) {
      if (/ultimo_acesso|column|schema cache|Could not find/i.test(error.message || '')) {
        return {
          ok: false,
          needsSchema: true,
          error: 'Execute supabase/presenca_online.sql no Supabase.'
        };
      }
      return { ok: false, error: errMsg(error) };
    }
    return { ok: true, lastSeen: nowIso };
  }

  function applyPaymentToSession(profileOrRow) {
    const session = Store.getSession();
    if (!session || !profileOrRow) return session;
    const profile = mapPaymentProfile(profileOrRow);
    Store.setSession({
      ...session,
      tipoConta: profile.tipoConta,
      razaoSocial: profile.razaoSocial,
      cnpj: profile.cnpj,
      statusPagamento: profile.statusPagamento,
      plano: profile.plano,
      pagoEm: profile.pagoEm,
      proximoVencimento: profile.proximoVencimento
    });
    return Store.getSession();
  }

  async function getPaymentProfile(userId) {
    const session = Store.getSession();
    const uid = Number(userId || session?.userId);
    if (!uid) return { ok: false, error: 'Não autenticado.', profile: null };

    const rpc = await db().rpc('pas_obter_status_conta', { p_usuario_id: uid });
    if (!rpc.error) {
      const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
      if (row) return { ok: true, profile: mapPaymentProfile(row) };
      return { ok: false, error: 'Usuário não encontrado.', profile: null };
    }
    if (!isMissingRpc(rpc.error)) {
      return { ok: false, error: errMsg(rpc.error), profile: null };
    }

    // Fallback: banco ainda sem as RPCs de pagamento
    const { data, error } = await db()
      .from('usuarios')
      .select('id, nome, email, tipo_conta, razao_social, cnpj, status_pagamento, plano, pago_em, proximo_vencimento')
      .eq('id', uid)
      .maybeSingle();

    if (error) {
      return { ok: false, needsSchema: true, error: errMsg(error), profile: null };
    }
    return { ok: true, profile: mapPaymentProfile(data) };
  }

  async function refreshPaymentProfile() {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };
    const result = await getPaymentProfile(session.userId);
    if (!result.ok) return result;
    applyPaymentToSession(result.profile);
    return { ok: true, profile: result.profile, session: Store.getSession() };
  }

  /**
   * Usuário enviou comprovante + "Já paguei".
   * NUNCA libera o recurso — só marca pendente_revisao para o admin confirmar.
   * @param {{ comprovanteDataUrl?: string }} [opts]
   */
  async function markPaymentForReview(opts = {}) {
    const session = Store.getSession();
    if (!session?.userId) return { ok: false, error: 'Não autenticado.' };

    let comprovante = String(opts.comprovanteDataUrl || opts.comprovante || opts.path || '').trim();
    if (!comprovante || comprovante.length < 8) {
      return { ok: false, error: 'Envie a foto ou print do comprovante de pagamento.' };
    }
    const isDataUrl = /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(comprovante);
    const isRef =
      /^https?:\/\//i.test(comprovante) ||
      /^comprovantes\//i.test(comprovante) ||
      isStoragePath(comprovante);
    if (!isDataUrl && !isRef) {
      return { ok: false, error: 'Comprovante inválido. Use JPG, PNG ou WEBP.' };
    }
    if (isDataUrl && comprovante.length > 120000) {
      return {
        ok: false,
        needsDeploy: true,
        error:
          'Comprovante grande demais para o banco. Faça deploy da função media e envie via Storage.'
      };
    }

    const uid = Number(session.userId);
    const rpc = await db().rpc('pas_marcar_pagamento_revisao', {
      p_usuario_id: uid,
      p_comprovante: comprovante
    });

    if (!rpc.error) {
      const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
      const status =
        normalizeStatusPagamento(row?.status_pagamento) || 'pendente_revisao';
      const safeStatus = status === 'ativo' ? 'pendente_revisao' : status;
      applyPaymentToSession({
        ...(row || {}),
        status_pagamento: safeStatus,
        comprovante_pagamento: isDataUrl ? '' : comprovante,
        has_comprovante: true,
        email: session.email,
        nome: session.name
      });
      notifyDeveloperPaymentReview({
        id: uid,
        name: session.name,
        email: session.email
      }).catch((err) => console.warn('notifyDeveloperPaymentReview', err));
      return {
        ok: true,
        statusPagamento: safeStatus,
        session: Store.getSession()
      };
    }

    if (!isMissingRpc(rpc.error)) {
      return { ok: false, error: errMsg(rpc.error, 'Não foi possível registrar.') };
    }

    // Fallback sem RPC: grava comprovante + pendente_revisao (não libera)
    const tipo = normalizeTipoConta(session.tipoConta);
    const plano =
      session.plano || (tipo === 'empresa' ? 'empresarial_mensal' : 'pessoal_unico');
    const payload = {
      status_pagamento: 'pendente_revisao',
      plano,
      tipo_conta: tipo,
      comprovante_pagamento: comprovante,
      comprovante_em: new Date().toISOString()
    };

    let { data, error } = await db()
      .from('usuarios')
      .update(payload)
      .eq('id', uid)
      .select('id, status_pagamento, plano, tipo_conta, comprovante_em')
      .maybeSingle();

    if (error && /comprovante_pagamento|comprovante_em|column|schema cache|Could not find/i.test(error.message || '')) {
      return {
        ok: false,
        error:
          'Execute supabase/fix_comprovante_pagamento.sql e supabase/storage_media_egress.sql no Supabase.'
      };
    }

    if (error) {
      return {
        ok: false,
        error:
          errMsg(error) ||
          'Não foi possível registrar. Execute supabase/storage_media_egress.sql no Supabase.'
      };
    }

    applyPaymentToSession({
      ...(data || {}),
      status_pagamento: 'pendente_revisao',
      comprovante_pagamento: isDataUrl ? '' : comprovante,
      has_comprovante: true,
      email: session.email,
      nome: session.name
    });
    notifyDeveloperPaymentReview({
      id: uid,
      name: session.name,
      email: session.email
    }).catch((err) => console.warn('notifyDeveloperPaymentReview', err));
    return {
      ok: true,
      statusPagamento: 'pendente_revisao',
      session: Store.getSession()
    };
  }

  function isAdminEmail(_email) {
    return false;
  }

  /** Conta do desenvolvedor: privilégio só via nivelAcesso / flags da sessão */
  function isDeveloperAccount(emailOrUser) {
    if (!emailOrUser || typeof emailOrUser !== 'object') return false;
    if (emailOrUser.isDev === true || emailOrUser.portal === 'dev') return true;
    const nivel = String(emailOrUser.nivelAcesso || emailOrUser.nivel_acesso || '')
      .trim()
      .toLowerCase();
    return nivel === 'super_admin' || nivel === 'superadmin';
  }

  function excludeDeveloperAccounts(list) {
    return (list || []).filter((u) => !isDeveloperAccount(u));
  }

  /** Sessão de usuário admin OU portal do desenvolvedor */
  function getAdminActorEmail() {
    if (typeof DevAuth !== 'undefined' && DevAuth.isLoggedIn()) {
      return DevAuth.adminEmail() || '';
    }
    const session = Store.getSession();
    if (session?.email && isAdminEmail(session.email)) return String(session.email);
    return '';
  }

  function requireDevOrAdmin() {
    const email = getAdminActorEmail();
    if (!email) return { ok: false, error: 'Acesso negado.' };
    const session =
      typeof DevAuth !== 'undefined' && DevAuth.isLoggedIn()
        ? DevAuth.getSession()
        : null;
    return {
      ok: true,
      email,
      userId: session?.userId ? Number(session.userId) : null
    };
  }

  /**
   * Legacy Supabase: criação automática do desenvolvedor no cliente foi removida
   * (não expor e-mail no front). Use a API Neon / seed no servidor.
   */
  async function ensureDeveloperUser() {
    return { ok: true, skipped: true };
  }

  /** Login do portal validando na tabela usuarios */
  async function loginDeveloperPortal({ email, password } = {}) {
    const mail = String(email || '').trim().toLowerCase();
    const pass = String(password || '');
    if (!mail || !pass) return { ok: false, error: 'Preencha e-mail e senha.' };

    const ensured = await ensureDeveloperUser({ bootstrapPassword: pass });
    if (!ensured.ok) return ensured;

    let { data, error } = await db()
      .from('usuarios')
      .select('id, nome, email, senha')
      .eq('email', mail)
      .eq('senha', pass)
      .maybeSingle();

    if (error) return { ok: false, error: errMsg(error) };

    if (!data) {
      return { ok: false, error: 'E-mail ou senha inválidos.' };
    }

    const sessionToken = generateSessionToken();
    try {
      await db()
        .from('usuarios')
        .update({
          sessao_token: sessionToken,
          sessao_em: new Date().toISOString(),
          ultimo_acesso: new Date().toISOString()
        })
        .eq('id', data.id);
    } catch { /* ignore */ }

    return {
      ok: true,
      session: {
        userId: data.id,
        email: data.email,
        name: data.nome || 'Desenvolvedor',
        photo: '',
        role: 'developer',
        sessionToken,
        loggedAt: new Date().toISOString()
      }
    };
  }

  async function getDeveloperProfile() {
    const gate = requireDevOrAdmin();
    if (!gate.ok) return { ok: false, error: gate.error || 'Acesso negado.' };

    let uid = gate.userId ? Number(gate.userId) : null;
    if (!uid && gate.email) {
      const { data: byEmail } = await db()
        .from('usuarios')
        .select('id')
        .eq('email', String(gate.email).toLowerCase())
        .maybeSingle();
      uid = byEmail?.id ? Number(byEmail.id) : null;
    }
    if (!uid) {
      const ensured = await ensureDeveloperUser();
      if (!ensured.ok || !ensured.user?.id) {
        return { ok: false, error: ensured.error || 'Conta do desenvolvedor não encontrada.' };
      }
      uid = Number(ensured.user.id);
    }

    let { data, error } = await db()
      .from('usuarios')
      .select('id, nome, email, foto_perfil')
      .eq('id', uid)
      .maybeSingle();

    if (error && /foto_perfil|column|schema cache|Could not find/i.test(error.message || '')) {
      ({ data, error } = await db()
        .from('usuarios')
        .select('id, nome, email')
        .eq('id', uid)
        .maybeSingle());
      if (!error && data) {
        return {
          ok: true,
          profile: {
            id: data.id,
            name: data.nome || '',
            email: data.email || '',
            photo: ''
          },
          needsSchema: true
        };
      }
    }

    if (error) return { ok: false, error: errMsg(error) };
    if (!data) return { ok: false, error: 'Usuário não encontrado.' };

    return {
      ok: true,
      profile: {
        id: data.id,
        name: data.nome || '',
        email: data.email || '',
        photo: data.foto_perfil || ''
      }
    };
  }

  async function updateDeveloperProfile({
    name,
    currentPassword,
    newPassword,
    photo
  } = {}) {
    const gate = requireDevOrAdmin();
    if (!gate.ok) return { ok: false, error: gate.error || 'Acesso negado.' };

    let uid = gate.userId ? Number(gate.userId) : null;
    if (!uid && gate.email) {
      const { data: byEmail } = await db()
        .from('usuarios')
        .select('id')
        .eq('email', String(gate.email).toLowerCase())
        .maybeSingle();
      uid = byEmail?.id ? Number(byEmail.id) : null;
    }
    if (!uid) return { ok: false, error: 'Sessão do desenvolvedor inválida. Faça login novamente.' };

    const nomeCheck = validateFullName(name);
    if (!nomeCheck.ok) return { ok: false, error: nomeCheck.error };
    const nome = nomeCheck.value;

    let { data: current, error: curErr } = await db()
      .from('usuarios')
      .select('id, email, senha, foto_perfil')
      .eq('id', uid)
      .maybeSingle();

    if (curErr && /foto_perfil|column|schema cache|Could not find/i.test(curErr.message || '')) {
      ({ data: current, error: curErr } = await db()
        .from('usuarios')
        .select('id, email, senha')
        .eq('id', uid)
        .maybeSingle());
    }
    if (curErr) return { ok: false, error: errMsg(curErr) };
    if (!current) return { ok: false, error: 'Usuário não encontrado.' };

    // E-mail não pode ser alterado pelo modal de perfil
    const mail = String(current.email || gate.email || '').trim().toLowerCase();

    const wantsPassword = Boolean(String(newPassword || '').trim());
    if (wantsPassword) {
      if (!currentPassword) {
        return { ok: false, error: 'Informe a senha atual para redefinir.' };
      }
      if (String(newPassword).length < 6) {
        return { ok: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' };
      }
      if (String(current.senha) !== String(currentPassword)) {
        return { ok: false, error: 'Senha atual incorreta.' };
      }
    }

    const payload = { nome };
    if (wantsPassword) payload.senha = String(newPassword);
    if (photo !== undefined) {
      payload.foto_perfil = photo ? String(photo) : null;
    }

    let { data, error } = await db()
      .from('usuarios')
      .update(payload)
      .eq('id', uid)
      .select('id, nome, email, foto_perfil')
      .maybeSingle();

    if (error && /foto_perfil|column|schema cache|Could not find/i.test(error.message || '')) {
      delete payload.foto_perfil;
      ({ data, error } = await db()
        .from('usuarios')
        .update(payload)
        .eq('id', uid)
        .select('id, nome, email')
        .maybeSingle());
      if (!error && data) {
        const session = {
          userId: data.id,
          email: data.email || mail,
          name: data.nome,
          photo: String(photo || '').trim(),
          role: 'developer',
          loggedAt: new Date().toISOString()
        };
        if (typeof DevAuth !== 'undefined') DevAuth.setSession?.(session);
        return {
          ok: true,
          session,
          passwordChanged: wantsPassword,
          needsSchema: true
        };
      }
    }

    if (error) return { ok: false, error: errMsg(error, 'Não foi possível atualizar o perfil.') };
    if (!data) return { ok: false, error: 'Não foi possível atualizar o perfil.' };

    const session = {
      userId: data.id,
      email: data.email || mail,
      name: data.nome,
      photo: data.foto_perfil || '',
      role: 'developer',
      loggedAt: new Date().toISOString()
    };
    if (typeof DevAuth !== 'undefined') DevAuth.setSession?.(session);

    return { ok: true, session, passwordChanged: wantsPassword };
  }

  async function listPendingPaymentReviews() {
    const gate = requireDevOrAdmin();
    if (!gate.ok) return { ok: false, error: gate.error || 'Acesso negado.', users: [] };

    // Sem blobs: comprovante_em indica existência; imagem sob demanda
    const colsLean =
      'id, nome, email, tipo_conta, razao_social, cnpj, status_pagamento, plano, pago_em, proximo_vencimento, comprovante_em';
    let { data, error } = await db()
      .from('usuarios')
      .select(colsLean)
      .eq('status_pagamento', 'pendente_revisao')
      .order('id', { ascending: false });

    if (!error) {
      return {
        ok: true,
        users: excludeDeveloperAccounts(
          (data || []).map((row) =>
            mapPaymentProfile({
              ...row,
              has_comprovante: Boolean(row.comprovante_em),
              comprovante_pagamento: ''
            })
          )
        )
      };
    }

    if (/comprovante_em|column|schema cache|Could not find/i.test(error.message || '')) {
      let fallback = await db()
        .from('usuarios')
        .select(
          'id, nome, email, tipo_conta, razao_social, cnpj, status_pagamento, plano, pago_em, proximo_vencimento'
        )
        .eq('status_pagamento', 'pendente_revisao')
        .order('id', { ascending: false });
      if (fallback.error) {
        return { ok: false, error: errMsg(fallback.error, 'Erro ao listar.'), users: [] };
      }
      return {
        ok: true,
        users: excludeDeveloperAccounts((fallback.data || []).map(mapPaymentProfile)),
        needsSchema: true
      };
    }

    const rpc = await db().rpc('pas_admin_listar_pagamentos_pendentes', {
      p_admin_email: String(gate.email)
    });
    if (!rpc.error) {
      return {
        ok: true,
        users: excludeDeveloperAccounts((rpc.data || []).map(mapPaymentProfile))
      };
    }

    return { ok: false, error: errMsg(error, 'Erro ao listar.'), users: [] };
  }

  /** Carrega comprovante de 1 usuário (admin) — sob demanda */
  async function getPaymentProof(userId) {
    const gate = requireDevOrAdmin();
    if (!gate.ok) return { ok: false, error: gate.error || 'Acesso negado.', url: '' };
    const uid = Number(userId);
    if (!uid) return { ok: false, error: 'Usuário inválido.', url: '' };

    const rpc = await db().rpc('pas_admin_obter_comprovante', {
      p_admin_email: String(gate.email),
      p_usuario_id: uid
    });
    let raw = '';
    let comprovanteEm = null;
    if (!rpc.error) {
      const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
      raw = String(row?.comprovante_pagamento || '').trim();
      comprovanteEm = row?.comprovante_em || null;
    } else if (!isMissingRpc(rpc.error)) {
      return { ok: false, error: errMsg(rpc.error), url: '' };
    } else {
      const { data, error } = await db()
        .from('usuarios')
        .select('comprovante_pagamento, comprovante_em')
        .eq('id', uid)
        .maybeSingle();
      if (error) return { ok: false, error: errMsg(error), url: '' };
      raw = String(data?.comprovante_pagamento || '').trim();
      comprovanteEm = data?.comprovante_em || null;
    }

    if (!raw) return { ok: false, error: 'Sem comprovante.', url: '', comprovanteEm };

    if (/^data:image\//i.test(raw) || /^https?:\/\//i.test(raw)) {
      return { ok: true, url: raw, path: '', comprovanteEm, legacy: /^data:image\//i.test(raw) };
    }

    if (/^comprovantes\//i.test(raw) || isStoragePath(raw)) {
      const signed = await resolveSignedMediaUrl(raw);
      if (!signed.ok) return { ok: false, error: signed.error, url: '', comprovanteEm };
      return { ok: true, url: signed.url, path: raw, comprovanteEm };
    }

    return { ok: true, url: resolveMediaSrc(raw), path: raw, comprovanteEm };
  }

  async function notifyPaymentApproved(userId, profileOrRow = {}) {
    const uid = Number(userId);
    if (!uid) return { ok: false, error: 'Usuário inválido.' };

    const tipo = normalizeTipoConta(
      profileOrRow.tipoConta || profileOrRow.tipo_conta
    );
    const isEmpresa = tipo === 'empresa';
    const refKey = `pagamento-aprovado-${uid}`;
    const titulo = 'Pagamento realizado com sucesso';
    const corpo = isEmpresa
      ? 'Seu pagamento foi confirmado. O acesso ao sistema está liberado.'
      : 'Seu pagamento foi confirmado com sucesso. A tela de Vendas já está liberada para uso.';
    const href = isEmpresa ? 'dashboard.html' : 'vendas.html';
    const nowIso = new Date().toISOString();

    try {
      const { data: existing } = await db()
        .from('notificacoes')
        .select('id')
        .eq('usuario_id', uid)
        .eq('ref_key', refKey)
        .maybeSingle();

      if (existing?.id) {
        const { error: updErr } = await db()
          .from('notificacoes')
          .update({
            tipo: 'sistema',
            titulo,
            corpo,
            href,
            lida: false,
            apagada: false,
            created_at: nowIso
          })
          .eq('id', existing.id);
        if (updErr) {
          if (isMissingNotifTable(updErr)) return { ok: false, needsSchema: true };
          return { ok: false, error: errMsg(updErr) };
        }
        return { ok: true, updated: true, refKey };
      }

      const row = {
        usuario_id: uid,
        tipo: 'sistema',
        titulo,
        corpo,
        href,
        ref_key: refKey,
        lida: false,
        apagada: false,
        created_at: nowIso
      };

      const { error } = await db().from('notificacoes').insert([row]);
      if (error) {
        if (isMissingNotifTable(error)) return { ok: false, needsSchema: true };
        if (/duplicate|unique/i.test(error.message || '')) {
          const { error: forceErr } = await db()
            .from('notificacoes')
            .update({
              tipo: 'sistema',
              titulo,
              corpo,
              href,
              lida: false,
              apagada: false,
              created_at: nowIso
            })
            .eq('usuario_id', uid)
            .eq('ref_key', refKey);
          if (forceErr) return { ok: false, error: errMsg(forceErr) };
          return { ok: true, updated: true, refKey };
        }
        return { ok: false, error: errMsg(error) };
      }
      return { ok: true, created: true, refKey };
    } catch (err) {
      return { ok: false, error: err.message || 'Falha ao notificar.' };
    }
  }

  /** Lê o usuário após aprovação para confirmar status=ativo */
  async function fetchUserPaymentRow(userId) {
    const uid = Number(userId);
    const { data, error } = await db()
      .from('usuarios')
      .select(
        'id, nome, email, tipo_conta, razao_social, cnpj, status_pagamento, plano, pago_em, proximo_vencimento'
      )
      .eq('id', uid)
      .maybeSingle();
    if (error) return { ok: false, error: errMsg(error), profile: null };
    if (!data) return { ok: false, error: 'Usuário não encontrado.', profile: null };
    return { ok: true, profile: mapPaymentProfile(data) };
  }

  /**
   * Desenvolvedor (linha em usuarios) aprova pagamento:
   * - status_pagamento = ativo (libera Vendas)
   * - pago_em = agora
   * - notificação na tabela notificacoes
   */
  async function confirmUserPayment(userId) {
    const gate = requireDevOrAdmin();
    if (!gate.ok) return { ok: false, error: gate.error || 'Acesso negado.' };

    const uid = Number(userId);
    if (!uid) return { ok: false, error: 'Informe o usuário.' };

    const target = await fetchUserPaymentRow(uid);
    if (target.ok && target.profile && isDeveloperAccount(target.profile)) {
      return {
        ok: false,
        error: 'Conta do desenvolvedor não entra na fila de cobrança/aprovação.'
      };
    }

    let devId = gate.userId ? Number(gate.userId) : null;
    if (!devId && gate.email) {
      const { data: byEmail } = await db()
        .from('usuarios')
        .select('id, nome, email')
        .eq('email', String(gate.email).toLowerCase())
        .maybeSingle();
      if (byEmail?.id) {
        devId = Number(byEmail.id);
        if (typeof DevAuth !== 'undefined' && DevAuth.isLoggedIn()) {
          const s = DevAuth.getSession() || {};
          DevAuth.setSession?.({
            ...s,
            userId: devId,
            email: byEmail.email || s.email,
            name: byEmail.nome || s.name,
            role: 'developer',
            loggedAt: s.loggedAt || new Date().toISOString()
          });
        }
      }
    }
    if (!devId) {
      const ensured = await ensureDeveloperUser();
      if (!ensured.ok || !ensured.user?.id) {
        return {
          ok: false,
          error:
            ensured.error ||
            'Conta do desenvolvedor não encontrada. Execute supabase/criar_usuario_desenvolvedor.sql e faça login de novo.'
        };
      }
      devId = Number(ensured.user.id);
      if (typeof DevAuth !== 'undefined' && DevAuth.isLoggedIn()) {
        const s = DevAuth.getSession() || {};
        DevAuth.setSession?.({
          ...s,
          userId: devId,
          email: ensured.user.email || s.email,
          name: ensured.user.name || s.name,
          role: 'developer',
          loggedAt: s.loggedAt || new Date().toISOString()
        });
      }
    }

    let rpcOk = false;
    let lastError = '';

    // 1) Preferido: RPC por ID do desenvolvedor na tabela usuarios
    const rpcDev = await db().rpc('pas_dev_aprovar_pagamento', {
      p_dev_usuario_id: devId,
      p_usuario_id: uid
    });

    if (!rpcDev.error) {
      rpcOk = true;
    } else {
      lastError = errMsg(rpcDev.error, 'Falha na aprovação.');
      if (isMissingRpc(rpcDev.error)) {
        const rpcAdmin = await db().rpc('pas_admin_confirmar_pagamento', {
          p_admin_email: String(gate.email),
          p_usuario_id: uid
        });
        if (!rpcAdmin.error) {
          rpcOk = true;
          lastError = '';
        } else {
          lastError = errMsg(rpcAdmin.error, lastError);
        }
      }
    }

    // 2) Sem RPC: não dá para burlar o trigger — orientar SQL
    if (!rpcOk) {
      const missing = /Could not find the function|schema cache|does not exist|PGRST202/i.test(
        lastError || ''
      );
      return {
        ok: false,
        error: missing
          ? 'Execute supabase/fix_dev_usuario_aprovacao.sql no SQL Editor do Supabase e tente de novo.'
          : lastError ||
            'Não foi possível aprovar. Execute supabase/fix_dev_usuario_aprovacao.sql no Supabase.'
      };
    }

    // 3) Confirma no banco
    const verified = await fetchUserPaymentRow(uid);
    if (!verified.ok || !verified.profile) {
      return {
        ok: false,
        error: verified.error || 'Não foi possível validar a aprovação.'
      };
    }

    if (!isPaymentActive(verified.profile.statusPagamento)) {
      return {
        ok: false,
        error:
          'O status não mudou para ativo. Execute supabase/fix_dev_usuario_aprovacao.sql e aprove novamente.'
      };
    }

    // 4) Reforça notificação (RPC já cria; aqui é fallback)
    const notif = await notifyPaymentApproved(uid, verified.profile);
    if (notif?.needsSchema) {
      console.warn('Tabela notificacoes ausente.');
    }

    return {
      ok: true,
      profile: verified.profile,
      notified: Boolean(notif?.ok) || rpcOk,
      needsSchema: Boolean(notif?.needsSchema)
    };
  }

  async function listUsersForDev() {
    const gate = requireDevOrAdmin();
    if (!gate.ok) return { ok: false, error: gate.error || 'Acesso negado.', users: [] };

    // Sem foto_perfil / comprovante_pagamento (base64) — só metadados leves
    const colsFull =
      'id, nome, email, tipo_conta, razao_social, cnpj, status_pagamento, plano, pago_em, proximo_vencimento, comprovante_em, sessao_token, sessao_em, ultimo_acesso';
    const colsMinimal =
      'id, nome, email, tipo_conta, razao_social, cnpj, status_pagamento, plano, pago_em, proximo_vencimento';
    const colsNoPresence =
      'id, nome, email, tipo_conta, razao_social, cnpj, status_pagamento, plano, pago_em, proximo_vencimento, comprovante_em';

    let { data, error } = await db()
      .from('usuarios')
      .select(colsFull)
      .order('id', { ascending: false })
      .limit(500);

    if (error && /ultimo_acesso|sessao_token|sessao_em|column|schema cache|Could not find/i.test(error.message || '')) {
      ({ data, error } = await db()
        .from('usuarios')
        .select(colsNoPresence)
        .order('id', { ascending: false })
        .limit(500));
    }

    if (error && /comprovante_em|column|schema cache|Could not find/i.test(error.message || '')) {
      ({ data, error } = await db()
        .from('usuarios')
        .select(colsMinimal)
        .order('id', { ascending: false })
        .limit(500));
    }

    if (error) return { ok: false, error: errMsg(error, 'Erro ao listar usuários.'), users: [] };
    return {
      ok: true,
      users: excludeDeveloperAccounts(
        (data || []).map((row) =>
          mapPaymentProfile({
            ...row,
            has_comprovante: Boolean(row.comprovante_em),
            comprovante_pagamento: '',
            foto_perfil: ''
          })
        )
      )
    };
  }

  async function getDevStats() {
    const gate = requireDevOrAdmin();
    if (!gate.ok) return { ok: false, error: gate.error || 'Acesso negado.', stats: null };

    const list = await listUsersForDev();
    if (!list.ok) return { ok: false, error: list.error, stats: null };

    const users = list.users || [];
    const stats = {
      total: users.length,
      pessoaFisica: 0,
      empresa: 0,
      pendente: 0,
      pendenteRevisao: 0,
      ativo: 0,
      atrasado: 0,
      outros: 0
    };

    users.forEach((u) => {
      if (normalizeTipoConta(u.tipoConta) === 'empresa') stats.empresa += 1;
      else stats.pessoaFisica += 1;
      const st = normalizeStatusPagamento(u.statusPagamento);
      if (st === 'pendente') stats.pendente += 1;
      else if (st === 'pendente_revisao') stats.pendenteRevisao += 1;
      else if (st === 'ativo') stats.ativo += 1;
      else if (st === 'atrasado') stats.atrasado += 1;
      else stats.outros += 1;
    });

    return { ok: true, stats };
  }

  /** Preços exibidos no fluxo de pagamento (PF = único / empresa = mensal) */
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

  /**
   * Pessoa física com pagamento pendente: Vendas e Reservas Pendentes ficam bloqueadas.
   * Conta empresa continua com gate completo do sistema.
   */
  function isVendasLocked(profileOrSession) {
    const src = profileOrSession || Store.getSession();
    if (!src) return false;
    if (isDeveloperAccount(src)) return false;
    if (isPaymentActive(src.statusPagamento)) return false;
    return normalizeTipoConta(src.tipoConta) !== 'empresa';
  }

  /** Free = status_pagamento diferente de ativo (ex.: pendente). Pro = ativo. */
  function isFreePlan(profileOrSession) {
    const src = profileOrSession || Store.getSession();
    if (!src) return false;
    if (isDeveloperAccount(src)) return false;
    return !isPaymentActive(src.statusPagamento);
  }

  /** Plano Free: no máximo 1 rifa. Pro (status_pagamento = ativo) sem limite. */
  const FREE_RAFFLE_LIMIT = 1;

  async function countUserRaffles() {
    const gate = await guardSession();
    if (!gate.ok) return { ok: false, error: gate.error || 'Não autenticado.', count: 0 };

    const session = Store.getSession();
    const uid = session?.userId;
    if (!uid) return { ok: false, error: 'Não autenticado.', count: 0 };

    const { count, error } = await db()
      .from('rifas')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', Number(uid));

    if (!error) return { ok: true, count: Number(count) || 0 };

    const listed = await listRaffles();
    if (!listed.ok) return { ok: false, error: errMsg(error, listed.error), count: 0 };
    return { ok: true, count: (listed.raffles || []).length };
  }

  /**
   * Free com 1+ rifas: bloqueia nova criação até status_pagamento = ativo (Pro).
   */
  async function checkRaffleCreateLimit(profileOrSession) {
    const src = profileOrSession || Store.getSession();
    if (!src?.userId) return { ok: false, reason: 'none' };
    if (!isFreePlan(src)) return { ok: true, unlimited: true };

    const counted = await countUserRaffles();
    if (!counted.ok) {
      return { ok: false, reason: 'error', error: counted.error || 'Não foi possível verificar suas rifas.' };
    }
    if (counted.count >= FREE_RAFFLE_LIMIT) {
      return {
        ok: false,
        reason: 'free-limit',
        count: counted.count,
        limit: FREE_RAFFLE_LIMIT,
        profile: src
      };
    }
    return { ok: true, count: counted.count, limit: FREE_RAFFLE_LIMIT };
  }

  function isEmpresaPaymentRequired(profileOrSession) {
    const src = profileOrSession || Store.getSession();
    if (!src) return false;
    if (isDeveloperAccount(src)) return false;
    if (isPaymentActive(src.statusPagamento)) return false;
    return normalizeTipoConta(src.tipoConta) === 'empresa';
  }

  /** Páginas liberadas mesmo sem pagamento ativo */
  function isPaymentExemptPage(pathname = window.location.pathname) {
    const file = String(pathname || '').split('/').pop() || '';
    const exempt = new Set([
      '',
      'index.html',
      'login.html',
      'cadastro.html',
      'pagamento.html',
      'admin-pagamentos.html',
      'dev-login.html',
      'dev.html',
      'visualizar-rifa.html',
      'compartilhar.html',
      'offline.html',
      'termos.html'
    ]);
    return exempt.has(file);
  }

  async function ensurePaymentAccess() {
    if (isPaymentExemptPage()) return { ok: true, exempt: true };

    const session = Store.getSession();
    if (!session?.userId) return { ok: false, reason: 'none' };
    if (isDeveloperAccount(session)) {
      return { ok: true, developer: true, session };
    }

    const result = await refreshPaymentProfile();
    if (!result.ok) {
      // Sem schema de pagamento ou falha de rede: não bloqueia quem já usava o sistema
      return { ok: true, skipped: true };
    }

    if (isPaymentActive(result.profile?.statusPagamento)) {
      return { ok: true, session: Store.getSession() };
    }

    const tipo = normalizeTipoConta(result.profile?.tipoConta);
    // Pessoa física: usa o sistema; Vendas permanece bloqueada até o Pix único
    if (tipo !== 'empresa') {
      return {
        ok: true,
        vendasLocked: true,
        session: Store.getSession()
      };
    }

    try {
      if (typeof Layout !== 'undefined' && Layout.allowNavigate) {
        Layout.allowNavigate('pagamento.html');
      } else {
        const key = 'pas_nav_allowed';
        const raw = sessionStorage.getItem(key);
        const list = raw ? JSON.parse(raw) : [];
        const set = new Set(Array.isArray(list) ? list : []);
        set.add('pagamento.html');
        sessionStorage.setItem(key, JSON.stringify([...set]));
      }
    } catch { /* ignore */ }
    window.location.href = 'pagamento.html';
    return { ok: false, reason: 'payment', session: Store.getSession() };
  }

  /** Guarda a página de Vendas (e links diretos) para contas PF sem pagamento */
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

  function isProAccount(userOrSession) {
    const src = userOrSession || Store.getSession();
    if (!src) return false;
    if (isDeveloperAccount(src)) return true;
    const pago = src.pagoEm ?? src.pago_em;
    if (pago != null) {
      const text = String(pago).trim().toLowerCase();
      if (text && text !== 'null' && text !== 'undefined') return true;
    }
    return isPaymentActive(src.statusPagamento);
  }

  function isMissingSupportChat(error) {
    return /suporte_conversas|suporte_mensagens|relation|schema cache|Could not find|does not exist/i.test(
      error?.message || ''
    );
  }

  function mapSupportMessage(row) {
    if (!row) return null;
    return {
      id: row.id,
      threadId: row.conversa_id || row.threadId,
      from: row.remetente === 'dev' ? 'dev' : 'usuario',
      body: String(row.corpo || '').trim(),
      read: !!row.lida,
      createdAt: row.created_at || row.createdAt || null
    };
  }

  function mapSupportThread(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.usuario_id || row.userId,
      updatedAt: row.atualizado_em || row.updatedAt || null,
      lastMessageAt: row.ultima_mensagem_em || row.lastMessageAt || null,
      unreadUser: Number(row.nao_lidas_usuario || 0) || 0,
      unreadDev: Number(row.nao_lidas_dev || 0) || 0,
      createdAt: row.created_at || row.createdAt || null
    };
  }

  async function ensureSupportThread(userId) {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
      return { ok: false, error: 'Usuário inválido.' };
    }

    const { data: existing, error: findErr } = await db()
      .from('suporte_conversas')
      .select('id, usuario_id, atualizado_em, ultima_mensagem_em, nao_lidas_usuario, nao_lidas_dev, created_at')
      .eq('usuario_id', uid)
      .maybeSingle();

    if (findErr) {
      if (isMissingSupportChat(findErr)) {
        return {
          ok: false,
          needsSchema: true,
          error: 'Execute supabase/suporte_chat.sql no Supabase.'
        };
      }
      return { ok: false, error: errMsg(findErr) };
    }
    if (existing) return { ok: true, thread: mapSupportThread(existing) };

    const { data, error } = await db()
      .from('suporte_conversas')
      .insert([{ usuario_id: uid }])
      .select('id, usuario_id, atualizado_em, ultima_mensagem_em, nao_lidas_usuario, nao_lidas_dev, created_at')
      .single();

    if (error) {
      if (isMissingSupportChat(error)) {
        return {
          ok: false,
          needsSchema: true,
          error: 'Execute supabase/suporte_chat.sql no Supabase.'
        };
      }
      if (/duplicate|unique/i.test(error.message || '')) {
        const retry = await db()
          .from('suporte_conversas')
          .select('id, usuario_id, atualizado_em, ultima_mensagem_em, nao_lidas_usuario, nao_lidas_dev, created_at')
          .eq('usuario_id', uid)
          .maybeSingle();
        if (retry.data) return { ok: true, thread: mapSupportThread(retry.data) };
      }
      return { ok: false, error: errMsg(error) };
    }
    return { ok: true, thread: mapSupportThread(data) };
  }

  async function listSupportThreads({ limit = 100 } = {}) {
    const gate = requireDevOrAdmin();
    if (!gate.ok) return { ok: false, error: gate.error || 'Acesso negado.', threads: [] };

    const { data, error } = await db()
      .from('suporte_conversas')
      .select('id, usuario_id, atualizado_em, ultima_mensagem_em, nao_lidas_usuario, nao_lidas_dev, created_at')
      .order('atualizado_em', { ascending: false })
      .limit(Number(limit) || 100);

    if (error) {
      if (isMissingSupportChat(error)) {
        return {
          ok: false,
          needsSchema: true,
          error: 'Execute supabase/suporte_chat.sql no Supabase.',
          threads: []
        };
      }
      return { ok: false, error: errMsg(error), threads: [] };
    }

    return {
      ok: true,
      threads: (data || []).map(mapSupportThread).filter(Boolean)
    };
  }

  async function listSupportMessages(userId, { limit = 100 } = {}) {
    const ensured = await ensureSupportThread(userId);
    if (!ensured.ok) return { ...ensured, messages: [] };
    const threadId = ensured.thread.id;

    const { data, error } = await db()
      .from('suporte_mensagens')
      .select('id, conversa_id, remetente, corpo, lida, created_at')
      .eq('conversa_id', threadId)
      .order('created_at', { ascending: true })
      .limit(Number(limit) || 100);

    if (error) {
      if (isMissingSupportChat(error)) {
        return {
          ok: false,
          needsSchema: true,
          error: 'Execute supabase/suporte_chat.sql no Supabase.',
          messages: [],
          thread: ensured.thread
        };
      }
      return { ok: false, error: errMsg(error), messages: [], thread: ensured.thread };
    }

    return {
      ok: true,
      thread: ensured.thread,
      messages: (data || []).map(mapSupportMessage)
    };
  }

  async function sendSupportMessage({ userId, body, asDev = false } = {}) {
    const texto = String(body || '').trim();
    if (texto.length < 1) return { ok: false, error: 'Digite uma mensagem.' };
    if (texto.length > 4000) return { ok: false, error: 'Mensagem muito longa.' };

    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
      return { ok: false, error: 'Usuário inválido.' };
    }

    // Só Pro (ou desenvolvedor falando com um Pro)
    if (asDev) {
      const gate = requireDevOrAdmin();
      if (!gate.ok) return { ok: false, error: gate.error || 'Acesso negado.' };
      const users = await listUsersForDev();
      const target = (users.users || []).find((u) => Number(u.id) === uid);
      if (!target) return { ok: false, error: 'Usuário não encontrado.' };
      if (!isProAccount(target)) {
        return { ok: false, error: 'Chat disponível apenas para usuários Pro.' };
      }
    } else {
      const session = Store.getSession();
      if (!session?.userId || Number(session.userId) !== uid) {
        return { ok: false, error: 'Não autenticado.' };
      }
      if (isVendasLocked(session)) {
        return {
          ok: false,
          error: 'Chat de suporte bloqueado na versão Free. Realize o pagamento para liberar.'
        };
      }
    }

    const ensured = await ensureSupportThread(uid);
    if (!ensured.ok) return ensured;
    const threadId = ensured.thread.id;
    const from = asDev ? 'dev' : 'usuario';
    const nowIso = new Date().toISOString();

    const { data, error } = await db()
      .from('suporte_mensagens')
      .insert([
        {
          conversa_id: threadId,
          remetente: from,
          corpo: texto,
          lida: false,
          created_at: nowIso
        }
      ])
      .select('id, conversa_id, remetente, corpo, lida, created_at')
      .single();

    if (error) {
      if (isMissingSupportChat(error)) {
        return {
          ok: false,
          needsSchema: true,
          error: 'Execute supabase/suporte_chat.sql no Supabase.'
        };
      }
      return { ok: false, error: errMsg(error) };
    }

    const patch = {
      atualizado_em: nowIso,
      ultima_mensagem_em: nowIso
    };
    if (asDev) {
      patch.nao_lidas_usuario = Number(ensured.thread.unreadUser || 0) + 1;
    } else {
      patch.nao_lidas_dev = Number(ensured.thread.unreadDev || 0) + 1;
    }

    await db().from('suporte_conversas').update(patch).eq('id', threadId);

    try {
      if (asDev) {
        // Resposta ao cliente: contador no FAB (nao_lidas_usuario), sem sino do toolbar.
      } else {
        const session = Store.getSession();
        await notifyDeveloperSupportMessage({
          userId: uid,
          userName: session?.name || session?.email || '',
          preview: texto
        });
      }
    } catch (notifErr) {
      console.warn('support chat notify', notifErr);
    }

    return { ok: true, message: mapSupportMessage(data), threadId };
  }

  async function markSupportMessagesRead({ userId, asDev = false } = {}) {
    const ensured = await ensureSupportThread(userId);
    if (!ensured.ok) return ensured;
    const threadId = ensured.thread.id;
    const fromOther = asDev ? 'usuario' : 'dev';

    await db()
      .from('suporte_mensagens')
      .update({ lida: true })
      .eq('conversa_id', threadId)
      .eq('remetente', fromOther)
      .eq('lida', false);

    const patch = asDev ? { nao_lidas_dev: 0 } : { nao_lidas_usuario: 0 };
    await db().from('suporte_conversas').update(patch).eq('id', threadId);

    try {
      const uid = Number(userId);
      if (asDev) {
        const devId = await resolveDeveloperUserId();
        if (devId && uid) {
          await db()
            .from('notificacoes')
            .update({ lida: true })
            .eq('usuario_id', devId)
            .eq('ref_key', `dev-support-${uid}`)
            .eq('lida', false);
        }
      } else if (uid) {
        await db()
          .from('notificacoes')
          .update({ lida: true })
          .eq('usuario_id', uid)
          .eq('ref_key', `user-support-reply-${uid}`)
          .eq('lida', false);
      }
    } catch (err) {
      console.warn('support notif mark read', err);
    }

    return { ok: true };
  }

  function subscribeSupportChat(userId, onChange) {
    const uid = Number(userId);
    const client = typeof window !== 'undefined' ? window.supabaseClient : null;
    if (!uid || !client || typeof onChange !== 'function') {
      return { unsubscribe() {}, ok: false };
    }

    let timer = null;
    const emit = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          onChange({ userId: uid });
        } catch (err) {
          console.warn('support chat live', err);
        }
      }, 150);
    };

    const channel = client
      .channel(`pas-support-${uid}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'suporte_mensagens' },
        () => emit()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'suporte_conversas',
          filter: `usuario_id=eq.${uid}`
        },
        () => emit()
      )
      .subscribe();

    return {
      ok: true,
      unsubscribe() {
        if (timer) clearTimeout(timer);
        try {
          client.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }

  return {
    validateFullName,
    bindFullNameInput,
    createUser,
    login,
    updateProfile,
    logout,
    requireAuth,
    requireRole,
    getAccessLevel,
    hasMinAccessLevel,
    validateSessionRemote,
    normalizeTipoConta,
    normalizeCnpjDigits,
    isCnpjFormatValid,
    formatCnpjMask,
    normalizeStatusPagamento,
    isPaymentActive,
    isAdminEmail,
    isDeveloperAccount,
    isProAccount,
    PLAN_PRICES,
    getPlanPrice,
    isVendasLocked,
    isFreePlan,
    FREE_RAFFLE_LIMIT,
    countUserRaffles,
    checkRaffleCreateLimit,
    isEmpresaPaymentRequired,
    getPaymentProfile,
    refreshPaymentProfile,
    markPaymentForReview,
    listPendingPaymentReviews,
    getPaymentProof,
    resolveSignedMediaUrl,
    resolveMediaSrc,
    confirmUserPayment,
    ensureDeveloperUser,
    loginDeveloperPortal,
    getDeveloperProfile,
    updateDeveloperProfile,
    listUsersForDev,
    getDevStats,
    touchPresence,
    isUserOnline,
    listSupportThreads,
    listSupportMessages,
    sendSupportMessage,
    markSupportMessagesRead,
    ensureSupportThread,
    subscribeSupportChat,
    isPaymentExemptPage,
    ensurePaymentAccess,
    ensureVendasAccess,
    requireActiveSession,
    validateActiveSession,
    guardSession,
    listRaffles,
    getRaffle,
    isRaffleOwner,
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
    subscribeLiveUpdates,
    subscribeDevUsersLive,
    getSystemBanner,
    saveSystemBanner,
    clearSystemBanner,
    getSystemMaintenance,
    activateSystemMaintenance,
    deactivateSystemMaintenance,
    broadcastSystemNotification,
    publishSystemAviso,
    getSystemAviso,
    markSystemAvisoRead,
    getMySystemRating,
    listSystemRatings,
    submitSystemRating,
    updateSystemRatingAdmin,
    normalizeRatingStatus,
    uploadImage,
    generatePDF,
    generatePix,
    generateQRCode,
    printRaffle,
    sendNotification,
    drawWinners,
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
    disconnectInstagram
  };
})();

window.API = API;
window.createUser = (...a) => API.createUser(...a);
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
