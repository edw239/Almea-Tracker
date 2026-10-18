# Almea Tracker — дизайн-система

| Поле | Значение |
| ---- | -------- |
| **Статус** | Approved v2 |
| **Дата** | 2026-10-17 |
| **Продукт** | Внутренний Work Management |
| **Палитра** | Брендбук ALMEA (forest / moss / lemon + нейтрали) |
| **Правила формы и chrome** | Cosmonavt ERP UI kit (адаптация) |
| **Реализация** | `web/src/index.css`, `web/src/components/ui/*`, `web/src/components/layout/*` |

Документ — источник правды для UI. Код подтягивается к нему, не наоборот.

---

## 1. Принцип

1. **Content over chrome.** Один page header + одна toolbar-полоса. Редкие действия — в overflow.
2. **Палитра Almea.** Белый холст, серый хром, Black Forest, Lemon точками, Moss на hover primary.
3. **Shade, not stroke.** Залитый блок (карточка, панель, чип, notice) отделяется оттенком (`bg-surface` / `bg-inset` / status tint), не рамкой. Outline-контролы без заливки, разделители строк и focus-ring — со stroke.
4. **Русский UI.** Подписи интерфейса на русском (в т.ч. «Уведомления» вместо Inbox).
5. **Нет native confirm/prompt.** Только `useConfirm()`.

Lemon не заменяет primary и не красится в фон экрана. Олива и беж — supporting, не canvas.

---

## 2. Цвет

Примитивы и семантика v1 сохранены:

| Токен | HEX / значение | Роль |
| ----- | -------------- | ---- |
| `--forest` | `#1D1E1A` | Текст, primary CTA |
| `--moss` | `#264A35` | Hover primary (`--brand-hover`) |
| `--lemon` | `#E7FC95` | Громкий акцент (заливка) |
| `--olive` / `--beige` | brandbook | Supporting |
| `--danger` | `#A33B32` | Overdue / destructive |
| `--danger-soft` | `#F3E4E1` | Warn chip |

Семантические поверхности (Tailwind colors):

| Token | Значение |
| ----- | -------- |
| `bg-base` | white canvas |
| `bg-surface` | gray-100 |
| `bg-elevated` | white (карточки поверх surface) |
| `bg-inset` | gray-200 |
| `bg-primary` | forest |
| `bg-accent` | lemon |
| `text-accent-foreground` | forest (текст на лимоне) |

**Lemon на белом — только пятно, не буква.** Запрещён `text-accent` без `-foreground`. Следит `web/src/lib/ds-contract.spec.ts`.

**Focus ring:** двойной — `0 0 0 1px forest` + лимонное гало 4px. Чистый лимон на белом не даёт 3:1.

---

## 3. Форма (v2 — правила Cosmonavt)

| Элемент | Радиус |
| ------- | ------ |
| Кнопка, чип, сегмент, nav-pill, аватар | `--radius-pill` (999px) |
| Поля, select, date picker | `--radius-control` (12px) |
| Menus, popovers, dialogs | `--radius-overlay` (12px) |
| Form notices, просторные панели | `--radius-panel` (16px) |
| Плотные таблицы, канбан-карточки | `--radius-box` (4px) |

### Отменено из v1

| v1 | v2 |
| -- | -- |
| Кнопки label-caps + tracking 0.16em | Sentence / title case, `font-medium` |
| Инпуты radius 4px | `--radius-control` 12px |
| Карточки с hairline-бордером | Shade (`bg-surface` / `bg-elevated`), без stroke |
| Focus ring только lemon 3px | Двойной forest + lemon |

---

## 4. Типографика

| Роль | Шрифт | Класс / токен |
| ---- | ----- | ------------- |
| UI / body | Manrope Variable | `font-sans` |
| Display | Inter Tight Variable | `.text-display-lg/md/sm`, `font-display` |
| Meta labels | Manrope | `.label-overline` (0.7rem, tracking 0.08em, uppercase) |

Подключение: `@fontsource-variable/manrope` + `@fontsource-variable/inter-tight` в `main.tsx`.

---

## 5. Каркас страницы

```
AppShell (Sidebar + TopBar)
  └─ PageHeader (title, actions, overflow, optional toolbar)
       └─ PageToolbar (views, search, filters, counters)
            └─ Content
```

- `PageHeader` — вместо ad-hoc `<h1 className="page-title">`.
- `PageToolbar` — вместо стека фильтров.
- Global search в TopBar компактный (иконка + Ctrl/⌘K).

---

## 6. Компоненты

| Need | Use |
| ---- | --- |
| Button | `components/ui/button.tsx` |
| Dialog / confirm | `components/ui/dialog.tsx`, `alert-dialog.tsx`, `hooks/useConfirm.tsx` |
| Side panel | `components/ui/drawer.tsx` |
| Menu | `components/ui/dropdown-menu.tsx` |
| Select | `components/ui/select-field.tsx` |
| Tooltip | `components/ui/tooltip.tsx` |
| Badge / Input / Form notice | `components/ui/{badge,input,form-notice}.tsx` |
| Avatar | `components/ui/avatar.tsx` (initials) |
| Empty / error / skeleton | `EmptyState`, `LoadErrorNotice`, `ui/Skeleton` |
| Control helpers | `lib/control-styles.ts` |

Primary в покое — чёрная пилюля (forest); hover — Moss (`--brand-hover`). Accent — lemon fill + forest text.

---

## 7. Сайдбар

Prefs: `{ pinned, mode: 'expanded'|'collapsed', expandedWidth }` в `localStorage` (`almea.sidebar.prefs`).

| Константа | Значение |
| --------- | -------- |
| Collapsed rail | 72px |
| Default expanded | 268px |
| Min / max expanded | 200 / 440px |
| Collapse drag threshold | 140px |
| Idle auto-collapse (unpinned) | 30s |

Collapsed: icon rail + portal loupe (220ms scale/blur). Counters: lemon pill expanded; dot + loupe text collapsed. Spaces tree: marks + loupe when collapsed.

---

## 8. Motion

| Token | Value |
| ----- | ----- |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Overlay in / out | 200ms / 150ms |
| Content | 280ms |
| Page enter / loupe | 220ms |

`prefers-reduced-motion: reduce` отключает page-enter, animate-in/out, dialog-motion, loupe.

---

## 9. Тёмная тема

**v2 нет.** `color-scheme: light`. Структура токенов допускает `.dark` позже.

---

## 10. Bundle

| Срез | JS | CSS | gzip JS / CSS |
| ---- | -- | --- | ------------- |
| Phase 0 (фундамент) | ~379 kB | ~51 kB | ~113 / ~13 |
| Phase 7 (полный кит) | ~997 kB | ~79 kB | ~277 / ~18 |

Рост ожидаем: Radix ×7, Phosphor, sonner, react-day-picker, fontsource. Дальше — code-splitting по маршрутам.
