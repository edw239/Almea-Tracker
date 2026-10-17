# Almea Tracker — контур поручения (ЛС)

| Поле | Значение |
| ---- | -------- |
| **Продукт** | Замкнутый цикл «постановка → исполнение → приёмка → обзор» |
| **Метрика 3 мес.** | Доля поручений недели до приёмки без ручного напоминания |
| **Дата** | 2026-08-27 |
| **Статус** | П-Люди…П-Ритм **done**. ЛС закрыт; очередь: import → polish → Phase C |

Связано: [USER_FLOWS.md](./USER_FLOWS.md) §9–12, [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md), [PERSONAL_CABINET_PLAN.md](./PERSONAL_CABINET_PLAN.md).

**ЛС** = продуктовая линия «контур поручения» (фазы **П-***). Не путать с ЛК (личный кабинет, done) и не с Phase C automations.

---

## Рамка

1. Контур — ядро продукта. Приёмку не делать через automations.
2. Порядок жёсткий: люди → домен → ввод → контур → обзор → ритм.
3. Уже есть: `createdByUserId` (ЛК-4), `/me/summary`, quiet hours, dual status, templates + **schedules/cron (П-Ритм)**, **реестр host-сущностей (П-Домен)**, **заведение людей (П-Люди)**.
4. Вне scope v1: SMTP, email, ERP-sync, внешние участники, time tracking.
5. UI типов сущностей v1: только **brand**. `batch|deal|project` — в enum, в UI не светятся.

---

## Сводка фаз и миграций

| Фаза | Миграция | Статус |
| ---- | -------- | ------ |
| **П-Люди** | `20260818220000_p_people_provisioning` | **done** |
| **П-Домен** | `20260818230000_p_host_entity_registry` | **done** |
| **П-Ввод** | — | **done** |
| **П-Контур** | `20260819010000_p_review_code` + `20260819020000_p_review_loop` | **done** |
| **П-Обзор** | `20260819030000_p_overview_indexes` | **done** |
| **П-Ритм** | `20260819040000_p_task_schedules` | **done** |

```
П-Люди ──► П-Домен ──► П-Ввод ──► П-Контур ──► П-Обзор ──► П-Ритм ──► Phase C
```

| Правило | Почему |
| ------- | ------ |
| П-Люди первой | Без второго пользователя коллаборация непроверяема |
| П-Домен раньше П-Ввод | Привязка к сущности живёт внутри ряда ввода |
| П-Контур после П-Ввод | Приёмка требует исполнителя и срока |
| П-Обзор после П-Контур | Блок «ждёт приёмки» |
| Phase C последней | Automations — правила поверх контура, не его замена |

---

## Phase П-Люди — заведение сотрудников — **done**

**Done-критерий:** админ создаёт сотрудника с одноразовым паролем; тот входит, обязан сменить пароль и сразу видит свои задачи; деактивированный не входит и не предлагается в исполнители.

### Миграция `p_people_provisioning`

```sql
ALTER TABLE "users"
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "created_by_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX "users_is_active_idx" ON "users"("is_active");
```

### API

| Method | Path | Доступ | Назначение |
| ------ | ---- | ------ | ---------- |
| POST | `/api/users` | `GLOBAL_ADMIN` | `email`, `name`, `role`, `jobTitle?` → одноразовый пароль **один раз в ответе** |
| PATCH | `/api/users/:id` | `GLOBAL_ADMIN` | `name`, `role`, `jobTitle`, `isActive` |
| POST | `/api/users/:id/reset-password` | `GLOBAL_ADMIN` | новый одноразовый пароль |

`GET /api/users` по умолчанию отдаёт только активных: иначе уволенные остаются в списке исполнителей.

### Правила

1. Пароль генерирует сервер (`crypto.randomBytes`, ≥ 12 символов), возвращается ровно один раз, **не пишется в логи и не попадает в activity**.
2. `mustChangePassword = true` при создании и при сбросе. Guard пускает только `GET /me`, `POST /me/password`, `POST /auth/logout`; остальное — 403 с кодом.
3. `POST /me/password` снимает флаг и переиздаёт cookie — механика `passwordChangedAt` из ЛК-0 уже есть.
4. Вход деактивированного → **401 с тем же телом, что неверный пароль**: не раскрываем существование учётной записи.
5. Email нормализуется в lower; дубль → 409.

### Тесты

- не-админ на `POST /users` → 403; дубль email → 409
- до смены пароля задачи недоступны, после — доступны
- деактивированный не входит и не появляется в `GET /users`
- одноразовый пароль отсутствует в выводе логгера (spy)
- e2e: создать → войти → сменить пароль → `GET /tasks` 200

