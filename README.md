# Ledger — Personal Finance Wallets

Sistema de gestão financeira pessoal baseado em carteiras. Permite múltiplas carteiras por usuário, compartilhamento com permissões, controle de cartões de crédito, parcelamentos e transferências rastreáveis entre carteiras.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | NestJS (Node 20) |
| Frontend | Next.js _(em breve)_ |
| Banco de dados | PostgreSQL 16 + Prisma ORM |
| Cache / Notificações | Redis 7 |
| Fila de emails | RabbitMQ 3.13 |
| Email transacional | Resend |
| Package manager | pnpm workspaces |

---

## Estrutura do monorepo

```
ledger/
├── apps/
│   ├── api/                  # Backend NestJS (@ledger/api)
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── auth/         # Autenticação (OTP + sessões)
│   │   │   ├── email/        # Fila RabbitMQ + Resend
│   │   │   ├── prisma/       # PrismaService
│   │   │   ├── redis/        # RedisModule
│   │   │   ├── config/       # Variáveis de ambiente tipadas
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── Dockerfile        # Multi-stage, EasyPanel-ready
│   │   ├── package.json
│   │   └── .env.example      # Referência de variáveis para produção
│   └── web/                  # Frontend Next.js (em breve)
├── docker-compose.yml        # Infraestrutura local (Postgres, Redis, RabbitMQ)
├── pnpm-workspace.yaml
├── package.json              # Scripts do monorepo
├── tsconfig.json             # TypeScript base
├── .env.example              # Referência de variáveis para desenvolvimento local
└── .dockerignore
```

---

## Pré-requisitos

