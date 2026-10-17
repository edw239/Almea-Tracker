# Almea Tracker — личный кабинет сотрудника

| Поле | Значение |
| ---- | -------- |
| **Продукт** | Агрегатор «про меня» + настройки, не новая доменная сущность |
| **Маршрут** | `#/me` (табы через `?tab=`, не вложенные пути) |
| **Дата** | 2026-08-27 |
| **Статус** | ЛК-0…ЛК-4 done |

Связано: [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md), [task-tracker-principles.md](./task-tracker-principles.md) §5.6.

---

## Рамка

1. Задачи не переезжают в кабинет. `TaskViewPreference` — источник правды по видам списков.
2. «Про меня» фильтруется только по `userId` из JWT (никогда из query) — иначе обход «невидимое → 404».
3. Один маршрут `#/me`: в `AppShell` `key={location.pathname}` — вложенные `/me/security` ремонтируют main.
4. `DEFAULT_TIMEZONE = Asia/Dubai` (UTC+4) в `api/src/common/constants.ts`.
5. Карточка коллеги (ЛК-4) — отдельный эндпоинт с ACL; не переиспользовать `scope` «моё».

**Вне scope:** time tracking, KPI/OKR, файлы-аватары, email/push (открытое решение), 2FA/SSO (Almea IdP).

---

## Сводка фаз и миграций

| Фаза | Миграция Prisma | DDL (суть) | Статус |
| ---- | --------------- | ---------- | ------ |
| **ЛК-0** | `20260818120000_lk0_user_profile` | `users`: `timezone`, `locale`, `job_title`, `password_changed_at` | **done** (код + DB) |
| **ЛК-1** | — | нет | **done** |
| **ЛК-2** | `20260818180000_lk2_notification_settings` | `user_notification_settings` + `users.quiet_*` / `snooze_hours_default` | **done** |
| **ЛК-3** | `20260818190000_lk3_activity_user_index` | индекс `task_activities(user_id, created_at)` | **done** |
| **ЛК-4** | `20260818200000_lk4_task_created_by` | `tasks.created_by_user_id` + FK + индекс | **done** (код + DB) |

### Порядок и зависимости

```
ЛК-0 ──┬──► ЛК-1 ──► ЛК-4
       ├──► ЛК-2
       └──► ЛК-3
```

| Правило | Почему |
| ------- | ------ |
| ЛК-0 первым всегда | таймзона, пароль, профиль |
| ЛК-2 ∥ ЛК-3 после ЛК-0 | тихие часы / бакеты нуждаются в timezone |
| ЛК-4 после ЛК-1 | сначала развязка «мои скоупы» vs ACL чужих |
| Нельзя ЛК-2/3 до ЛК-0 | quiet hours и summary без IANA zone бессмысленны |

---

## Phase ЛК-0 — профиль и безопасность — **done**

**Done-критерий:** смена имени / таймзоны / пароля; старые cookie → 401; «Доступы» = Spaces с ролью.

### Миграция `20260818120000_lk0_user_profile`

```sql
ALTER TABLE "users"
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Dubai',
  ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'ru',
  ADD COLUMN "job_title" TEXT,
  ADD COLUMN "password_changed_at" TIMESTAMP(3);
```

Prisma: `User.timezone`, `locale`, `jobTitle?`, `passwordChangedAt?`.

### API

| Method | Path | Назначение |
| ------ | ---- | ---------- |
| GET | `/api/me` | профиль + memberships |
| PATCH | `/api/me` | `name`, `timezone`, `locale`, `jobTitle?` |
| POST | `/api/me/password` | смена пароля → новый cookie |

`GET /api/auth/me` — лёгкая проба сессии (без memberships).

### Сессии

`passwordChangedAt` floored to second; в `JwtStrategy.validate`: `payload.iat < floor(passwordChangedAt/1000)` → 401. Сразу выдаём новый JWT. Rate limit: in-memory 5 / 15 мин по `userId`.

### UI