### Реализовано

- [x] Миграция `20260818220000_p_people_provisioning`
- [x] `POST/PATCH /users`, `POST /users/:id/reset-password`, `GET /users` только активные
- [x] Guard `MUST_CHANGE_PASSWORD` (кроме `/me`, `/me/password`, `/auth/me`, `/auth/logout`)
- [x] UI `#/people` + `#/change-password`

---

## Phase П-Домен — реестр сущностей — **done**

**Done-критерий:** бренд выбирается из справочника с поиском, два бренда с одним именем создать нельзя, карточка бренда показывает только доступные актору задачи, `brand` — единственный тип в UI.

### Миграция `p_host_entity_registry`

```sql
CREATE TABLE "host_entities" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_type"  VARCHAR(40)  NOT NULL,
  "name"         VARCHAR(200) NOT NULL,
  "name_key"     VARCHAR(200) NOT NULL,   -- lower(trim(name)), нормализация в приложении
  "external_key" VARCHAR(100),            -- будущий id из 1С; сейчас NULL
  "is_archived"  BOOLEAN NOT NULL DEFAULT false,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "host_entities_type_name_key_key" UNIQUE ("entity_type", "name_key")
);

CREATE INDEX "host_entities_entity_type_is_archived_idx"
  ON "host_entities"("entity_type", "is_archived");

ALTER TABLE "tasks"
  ADD COLUMN "host_entity_id" UUID REFERENCES "host_entities"("id") ON DELETE SET NULL;
CREATE INDEX "tasks_host_entity_id_idx" ON "tasks"("host_entity_id");

ALTER TABLE "task_lists"
  ADD COLUMN "host_entity_id" UUID REFERENCES "host_entities"("id") ON DELETE SET NULL;
```

Бэкфилл — в той же миграции, детерминированный (в отличие от ЛК-4, здесь источник однозначен: пары `domain_entity_type` + `domain_label`):

```sql
INSERT INTO "host_entities" ("entity_type", "name", "name_key", "updated_at")
SELECT DISTINCT t."domain_entity_type",
       COALESCE(t."domain_label", t."domain_entity_id"),
       lower(trim(COALESCE(t."domain_label", t."domain_entity_id"))),
       CURRENT_TIMESTAMP
FROM "tasks" t
WHERE t."domain_entity_type" IS NOT NULL
  AND t."domain_entity_id" IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE "tasks" t
SET "host_entity_id" = h."id"
FROM "host_entities" h
WHERE h."entity_type" = t."domain_entity_type"
  AND h."name_key" = lower(trim(COALESCE(t."domain_label", t."domain_entity_id")));
```

Колонки `domain_entity_id` / `domain_entity_type` / `domain_label` живут ещё один релиз для совместимости `GET /host/entities/:type/:id`, удаляются отдельной миграцией.

### API

| Method | Path | Назначение |
| ------ | ---- | ---------- |
| GET | `/api/host-entities?type=brand&query=&includeArchived=false` | поиск по `name_key`, лимит страницы |
| POST | `/api/host-entities` | `entityType`, `name`; дубль по `name_key` → 409 |
| PATCH | `/api/host-entities/:id` | переименование, архивирование |
| GET | `/api/host-entities/:id` | карточка: сущность + задачи через `TaskAccessService` |

`ensureEntityList` переводится на `host_entity_id`. Константа `HOST_ENTITY_TYPES_VISIBLE = ['brand']`: остальные типы валидны в API, но не отдаются в справочник UI — тот же принцип, что с нереализованными триггерами автоматизаций.

### Тесты

- `«XLASH»`, `« xlash »`, `«xlash»` — одна сущность (нормализация `name_key`)
- карточка не возвращает недоступные задачи (инвариант 404)
- бэкфилл идемпотентен: на пустой базе, на сид-данных, при повторном прогоне
- UI-справочник отдаёт только `brand`

---

## Phase П-Ввод — быстрый ввод и обязательные поля — **done**

**Миграция:** нет. Признак «поручение» выводится из данных (`assignees` содержит кого-то, кроме владельца), новых колонок это не требует.

**Done-критерий:** поручение другому нельзя создать без срока; задача создаётся из одного ряда за один проход без открытия карточки; на «Входящих» виден счётчик неразобранных.

### Валидация на границе

| Условие | Ответ |
| ------- | ----- |
| В `assigneeIds` есть кто-то, кроме актора, и `dueDate` не задан | 400, код `TASK_DELEGATION_REQUIRES_DUE_DATE` |
| Личная задача (`assignees ⊆ {actor}`) без срока | разрешено — это идея во «Входящих» |
| `hostEntityId` не найден или архивный | 400 |

