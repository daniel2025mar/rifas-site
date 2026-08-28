# Deploy do auth server (Express + Aiven)

Este documento lista opções **gratuitas ou de entrada baixa** para hospedar o
`server/`. **Não configurei nenhum deploy** — escolha uma opção e me diga qual
seguir.

Antes de qualquer plataforma:

1. Rode `server/sql/001_two_fa_usuarios.sql` no Postgres Aiven.
2. Defina no painel da hospedagem (nunca no Git):
   - `AIVEN_DATABASE_URL`
   - `TWO_FA_ENCRYPTION_KEY` (64 hex)
   - `CORS_ORIGIN` (URL do front, sem `*`)
   - `TOTP_ISSUER`
   - `NODE_ENV=production`
3. Build/start: pasta `server/`, `npm install`, `npm start` (porta via `PORT`).

---

## 1) Render (Web Service free)

**Prós**

- Ainda oferece tier gratuito de web service (2026).
- Deploy simples a partir do GitHub; SSL incluso.
- Bom para API Node sem cartão no free.

**Contras / limites**

- Dorme após ~15 min sem tráfego → cold start de ~30–60s no próximo request.
- ~750 horas/mês de instância free; ao estourar, **suspende** os serviços free
  até o mês seguinte (parecido com a dor do Neon por cota).
- Bandwidth free limitada; sem cartão, estouro pode suspender.
- Free Postgres do Render **expira em ~30 dias** — use só o Aiven externo.
- **SMTP (portas 25/465/587) é bloqueado no free** — Hotmail/Outlook SMTP
  não conecta. Use `RESEND_API_KEY` (API HTTPS) no serviço `backend/`, ou
  faça upgrade do plano se quiser SMTP.

**Ao atingir o limite:** serviço free fica suspenso até o ciclo mensal ou upgrade.

**Indicado se:** aceita cold start e tráfego baixo/esporádico.

---

## 2) Railway

**Prós**

- DX excelente, deploys rápidos, logs bons.
- Instância tende a ficar acordada (sem sleep clássico do Render free).

**Contras / limites**

- **Não há free tier contínuo** para contas novas (2026): costuma ser crédito
  trial (~US$5) e depois plano pago por uso.
- Sem crédito → o deploy para ou gera cobrança.

**Ao atingir o limite:** trial acaba; precisa pagar ou o app para.

**Indicado se:** topa gastar pouco por mês para API sempre ligada.

---

## 3) Fly.io

**Prós**

- Máquinas leves, escala a zero em alguns setups, boa latência regional.
- Controle fino (Dockerfile/`fly.toml`).

**Contras / limites**

- Free allowance generoso **acabou para contas novas** (desde ~out/2024);
  contas novas são pay-as-you-go.
- Contas antigas (legacy) ainda podem ter crédito residual.
- Mais configuração que Render.

**Ao atingir o limite:** cobrança por uso ou machine parada se não houver crédito.

**Indicado se:** já tem conta legacy com allowance, ou aceita pagar pouco.

---

## Comparativo rápido

| | Render free | Railway | Fly.io (conta nova) |
|---|---|---|---|
| Custo zero contínuo | Sim (com ressalvas) | Não (trial) | Não |
| Sleep / cold start | Sim (~15 min) | Em geral não no trial/pago | Depende do setup |
| Risco de suspensão por cota | Sim (horas/mês) | Para quando o crédito acaba | Cobra ou para |
| Facilidade | Alta | Alta | Média |

---

## Recomendação operacional (sem escolher por você)

- **Só testar / pouco uso:** Render free (aceitar cold start e risco de suspensão mensal).
- **API sempre responsiva com orçamento mínimo:** Railway ou Fly pago baixo, Aiven
  como banco externo (já é o seu caso).

Quando decidir a plataforma, diga qual é — aí configuro `Dockerfile`/`render.yaml`/
`fly.toml` e as variáveis de ambiente no painel.
