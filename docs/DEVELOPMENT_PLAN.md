# Almea Tracker — план разработки

| Поле | Значение |
| ---- | -------- |
| **База** | [task-tracker-principles.md](./task-tracker-principles.md) §17–18 |
| **Продуктовый слой** | [USER_FLOWS.md](./USER_FLOWS.md) — персоны, флоу, метрики; §9–10 задают очередь фаз ниже |
| **Продукт** | ClickUp-Light Work Management для Almea |
| **Главная ставка** | Задачи привязаны к брендам / партиям / сделкам — причина ухода компании с прежнего трекера |
| **Дата** | 2026-08-28 |
| **Статус** | Ядро A–B3 + templates + **ЛК-0…ЛК-4 done**. **П-Люди…П-Ритм done** (ЛС). **Polish + Later (часть backlog) done** 28.08.2026. Очередь: **CSV import → Phase C** |

Порядок фаз ядра проверен на Космонавт: **сжимать можно, переставлять dual-status раньше hierarchy / move — нельзя**. Очередь после ЛК построена от контура поручения, а не от набора возможностей ClickUp.

---

## 0. Подготовка репозитория

**Done-критерий:** есть GitHub-репо, living docs, зафиксированные non-goals и план.

- [x] Репозиторий `Almea-Tracker`
- [x] Порт гайда в `docs/task-tracker-principles.md`
- [x] Этот план
- [x] Дизайн-система v1: [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- [x] Стек: NestJS + Prisma + PostgreSQL в `api/`; JWT в httpOnly cookie
- [x] Host Plugin: `domain_entity_id` nullable + `ensureEntityList`
- [x] Язык UI и seed-статусов: RU
- [x] Роли: `GLOBAL_ADMIN` vs space `OWNER|MEMBER|VIEWER` vs assignee-only whitelist

**Допущения v0 (явно):**

1. List обязателен всегда; личные задачи → system List `personal-inbox`.
2. Имена сущностей сразу `Task` / `task_*`, без `Event*`.
3. Отдельный модуль `work-management`.
4. Prisma schema hierarchy + position + soft delete (+ collab/views в phase_b мигра).
5. OpenAPI с первого feature-PR (`/api/docs`).
6. Auth: JWT cookie в этом сервисе; shared Almea IdP — позже.

---

## Phase A — Hierarchy + Task CRUD — **done**

**Содержание:** Space / Folder / List / Task, system spaces, sidebar, create-in-list, deep-link.

| Backend | Frontend |
| ------- | -------- |
| Schema + seed personal/ops | `/` My Work, sidebar tree |
| Access: 404/403 | List view, deep-link `:taskId` |
| Host stub `ensureEntityList` | Login cookie + detail basics |

---

## Phase B1 — Position + Move + DnD — **done**

- [x] Utils: mid-point + renumber (`MIN_GAP`)
- [x] `PATCH /tasks/:id/move` в transaction
- [x] Board drop ids: `column-{listStatusId}`
- [x] Quick add + detail basics
- [x] Personal-inbox create для обычного пользователя

---

## Phase B2 — Dual status + views basics — **done** (API; UI prefs частично)

- [x] Status seed / inheritance / `is_default`
- [x] View preferences persist (`GET/PUT /task-view-preferences`)
- [x] Named views create/list (API)
- [x] Table view + group-by на фронте
- [x] Filter DSL + cursor pagination на `GET .../tasks`
- [x] User favorites API + UI

---

## Phase B3 — Collab + dependencies — **done** (API + карточка)

- [x] Comments + `@[uuid]` mentions
- [x] Checklist, watchers; subtasks через `parentTaskId`
- [x] Relations BLOCKS/RELATES + activity + due-shift для BLOCKS
- [x] Bulk update; overdue / kanban endpoints
- [x] Progress badges по чеклисту в row

### Inbox + Host + Filter UI — **done** (после B3)

- [x] `TaskNotification` + API: list / unread-count / read / read-all / snooze / clear
- [x] События: assignee, comment/mention, status change; due/overdue scan при GET inbox (dedup)
- [x] Inbox UI `#/inbox` на API
- [x] Host: system space `host`, типы `brand|batch|deal|project`, `POST /host/entity-lists/ensure`, `GET /host/entities/:type/:id`
- [x] Карточка → deep-link `#/host/:entityType/:entityId`; страница HostEntity
- [x] Filter bar на list (status / priority / assignee / title) → Filter DSL query
- [x] Тесты: notifications/host (API), `buildListFilters` (web)

### Saved views + Templates — **done** (automations — отдельно)

- [x] Named views: list/create + PATCH/DELETE; personal create без manage; share требует manage
- [x] List UI: выбор вида, сохранить текущий (view/group/filters), удалить
- [x] `TaskTemplate` + `GET .../templates`, `POST /task-templates`, `POST .../tasks/from-template/:id`
- [x] Seed: «Еженедельный ops-пакет»; UI «Создать из шаблона…»
- [x] UX: empty state списка, refresh inbox badge ~60s, clear filters → preference
- [x] E2E smoke: login → create → move → view → template → inbox (`npm run test:e2e`)

---

## Phase ЛК — личный кабинет — **ЛК-0…ЛК-4 done**

План (фазы + миграции): [PERSONAL_CABINET_PLAN.md](./PERSONAL_CABINET_PLAN.md). Маршрут `#/me`.

| Фаза | Миграция | Статус | Содержание |
| ---- | -------- | ------ | ---------- |
| ЛК-0 | `20260818120000_lk0_user_profile` | **done** | Профиль, пароль, доступы, `passwordChangedAt` |
| ЛК-1 | — | **done** | `GET /tasks?scope=`; My Work seg; principles §5.6 |
| ЛК-2 | `20260818180000_lk2_notification_settings` | **done** | Settings + quiet hours + notify filter |
| ЛК-3 | `20260818190000_lk3_activity_user_index` | **done** | Summary + activity index |
| ЛК-4 | `20260818200000_lk4_task_created_by` | **done** | `created_by` + карточка коллеги |

---

## Продуктовая очередь ЛС — П-Люди → П-Ритм — **done**

Полный план (миграции, API, правила, тесты): [ASSIGNMENT_LOOP_PLAN.md](./ASSIGNMENT_LOOP_PLAN.md). Основание — [USER_FLOWS.md §9–10](./USER_FLOWS.md#9-пробелы-флоу-против-кода).

| Порядок | Фаза | Миграция | Статус | Содержание |
| ------- | ---- | -------- | ------ | ---------- |
| 1 | П-Люди | `20260818220000_p_people_provisioning` | **done** | admin create, one-time password, deactivate |
| 2 | П-Домен | `20260818230000_p_host_entity_registry` | **done** | реестр brand + FK `host_entity_id` |
| 3 | П-Ввод | — | **done** | ряд ввода; due обязателен при делегировании |
| 4 | П-Контур | `20260819010000` + `20260819020000` | **done** | `review_required`, сдача/приёмка |
| 5 | П-Обзор | `20260819030000_p_overview_indexes` | **done** | экран владельца, 6 блоков (с `rescheduled`) |
| 6 | П-Ритм | `20260819040000_p_task_schedules` | **done** | расписания + global due planner |
| 7 | Phase C | — | queued | automations после контура |

```
П-Люди ──► П-Домен ──► П-Ввод ──► П-Контур ──► П-Обзор ──► П-Ритм ──► Phase C
```

Приёмку через automations **не реализовывать**.

---

### Phase C — Automations — **queued**

**Содержание:** automation rules + depth guard, UI правил.

**Done-критерий:** минимум `STATUS_CHANGED` с `MAX_AUTOMATION_DEPTH ≤ 3`. Константа уже в `api/src/common/constants.ts`; runtime и UI — нет.

---

## Backlog после ЛС — **planned**

| Порядок | Тема | Флоу | Статус | Содержание |
| ------- | ---- | ---- | ------ | ---------- |
| 1 | **CSV import** | F10 | **next** | Загрузка CSV, маппинг колонок (title, assignee, due, list), отчёт ошибок, dry-run |
| 2 | **Polish** | F3, Wave 2–4 | **done** (28.08) | Server-side My Work buckets; UI-редактор статусов; calendar month nav; task types (без CF) |
| 3 | **Phase C** | — | queued | Automations (см. выше) |
| 4 | **Позже** | F7, F9, F8 | **частично done** | «Застрял», счётчик переносов, browser push, `externalKey` 1С — **done**; email/push, полный 1С sync — open |

Миграции polish/later: `20260827210000_polish_later_stuck_moves`, `20260827211000_task_types`.

Подробнее — [USER_FLOWS.md §9–10](./USER_FLOWS.md#9-пробелы-флоу-против-кода).

---

## Waves 2–4 — ClickUp-level UX

| Волна | Статус | Содержание |
| ----- | ------ | ---------- |
| Status polish | **done** (28.08) | inheritance + seed; UI-редактор колонок на ListPage |
| Saved views | done | API + list picker / save / delete |
| Filter + cursor | done | API DSL + list filter bar UI |
| Templates | done | create-from-template (без automations) |
| CF + types | **частично** | task types (API + карточка); custom fields — open |
| Favorites | done | API + sidebar/UI |
| Calendar / timeline | **частично** | календарь: навигация по месяцам; timeline FE-only |
| Due-shift | done (API) | BLOCKS dependent due |
| Inbox | done | notifications snooze/clear + Inbox UI |
| Host entity | done | реестр `host_entities` + UI `#/brands`; ensure list + deep-link |
| Automations | open | отдельно от templates, после П-Ритм |
| Приёмка | done | `review_required` + «На проверке» + `TASK_REVIEW_REQUESTED` |
| Регулярка | **done** | П-Ритм: `task_schedules` + планировщик |

---

## Definition of Done для ядра (сквозные)

- Access отдельно от CRUD; невидимое = **404**, manage fail = **403**
- Assignee-only whitelist на status/position
- Валидация на границе API (DTO / filter / cursor)
- Тесты utils (position, cursor, filter) раньше E2E
- Секреты и лишний PII не в activity/logs
- Non-goals явно в README модуля
- Living docs синхронизированы со статусом (этот файл + корневой README)

---

## Открытые продуктовые решения

Продуктовые решения приняты — [USER_FLOWS.md §12](./USER_FLOWS.md#12-принятые-решения). Инженерные:

1. ~~**Monorepo layout:** оставить `api/` + `web/` или `apps/*`?~~ Решено 27.08.2026: **оставить `api/` + `web/`**. Два deployable, без `packages/*` и workspace-tooling; `apps/*` — при появлении третьего приложения или shared-пакета (OpenAPI client, общие типы).
2. ~~**Notification delivery:** только in-app inbox или ещё email/push?~~ Решено: in-app + браузерное уведомление, email позже — колонку `email` в ЛК-2 не добавляем ([USER_FLOWS §12](./USER_FLOWS.md#12-принятые-решения))
3. ~~**Host ACL:** сейчас через space membership; отдельный host RBAC — позже?~~ Решено 27.08.2026: **v1 — только space membership** (`TaskSpaceAccessService` + task-level assignee/watcher/owner + `GLOBAL_ADMIN`). Реестр брендов (`GET /host-entities`) — общий справочник; фильтрация на карточке — по видимости задач через Space. Отдельный host RBAC — extension point Host Plugin; триггер: `batch`/`deal`/`project` в UI или сегментация «по бренду, не по Space» ([principles §1.2, §2.1](./task-tracker-principles.md)).
4. ~~**My Work vs watcher:** principles §5.6 включают watcher; код — нет. ЛК-1 фиксирует: дефолт без watcher, отдельный `scope=watching`.~~ Решено 27.08.2026: **watcher входит в дефолтный My Work** (`owner ∪ assignee ∪ watcher`); `scope=watching` — узкий фильтр «только наблюдаю» ([principles §5.6](./task-tracker-principles.md)).

Auth для v0 зафиксирован: JWT cookie в этом сервисе. Host types в enum — `brand|batch|deal|project`, system space key `host`; **в UI v1 показывается только `brand`** (решение USER_FLOWS §12, п. 9).
