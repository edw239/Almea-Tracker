export const SYSTEM_SPACE_PERSONAL = 'personal';
export const SYSTEM_LIST_PERSONAL_INBOX = 'personal-inbox';
export const SYSTEM_SPACE_HOST = 'host';

export const HOST_ENTITY_TYPES = ['brand', 'batch', 'deal', 'project'] as const;
export type HostEntityType = (typeof HOST_ENTITY_TYPES)[number];

export const POSITION_STEP = 1000;
export const MIN_GAP = 0.0001;

export const TITLE_MAX_LENGTH = 500;
export const DOMAIN_LABEL_MAX_LENGTH = 200;
export const TEMPLATE_NAME_MAX_LENGTH = 120;
export const TEMPLATE_ITEMS_MAX = 50;
export const DUE_SOON_HOURS = 24;
export const NOTIFICATION_SNOOZE_HOURS_DEFAULT = 4;

export const DEFAULT_STATUSES = [
  { name: 'К выполнению', color: '#94a3b8', order: 0, category: 'OPEN' as const, isDefault: true },
  { name: 'В работе', color: '#3b82f6', order: 1, category: 'IN_PROGRESS' as const, isDefault: false },
  { name: 'Готово', color: '#22c55e', order: 2, category: 'DONE' as const, isDefault: false },
  { name: 'Отменено', color: '#ef4444', order: 3, category: 'CANCELLED' as const, isDefault: false },
];

export const ASSIGNEE_ONLY_FIELDS = ['status', 'listStatusId', 'position'] as const;

export const FILTER_MAX_DEPTH = 3;
export const FILTER_MAX_CONDITIONS = 20;
export const CURSOR_PAGE_DEFAULT = 50;
export const CURSOR_PAGE_MAX = 100;
export const MAX_AUTOMATION_DEPTH = 3;

export const HTTP_TIMEOUT_MS = 15_000;
