-- Recuperação de senha por e-mail (PowerApps Sistemas)
-- Execute uma vez no Aiven / Postgres

CREATE TABLE IF NOT EXISTS public.password_resets (
  id bigserial PRIMARY KEY,
  usuario_id bigint NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS password_resets_token_hash_uidx
  ON public.password_resets (token_hash);

CREATE INDEX IF NOT EXISTS password_resets_usuario_idx
  ON public.password_resets (usuario_id);
