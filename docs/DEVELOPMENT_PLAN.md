# Almea Tracker — план разработки

| Поле | Значение |
| ---- | -------- |
| **База** | [task-tracker-principles.md](./task-tracker-principles.md) §17–18 |
| **Продукт** | ClickUp-Light Work Management для Almea |
| **Дата** | 2026-08-17 |
| **Статус** | Saved views UI + Templates done (automations отдельно). Далее — dogfood / Phase C automations |

Порядок фаз проверен на Космонавт: **сжимать можно, переставлять dual-status раньше hierarchy / move — нельзя**.

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

## Phase C — Automations — **next** (templates уже сделаны)

**Содержание:** automation rules + depth guard, UI правил.

**Done-критерий:** минимум `STATUS_CHANGED` с `MAX_AUTOMATION_DEPTH ≤ 3`.

Константа `MAX_AUTOMATION_DEPTH` уже в `api/src/common/constants.ts`; runtime и UI — нет.

---

## Waves 2–4 — ClickUp-level UX

| Волна | Статус | Содержание |
| ----- | ------ | ---------- |
| Status polish | частично | inheritance + `is_default` в seed; UI-редактор колонок — позже |
| Saved views | done | API + list picker / save / delete |
| Filter + cursor | done | API DSL + list filter bar UI |
| Templates | done | create-from-template (без automations) |
| CF + types | open | custom fields, task types |
| Favorites | done | API + sidebar/UI |
| Calendar / timeline | UI-демо | календарь во views; timeline FE-only |
| Due-shift | done (API) | BLOCKS dependent due |
| Inbox | done | notifications snooze/clear + Inbox UI |
| Host entity | done | ensure list + deep-link UI (`host` space) |
| Automations | open | отдельно от templates |

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

1. **Monorepo layout:** оставить `api/` + `web/` или `apps/*`?
2. **Notification delivery:** только in-app inbox или ещё email/push?
3. **Host ACL:** сейчас через space membership; отдельный host RBAC — позже?

Auth для v0 зафиксирован: JWT cookie в этом сервисе. Host types v0: `brand|batch|deal|project`, system space key `host`.
