export const SYSTEM_SPACE_PERSONAL = 'personal';
export const SYSTEM_LIST_PERSONAL_INBOX = 'personal-inbox';
export const SYSTEM_SPACE_HOST = 'host';

export const HOST_ENTITY_TYPES = ['brand', 'batch', 'deal', 'project'] as const;
export type HostEntityType = (typeof HOST_ENTITY_TYPES)[number];
/** Types shown in UI v1; others stay in enum for API/compat. */
export const HOST_ENTITY_TYPES_VISIBLE = ['brand'] as const;
export type HostEntityTypeVisible = (typeof HOST_ENTITY_TYPES_VISIBLE)[number];
export const HOST_ENTITY_NAME_MAX_LENGTH = 200;
export const HOST_ENTITIES_PAGE_DEFAULT = 50;
export const HOST_ENTITIES_PAGE_MAX = 100;

export const POSITION_STEP = 1000;
export const MIN_GAP = 0.0001;

export const TITLE_MAX_LENGTH = 500;
export const DOMAIN_LABEL_MAX_LENGTH = 200;
export const TEMPLATE_NAME_MAX_LENGTH = 120;
export const TEMPLATE_ITEMS_MAX = 50;
export const DUE_SOON_HOURS = 24;
export const NOTIFICATION_SNOOZE_HOURS_DEFAULT = 4;
export const QUIET_HOURS_MIN = 0;
export const QUIET_HOURS_MAX = 1439;
export const SNOOZE_HOURS_MIN = 1;
export const SNOOZE_HOURS_MAX = 168;

/** Default IANA zone for new users (UTC+4). Per-user override in profile. */
export const DEFAULT_TIMEZONE = 'Asia/Dubai';
export const SUPPORTED_LOCALES = ['ru', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 120;
export const JOB_TITLE_MAX_LENGTH = 120;
export const PASSWORD_CHANGE_MAX_ATTEMPTS = 5;
export const PASSWORD_CHANGE_WINDOW_MS = 15 * 60_000;
/** 12 bytes → 16 base64url chars, above PASSWORD_MIN_LENGTH. */
export const TEMP_PASSWORD_BYTES = 12;

export const DEFAULT_STATUSES = [
  { name: 'К выполнению', color: '#94a3b8', order: 0, category: 'OPEN' as const, isDefault: true },
  { name: 'В работе', color: '#3b82f6', order: 1, category: 'IN_PROGRESS' as const, isDefault: false },
  { name: 'На проверке', color: '#d97706', order: 2, category: 'IN_PROGRESS' as const, isDefault: false },
  { name: 'Готово', color: '#22c55e', order: 3, category: 'DONE' as const, isDefault: false },
  { name: 'Отменено', color: '#ef4444', order: 4, category: 'CANCELLED' as const, isDefault: false },
];

/** List-column name for review submission (canonical status stays IN_PROGRESS). */
export const LIST_STATUS_NAME_IN_REVIEW = 'На проверке';

export const ASSIGNEE_ONLY_FIELDS = ['status', 'listStatusId', 'position', 'rank'] as const;

export const SPACE_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;
export const TASK_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}-\d+$/;
export const BACKLOG_STATUS_NAME = 'Бэклог';
export const EPIC_TYPE_KEY = 'epic';

export const BOARD_NAME_MAX_LENGTH = 120;
export const BOARD_MAX_CARDS = 500;
export const BOARD_DONE_HIDE_DAYS = 14;
export const BOARD_REFRESH_MS = 30_000;
export const BOARD_CARD_FIELDS_MAX = 3;
export const BOARD_RECENT_HOURS = 24;
export const LABEL_NAME_MAX_LENGTH = 40;
export const STORY_POINTS_MAX = 999.9;
export const SPRINT_DEFAULT_LENGTH_DAYS = 14;
export const SPRINT_NAME_MAX_LENGTH = 120;
export const VELOCITY_SPRINTS = 7;
export const CYCLE_ROLLING_WINDOW = 10;
export const REPORT_DEFAULT_DAYS = 30;

export const FILTER_MAX_DEPTH = 3;
export const FILTER_MAX_CONDITIONS = 20;
export const CURSOR_PAGE_DEFAULT = 50;
export const CURSOR_PAGE_MAX = 100;
export const MAX_AUTOMATION_DEPTH = 3;

export const HTTP_TIMEOUT_MS = 15_000;

export const SCHEDULE_TITLE_MAX_LENGTH = 200;
export const SCHEDULE_AT_MINUTE_MIN = 0;
export const SCHEDULE_AT_MINUTE_MAX = 1439;
export const SCHEDULE_WEEKDAY_MIN = 1;
export const SCHEDULE_WEEKDAY_MAX = 7;
export const SCHEDULE_MONTHDAY_MIN = 1;
export const SCHEDULE_MONTHDAY_MAX = 28;
export const SCHEDULE_DUE_USER_BATCH = 100;
export const SCHEDULE_RUN_BATCH = 50;
export const STUCK_REASON_MAX_LENGTH = 500;
export const RESCHEDULED_MIN_MOVES = 2;

export const DEFAULT_TASK_TYPES = [
  { key: 'task', name: 'Задача', color: '#64748b', position: 0 },
  { key: 'milestone', name: 'Веха', color: '#8b5cf6', position: 1 },
  { key: 'approval', name: 'Согласование', color: '#d97706', position: 2 },
  { key: 'epic', name: 'Эпик', color: '#7c3aed', position: 3 },
] as const;

export const EPIC_COLORS = ['#3b82f6', '#8b5cf6', '#d97706', '#22c55e', '#ef4444', '#0891b2', '#db2777'] as const;

export const KNOWN_SPACE_KEYS: Record<string, string> = {
  ops: 'OPS',
  personal: 'ME',
  host: 'BR',
};
