# Almea Tracker API

NestJS + Prisma + PostgreSQL. Модуль `work-management` — ядро. Auth — JWT в httpOnly cookie (`almea_access`); токен в JSON **не** отдаём.

## Запуск

```bash
# из корня репо
docker compose up -d postgres

cd api
cp .env.example .env
npm install
npx prisma migrate dev
npm run prisma:seed
npm run start:dev
```

| | |
| - | - |
| API | `http://localhost:3001/api` |
| OpenAPI | `http://localhost:3001/api/docs` |
| Postgres | `127.0.0.1:5433` (см. `docker-compose.yml`) |

### Env

| Переменная | Назначение |
| ---------- | ---------- |
| `DATABASE_URL` | Postgres (порт **5433** в локальном compose) |
| `JWT_SECRET` | ≥32 символов |
| `JWT_EXPIRES_IN` | компактно: `8h`, `30m`, `7d` |
| `WEB_ORIGIN` | CORS origins через запятую (`credentials: true`) |
| `SEED_ADMIN_*` | email / password / name для seed |

## Auth

| Method | Path | Поведение |
| ------ | ---- | --------- |
| POST | `/api/auth/login` | `{ user }` + Set-Cookie `almea_access` |
| POST | `/api/auth/logout` | clear cookie |
| GET | `/api/auth/me` | текущий пользователь (cookie) |
| GET | `/api/users` | список пользователей (для assignees) |

Cookie: httpOnly, SameSite=Lax, path `/`, Secure в `NODE_ENV=production`.

## Модули

| Модуль | Ответственность |
| ------ | --------------- |
| `identity` | login/logout/me, users, JWT cookie strategy |
| `work-management` | hierarchy, tasks, dual status, move, filter/cursor, views/favorites, collab, notifications, host, templates |
| `prisma` | PrismaClient |

## Основные endpoints

### Spaces / lists

- `GET/POST /api/task-spaces`, `GET /api/task-spaces/:spaceId`
- `POST /api/task-spaces/:spaceId/folders`, `POST /api/task-spaces/:spaceId/lists`
- `GET/POST /api/task-lists/:listId/tasks` (list: filter JSON + cursor)
- `GET /api/task-lists/:listId/statuses`

### Tasks

- `GET /api/tasks` — My Work
- `GET /api/tasks/overdue`, `GET /api/tasks/kanban?listId=`
- `GET/PATCH /api/tasks/:taskId`
- `PATCH /api/tasks/:taskId/move`
- `PATCH /api/tasks/bulk`

### Collab (`/api/tasks/:taskId/...`)

- comments, checklist, watchers, relations, activity

### Notifications (Inbox)

- `GET /api/notifications` — inbox (+ due/overdue scan, dedup)
- `GET /api/notifications/unread-count`
- `POST /api/notifications/read-all`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/:id/snooze` — body `{ hours? }` (default `NOTIFICATION_SNOOZE_HOURS_DEFAULT`)
- `PATCH /api/notifications/:id/clear`

События: assignee, comment/mention, status change. Отдельного scheduler нет — due buckets при GET.

### Host plugin

- `POST /api/host/entity-lists/ensure` — `{ entityType, entityId, name, spaceId? }` → идемпотентный list (`systemKey` `entity:{type}:{id}`)
- `GET /api/host/entities/:entityType/:entityId` — space/list + tasks bundle

Типы v0: `brand|batch|deal|project`. System space key: `host`. Поля задачи: `domainEntityType`, `domainEntityId`, `domainLabel`.

### Views / favorites

- `GET/PUT /api/task-view-preferences`
- `GET /api/task-lists/:listId/views`
- `POST /api/task-views`, `PATCH/DELETE /api/task-views/:viewId`
- `GET/POST/DELETE /api/user-favorites...`

Personal named view — любой видимый member; `isShared: true` — manage space.

### Templates

- `GET /api/task-lists/:listId/templates` — list + space + global active
- `POST /api/task-templates` — `{ name, items, spaceId?, listId? }`
- `POST /api/task-lists/:listId/tasks/from-template/:templateId` — expand items (title/priority/checklist/subtasks) в transaction

`items` валидируются на границе (zod). Automations — отдельно, не в этом релизе.

## ACL

- Невидимое → **404**, manage fail → **403**
- Assignee-only whitelist: `status`, `listStatusId`, `position`
- Create в `personal-inbox` разрешён обычному пользователю

## Non-goals этого сервиса (v1)

Docs/wiki, Goals/OKR, time tracking, полный ClickUp (Dashboards/Whiteboards/Forms), shared Almea IdP (позже).

## Скрипты

| Команда | |
| ------- | - |
| `npm run start:dev` | watch |
| `npm run build` | `nest build` → `dist/main.js` |
| `npm test` | unit (position, cursor/filter, auth, statuses, notifications, host, views, templates) |
| `npm run test:e2e` | health + smoke (login→create→move→view→template→inbox; нужен `.env` + DB) |
| `npm run prisma:seed` | admin + personal/ops/host + weekly template |
