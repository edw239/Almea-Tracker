# Almea Tracker

ClickUp-Light **Work Management** для Almea: Spaces → Folders → Lists → Tasks, dual status, views, collab.

Продуктовый каркас — [docs/task-tracker-principles.md](docs/task-tracker-principles.md). Host domain — плагин, не ветка дерева.

## Документация

| Документ | Назначение |
| -------- | ---------- |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Визуальный контракт |
| [docs/task-tracker-principles.md](docs/task-tracker-principles.md) | Модель, dual status, ACL, API, фазы (портабельный гайд) |
| [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) | Статус Almea Tracker по фазам |
| [api/README.md](api/README.md) | Backend: env, auth cookie, endpoints |
| [web/README.md](web/README.md) | Frontend: env, proxy, data layer |

## Стек

| Слой | Выбор |
| ---- | ----- |
| Backend | NestJS + Prisma + PostgreSQL (`api/`) |
| Frontend | React + TypeScript (`web/`) |
| API contract | OpenAPI (`/api/docs`) |
| Auth | JWT в httpOnly cookie `almea_access` (не Bearer в JSON) |

## Статус (2026-08-17)

| Слой | Готово | Ещё нет |
| ---- | ------ | ------- |
| Backend | Phase A–B3 + inbox/host/filters + named views CRUD + templates/from-template | Automations, email/push, CF/types |
| Frontend | Логин, sidebar, My Work, lists/board + filters + saved views, templates, карточка, Inbox, Host deep-link | Automations UI, shared Almea auth |

## API

PostgreSQL в Docker на **5433** (на Windows часто занят системный 5432). URL — в `api/.env.example`.

```bash
docker compose up -d postgres
cd api
cp .env.example .env   # JWT_SECRET (≥32), SEED_ADMIN_PASSWORD (≥8)
npm install
npx prisma migrate dev
npm run prisma:seed
npm run start:dev
```

- API: `http://localhost:3001/api`
- OpenAPI: `http://localhost:3001/api/docs`
- Seed-логин: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (по умолчанию `ceo@almea.local` / `change-me`)
- Cookie: `almea_access`, httpOnly, SameSite=Lax, Secure только в production

Подробнее — [api/README.md](api/README.md).

## Web

```bash
cd web
cp .env.example .env   # VITE_API_URL=http://localhost:3001 или пусто + Vite proxy
npm install
npm run dev
```

Откроется `http://localhost:5173`, вход `#/login`. Маршруты через HashRouter (`#/lists/...`) — удобно для статического деплоя.

Подробнее — [web/README.md](web/README.md).
