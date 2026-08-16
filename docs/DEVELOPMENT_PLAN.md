# Almea Tracker — план разработки

| Поле | Значение |
| ---- | -------- |
| **База** | [task-tracker-principles.md](./task-tracker-principles.md) §17–18 |
| **Продукт** | ClickUp-Light Work Management для Almea |
| **Дата** | 2026-08-12 |
| **Статус** | Draft v0 — согласовать перед Phase A |

Порядок фаз проверен на Космонавт: **сжимать можно, переставлять dual-status раньше hierarchy / move — нельзя**.

---

## 0. Подготовка репозитория (сейчас)

**Done-критерий:** есть GitHub-репо, living docs, зафиксированные non-goals и план.

- [x] Репозиторий `Almea-Tracker`
- [x] Порт гайда в `docs/task-tracker-principles.md`
- [x] Этот план
- [x] Дизайн-система v1: [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) (белый/серый/чёрный + лайм)
- [ ] Согласовать стек (NestJS/Prisma vs альтернатива) и auth Almea
- [ ] Зафиксировать Host Plugin: что за `domain_entity_id` (project / deal / …)
- [ ] Язык UI (RU/EN) и seed-названия статусов
- [ ] Ролевая матрица: global admin vs space roles vs assignee-only

**Допущения v0 (явно):**

1. List обязателен всегда; личные задачи → system List `personal-inbox`.
2. Имена сущностей сразу `Task` / `task_*`, без `Event*`.
3. Отдельный модуль `work-management`, не внутри чужого domain module.
4. Prisma schema Phase A+B1 пакетом (hierarchy + position + soft delete).
5. OpenAPI-секция Tasks/Spaces с первого feature-PR.

---

## Phase A — Hierarchy + Task CRUD

**Содержание:** Space / Folder / List / Task, system spaces, sidebar, create-in-list, deep-link из host-карточки.

**Done-критерий:** каждая задача в List; дерево sidebar работает; seed personal space/list.

| Backend | Frontend |
| ------- | -------- |
| Schema: Space, Member, Folder, List, Task | `/tasks` shell: sidebar + list view |
| Seed: `personal` + `personal-inbox`, default statuses | Create-in-list, deep-link `:taskId` |
| Access: Space membership + Task visibility (404) | Detail panel basics (title, status, assignees) |
| Host plugin stub: `ensureEntityList` | |

Не блокировать Core полным Host ACL — подключать параллельно.

---

## Phase B1 — Position + Move + DnD

**Содержание:** fractional `position`, `PATCH move`, DnD list/board/sidebar, quick add.

**Done-критерий:** стабильный DnD с optimistic UI + rollback.

- Utils: mid-point + renumber (`MIN_GAP`)
- Move API в transaction
- Board drop ids: `column-{statusOrListStatusId}`, sidebar `list-drop-{listId}`
- Quick add + detail basics

---

## Phase B2 — Dual status + views basics

**Содержание:** `TaskListStatus`, view prefs, group-by, table.

**Done-критерий:** dual status работает (canonical enum ↔ list columns); кастомные колонки.

- Status seed / inheritance / `is_default`
- View preferences persist
- Table view + group-by

---

## Phase B3 — Collab + dependencies

**Содержание:** relations, activity, bulk, My Work grouping, progress badges.

**Done-критерий:** комментарии/checklist/subtasks/watchers; BLOCKS/RELATES; My Work aggregators.

- Comments + `@mentions`
- Checklist, subtasks, watchers
- Relations + activity audit
- Bulk update; overdue / mine endpoints
- Progress badges on row

---

## Phase C — Templates + Automations

**Содержание:** templates, automation rules + depth guard, UI правил.

**Done-критерий:** create-from-template; минимум `STATUS_CHANGED` rules с `MAX_AUTOMATION_DEPTH ≤ 3`.

---

## Waves 2–4 — ClickUp-level UX

Порядок внутри волны гибкий, но filter/cursor/CF опираются на стабильный list+move.

| Волна | Содержание |
| ----- | ---------- |
| Status polish | Inheritance + `is_default` доводка |
| Saved views | Named views, share/mine |
| Filter + cursor | Filter DSL (depth ≤ 3, ≤ 20 conditions) + cursor pagination |
| CF + types | Custom fields, task types |
| Favorites | User favorites в sidebar |
| Calendar / timeline | После list/board — не блокируют MVP |
| Due-shift | Dependent due shift при BLOCKS |
| Inbox | Notifications snooze/clear |

---

## Definition of Done для ядра (сквозные)

- Access отдельно от CRUD; невидимое = **404**, manage fail = **403**
- Assignee-only whitelist на status/position
- Валидация на границе API (DTO / filter / cursor / CF)
- Тесты utils (position, cursor, filter, CF) и access раньше E2E
- Секреты и лишний PII не в activity/logs
- Non-goals явно в README модуля

---

## Ближайшие решения (нужен input)

1. **Host entity:** project / deal / другое — и system Space key?
2. **Auth:** отдельный сервис Almea или shared с основным Almea-репо?
3. **Monorepo layout:** `apps/api` + `apps/web` vs отдельные репо?
4. **MVP cutoff:** останавливаемся ли на конце B3 или тянем C в первый релиз?

После ответов — переводим Phase A в конкретные issues/milestones.
