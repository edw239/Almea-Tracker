# Almea Tracker — web

React UI для Work Management. Данные — из Nest API (cookie-сессия).

## Запуск

```bash
# API (отдельный терминал) — см. api/README.md
# Docker Desktop должен быть запущен
docker compose up -d postgres   # из корня репо → localhost:5433
cd api && npx prisma migrate deploy && npm run start:dev

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
- Личный кабинет `#/me`: сводка, профиль, доступы, уведомления, смена пароля
- Админ `#/people`: заведение сотрудников, одноразовый пароль, деактивация
- Первый вход: `#/change-password` при `mustChangePassword`
- Sidebar + My Work: скоупы `?scope=`, счётчики из `GET /me/summary`, **бакеты** из `GET /me/buckets`
- QuickAdd на `#/`: title / assignee / due / brand
- List / board: задачи, статусы, move/status, filter bar, saved views, create from template, **расписания**, **редактор колонок**, **calendar month nav**
- Карточка: title, priority, due, description, assignees, comments, checklist, **приёмка** (review), hostEntity, **тип задачи**, **«Я застрял»**
- Inbox (`#/inbox`): read / snooze / clear / read-all; **browser push** при новых unread (разрешение в браузере)
- Host: `#/brands` (+ **ключ 1С** `externalKey`), `#/host/:entityType/:entityId`, brand picker в TaskPanel
- Обзор владельца: `#/overview` (incl. **rescheduled**)
- Коллега: `#/users/:id`
- Favorites через API

## Backlog (UI)

- CSV import (F10) — нет
- Custom fields — нет
- Timeline view polish — open
- Automations UI — Phase C
- Email push — только in-app + browser notification

## Скрипты

| Команда | Назначение |
| ------- | ---------- |
| `npm run dev` | Vite HMR |
| `npm run build` | `tsc -b` + production bundle |
| `npm run test` | Vitest (mechanics, filters, my-work) |
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

Дизайн: [docs/DESIGN_SYSTEM.md](../docs/DESIGN_SYSTEM.md) (v2 — правила Cosmonavt + палитра Almea).

## UI-кит

Стек: Tailwind v4 + Radix (подход shadcn) + Phosphor (обёртки в `lib/icons.ts`) + sonner.

| Слой | Путь |
| ---- | ---- |
| Токены / motion | `src/index.css` |
| Legacy-совместимость форм | `src/legacy-compat.css` (`@layer legacy`) |
| Примитивы | `src/components/ui/*` |
| Каркас | `src/components/layout/*` (Sidebar, TopBar, GlobalSearch, NotificationInbox, UserMenu) |
| Page chrome | `PageHeader`, `PageToolbar`, `EmptyState`, `LoadErrorNotice` |
| Confirm / toast | `hooks/useConfirm.tsx`, `lib/toast-bridge.ts` |
| Contract-тесты | `lib/ds-contract.spec.ts` |

Сайдбар: pin, idle-collapse 30s, resize, loupe. Поиск: Ctrl/⌘K по данным store.

## Render

Static: https://almea-track.onrender.com — при билде нужен `VITE_API_URL` на API.  
API: https://almea-tracker-api.onrender.com — CORS `WEB_ORIGIN` = origin static site.