### Скоуп и UI

`GET /api/tasks?scope=untriaged` — personal-inbox актора без исполнителя и без срока; используется счётчиком и обзором владельца.

Ряд ввода: заголовок → исполнитель → срок → бренд, переходы по Tab, `Enter` создаёт, `Esc` отменяет. Описание открывается в фокусе после создания, но **не блокирует** — иначе ввод не укладывается в 10 секунд, а ассистента, который разберёт позже, в компании нет.

### Тесты

- поручение без срока → 400 с кодом; личная без срока → 201
- ряд ввода создаёт задачу со всеми четырьмя полями одним запросом
- `scope=untriaged` покрыт unit-тестом `where`

---

## Phase П-Контур — сдача и приёмка — **done**

**Done-критерий:** исполнитель не может закрыть задачу с приёмкой; постановщик получает уведомление о сдаче и принимает или возвращает; canonical-статус при «На проверке» = `IN_PROGRESS`.

### Миграции

Две, и это не дробление ради дробления: Postgres не даёт использовать новое значение enum в той же транзакции, где оно добавлено, а Prisma выполняет миграцию транзакционно.

```sql
-- p_review_code
ALTER TYPE "NotificationCode" ADD VALUE 'TASK_REVIEW_REQUESTED';
```

```sql
-- p_review_loop
ALTER TABLE "tasks"
  ADD COLUMN "review_required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "submitted_at" TIMESTAMP(3);

CREATE INDEX "tasks_review_required_status_idx"
  ON "tasks"("review_required", "status");
```

Статус «На проверке» добавляется идемпотентным сидом: `category = IN_PROGRESS`, порядок `К выполнению 0 → В работе 1 → На проверке 2 → Готово 3 → Отменено 4`. Для существующих списков порядок «Готово» и «Отменено» сдвигается в той же транзакции.

### Правила

1. `review_required` проставляет **сервер**: `true`, если в исполнителях есть кто-то, кроме актора. Клиент может передать `false` явно (снятая галочка).
2. Исполнитель при `review_required = true` двигает задачу максимум до «На проверке» (`submitted_at = now`); попытка `DONE` → 403 с кодом. Расширение `ASSIGNEE_ONLY_FIELDS`, не отмена его.
3. Закрыть может `created_by_user_id` или manage: `DONE` + `completed_at`. Возврат сбрасывает `submitted_at`, пишет activity `REVIEW_REJECTED` с причиной.
4. Уведомление `TASK_REVIEW_REQUESTED` (severity `MEDIUM`) постановщику, `dedupKey` от `(taskId, submittedAt)`.
5. `GET /api/tasks?scope=review` — «ждёт моей приёмки».

### Тесты

- исполнитель → `DONE` при приёмке = 403; → «На проверке» = 200
- постановщик получает ровно одно уведомление на одну сдачу
- возврат пишет activity и не теряет `dueDate`
- dual status: «На проверке» ⇒ `status = IN_PROGRESS`, `completed_at IS NULL`
- `scope=review` unit-тест `where`

---

## Phase П-Обзор — экран владельца — **done**

**Done-критерий:** пять блоков «что горит» в таймзоне профиля; ни один блок не показывает недоступные актору задачи; клиентский подсчёт бакетов из `HomePages` / `AppShell` удалён.

### Миграция `p_overview_indexes`

```sql
CREATE INDEX "tasks_status_updated_at_idx"
  ON "tasks"("status", "updated_at")
  WHERE "deleted_at" IS NULL;
```

### API `GET /api/overview`

| Блок | Определение |
| ---- | ----------- |
| `unassigned` | без исполнителей, не `DONE`/`CANCELLED`, создана > 24 ч назад |
| `stale` | `updated_at` старше **3 рабочих дней**, статус `OPEN`/`IN_PROGRESS`, без активного блокера |
| `blocked` | есть входящая связь `BLOCKS` от незакрытой задачи |
| `awaitingReview` | `review_required = true` и `submitted_at IS NOT NULL` |
| `overdueByUser` | просроченные, сгруппированные по исполнителю |

ACL: по умолчанию — только видимые актору задачи; полный срез по компании — `GLOBAL_ADMIN` или `OWNER` общего Space. Инвариант «невидимое = 404» не обходится агрегатом.

Утилита `businessDaysAgo(now, days, timezone)` — чистая функция, без обращений к БД.

### Тесты

- фиксированный `now`, пятница и суббота: 3 рабочих дня не превращаются в 3 календарных
- две таймзоны (UTC и профильная) дают разные границы «сегодня»
- обычный member не видит в агрегате чужие задачи
- сайдбар читает `GET /me/summary`, а не считает локально

