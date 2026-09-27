-- Migração Aiven / Postgres — autenticação em 2 fatores (TOTP) opcional
-- Execute uma vez no banco (psql, DBeaver, console Aiven, etc.)
--
-- Colunas:
--   two_fa_ativo          — usuário concluiu o setup e 2FA está ligado
--   two_fa_secret         — secret TOTP cifrado (AES-256-GCM) no backend; NUNCA texto puro
--   two_fa_codigos_backup — hashes bcrypt dos códigos de backup (jsonb); NUNCA texto puro

ALTER TABLE IF EXISTS public.usuarios
  ADD COLUMN IF NOT EXISTS two_fa_ativo boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.usuarios
  ADD COLUMN IF NOT EXISTS two_fa_secret text;

ALTER TABLE IF EXISTS public.usuarios
  ADD COLUMN IF NOT EXISTS two_fa_codigos_backup jsonb;

COMMENT ON COLUMN public.usuarios.two_fa_ativo IS
  'true quando o usuário ativou 2FA TOTP após confirmar um código válido.';

COMMENT ON COLUMN public.usuarios.two_fa_secret IS
  'Secret TOTP cifrado pelo backend (AES-256-GCM + TWO_FA_ENCRYPTION_KEY). Nunca gravar em claro.';

COMMENT ON COLUMN public.usuarios.two_fa_codigos_backup IS
  'Array JSON de hashes bcrypt dos códigos de backup de uso único.';
