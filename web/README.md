# Almea Tracker — web

React UI для Work Management. Данные — из Nest API (cookie-сессия).

## Запуск

```bash
# API (отдельный терминал) — см. api/README.md
docker compose up -d postgres   # из корня репо
cd api && npm run start:dev

# Web
cd web
cp .env.example .env
npm install
npm run dev
```

Откроется `http://localhost:5173`. Вход: `#/login` — `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` из `api/.env`.

### Env

| Переменная | Назначение |
| ---------- | ---------- |
| `VITE_API_URL` | База API. Пусто → same-origin; Vite proxy `/api` → `localhost:3001` |
| `VITE_USE_MOCK=1` | Пустой mock-репозиторий без сети (только оболочка) |

## Что подключено к API

- Auth: login / logout / me (httpOnly cookie)
- Sidebar spaces/lists, My Work, overdue
- List / board: задачи, статусы, quick add, move/status, **filter bar**, **saved views**, **create from template**
- Карточка: title, priority, due, description, assignees, comments, checklist; host deep-link при `domainEntity*`
- Inbox (`#/inbox`): read / snooze / clear / read-all (badge в сайдбаре обновляется ~60s)
- Host (`#/host/:entityType/:entityId`): ensure list + задачи сущности
- Favorites через API

## Ещё заглушки

- Automations — отдельно (Phase C remainder)
- Named shared views polish / reorder — позже
- Email/push уведомления — только in-app inbox

## Скрипты

| Команда | Назначение |
| ------- | ---------- |
| `npm run dev` | Vite HMR |
| `npm run build` | `tsc -b` + production bundle |
| `npm run test` | Vitest (mechanics, filters) |
| `npm run lint` | Oxlint |
| `npm run preview` | preview + proxy `/api` |

## Архитектура

| Файл | Роль |
| ---- | ---- |
| `auth.tsx` | сессия, `RequireAuth` |
| `lib/api.ts` | HTTP, `credentials: 'include'`, таймаут 15s |
| `lib/mappers.ts` | API → UI-модель |
| `data/repository.ts` | граница `http \| mock` |
| `store.tsx` | состояние + optimistic status/move с rollback |
| `App.tsx` | `HashRouter` (`#/lists/...`) для статического деплоя |

Дизайн: [docs/DESIGN_SYSTEM.md](../docs/DESIGN_SYSTEM.md).
