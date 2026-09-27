# Etapa 1 — Criar o PostgreSQL gratuito no Aiven

Siga estes passos **no navegador**. Quando terminar, volte ao chat e confirme que o serviço está **Running**. Depois cole as credenciais (só no chat / no `.env` local — nunca no GitHub).

---

## 1. Criar conta (sem cartão)

1. Abra: [https://console.aiven.io/signup](https://console.aiven.io/signup)
2. Crie a conta com e-mail, Google ou GitHub.
3. **Não** será pedido cartão de crédito no plano Free.
4. Aceite os termos e entre no console.

Se já tiver conta, entre em: [https://console.aiven.io](https://console.aiven.io)

### Depois do login — pergunta de perfil

O Aiven pode perguntar o tipo de uso. Escolha:

| Opção | Quando usar |
|--------|-------------|
| **Personal Project** | Projeto pessoal / app próprio (recomendado neste caso) |
| **Work or business** | Empresa / time de trabalho |
| **Exploring and learning** | Só estudar / brincar com a plataforma |

Para este sistema de rifas, escolha **Personal Project**.  
Isso não muda o plano Free nem o preço — é só classificação do uso. Depois disso o console abre normalmente.

---

## 2. Criar o serviço PostgreSQL Free

Você está na tela: **Create a new service**  
(`…/project/…/new-service`)

### Preencha assim

1. **Service type**: selecione **PostgreSQL®** (se ainda não selecionou).
2. **Service name** (campo **Nome**): apague o padrão (`pg-xxxx`) e use:

   ```text
   powerapps-sistemas
   ```

   - O Aiven costuma exigir **minúsculas**, números e hífen (sem espaços, sem maiúsculas).  
   - Esse nome **não pode ser alterado depois** — é só o nome do serviço no painel.  
   - O banco PostgreSQL **`PowerAppsSistemas`** eu crio depois, na migração, com `CREATE DATABASE`.
3. **Cloud provider**: AWS, Google Cloud ou Azure (qualquer um do Free).
4. **Region**: a mais próxima (ex. São Paulo / `southamerica-east1`, se existir no Free).
5. **Plan**: escolha **Free** — confirme preço **$0** e ~1 GB de storage.  
   - **Não** escolha Startup / Business / Premium (isso cobra).
6. Clique em **Create service** / **Create free service**.
7. Aguarde o status: **Rebuilding** → **Running** (1–3 minutos).

> Só continue quando o status estiver **Running**.

### O que eu faço depois (não dá para fazer nesta tela)

Nesta tela o Aiven só cria o **servidor** vazio (`defaultdb`).  
Eu **não consigo** clicar “Create” na sua conta Aiven daqui — isso só você faz no navegador.

Depois que estiver **Running** e você colar as URLs no chat:

1. Criar o database **`PowerAppsSistemas`**
2. Copiar **todas** as tabelas/dados do Neon → Aiven (`pg_dump` / `psql`)
3. Aplicar proteções (SSL obrigatório, credenciais só no `.env`, `.gitignore`, sem segredos no GitHub, etc.)

---

## 3. Onde achar a string de conexão completa

Você deve estar em: **Services → powerapps-sistemas → Overview**

1. Confirme o status no topo: deve estar **Running** (não **Rebuilding** / **Powered off**).
2. Na Overview, procure o bloco de conexão / **Connection information**.
3. Copie o campo **Service URI** (às vezes **Connection URI** / **PostgreSQL URI**).
4. Se aparecer um botão **Show** / **Reveal** na senha ou na URI, clique antes de copiar.

Formato típico:

```text
postgres://avnadmin:SUA_SENHA@HOST.aivencloud.com:PORTA/defaultdb?sslmode=require
```

Guarde essa URI inteira. Ela será a `AIVEN_DATABASE_URL`.

Importante:

- Não remova `sslmode=require` — o Aiven exige TLS.
- Não compartilhe essa URI no GitHub, em issues ou em commits.

---

## 4. Onde baixar o certificado SSL (CA)

Ainda na Overview do serviço:

1. Procure **CA Certificate**, **Download CA certificate** ou **SSL CA**.
2. Baixe o arquivo (geralmente `ca.pem` ou similar).
3. Guarde em um lugar **fora do Git**, por exemplo:

```text
migracao-neon-aiven/aiven-ca.pem
```

(Na próxima etapa vamos garantir que essa pasta e o `.pem` fiquem no `.gitignore`.)

Para a maioria das ferramentas (`psql`, `pg_dump`, Node `pg`), `sslmode=require` na URI já basta. O certificado CA é útil se precisar de `sslmode=verify-ca` / `verify-full`.

---

## 5. Como copiar host, porta, usuário, senha e nome do banco

Na mesma Overview, abra a seção de **Connection information** (ou equivalente). Anote:

| Campo | Onde aparece no Aiven | Exemplo típico |
|--------|------------------------|----------------|
| **Host** | Host / Hostname | `pg-xxxx.aivencloud.com` |
| **Port** | Port | número alto, ex. `12345` (não é 5432 no Free) |
| **User** | User | `avnadmin` |
| **Password** | Password (botão Show / Copy) | senha longa gerada |
| **Database** | Database name | em geral `defaultdb` |

Você pode montar a URI assim (só para conferir se bate com o Service URI):

```text
postgres://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO?sslmode=require
```

Se a senha tiver caracteres especiais (`@`, `#`, `%`, etc.), prefira copiar o **Service URI** pronto do painel em vez de montar na mão.

---

## 6. Checklist antes de voltar ao chat

Marque mentalmente:

- [ ] Conta criada **sem** cartão
- [ ] Serviço PostgreSQL no plano **Free**
- [ ] Status **Running**
- [ ] **Service URI** copiada
- [ ] Host, porta, usuário, senha e database anotados (ou URI completa)
- [ ] Certificado CA baixado (opcional agora, recomendado guardar)

---

## 7. O que me enviar a seguir

Quando estiver pronto, responda neste chat com algo como:

> Serviço criado e Running. Vou colar as credenciais.

Depois cole (só aqui no chat / no `.env` local):

1. **AIVEN_DATABASE_URL** — a Service URI completa  
2. **NEON_DATABASE_URL** — a connection string atual do Neon (para o `pg_dump`)

**Não** cole senhas em arquivos que vão para o Git. Na Etapa 2 eu preparo o `.env` local e confirmo o `.gitignore`.

---

## Observações rápidas (Free tier)

- Free ≈ 1 GB de disco e 1 GB de RAM — se o dump do Neon for grande, pode faltar espaço; nesse caso avisamos na importação.
- O banco padrão costuma ser `defaultdb`.
- Usuário padrão costuma ser `avnadmin`.
- Conexão **sempre** com SSL (`sslmode=require`).

---

## 8. Onde ver as tabelas no painel Aiven

1. Abra: [Overview powerapps-sistemas](https://console.aiven.io/account/a5d703ad169c/project/djdaniel095-c416/services/powerapps-sistemas/overview)
2. Confirme status **Corrida**.
3. No menu à esquerda do serviço, clique em **Query editor** (Editor de consultas) — às vezes aparece como **SQL** / **Databases**.
4. Escolha o banco **`PowerAppsSistemas`** (não `defaultdb`).
5. Cole e execute:

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY 1;
```

Para conferir registros:

```sql
SELECT COUNT(*) FROM usuarios;
SELECT COUNT(*) FROM rifas;
SELECT * FROM usuarios LIMIT 10;
```

Se não achar Query editor: use DBeaver/pgAdmin com Host/Porta/User/Senha da Overview e database **`PowerAppsSistemas`**, SSL ligado.