`#/me?tab=profile|access|security`. User-chip → `/me`.

---

## Phase ЛК-1 — скоупы «моё» — **done**

**Миграция:** нет.

**Done-критерий:** `GET /api/tasks?scope=` отдаёт пять скоупов; My Work без двойного клиентского фильтра; watcher только через `scope=watching`; principles §5.6 обновлены.

### API

| Query | Where |
| ----- | ----- |
| _(пусто)_ / `default` | `owner OR assignee OR watcher` |
| `assigned` | assignee |
| `owned` | owner |
| `watching` | `TaskWatcher` |
| `mentions` | `TaskNotification` code=`TASK_MENTION` |
| `checklist` | `ChecklistItem.assigneeUserId` |

Неизвестный `scope` → **400**. Субъект всегда из JWT.

### UI / клиент

- Seg на My Work или вкладка «Задачи» в `#/me`: Все / Исполнитель / Владелец / Наблюдаю / Упоминания / Чеклист.
- Убрать `isAssignedTo`-only фильтр на My Work; общий хелпер бакетов (`bucketMyWorkTasks`).
- Copy: «исполнитель или владелец», не только исполнитель.

### Principles

§5.6: дефолтный My Work = owner ∪ assignee ∪ watcher (с 27.08.2026; ранее ЛК-1 — без watcher); `scope=watching` — только наблюдаемые.

---

## Phase ЛК-2 — настройки уведомлений — **done**

**Done-критерий:** выключенный код не создаёт in-app запись; тихие часы откладывают через `snoozedUntil`; snooze берёт дефолт из профиля.

### Миграция `lk2_notification_settings`

```sql
-- User prefs
ALTER TABLE "users"
  ADD COLUMN "quiet_hours_from" INTEGER,  -- минуты от полуночи в timezone профиля, 0..1439
  ADD COLUMN "quiet_hours_to" INTEGER,
  ADD COLUMN "snooze_hours_default" INTEGER;

-- Per-code in-app toggles (email column — только когда появится канал доставки)
CREATE TABLE "user_notification_settings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "code" "NotificationCode" NOT NULL,
  "in_app" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_notification_settings_user_id_code_key" UNIQUE ("user_id", "code")
);

CREATE INDEX "user_notification_settings_user_id_idx"
  ON "user_notification_settings"("user_id");
```

CHECK (опционально в app-слое): `quiet_*` null или 0..1439; `snooze_hours_default` null или 1..168.

### API

| Method | Path | Назначение |
| ------ | ---- | ---------- |
| GET | `/api/me/notification-settings` | полный набор кодов + quiet/snooze |
| PUT | `/api/me/notification-settings` | upsert всех кодов в транзакции |

### Runtime

Единственная точка фильтра — `TaskNotificationsService.notify()` (до insert).  
Тихие часы → `snoozedUntil` на конец окна, не drop.  
`snooze()` читает `user.snoozeHoursDefault ?? NOTIFICATION_SNOOZE_HOURS_DEFAULT`.

### UI

`#/me?tab=notifications`: тогглы по `NotificationCode`, тихие часы, дефолт snooze.

