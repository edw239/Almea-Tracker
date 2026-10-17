# Almea Tracker API

NestJS + Prisma + PostgreSQL. Модуль `work-management` — ядро. Auth — JWT в httpOnly cookie (`almea_access`); токен в JSON **не** отдаём.

## Запуск

```bash
# из корня репо — нужен запущенный Docker Desktop
docker compose up -d postgres
docker compose ps   # postgres → healthy

cd api
cp .env.example .env
npm install
npx prisma migrate deploy   # или migrate dev при разработке
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
| GET | `/api/auth/me` | текущий пользователь (cookie, лёгкая проба сессии) |
| GET | `/api/users` | список активных (для assignees); `?includeInactive=true` — только GLOBAL_ADMIN |
| POST | `/api/users` | GLOBAL_ADMIN: создать сотрудника, одноразовый пароль **один раз** в ответе (П-Люди) |
| PATCH | `/api/users/:id` | GLOBAL_ADMIN: имя, роль, должность, `isActive` |
| POST | `/api/users/:id/reset-password` | GLOBAL_ADMIN: новый одноразовый пароль, `mustChangePassword` |
| GET | `/api/users/:userId` | карточка коллеги: профиль + видимые задачи; агрегаты только self / GLOBAL_ADMIN / OWNER общего Space (ЛК-4) |
| GET | `/api/me` | профиль + memberships Spaces (ЛК-0) |
| PATCH | `/api/me` | `name`, `timezone`, `locale`, `jobTitle` |
| POST | `/api/me/password` | смена пароля; новый cookie; старые JWT → 401 по `passwordChangedAt` vs `iat` |
| GET/PUT | `/api/me/notification-settings` | in-app toggles по `NotificationCode`, quiet hours, snooze default (ЛК-2) |
| GET | `/api/me/summary` | бакеты overdue/today/week/inProgress/mineOpen/unread в timezone профиля (ЛК-3) |
| GET | `/api/me/buckets` | `?scope=` — задачи по бакетам Просрочено/Сегодня/Позже/Без даты (Polish F3) |
| GET | `/api/me/activity` | `?days=&limit=` — закрыто/комменты/updates + лента (ЛК-3) |

Cookie: httpOnly, SameSite=Lax, path `/`, Secure в `NODE_ENV=production`.

## Модули

| Модуль | Ответственность |
| ------ | --------------- |
| `identity` | login/logout, `/me` profile+password, users, JWT cookie strategy |
| `work-management` | hierarchy, tasks, dual status, move, filter/cursor, views/favorites, collab, notifications, host, templates |
| `prisma` | PrismaClient |

## Основные endpoints

### Spaces / lists

- `GET/POST /api/task-spaces`, `GET /api/task-spaces/:spaceId`
- `POST /api/task-spaces/:spaceId/folders`, `POST /api/task-spaces/:spaceId/lists`
- `GET/POST /api/task-lists/:listId/tasks` (list: filter JSON + cursor)
- `GET /api/task-lists/:listId/statuses`
- `POST /api/task-lists/:listId/statuses`, `PATCH/DELETE /api/task-list-statuses/:id` — редактор колонок
- `GET /api/task-spaces/:spaceId/task-types` — типы задач (автосид `DEFAULT_TASK_TYPES`)

### Tasks

- `GET /api/tasks` — My Work (`?scope=default|assigned|owned|watching|mentions|checklist|created|waiting|untriaged|review`; без scope = default: owner ∪ assignee ∪ watcher)
- `GET /api/tasks/overdue`, `GET /api/tasks/kanban?listId=`
- `GET/PATCH /api/tasks/:taskId`
- `PATCH /api/tasks/:taskId/move`
- `POST/DELETE /api/tasks/:taskId/stuck` — флаг «застрял» + `TASK_STUCK` (body `{ reason }`)
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

События: assignee, comment/mention, status change, review. Планировщик (`SCHEDULER_ENABLED`): каждые 10 мин — due/overdue по активным пользователям (батч 100); inbox `scanDueBuckets` остаётся fallback.

### Schedules (П-Ритм)

- `GET/POST /api/task-lists/:listId/schedules` — `DAILY|WEEKLY|MONTHLY`, `atMinute` 0..1439, IANA timezone
- `PATCH /api/task-schedules/:id` — вкл/выкл, сдвиг слота
- Идемпотентность: `task_schedule_runs (schedule_id, period_key)`; cron раз в минуту

### Overview

- `GET /api/overview` — шесть блоков владельца (unassigned / stale / blocked / awaitingReview / **rescheduled** / overdueByUser) в timezone профиля; ACL: company для admin/OWNER Space, иначе visible

### Host plugin + registry (П-Домен)

- `GET/POST /api/host-entities` — справочник (`?type=brand&query=&includeArchived=&visibleOnly=`); дубль `name_key` → 409
- `GET/PATCH /api/host-entities/:id` — карточка (задачи через ACL) / rename+archive+**externalKey** (1С, ручной)
- `POST /api/host/entity-lists/ensure` — `{ entityType, entityId, name, spaceId? }` → list + upsert в реестр
- `GET /api/host/entities/:entityType/:entityId` — legacy deep-link; UUID brand → тот же bundle, что карточка

Типы: `brand|batch|deal|project`. В UI v1 только `brand` (`HOST_ENTITY_TYPES_VISIBLE`). System space: `host`. На задаче: `hostEntityId` + denormalized `domainEntity*`.

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

`items` валидируются на границе (zod). Automations — Phase C, не в этом релизе.

### CSV import — **planned** (F10)

Backlog после ЛС. См. [USER_FLOWS.md §10](../docs/USER_FLOWS.md#10-очередь-разработки-после-лс).

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
