# Almea Tracker

ClickUp-Light **Work Management** для Almea: Spaces → Folders → Lists → Tasks, dual status, views, collab, automations.

Продуктовый и архитектурный каркас — из портабельного гайда Космонавт ERP (2026-08). Цель репозитория: вынести **Work Management Core** в отдельный продукт с тонким **Host Plugin** под домен Almea.

## Документация

| Документ | Назначение |
| -------- | ---------- |
| [docs/task-tracker-principles.md](docs/task-tracker-principles.md) | Полный гайд: модель, dual status, ACL, API, фазы, антипаттерны |
| [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) | План разработки Almea Tracker по фазам |

## Продуктовая рамка (кратко)

- **Делаем:** hierarchy, dual status, DnD/position, My Work, comments, checklist, subtasks, relations, templates, automations (с depth guard), custom fields, saved views, notifications.
- **Не делаем в v1:** Docs/wiki, Goals/OKR, time tracking, полный клон ClickUp (Dashboards, Whiteboards, Forms).

Главный принцип: контейнерная иерархия отвечает за навигацию и ACL; домен хоста — атрибут/плагин, не ветка дерева.

## Стек (допущение v0)

Пока зафиксировано консервативно — уточним на старте Phase A:

| Слой | Выбор |
| ---- | ----- |
| Backend | NestJS + Prisma + PostgreSQL |
| Frontend | React + TypeScript |
| API contract | OpenAPI с первого PR |
| Auth | Host / shared auth Almea (TBD) |

## Демо (без бэкенда)

Кликабельный прототип «глазами CEO»: My Work, неделя, inbox, spaces, lists, доска/таблица/календарь, карточка задачи. Данные в `localStorage` браузера.

```bash
cd web
npm install
npm run dev
```

Откроется `http://localhost:5173`. Для проверки production-сборки: `npm run build && npm run preview`.

Статический деплой на Render: корень репозитория, команда `npm --prefix web ci && npm --prefix web run build`, publish path `web/dist`. Маршруты через HashRouter (`#/inbox`), без rewrite-правил.

## Статус

Есть фронт-демо и план ядра. Backend ещё не начат — см. [план разработки](docs/DEVELOPMENT_PLAN.md).