---

## Phase П-Ритм — расписание и планировщик — **done**

**Done-критерий:** регулярная задача появляется без участия человека и не дублируется при рестарте; просрочка доходит до того, кто в продукт не заходил.

### Миграция `20260819040000_p_task_schedules`

```sql
CREATE TYPE "ScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

CREATE TABLE "task_schedules" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "list_id"          UUID NOT NULL REFERENCES "task_lists"("id") ON DELETE CASCADE,
  "template_id"      UUID REFERENCES "task_templates"("id") ON DELETE SET NULL,
  "title"            VARCHAR(200) NOT NULL,
  "frequency"        "ScheduleFrequency" NOT NULL,
  "by_weekday"       SMALLINT,          -- 1..7 для WEEKLY
  "by_monthday"      SMALLINT,          -- 1..28 для MONTHLY
  "at_minute"        INTEGER NOT NULL,  -- 0..1439 в timezone расписания
  "timezone"         TEXT NOT NULL,
  "assignee_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "due_in_days"      INTEGER,
  "is_active"        BOOLEAN NOT NULL DEFAULT true,
  "next_run_at"      TIMESTAMP(3) NOT NULL,
  "last_run_at"      TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL
);

CREATE INDEX "task_schedules_next_run_at_idx"
  ON "task_schedules"("next_run_at") WHERE "is_active";

CREATE TABLE "task_schedule_runs" (
  "schedule_id" UUID NOT NULL REFERENCES "task_schedules"("id") ON DELETE CASCADE,
  "period_key"  VARCHAR(40) NOT NULL,   -- 2026-08-19 | 2026-W34 | 2026-08
  "task_id"     UUID REFERENCES "tasks"("id") ON DELETE SET NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("schedule_id", "period_key")
);
```

Почему три частоты, а не cron-строка: cron требует парсера и плохо валидируется на границе, а `DAILY` / `WEEKLY` / `MONTHLY` закрывают ежедневный стендап, недельный ops-пакет и месячную процедуру. Расширять — осознанно, а не «на всякий случай».

Идемпотентность — через `PRIMARY KEY (schedule_id, period_key)`: рестарт процесса или второй инстанс не создают вторую задачу за тот же период. Тот же приём, что с `template_key` в playbook.

### Планировщик

| Периодичность | Работа |
| ------------- | ------ |
| 10 минут | due-soon (`DUE_SOON_HOURS`) и overdue **по всем пользователям**, батч 100, dedup дневным bucket |
| 1 минута | расписания с `next_run_at <= now` (TaskReminder v1 не вводим) |

Фильтр настроек и тихих часов — через существующий `TaskNotificationsService.notify()`, единственная точка. `scanDueBuckets` при `GET /inbox` остаётся как fallback, но перестаёт быть единственным путём: сейчас человек, который не заходит, невидим и для себя, и для руководителя.

`SCHEDULER_ENABLED=false` отключает cron (удобно для e2e).

### API

| Method | Path | Доступ | Назначение |
| ------ | ---- | ------ | ---------- |
| GET | `/api/task-lists/:listId/schedules` | visible space | список |
| POST | `/api/task-lists/:listId/schedules` | manage space | создать |
| PATCH | `/api/task-schedules/:id` | manage space | вкл/выкл, сдвиг слота |

### Тесты

- повторный запуск того же периода не создаёт дубль
- просрочка доходит до пользователя, который ни разу не входил
- тихие часы откладывают через `snoozedUntil`, а не глотают уведомление
- переход на летнее время в зоне с DST не сдвигает и не удваивает цикл (актуально не для Дубая, а для будущей продажи)

### Реализовано

- [x] Миграция `20260819040000_p_task_schedules`
- [x] `WorkSchedulerService` (10m due / 1m schedules) + `TaskSchedulesService.runDueSchedules`
- [x] `scanDueBucketsAllUsers` + inbox fallback
- [x] CRUD schedules + UI на ListPage
- [x] unit `schedule-timing` (DST) + e2e idempotency / silent overdue

---

## После ЛС

| Тема | Статус |
| ---- | ------ |
| Phase C automations | queued |
| CSV import (F10) | **next** |
| Флаг «застрял» / счётчик переносов | **done** (28.08, миграции `202608272*`) |
| Browser push / `externalKey` 1С | **done** (ручной ключ на `#/brands`) |
| Email / полный 1С sync | open |

## Сквозной DoD

- Валидация на границе; коды ошибок стабильны
- Невидимое → 404; manage fail → 403
- Пароли и PII не в логах / activity
- Living docs в том же PR
- e2e smoke: admin create → assign → submit review → accept