**Решено** ([USER_FLOWS §12](./USER_FLOWS.md#12-принятые-решения)): канал — in-app + браузерное уведомление, email позже, колонку `email` в settings не добавлять. Следствие для фазы П-Ритм: раз до отсутствующего человека канала нет, планировщик обязан считать просрочки по **всем** пользователям, а не только по зашедшим.

---

## Phase ЛК-3 — сводка и активность — **done**

**Done-критерий:** сайдбар и кабинет читают одни бакеты из `/me/summary` в timezone профиля; activity feed за N дней без seq scan.

### Миграция `lk3_activity_user_index`

```sql
CREATE INDEX "task_activities_user_id_created_at_idx"
  ON "task_activities"("user_id", "created_at");
```

Сейчас есть только `[taskId, createdAt]` — запрос «что я делал» иначе seq scan.

### API

| Method | Path | Назначение |
| ------ | ---- | ---------- |
| GET | `/api/me/summary` | overdue / today / week / inProgress / unread — SQL + timezone профиля |
| GET | `/api/me/activity?days=7&limit=50` | агрегаты + последние действия |

Тесты с фиксированным `now` и двумя таймзонами (UTC и профильная).

### UI

Блок сводки в `#/me?tab=overview` (или сверху profile); сайдбар-бейджи → summary, не локальный подсчёт по стору.

**Примечание (2026-08-27):** счётчики сайдбара и карточки на `#/` — из `/me/summary`. Группировка списка задач на главной ещё локальная — см. F3 polish в [USER_FLOWS.md §9](./USER_FLOWS.md#9-пробелы-флоу-против-кода).

---

## Phase ЛК-4 — автор задач и коллеги — **done**

**Done-критерий:** новые задачи имеют `createdByUserId`; вкладки «Я поставил» / «Жду от других»; карточка коллеги не обходит 404-инвариант.

### Миграция `lk4_task_created_by`

```sql
ALTER TABLE "tasks"
  ADD COLUMN "created_by_user_id" UUID
  REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tasks_created_by_user_id_idx"
  ON "tasks"("created_by_user_id");
```

Prisma: `Task.createdByUserId` + relation `User.createdTasks`.

**Бэкфилл из `TaskActivity` не делаем** — `null` = «автор неизвестен» для старых строк.  
Заполнять в `createInList` и `from-template`.

### API

| Method | Path | Назначение |
| ------ | ---- | ---------- |
| _(scope)_ | `GET /api/tasks?scope=created` | опционально: созданные мной (после колонки) |
| GET | `/api/users/:userId` | `name`, `role`, `jobTitle`; задачи только через `TaskAccessService` |

Чужие агрегаты нагрузки — только `GLOBAL_ADMIN` или OWNER общего Space.

### UI

Вкладки «Поставил» / «Жду»; клик по аватару → `#/users/:id` (не `#/me`).

---

## Карта эндпоинтов (итог)

| Фаза | Endpoints |
| ---- | --------- |
| 0 | `GET/PATCH /me`, `POST /me/password` |
| 1 | `GET /tasks?scope=` |
| 2 | `GET/PUT /me/notification-settings` |
| 3 | `GET /me/summary`, `GET /me/activity` |
| 4 | `GET /users/:id`, create пишет `createdByUserId` |

---

## Сквозной DoD

- Валидация на границе (DTO / zod / IANA timezone)
- Инвариант 404 / 403
- `/api/me/*` — субъект только из JWT
- PII не в логах
- Тест пути ошибки в каждой фазе
- Living docs в том же PR: этот файл, DEVELOPMENT_PLAN, api/README, web/README

---

## Чеклист реализации

### ЛК-0
- [x] Миграция + Prisma User fields
- [x] `MeController` / `MeService`
- [x] JwtStrategy iat check
- [x] `#/me` UI + user-chip Link
- [x] Unit + e2e (`me.e2e-spec.ts`)

### ЛК-1
- [x] `buildMyWorkWhere` + unit
- [x] `TasksService.myWork(scope)` + controller query
- [x] Frontend: load by scope, seg UI
- [x] Убрать двойной `isAssignedTo` на My Work (`isMyWorkTask`)
- [x] Хелпер бакетов в HomePages / AppShell
- [x] principles §5.6

### ЛК-2
- [x] Миграция settings
- [x] GET/PUT settings + filter в `notify()`
- [x] UI tab notifications

### ЛК-3
- [x] Индекс activity
- [x] summary + activity API
- [x] Сайдбар на summary
- [x] UI `#/me` tab overview

### ЛК-4
- [x] Миграция `created_by_user_id`
- [x] Wire create paths (`createInList`, from-template)
- [x] `scope=created` / `waiting` + UI «Поставил» / «Жду»
- [x] Colleague page + ACL (`GET /api/users/:userId`, `#/users/:id`)