- [Node.js](https://nodejs.org) **v20+**
- [pnpm](https://pnpm.io) **v9+** — `npm install -g pnpm`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — para subir Postgres, Redis e RabbitMQ localmente

---

## Setup local (primeira vez)

### 1. Clone o repositório

```bash
git clone <url-do-repo>
cd ledger
```

### 2. Instale as dependências

```bash
pnpm install
```

### 3. Configure as variáveis de ambiente

```bash
pnpm env:setup
```

Esse comando faz duas coisas:
- Copia `.env.example` para `.env` na raiz do monorepo
- Cria o symlink `apps/api/.env → ../../.env` (necessário para o Prisma CLI encontrar as variáveis)

Depois, edite o `.env` e preencha os valores obrigatórios:

```bash
# Obrigatórios para funcionar localmente:
RESEND_API_KEY=re_xxxxxxxxxxxx   # Obtenha em resend.com
EMAIL_FROM=noreply@seudominio.com
```

Os demais valores já estão configurados para o ambiente Docker local.

### 4. Suba a infraestrutura local

```bash
pnpm docker:up
```

Isso inicia:
- PostgreSQL na porta `5432`
- Redis na porta `6379`
- RabbitMQ na porta `5672` (management UI em `http://localhost:15672` — login: `ledger/ledger`)

Aguarde ~10 segundos até os containers estarem saudáveis.

### 5. Rode as migrations do banco

```bash
pnpm prisma:migrate
```

Quando solicitado, dê um nome para a migration (ex: `init`).

### 6. Inicie o servidor de desenvolvimento

```bash
pnpm dev
```

A API estará disponível em **http://localhost:3000**.

---

## Scripts disponíveis

Execute todos os scripts a partir da **raiz do monorepo**.

### Desenvolvimento

| Script | Descrição |
|---|---|
| `pnpm dev` | Inicia a API em modo watch |
| `pnpm build` | Compila a API para produção |
| `pnpm typecheck` | Verifica tipos TypeScript sem compilar |
| `pnpm lint` | Lint + autofix |
| `pnpm test` | Roda os testes |

### Banco de dados

| Script | Descrição |
|---|---|
| `pnpm prisma:migrate` | Cria e aplica uma nova migration (dev) |
| `pnpm prisma:migrate:deploy` | Aplica migrations pendentes (produção) |
| `pnpm prisma:generate` | Regenera o cliente Prisma após mudar o schema |
| `pnpm prisma:seed` | Popula o banco com dados de desenvolvimento |
| `pnpm prisma:studio` | Abre o Prisma Studio (GUI do banco) |

### Docker

| Script | Descrição |
|---|---|
| `pnpm docker:up` | Sobe a infraestrutura local em background |
| `pnpm docker:down` | Para e remove os containers |
| `pnpm docker:logs` | Stream dos logs dos containers |

### Setup

| Script | Descrição |
|---|---|
| `pnpm env:setup` | Cria `.env` e configura symlink da API (rodar uma vez por clone) |

---

## Variáveis de ambiente

### Estrutura

O monorepo usa **uma única fonte de verdade** para variáveis de ambiente locais:

```
.env                    ← arquivo real (gitignored), criado pelo env:setup
.env.example            ← template de referência para dev local
apps/api/.env           ← symlink para ../../.env (necessário para o Prisma CLI)
apps/api/.env.example   ← template de referência para produção (EasyPanel)
```

### Variáveis da API

| Variável | Descrição | Obrigatória |
|---|---|---|
| `DATABASE_URL` | Connection string do PostgreSQL | Sim |
| `REDIS_URL` | URL de conexão do Redis | Sim |
| `RABBITMQ_URL` | URL de conexão do RabbitMQ (AMQP) | Sim |
| `RESEND_API_KEY` | Chave da API do Resend | Sim |
| `EMAIL_FROM` | Endereço de remetente dos emails | Sim |
| `PORT` | Porta HTTP da API (default: `3000`) | Não |
| `NODE_ENV` | Ambiente (`development` / `production`) | Não |
| `SESSION_TTL_DAYS` | Validade da sessão em dias (default: `30`) | Não |
| `OTP_TTL_MINUTES` | Validade do OTP em minutos (default: `10`) | Não |
| `OTP_MAX_ATTEMPTS` | Tentativas máximas por OTP (default: `3`) | Não |
| `OTP_RATE_LIMIT_MAX` | Máximo de requests OTP por janela (default: `3`) | Não |
| `OTP_RATE_LIMIT_WINDOW_MINUTES` | Janela de rate limit em minutos (default: `10`) | Não |

---

## Documentação interativa

Com a API rodando, acesse:

| URL | Descrição |
|---|---|
| `http://localhost:3000/docs` | Scalar UI — documentação interativa |
| `http://localhost:3000/docs/json` | OpenAPI spec em JSON (para geração de clientes) |

---

## Endpoints da API (Auth)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| `POST` | `/auth/request-otp` | Solicita código OTP por email | Não |
| `POST` | `/auth/verify-otp` | Valida OTP e retorna session token | Não |
| `GET` | `/auth/me` | Retorna o usuário autenticado | Sim |
| `POST` | `/auth/logout` | Invalida a sessão | Sim |

Endpoints autenticados exigem o header:
```
Authorization: Bearer <sessionToken>
```

---

## Deploy no EasyPanel

### Serviços necessários

Crie os seguintes serviços no EasyPanel:

| Serviço | Tipo | Configuração |
|---|---|---|
| `ledger-postgres` | PostgreSQL | Database Service gerenciado pelo EasyPanel |
| `ledger-redis` | Redis | Redis Service gerenciado pelo EasyPanel |
| `ledger-rabbitmq` | App | Image: `rabbitmq:3.13-alpine` |
| `ledger-api` | App | Build via Dockerfile (ver abaixo) |

### Configuração do serviço `ledger-api`

| Campo | Valor |
|---|---|
| **Source** | Git repository |
| **Branch** | `main` |
| **Build method** | Dockerfile |
| **Dockerfile path** | `apps/api/Dockerfile` |
| **Build context** | `.` _(raiz do repositório)_ |
| **Port** | `3000` |

### Variáveis de ambiente no EasyPanel (`ledger-api`)

Use os hostnames internos dos serviços EasyPanel (não `localhost`):

```
NODE_ENV=production
PORT=3000

DATABASE_URL=postgresql://USER:PASSWORD@ledger-postgres:5432/ledger?schema=public
REDIS_URL=redis://ledger-redis:6379
RABBITMQ_URL=amqp://USER:PASSWORD@ledger-rabbitmq:5672

RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@seudominio.com

SESSION_TTL_DAYS=30
OTP_TTL_MINUTES=10
OTP_MAX_ATTEMPTS=3
OTP_RATE_LIMIT_MAX=3
OTP_RATE_LIMIT_WINDOW_MINUTES=10
```

> **Nota:** O Dockerfile executa `prisma migrate deploy` automaticamente antes de iniciar a API. Não é necessário rodar migrations manualmente no EasyPanel.

---

## Fluxo de autenticação

```
1. POST /auth/request-otp  { email }
   → Cria usuário se não existir
   → Gera OTP de 6 dígitos (válido por 10 min)
   → Enfileira email via RabbitMQ → Resend

2. POST /auth/verify-otp  { email, token }
   → Valida OTP (hash SHA-256, uso único, max 3 tentativas)
   → Cria sessão autenticada (válida por 30 dias)
   → Retorna { sessionToken, expiresAt, user }

3. GET /auth/me
   Authorization: Bearer <sessionToken>
   → Retorna dados do usuário autenticado

4. POST /auth/logout
   Authorization: Bearer <sessionToken>
   → Invalida a sessão imediatamente
```

---

## Fluxo de desenvolvimento

```bash
# Fluxo diário
pnpm docker:up          # garante que os containers estão rodando
pnpm dev                # inicia a API

# Após alterar o schema.prisma
pnpm prisma:migrate     # cria a migration
pnpm prisma:generate    # regenera o cliente (opcional — migrate já faz isso)

# Antes de fazer PR
pnpm typecheck          # zero erros TypeScript
pnpm lint               # zero warnings de lint
pnpm test               # todos os testes passando
```

---

## Novo desenvolvedor no time

```bash
git clone <url-do-repo> && cd ledger
pnpm install
pnpm env:setup
# Edite .env: preencha RESEND_API_KEY e EMAIL_FROM
pnpm docker:up
pnpm prisma:migrate
pnpm dev
```

> API rodando em **http://localhost:3000**
