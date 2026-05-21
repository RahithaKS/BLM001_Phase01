# LedgerLM

AI-powered financial intelligence platform for multi-tenant enterprise ledger management, document processing, and KPI analysis.

## Run & Operate

- `cd ledgerlm && npm run dev` — run the full app (Express + Vite on port 5000, Python FastAPI on port 8000)
- `cd ledgerlm && npx drizzle-kit push` — push DB schema changes to Neon
- Workflow name: **LedgerLM** (auto-starts)

## Stack

- **Frontend**: React + Vite (served via Express in dev)
- **Backend**: Express (Node 20, TypeScript via tsx)
- **Python backend**: FastAPI + Uvicorn (port 8000, document processing & RAG)
- **DB**: PostgreSQL on Neon (`pgvector` extension enabled) + Drizzle ORM
- **Schema**: `ledgerlm/shared/schema.ts`
- **DB config**: `ledgerlm/drizzle.config.ts`

## Where things live

- App root: `ledgerlm/`
- Server entry: `ledgerlm/server/index.ts`
- React client: `ledgerlm/client/src/`
- Shared schema: `ledgerlm/shared/schema.ts`
- Python backend: `ledgerlm/python_backend/`
- DB connection: `ledgerlm/server/db.ts`

## Architecture decisions

- Uses `NEON_DATABASE_URL` env var (not `DATABASE_URL`, which is reserved by Replit's managed Postgres)
- Python FastAPI backend is started automatically by Express on app boot (unless `DOCKER_ENV=true`)
- All DB migrations run automatically on startup via inline migration functions in `server/index.ts`
- The app is a standalone npm project at `ledgerlm/`, separate from the pnpm workspace

## Default Accounts (seeded)

- **Super Admin**: `customer@ledgerlm.ai` — email OTP login
- **Nemko Admin**: `nemkomatasma@nemko.com` — OTP: `123456`
- **Bosch Admin**: `boschmatasma@in.bosch.com` — OTP: `123456`

## User preferences

- App is cloned from GitHub, not scaffold-generated
- DB is Neon (user-provided), not Replit managed Postgres

## Gotchas

- Always use `NEON_DATABASE_URL` — never `DATABASE_URL` (reserved by Replit)
- Enable `vector` extension on Neon DB before first `drizzle-kit push` (already done)
- Run `npm install --legacy-peer-deps` if `npm install` fails with peer dep conflicts

## Pointers

- See the `pnpm-workspace` skill for the surrounding monorepo structure
