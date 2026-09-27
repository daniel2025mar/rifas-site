/**
 * PowerApps Sistemas — Cliente Supabase (legado)
 * O site ativo usa js/frontend-api.js → Express → Neon.
 * Se precisar deste cliente, configure URL/chave via PAS_CONFIG (nunca cometa valores reais).
 */
const SUPABASE_URL = String(
  (typeof window !== 'undefined' && window.PAS_CONFIG && window.PAS_CONFIG.SUPABASE_URL) || ''
).trim();
const SUPABASE_KEY = String(
  (typeof window !== 'undefined' && window.PAS_CONFIG && window.PAS_CONFIG.SUPABASE_ANON_KEY) || ''
).trim();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn(
    'js/supabase.js: SUPABASE_URL / SUPABASE_ANON_KEY não configurados em PAS_CONFIG. Cliente legado inativo.'
  );
}

if (typeof supabase === 'undefined' || !supabase.createClient) {
  console.error('Biblioteca @supabase/supabase-js não carregada. Inclua o CDN antes de js/supabase.js.');
}

const supabaseClient =
  SUPABASE_URL && SUPABASE_KEY && typeof supabase !== 'undefined' && supabase.createClient
    ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

window.supabaseClient = supabaseClient;
window.SUPABASE_URL = SUPABASE_URL;
