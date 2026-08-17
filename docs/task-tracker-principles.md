# Task Tracker (ClickUp-like) — полный гайд по принципам, модели и разработке

| Поле | Значение |
| ---- | -------- |
| **Источник** | Космонавт ERP (ADR-009, ADR-012, Waves 0–4, реализация 2026-08) |
| **Назначение** | Подробный переносимый гайд для нового проекта / другой компании |
| **Дата** | 2026-08-12 (гайд); статус порта Almea — [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) |
| **Статус** | Living document — портабельный гайд |
| **Связано** | ADR-009, ADR-012, `Implementation Status.md`, `openapi.yaml`; Almea: JWT httpOnly cookie в `api/` |

Документ описывает **как устроен, как работает и как развивать** таск-трекер уровня ClickUp-Light из Космонавт ERP. Его можно использовать как ТЗ/архитектурный каркас ядра Work Management в новом продукте.

---

## Оглавление

1. [Продуктовая рамка и non-goals](#1-продуктовая-рамка-и-non-goals)
2. [Bounded context: Core vs Host Plugin](#2-bounded-context-core-vs-host-plugin)
3. [Каноническая модель данных](#3-каноническая-модель-данных)
4. [Dual status — детальный контракт](#4-dual-status--детальный-контракт)
5. [Права доступа](#5-права-доступа)
6. [Алгоритмы: position, cursor, filters](#6-алгоритмы-position-cursor-filters)
7. [Жизненный цикл задачи](#7-жизненный-цикл-задачи)
8. [Коллаборация](#8-коллаборация)
9. [Views, group-by, favorites](#9-views-group-by-favorites)
10. [Custom fields и Task types](#10-custom-fields-и-task-types)
11. [Templates и Automations](#11-templates-и-automations)
12. [Уведомления и reminders](#12-уведомления-и-reminders)
13. [API-поверхность](#13-api-поверхность)
14. [Backend-архитектура](#14-backend-архитектура)
15. [Frontend-архитектура](#15-frontend-архитектура)
16. [Принципы разработки (чеклист)](#16-принципы-разработки-чеклист)
17. [Фазы внедрения](#17-фазы-внедрения)
18. [Порт в новый проект: чеклист](#18-порт-в-новый-проект-чеклист)
19. [Антипаттерны](#19-антипаттерны)
20. [Карта исходников Космонавт](#20-карта-исходников-космонавт)
21. [Глоссарий](#21-глоссарий)

---

## 1. Продуктовая рамка и non-goals

### 1.1. Что это за продукт

Внутренний **Work Management**: люди ведут работу в списках, видят доски/таблицы/календарь, назначают исполнителей, комментируют, ставят зависимости и напоминания. UX-ориентир — ClickUp, но объём сознательно урезан до **ClickUp-Light / ClickUp-level без Docs/Goals/time tracking**.

В Космонавт модуль живёт на маршруте `/tasks` и логически является Work Management, хотя физически код лежит внутри `EventsModule`, а сущность задачи исторически называется `EventTask`.

### 1.2. Главный продуктовый принцип

> **Контейнерная иерархия отвечает за навигацию и ACL. Домен хост-системы — атрибут или плагин, не ветка дерева.**

Правильно:

```
Space "Операции"
  └── List "Онбординг"
        └── Task "Подписать договор"  (project_id / event_id = атрибут)
```

Неправильно:

```
Space "Проект А"          ← проект как Space ломает My Work и перенос
  └── List "Задачи"
```

Проект/сделка/мероприятие либо:

- **атрибут** задачи (`domain_entity_id`), либо
- **системный List** внутри system Space (`project:{id}`), создаваемый идемпотентным resolver’ом.

### 1.3. Explicit non-goals

Не делаем в ядре (и не обещаем в v1 порта):

| Не делаем | Почему |
| --------- | ------ |
| Docs / wiki на задачах | Отдельный продукт; тянет storage, версии, ACL |
| Goals / OKR | Другой bounded context |
| Time tracking / timers | Отчётность и биллинг — отдельный модуль |
| Полный клон ClickUp (Dashboards, Whiteboards, Forms…) | Scope explosion |
| Замена доменного lifecycle хоста задачами | В Космонавт Event status/readiness остаётся выше задач |
| Обязательная привязка Space к venue/отделу | Ломает универсальность hierarchy |

---

## 2. Bounded context: Core vs Host Plugin

### 2.1. Слои

```
┌──────────────────────────────────────────────────────────────┐
│ Host Domain Plugin (заменяется в каждом продукте)            │
│  · domain_entity_id (event/project/deal)                     │
│  · playbooks / status-entry seeds                            │
│  · domain categories / role→category maps                    │
│  · host RBAC для доменных сущностей                          │
│  · deep-links из карточки сущности                           │
│  · domain-scoped tags (venue и т.п.)                         │
└────────────────────────────▲─────────────────────────────────┘
                             │ hooks / nullable FKs
┌────────────────────────────┴─────────────────────────────────┐
│ Work Management Core (переносить почти целиком)              │
│  Space → Folder → List → Task                                │
│  dual status · views · filters · CF · types · favorites      │
│  assignees · watchers · comments · checklist · subtasks      │
│  relations · reminders · activity · templates · automations  │
│  My Work aggregator · DnD/position · cursor pagination       │
└──────────────────────────────────────────────────────────────┘
```

### 2.2. Что в Core

- Hierarchy + membership
- Task CRUD / move / bulk
- Dual status + inheritance
- Views / prefs / group-by
- Filter DSL + cursor
- Custom fields, task types, favorites
- Collab: assignees, watchers, comments/@mentions, checklist, subtasks, reminders
- Relations `BLOCKS`/`RELATES` + due-shift
- Templates, automations (с depth guard)
- Activity audit
- Notification *типы* для задач (канал доставки — рядом)

### 2.3. Что в Host Plugin (пример Космонавт → замена)

| Космонавт | В новом проекте |
| --------- | --------------- |
| `event_id` на Task/List | `project_id` / `deal_id` / … |
| Space `events` + `ensureEventList` | Space `projects` + `ensureProjectList` |
| `STATUS_ENTRY_PLAYBOOK` + `template_key` | Playbook под ваш lifecycle или нет |
| `TaskCategory` (BOOKING, MARKETING…) | Свои категории или убрать |
| `EventAccessService` в ACL задачи | ACL доменной сущности |
| `Tag.venue_id` | Теги без venue / с org-unit |
| Имя `EventTask` | Сразу `Task` |
| Код в `modules/events/` | Отдельный `modules/work-management/` |

**Допущение порта:** List обязателен всегда. «Личная задача» = задача в system List `personal-inbox`, а не `list_id = null`.

---

## 3. Каноническая модель данных

### 3.1. Иерархия контейнеров

```
TaskSpace
  ├── TaskSpaceMember[]
  ├── TaskFolder[]?                # опционально
  │     └── TaskList[]
  ├── TaskList[]                   # list может быть без folder
  ├── TaskListStatus[]             # space-level statuses (list_id = null)
  ├── TaskType[]
  ├── CustomFieldDefinition[]      # scope SPACE
  └── TaskTemplate[]

TaskList
  ├── EventTask[] / Task[]
  ├── TaskListStatus[]             # list-level overrides
  ├── TaskViewPreference[]
  ├── TaskView[]
  ├── TaskAutomationRule[]
  ├── TaskTemplate[]
  └── CustomFieldDefinition[]      # scope LIST
```

| Сущность | Обязательные поля | Смысл |
| -------- | ----------------- | ----- |
| **TaskSpace** | `name`; опц. `color`, `icon`, `description`, `is_system`, `system_key`, `is_archived` | Верхний контейнер |
| **TaskSpaceMember** | `(space_id, user_id)`, `role` | ACL Space |
| **TaskFolder** | `space_id`, `name`, `position`, `is_archived` | Группировка Lists |
| **TaskList** | `space_id`, `name`, `position`; опц. `folder_id`, `system_key`, `domain_entity_id` | **Единица работы** |
| **Task** | `list_id`, `title`, `status`, `priority`, `position` | Единица исполнения |

Удаление List с задачами: в Космонавт на Task стоит `onDelete: Restrict` для `list_id` — нельзя снести List, пока есть задачи. Это консервативное и правильное поведение для порта.

### 3.2. Системные Spaces / Lists

Паттерн: `is_system + system_key`, уникальность `(space_id, system_key)` на List.

| system_key (Космонавт) | Назначение |
| ---------------------- | ---------- |
| Space `personal` → List `personal-inbox` | Личные задачи (`domain_entity_id IS NULL`) |
| Space `events` → List `event:{eventId}` | По List на каждое мероприятие |

Правила:

1. System Space **видят все** аутентифицированные пользователи (фильтрация задач внутри — отдельно).
2. Управлять system List может только global admin (не обычный Space member).
3. `ensureXList(entityId)` — идемпотентное создание.

### 3.3. Поля задачи (полный минимум ядра)

| Поле | Тип | Заметки |
| ---- | --- | ------- |
| `id` | UUID | |
| `list_id` | UUID, required | Restrict on delete |
| `parent_task_id` | UUID? | Subtasks; cascade delete children |
| `owner_user_id` | UUID? | Владелец (личные задачи) |
| `title` | varchar(500) | |
| `description` | text? | |
| `status` | enum TaskStatus | Canonical |
| `list_status_id` | UUID? | UI-колонка |
| `priority` | enum | default MEDIUM |
| `due_date`, `start_date` | timestamptz? | |
| `time_estimate` | int? | минуты (договорённость зафиксировать) |
| `task_type_id` | UUID? | |
| `is_blocking` | bool | UI-флаг «блокирует» |
| `completed_at` | timestamptz? | Ставится при переходе в DONE |
| `position` | float | Fractional ranking |
| `deleted_at` | timestamptz? | Soft delete |
| Host: `domain_entity_id`, `category`, `template_key` | опционально | Plugin |

Индексы, которые уже оправдали себя:

- `(list_id, deleted_at)`, `(list_id, position)`, `(list_id, list_status_id)`
- `(owner_user_id, deleted_at)`, `(parent_task_id)`, `(due_date)`, `(start_date)`

### 3.4. Enum-словарь

```
TaskStatus:             OPEN | IN_PROGRESS | DONE | CANCELLED
TaskPriority:           LOW | MEDIUM | HIGH | URGENT
TaskRelationType:       BLOCKS | RELATES
TaskViewType:           LIST | BOARD | CALENDAR | TABLE
                        # UI может иметь timeline, но API-enum — отдельно
TaskGroupBy:            NONE | STATUS | PRIORITY | ASSIGNEE | DUE_DATE
TaskSpaceMemberRole:    OWNER | MEMBER | VIEWER
CustomFieldScope:       SPACE | LIST
CustomFieldType:        TEXT | NUMBER | MONEY | DATE | SELECT
                        | MULTI_SELECT | USER | CHECKBOX | URL
FavoriteEntityType:     TASK_LIST | TASK | TASK_VIEW
TaskAutomationTrigger:  STATUS_CHANGED | TASK_CREATED | DUE_REACHED
                        | ASSIGNEE_CHANGED | ENTERED_DONE_GROUP
                        | CUSTOM_FIELD_CHANGED
```

### 3.5. Связанные сущности (кратко)

| Модель | PK / уникальность | Назначение |
| ------ | ----------------- | ---------- |
| `TaskListStatus` | id; index `(list_id, order)`, `(space_id, order)` | Кастомные колонки |
| `TaskViewPreference` | unique `(user_id, list_id)` | Личные дефолты |
| `TaskView` | id; index `(list_id, position)` | Named/shared views |
| `TaskType` | unique `(space_id, key)` | Типы задач |
| `CustomFieldDefinition` | id | Определение поля |
| `TaskCustomFieldValue` | unique `(task_id, field_id)` | Значение |
| `UserFavorite` | unique `(user_id, entity_type, entity_id)` | Избранное |
| `TaskRelation` | `(from, to, relation_type)` | Зависимости |
| `TaskActivity` | id; index `(task_id, created_at)` | Audit |
| `TaskTemplate` | id; `items` Json | Шаблоны |
| `TaskAutomationRule` | id; index `(list_id, is_active)` | Правила |
| `EventTaskAssignee` / Assignees | `(task_id, user_id)` | Исполнители |
| `TaskWatcher` | `(task_id, user_id)` | Наблюдатели |
| `TaskComment` | id | Комментарии |
| `ChecklistItem` | id; `position` int | Чеклист |
| `TaskReminder` | id; index `(remind_at, sent_at)` | Напоминания |
| `Tag` + M2M | unique `(venue_id, name)` в Космонавт | Теги |

---

## 4. Dual status — детальный контракт

Это самый важный инвариант ядра. Нарушение приводит к рассинхрону Kanban, автоматизаций и отчётов.

### 4.1. Два уровня

1. **Canonical `TaskStatus`** — истина для бизнес-логики (done/not done, playbook, overdue-исключения, автоматизации по статусу).
2. **`TaskListStatus`** — отображаемая колонка: `name`, `color`, `order`, `category → TaskStatus`, `is_default`.

Задача хранит **оба**: `status` и опционально `list_status_id`.

### 4.2. Цепочка резолва колонок List

`resolveStatusesForList(listId)`:

1. Есть статусы с `list_id = listId` → используем их.
2. Иначе статусы Space: `space_id = list.space_id` и `list_id IS NULL`.
3. Иначе **seed defaults** на этот List и перечитать.

### 4.3. Дефолтный seed

| name | color | order | category | is_default |
| ---- | ----- | ----- | -------- | ---------- |
| К выполнению | `#94a3b8` | 0 | `OPEN` | **true** |
| В работе | `#3b82f6` | 1 | `IN_PROGRESS` | |
| Готово | `#22c55e` | 2 | `DONE` | |
| Отменено | `#ef4444` | 3 | `CANCELLED` | |

Seed — no-op, если у List уже есть хотя бы один статус.

### 4.4. Правила синхронизации

| Действие пользователя | Что писать в БД |
| --------------------- | --------------- |
| Выбрал кастомную колонку | `list_status_id = X`, `status = X.category`; если DONE → `completed_at = now`, иначе при уходе с DONE → `completed_at = null` |
| Выбрал/изменил только canonical | Найти default list-status для category (`is_default` в категории или первый) и проставить `list_status_id` |
| Удалили статус | Обязателен `move_to` статус; задачи переносятся; `status`/`completed_at` синхронизируются с category цели |
| Новый `is_default=true` | Сбросить `is_default` у остальных статусов того же List |

Kanban без кастомных статусов: колонки = canonical `OPEN / IN_PROGRESS / DONE` (CANCELLED обычно скрыт или в отдельном фильтре — зафиксировать в UI-политике).

### 4.5. Почему так

- Отчёты и «% готово» не зависят от переименования колонки «Готово» → «Сдано».
- Playbook/host lifecycle читает enum, а не строковый label.
- Разные Lists могут иметь разные воркфлоу при общей семантике DONE.

---

## 5. Права доступа

### 5.1. Два сервиса

| Сервис | Зона |
| ------ | ---- |
| `TaskSpaceAccessService` | Видимость/управление Space, Folder, List |
| `TaskAccessService` | Видимость/управление конкретной Task |

Не смешивать в одном «god-service» с CRUD.

### 5.2. Space / List

**Global admin** (в Космонавт: `ADMIN | GENERAL_MANAGER`) — полный доступ.

| Операция | Правило |
| -------- | ------- |
| View Space | Admin **или** (не archived **и** (system space **или** membership)) |
| Manage Space | Admin **или** membership `OWNER`/`MEMBER` (`VIEWER` нельзя) |
| View List | List не archived + view Space |
| Manage List | List не archived; **system list → только admin**; иначе manage Space |
| Create Folder/List | Manage Space |

### 5.3. Task visibility (`canViewTask`)

Задача видна, если выполняется **хотя бы одно**:

1. Actor = `owner_user_id`
2. Actor в assignees
3. Actor в watchers
4. List в **non-system** Space **и** actor — member этого Space
5. Иначе, если есть `domain_entity_id` / `event_id` — проходит host visibility ACL
6. Иначе (личная без owner/assignee/watcher) → **false**

**Инвариант UX/API:** нет доступа → `404 Задача не найдена`, не `403`. Так не светится существование чужих задач.

### 5.4. Task manage (`canManageTask`)

| Контекст | Manage |
| -------- | ------ |
| Нет domain entity (personal) | Только owner |
| Есть domain entity | Host write ACL на сущность |
| Только assignee / watcher | **Не** manage |

### 5.5. Исключения для assignee

Assignee без manage может:

- менять **только** `status` / `list_status_id` на update;
- на move — только `status` / `list_status_id` / `position` / `after_task_id` (перенос в другой List запрещён).

Всё остальное (title, assignees, priority, due, cross-list move) — manage.

### 5.6. My Work where

Агрегатор «мои задачи»: не удалённые **и** (assignee **или** owner **или** watcher **или** видимая доменная сущность).

Доп. фильтр внутри system spaces при листинге List:

- `personal` — только owner/assignee/watcher;
- `events` (host) — то же **или** host event visibility;
- обычный Space — достаточно Space membership (уже на уровне list visible).

---

## 6. Алгоритмы: position, cursor, filters

### 6.1. Fractional ranking (`position`)

Константы:

- `POSITION_STEP = 1000`
- `MIN_GAP = 0.0001`

Поведение:

1. Новая задача в конец: `max(position) + STEP` (только top-level: `parent_task_id IS NULL`).
2. Вставка after `taskA`: mid-point между `taskA` и следующим; если следующего нет — `after + STEP`.
3. Если `next - after < MIN_GAP` → **renumber** всего List (`(i+1) * STEP`) и повторить расчёт.
4. Можно передать explicit `position` (для редких admin/import сценариев).

Почему Float, а не dense int: DnD без массового UPDATE на каждый drag (renumber — редкий путь).

### 6.2. Cursor pagination

Порядок: `position ASC, created_at DESC, id ASC`.

Cursor = `base64url(JSON({ position, created_at: ISO, id }))`.

Предикат «после курсора»:

```
position > cursor.position
OR (position = cursor.position AND created_at < cursor.created_at)
OR (position = cursor.position AND created_at = cursor.created_at AND id > cursor.id)
```

Невалидный cursor → `400`.  
Лимит страницы: default 50, clamp max 100 (DTO может декларировать до 200 — сервис жёстче).

Offset pagination на больших List с DnD **запрещён** — страницы «плывут».

### 6.3. Filter DSL

Корень — всегда группа:

```ts
type FilterGroup = {
  op: 'AND' | 'OR';
  children: Array<FilterCondition | FilterGroup>;
};

type FilterCondition = {
  field: FilterField;
  operator: FilterOperator;
  value?: unknown;
};
```

Потолки:

- `MAX_DEPTH = 3`
- `MAX_CONDITIONS = 20`

Allowlist полей:  
`status | priority | assignee_id | due_date | category | tag_id | task_type_id | title | list_status_id`

Allowlist операторов:  
`is | is_not | is_set | is_not_set | gt | lt | between | contains`

Семантика (важное):

| Field | Поддерживаемые ops | Prisma-смысл |
| ----- | ------------------ | ------------ |
| `status` / `priority` | is, is_not | прямое сравнение enum |
| `list_status_id` | is, is_not, is_set, is_not_set | FK / null |
| `assignee_id` | is, is_not, is_set, is_not_set | `assignees some/none` |
| `tag_id` | is, is_not | M2M |
| `task_type_id` | is, is_not, is_set, is_not_set | FK |
| `category` | is, is_not, is_set, is_not_set | host enum |
| `title` | contains | `ILIKE` / insensitive contains |
| `due_date` | is_set, is_not_set, gt, lt, between | даты; between = `[from, to]` |

Недопустимая пара field/op → `400`, не silent skip.  
На API передаётся JSON-строкой в query (`filters`).

Пример:

```json
{
  "op": "AND",
  "children": [
    { "field": "priority", "operator": "is", "value": "HIGH" },
    {
      "op": "OR",
      "children": [
        { "field": "due_date", "operator": "lt", "value": "2026-08-12T00:00:00.000Z" },
        { "field": "assignee_id", "operator": "is", "value": "<user-uuid>" }
      ]
    }
  ]
}
```

---

## 7. Жизненный цикл задачи

### 7.1. Создание

Пути:

1. `POST /tasks` → обычно personal inbox (+ owner = actor).
2. `POST /task-lists/:listId/tasks` → в конкретный List.
3. `POST .../from-template/:templateId` → разворот template items.
4. Host playbook → `ensureEntityList` + create с `template_key` (идемпотентность через unique `(domain_id, template_key)`).

При create:

- `position = next in list`
- `status` / `list_status` из default или DTO
- assignees → нотификации `TASK_ASSIGNED`
- activity (по политике)
- trigger automation `TASK_CREATED` (если реализован runtime)

### 7.2. Update

- Manage: полные поля.
- Assignee-only: только статусные поля.
- Смена `due_date` при наличии старого и нового → `shiftDependentDueDates` для исходящих `BLOCKS`.
- Смена status/list_status → sync dual status + `completed_at` + `afterStatusChange` → automations.

### 7.3. Move

`PATCH /tasks/:id/move`:

- смена `list_id` (с ACL и host-ограничениями),
- `list_status_id` / `status`,
- `position` / `after_task_id`.

Host-ограничения Космонавт (оставить как паттерн):

- event-задачу нельзя утащить в personal list;
- нельзя переносить между разными event lists произвольно.

Activity: `MOVED`.

### 7.4. Bulk

`PATCH /tasks/bulk`: хотя бы одно из `status | list_status_id | priority | assignee_ids`.  
**Каждая** задача должна быть manageable.  
Per-task transaction: sync статусов, replace assignees, activity `BULK_UPDATED`.

### 7.5. Soft delete

`deleted_at`; листинги всегда фильтруют `deleted_at IS NULL`.  
Containers: `is_archived`, не hard delete при живых задачах.

### 7.6. Subtasks

Отдельные Task с `parent_task_id`.  
В list/kanban по умолчанию показывают **только корни** (`parent_task_id IS NULL`); дети — в detail / Subtasks tab.  
Position считается среди top-level.

---

## 8. Коллаборация

### 8.1. Assignees

M2M. Смена набора → `TASK_ASSIGNED` новым (с dedupKey).  
Не путать с owner: owner — «чья личная», assignee — «кто делает».

### 8.2. Watchers

Явная подписка. Автор комментария обычно auto-watch.  
Watchers получают `TASK_COMMENT`.

### 8.3. Comments и mentions

Формат mention в теле: **`@[uuid]`** (общий util FE/BE).

На create comment:

1. Извлечь mention user ids.
2. `TASK_MENTION` (HIGH) упомянутым.
3. `TASK_COMMENT` (LOW) watchers (кроме автора/уже упомянутых — по политике dedup).

FE: tokenize для рендера, autocomplete по `@query`, insert token.

### 8.4. Checklist

Элементы: `text`, `is_done`, optional `assignee_user_id`, `position` (int).  
Прогресс = done/total; показывают в row/detail.

### 8.5. Relations

Типы:

- `BLOCKS` — from блокирует to; due-shift идёт по исходящим BLOCKS от изменённой задачи.
- `RELATES` — мягкая связь без сдвига дат.

Запрет self-link. PK `(from, to, type)`.  
Payload detail: `relations.outgoing` / `incoming`.  
Activity: `RELATION_ADDED` / `RELATION_REMOVED`.

Перед сохранением due на FE — предупреждение, если есть зависимые (`saveDueDateWithDependencyNotice`).

### 8.6. Activity

Строковый `action` + JSON `details`.  
Минимальный набор action-кодов:  
`UPDATED | MOVED | RELATION_ADDED | RELATION_REMOVED | BULK_UPDATED`  
(+ причины в details, напр. `shifted_by_blocker`).

Это audit trail, не event sourcing.

### 8.7. Reminders

`remind_at`, `user_id?`, `sent_at?`.  
Scheduler каждую минуту: due reminders → `TASK_REMINDER`, проставить `sent_at`.

---

## 9. Views, group-by, favorites

### 9.1. Два механизма хранения

| Механизм | Уникальность | Смысл |
| -------- | ------------ | ----- |
| `TaskViewPreference` | `(user_id, list_id)` | «Как я обычно смотрю этот List / My Work» |
| `TaskView` | id; per list + owner | Именованный/shared пресет (как ClickUp views) |

Поля пресета: `view_type`, `group_by`, `sort` Json?, `filters` Json?, у TaskView ещё `columns` Json?, `is_shared`, `position`.

### 9.2. View types

| UI | API enum | Заметки |
| -- | -------- | ------- |
| list | `LIST` | Sortable + group-by |
| board | `BOARD` | Kanban по list statuses / fallback |
| table | `TABLE` | Плотная таблица |
| calendar | `CALENDAR` | По due |
| timeline | *(нет в API)* | FE-only; persist как `LIST` до расширения enum |

Group-by API: `NONE | STATUS | PRIORITY | ASSIGNEE | DUE_DATE`.  
UI-группы вроде tag/type, если нет в enum, persist как `NONE` (или расширяйте enum осознанно).

### 9.3. My Work home grouping

Клиентские/серверные корзины по due: overdue / today / no_due (и аналоги).  
Это представление агрегатора, не отдельная сущность.

### 9.4. Favorites

`UserFavorite`: entity `TASK_LIST | TASK | TASK_VIEW` + `position`.  
Sidebar: favorites / recent — ускорение навигации.

---

## 10. Custom fields и Task types

### 10.1. Definitions

- Scope `SPACE` или `LIST` (ровно один FK).
- `key`, `name`, `type`, `options` Json (для SELECT/MULTI_SELECT), `position`.

### 10.2. Values — packing

Одна строка на `(task_id, field_id)`, колонки:

| Type | Куда писать |
| ---- | ----------- |
| TEXT, URL, SELECT | `value_text` |
| USER | `value_text` (UUID, regex 36) |
| NUMBER, MONEY | `value_number` Decimal(18,4) |
| DATE | `value_date` |
| CHECKBOX | `value_json` boolean |
| MULTI_SELECT | `value_json` array |
| clear (null) | все колонки null |

Неиспользуемые колонки при записи обнуляются. Невалидный raw → `400`.

API read: сериализация в `{ field_id, key, name, type, value }`.

### 10.3. Task types

Global (`space_id null`) или space-scoped.  
Seed-пример: `task`, `milestone`, `approval`, `incident`, `meeting`.  
`is_system` защищает от случайного удаления.

---

## 11. Templates и Automations

### 11.1. Templates

`TaskTemplate`: `space_id?`, `list_id?`, `name`, `items` Json, `is_active`.  
`POST /task-lists/:listId/tasks/from-template/:templateId` разворачивает items в реальные задачи (title/priority/checklist/subtasks — по контракту items; зафиксируйте schema items в OpenAPI).

### 11.2. Automations

Модель: на List, `trigger` enum, `condition` Json, `action` Json, `is_active`.

**Enum триггеров шире, чем runtime.** В Космонавт реально исполняется прежде всего `STATUS_CHANGED`. Остальные — зарезервированы API/схемой; при порте либо реализуйте по одному, либо не светите в UI.

#### Condition (STATUS_CHANGED)

```ts
{ status?: TaskStatus; list_status_id?: string }
// оба optional; если заданы — AND match
```

#### Actions

```ts
| { type: 'SET_PRIORITY'; priority: TaskPriority }
| { type: 'SET_STATUS'; status: TaskStatus; list_status_id?: string }  // recurse
| { type: 'NOTIFY'; title?: string; body?: string }  // assignees except actor
| { type: 'SHIFT_DUE_DAYS'; days: number }  // base = due ?? now
```

#### Safety

`MAX_AUTOMATION_DEPTH = 3` — при рекурсивном `SET_STATUS` останавливаемся и логируем warn.  
Без этого легко словить цикл правил.

---

## 12. Уведомления и reminders

### 12.1. Типы (topic TASKS)

| Code | Default severity | Когда |
| ---- | ---------------- | ----- |
| `TASK_ASSIGNED` | LOW | Назначили исполнителя |
| `TASK_DUE_SOON` | MEDIUM | Scheduler: due в окне 24h |
| `TASK_OVERDUE` | HIGH | Scheduler: due < now, не DONE/CANCELLED |
| `TASK_MENTION` | HIGH | `@[uuid]` в комментарии |
| `TASK_COMMENT` | LOW | Новый комментарий (watchers) |
| `TASK_REMINDER` | MEDIUM | Сработал TaskReminder |
| `TASK_STATUS_CHANGED` | LOW | В т.ч. automation NOTIFY |

### 12.2. Scheduler (референс)

- Каждые **10 мин**: due soon (`DUE_SOON_HOURS = 24`) и overdue; batch ~100; dedup по дневному bucket.
- Каждую **1 мин**: reminders.

### 12.3. Recipients

Для task-уведомлений «свои» = owner ∪ assignees ∪ watchers (+ host roles, если задача на сущности).  
Пересечение с notification preferences (opt-in по topic/type).

Inbox UX: read / read-all / snooze / clear — отдельный UI `/inbox`, но контрактно связан с задачами.

---

## 13. API-поверхность

Базовый префикс API — как в вашем шлюзе (`/api/...`). Ниже — ресурсные пути ядра.

### 13.1. Tasks controller (`/tasks`)

| Method | Path | Назначение |
| ------ | ---- | ---------- |
| GET | `/tasks` | My Work |
| GET | `/tasks/kanban` | Kanban-агрегатор |
| GET | `/tasks/overdue` | Management overdue |
| POST | `/tasks` | Быстрое создание (часто personal) |
| PATCH | `/tasks/bulk` | Bulk update |
| GET | `/tasks/:id` | Detail |
| PATCH | `/tasks/:id` | Update |
| PATCH | `/tasks/:id/move` | Move list/status/position |
| POST/GET | `/tasks/:id/subtasks` | Subtasks |
| POST/DELETE | `/tasks/:id/watchers/:userId` | Watchers |
| GET/POST | `/tasks/:id/comments` | Comments |
| GET/POST/PATCH/DELETE | `/tasks/:id/checklist[/:itemId]` | Checklist |
| POST | `/tasks/:id/reminders` | Reminders |
| GET | `/tasks/:id/activity` | Activity |
| POST/DELETE | `/tasks/:id/relations` | Relations |
| PUT | `/tasks/:id/custom-fields/:fieldId` | CF upsert |

### 13.2. Spaces & meta (плоские маршруты)

| Область | Paths |
| ------- | ----- |
| Spaces | `GET/POST /task-spaces`, `GET/PATCH /task-spaces/:spaceId`, members |
| Folders | `POST /task-spaces/:spaceId/folders`, `PATCH /task-folders/:folderId` |
| Lists | `POST /task-spaces/:spaceId/lists`, `GET/PATCH /task-lists/:listId` |
| List tasks | `GET/POST /task-lists/:listId/tasks`, `.../from-template/:templateId` |
| Statuses | `GET/POST /task-lists/:listId/statuses`, `PATCH/DELETE /task-statuses/:id` |
| View prefs | `GET/PUT /task-view-preferences` |
| Named views | `GET /task-lists/:listId/views`, `GET /task-views/mine`, `POST/PATCH/DELETE /task-views...` |
| Templates | `GET/POST /task-templates` |
| Automations | `GET/POST/PATCH /task-lists/:listId/automations...` |
| Types | `GET/POST/PATCH/DELETE /task-types`, list by space |
| Custom fields | `GET` space/list, `POST/PATCH/DELETE /custom-fields` |
| Favorites | `GET/POST/DELETE /user-favorites...` |

### 13.3. Host compat (опционально)

`GET/POST /{domain}/:id/tasks` — удобный фасад: filter by entity + create в system list сущности.  
Не заменяет ядро `/task-lists/:id/tasks`.

### 13.4. Валидация на границе

- DTO class-validator (или аналог) на все write-endpoints.
- `filters` — parse JSON → schema/allowlist → 400.
- CF raw — type switch → 400.
- Cursor — decode → 400.
- Automation condition/action — хотя бы структурная проверка `type` на write (рекомендуется усилить относительно текущего opaque Json).

---

## 14. Backend-архитектура

### 14.1. Рекомендуемая раскладка модуля (для нового проекта)

```
work-management/
  tasks.controller.ts
  task-spaces.controller.ts
  services/
    tasks.service.ts
    task-spaces.service.ts
    task-list-resolver.service.ts
    task-list-statuses.service.ts
    task-access.service.ts
    task-space-access.service.ts
    task-views.service.ts
    task-view-preferences.service.ts
    task-custom-fields.service.ts
    task-types.service.ts
    user-favorites.service.ts
    task-templates.service.ts
    task-automation.service.ts
    task-activity.service.ts
  utils/
    task-position.util.ts
    task-cursor.util.ts
    task-filter.util.ts
    custom-field-value.util.ts
  dto/
  *.spec.ts
```

В Космонавт то же лежит под `backend/src/modules/events/` с префиксом `event-tasks` / `task-*`.

### 14.2. Слои и зависимости

```
Controller → Access → Domain Service → Prisma
                 ↘ Pure utils (filter/cursor/position/CF)
Domain Service → Automation / Notifications (side effects)
Host Plugin ← hooks из Domain Service (ensureList, playbook)
```

Правила:

- Access не пишет бизнес-данные.
- Utils чистые / без HTTP.
- Side effects (notify, automate) после успешной мутации; automation глубина ограничена.
- Идемпотентность playbook через unique keys, не через «попробуй создать».

### 14.3. Транзакции

Move / bulk item / status delete+retarget / template expand — в transaction.  
Renumber positions — в той же tx, что insert, если сработал MIN_GAP.

### 14.4. Тесты, которые стоит иметь в ядре

- filter allowlist / depth / between
- cursor encode/decode / where predicate
- position mid-point + renumber
- dual status sync / default seed
- CF packing per type
- automation depth cap
- access: 404 vs manage 403; assignee-only whitelist
- ClickUp-mechanics UI utils (home groups, kanban fallback, drop ids)

---

## 15. Frontend-архитектура

### 15.1. Маршруты

- `/tasks` — основной shell
- `/tasks/:taskId` — deep-link в detail panel
- `/inbox` — уведомления (рядом с задачами)

### 15.2. Shell composition

```
TasksPage
├── TasksSidebar          # tree + favorites + mine/overdue
├── header / TasksViewControls / TaskViewsTabs
├── TasksFilterBar / TasksAdvancedFilters
├── TasksBulkToolbar      # if selection
├── main view:
│   ├── SortableTaskList + TaskRow
│   ├── TasksKanbanBoard
│   ├── TasksTableView
│   ├── TasksCalendarView
│   └── TasksTimelineView
├── TaskDetailPanel
│   ├── fields / StatusSelect / CF
│   ├── SubtasksTab / ChecklistTab
│   ├── CommentComposer / TaskActivityFeed
│   ├── TaskRelationsSection / ReminderPicker
│   └── move / breadcrumbs
├── CreateTaskPanel / QuickAddTask
└── ListSettingsPanel → ListStatusManager / CustomFieldsManager / automations
```

### 15.3. Data flow

1. Навигация задаёт scope: mine | listId | overdue.
2. Грузится `TaskViewPreference` (и named views).
3. Local `viewOverride` до смены nav.
4. Fetch: list(+filters+cursor) | kanban | mine | overdue.
5. Client helpers: group/sort/stats (`tasks-page.util`, `tasks-group.util`, `tasks-kanban.util`).
6. DnD → `move` mutation с **optimistic** `onMutate` + rollback.

### 15.4. DnD

Библиотека: `@dnd-kit` (или аналог).  
Drop id конвенции:

- `list-drop-{listId}` — дроп на List в sidebar
- `column-{statusOrListStatusId}` — колонка board

Handlers централизовать (`tasks-dnd-handlers`) → один move API.

### 15.5. API clients (разбиение)

| Client | Зона |
| ------ | ---- |
| `tasks.api` | CRUD, move, bulk, collab, my/kanban/overdue |
| `task-spaces.api` | Tree + list tasks |
| `task-extras.api` | Statuses, prefs, templates, automations |
| `task-views.api` | Named views |
| `task-types.api` | Types |
| `custom-fields.api` | Definitions + values |
| `user-favorites.api` | Favorites |

### 15.6. UX-детали, которые стоит сохранить

- Inline edit в row/detail где безопасно.
- Soft WIP warning на kanban (не жёсткий WIP limit в v1).
- Blocked badge при входящем BLOCKS.
- Progress subtasks/checklist на row.
- Предупреждение при сдвиге due у blocker’а.
- Mentions autocomplete.
- Calendar/timeline можно добавить после list/board — не блокируют MVP.

---

## 16. Принципы разработки (чеклист)

1. **List — единица работы.** Нет задачи без `list_id`.
2. **Dual status не ломать.** Canonical для логики, list status для UI.
3. **Host — плагин.** Nullable FK + resolver + hooks, не ветка дерева.
4. **Слои вниз.** Controller → Access → Service → Utils/DB.
5. **Невидимое = 404.** Manage fail = 403.
6. **Assignee-only whitelist** на status/position.
7. **Fractional position + редкий renumber.**
8. **Cursor pagination**, не offset.
9. **Filter DSL с allowlist и потолками** (depth 3, conditions 20).
10. **Automation depth ≤ 3.**
11. **BLOCKS due-shift** детерминированный, с activity reason.
12. **Activity = audit**, не bus.
13. **Soft delete / archive**, Restrict на list delete при задачах.
14. **Optimistic UI только с rollback.**
15. **Валидация на границе**, без silent ignore.
16. **Секреты/лишний PII не в activity/logs.**
17. **Константы именованные**, не магические числа в коде.
18. **Тесты на utils и access** раньше E2E.
19. **OpenAPI = контракт** фронта и бэка.
20. **Non-goals держать в README модуля.**

---

## 17. Фазы внедрения

Порядок проверен на Космонавт; сжимать можно, **переставлять dual-status раньше hierarchy / move — нельзя**.

| Фаза | Содержание | Done-критерий |
| ---- | ---------- | ------------- |
| **A** | Space/Folder/List/Task, system spaces, sidebar, create-in-list, deep-link из host-карточки | Каждая задача в List; дерево работает |
| **B1** | `position`, `PATCH move`, DnD list/board/sidebar, quick add, detail basics | Стабильный DnD |
| **B2** | `TaskListStatus`, view prefs, group-by, table | Dual status + кастомные колонки |
| **B3** | Relations, activity, bulk, My Work grouping, progress badges | Коллаборация + зависимости |
| **C** | Templates, automations (+ depth guard), UI правил | Create-from-template; STATUS_CHANGED rules |
| **Wave 2–4** | Status inheritance + `is_default`, saved views, filter engine + cursor, CF, types, favorites, calendar/timeline, dependent due shift, inbox snooze/clear | ClickUp-level UX |

Host plugin (system entity lists, playbooks, domain ACL) подключайте с фазы A, но не блокируйте им Core.

---

## 18. Порт в новый проект: чеклист

> **Almea Tracker (этот репозиторий):** прогресс фаз — [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md). Auth v0 — JWT в httpOnly cookie, не Bearer в localStorage.

### Репозиторий / модуль

- [ ] Отдельный модуль `work-management` (не внутри чужого domain module)
- [ ] Имена `Task` / `task_assignees` без `Event*` префикса
- [ ] Prisma schema пакетом Phase A+B1 сразу (hierarchy + position + soft delete)
- [ ] Seed: personal space/list, default statuses, system task types
- [ ] OpenAPI секция Tasks / Spaces с первого PR

### Backend

- [ ] `TaskAccessService` + `TaskSpaceAccessService` до публичного API
- [ ] Utils: position, cursor, filter (+ тесты)
- [ ] Dual status service с seed/inheritance
- [ ] Move + bulk
- [ ] Notifications types + scheduler hooks
- [ ] Automation runtime хотя бы для `STATUS_CHANGED`
- [ ] Host plugin package: `ensureEntityList`, optional playbook

### Frontend

- [ ] `/tasks` shell: sidebar + one view (list) + detail
- [ ] Затем board + move optimistic
- [ ] Filters/views/CF по волнам
- [ ] Mechanics unit tests для grouping/dnd ids/view map

### Продукт

- [ ] Зафиксировать non-goals письменно
- [ ] Выбрать system spaces под домен
- [ ] Ролевая матрица global admin vs space roles vs assignee-only
- [ ] Язык UI (RU/EN) и seed-названия статусов

---

## 19. Антипаттерны

| Антипаттерн | Почему плохо | Как правильно |
| ----------- | ------------ | ------------- |
| Проект/отдел = Space по умолчанию | Ломает My Work и перенос | System list или атрибут |
| Только кастомные статусы без enum | Ломает отчёты/автоматизации | Dual status |
| `list_id` nullable «для личных» | Два мира задач | Personal system list |
| Offset pagination | Плывущие страницы при DnD | Cursor |
| Автоматизации без depth cap | Циклы | `MAX_AUTOMATION_DEPTH` |
| 403 на невидимую задачу | Enumeration | 404 |
| Docs/вложения задач в MVP | Scope creep | Отдельный files later |
| Optimistic без rollback | Расхождение кэша | onMutate + onError |
| Filters как свободный SQL/Prisma с клиента | Инъекции/DoS | Allowlist DSL |
| Смешать Access и CRUD в одном классе | Нельзя тестировать/портить | Два сервиса |
| Реализовать все AutomationTrigger сразу | Мёртвый UI | По одному + честный UI |
| Hard delete List с задачами | Потеря данных | Restrict + archive |

---

## 20. Карта исходников Космонавт

| Область | Путь |
| ------- | ---- |
| Schema | `backend/prisma/schema.prisma` |
| Wave 2–4 migration | `backend/prisma/migrations/20260811120000_tasks_clickup_wave2_4/` |
| Backend services | `backend/src/modules/events/event-tasks.service.ts`, `task-*.ts` |
| Access | `task-access.service.ts`, `task-space-access.service.ts` |
| Utils | `task-position.util.ts`, `task-cursor.util.ts`, `task-filter.util.ts`, `custom-field-value.util.ts` |
| Controllers | `tasks.controller.ts`, `task-spaces.controller.ts` |
| Frontend pages | `frontend/src/pages/tasks/` |
| Frontend API | `frontend/src/api/task*.ts`, `custom-fields.api.ts`, `user-favorites.api.ts` |
| Mechanics tests | `clickup-mechanics.util.spec.ts` |
| ADR | `Documentation initial/ADR/ADR-009-*.md`, `ADR-012-*.md` |
| Status | `Documentation initial/Implementation Status.md` |
| Contract | `Documentation initial/openapi.yaml` |

---

## 21. Глоссарий

| Термин | Значение |
| ------ | -------- |
| **Space** | Верхний контейнер навигации и membership |
| **Folder** | Опциональная группировка Lists |
| **List** | Обязательный контейнер задач; scope статусов/views/automations |
| **Task** | Единица работы; в Космонавт исторически `EventTask` |
| **Canonical status** | Enum `TaskStatus` — бизнес-истина |
| **List status** | Кастомная колонка UI с `category` |
| **My Work** | Кросс-list агрегатор задач пользователя |
| **Host Plugin** | Связь с доменной сущностью продукта (event/project/…) |
| **Fractional ranking** | Сортировка через mid-point float `position` |
| **Filter DSL** | JSON-дерево условий с allowlist |
| **ClickUp-Light** | Подмножество ClickUp: collab + board без Docs/Goals/time |

---

## Краткая манифест-выжимка

1. **Space → Folder? → List → Task** — навигация и ACL.  
2. **List обязателен**; домен хоста — плагин.  
3. **Dual status**: UI-колонки ↔ canonical enum.  
4. **Position + cursor + filter DSL** — три столпа масштаба.  
5. **Access отдельно**; невидимое = 404; assignee-only узкий whitelist.  
6. **Automations/filters с потолками сложности**.  
7. **Фазы A→C→Waves**, не big-bang.  
8. **Non-goals** держать явно.

Этого набора достаточно, чтобы воспроизвести тот же класс продукта в новой компании: перенести Core и контракты, заменить Host Plugin под свой домен.
