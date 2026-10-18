import { FILTER_MAX_CONDITIONS, FILTER_MAX_DEPTH } from '../../common/constants';
import { AppError } from '../../common/errors';

export const FILTER_FIELDS = [
  'status',
  'priority',
  'assignee_id',
  'due_date',
  'title',
  'list_status_id',
  'task_type_id',
  'host_entity_id',
  'list_id',
  'updated_at',
  'key',
  'epic_id',
  'label_id',
  'story_points',
  'sprint_id',
] as const;

export type FilterField = (typeof FILTER_FIELDS)[number];

export const FILTER_OPERATORS = [
  'is',
  'is_not',
  'is_set',
  'is_not_set',
  'gt',
  'lt',
  'between',
  'contains',
] as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export type FilterCondition = {
  field: FilterField;
  operator: FilterOperator;
  value?: unknown;
};

export type FilterGroup = {
  op: 'AND' | 'OR';
  children: Array<FilterCondition | FilterGroup>;
};

const FIELD_OPS: Record<FilterField, FilterOperator[]> = {
  status: ['is', 'is_not'],
  priority: ['is', 'is_not'],
  list_status_id: ['is', 'is_not', 'is_set', 'is_not_set'],
  assignee_id: ['is', 'is_not', 'is_set', 'is_not_set'],
  title: ['contains'],
  due_date: ['is_set', 'is_not_set', 'gt', 'lt', 'between'],
  task_type_id: ['is', 'is_not', 'is_set', 'is_not_set'],
  host_entity_id: ['is', 'is_not', 'is_set', 'is_not_set'],
  list_id: ['is', 'is_not'],
  updated_at: ['is_set', 'is_not_set', 'gt', 'lt', 'between'],
  key: ['is'],
  epic_id: ['is', 'is_not', 'is_set', 'is_not_set'],
  label_id: ['is', 'is_not'],
  story_points: ['is', 'gt', 'lt', 'is_set', 'is_not_set'],
  sprint_id: ['is', 'is_not', 'is_set', 'is_not_set'],
};

function isGroup(node: FilterCondition | FilterGroup): node is FilterGroup {
  return 'op' in node && 'children' in node;
}

function countConditions(node: FilterCondition | FilterGroup): number {
  if (!isGroup(node)) return 1;
  return node.children.reduce((sum, child) => sum + countConditions(child), 0);
}

function maxDepth(node: FilterCondition | FilterGroup, depth = 1): number {
  if (!isGroup(node)) return depth;
  return Math.max(depth, ...node.children.map((child) => maxDepth(child, depth + 1)));
}

export function parseFilters(raw: string | undefined | null): FilterGroup | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw AppError.badRequest('Невалидный filters JSON');
  }
  return validateFilterGroup(parsed);
}

export function validateFilterGroup(raw: unknown): FilterGroup {
  if (!raw || typeof raw !== 'object' || !('op' in raw) || !('children' in raw)) {
    throw AppError.badRequest('Корень filters должен быть группой');
  }
  const group = raw as FilterGroup;
  if (group.op !== 'AND' && group.op !== 'OR') {
    throw AppError.badRequest('filters.op должен быть AND|OR');
  }
  if (!Array.isArray(group.children)) {
    throw AppError.badRequest('filters.children обязателен');
  }
  for (const child of group.children) {
    validateNode(child);
  }
  if (maxDepth(group) > FILTER_MAX_DEPTH) {
    throw AppError.badRequest(`Глубина filters > ${FILTER_MAX_DEPTH}`);
  }
  if (countConditions(group) > FILTER_MAX_CONDITIONS) {
    throw AppError.badRequest(`Слишком много условий (> ${FILTER_MAX_CONDITIONS})`);
  }
  return group;
}

function validateNode(node: unknown): asserts node is FilterCondition | FilterGroup {
  if (!node || typeof node !== 'object') {
    throw AppError.badRequest('Невалидный узел filters');
  }
  if ('op' in node) {
    validateFilterGroup(node);
    return;
  }
  const condition = node as FilterCondition;
  if (!FILTER_FIELDS.includes(condition.field as FilterField)) {
    throw AppError.badRequest(`Неизвестное поле ${String(condition.field)}`);
  }
  if (!FILTER_OPERATORS.includes(condition.operator as FilterOperator)) {
    throw AppError.badRequest(`Неизвестный оператор ${String(condition.operator)}`);
  }
  const allowed = FIELD_OPS[condition.field as FilterField];
  if (!allowed.includes(condition.operator as FilterOperator)) {
    throw AppError.badRequest(`Пара ${condition.field}/${condition.operator} запрещена`);
  }
}

/** Build a Prisma where fragment from a validated filter tree. */
export function filtersToPrisma(group: FilterGroup): Record<string, unknown> {
  const parts = group.children.map((child) => (isGroup(child) ? filtersToPrisma(child) : conditionToPrisma(child)));
  if (parts.length === 0) return {};
  return group.op === 'AND' ? { AND: parts } : { OR: parts };
}

function dateCondition(field: 'dueDate' | 'updatedAt', condition: FilterCondition): Record<string, unknown> {
  if (condition.operator === 'is_set') return { [field]: { not: null } };
  if (condition.operator === 'is_not_set') return { [field]: null };
  if (condition.operator === 'gt') return { [field]: { gt: new Date(String(condition.value)) } };
  if (condition.operator === 'lt') return { [field]: { lt: new Date(String(condition.value)) } };
  if (condition.operator === 'between' && Array.isArray(condition.value) && condition.value.length === 2) {
    return {
      [field]: {
        gte: new Date(String(condition.value[0])),
        lte: new Date(String(condition.value[1])),
      },
    };
  }
  throw AppError.badRequest(`Невалидный ${field} filter`);
}

function idCondition(
  field: 'taskTypeId' | 'hostEntityId' | 'epicId' | 'sprintId',
  condition: FilterCondition,
): Record<string, unknown> {
  if (condition.operator === 'is_set') return { [field]: { not: null } };
  if (condition.operator === 'is_not_set') return { [field]: null };
  return condition.operator === 'is' ? { [field]: condition.value } : { [field]: { not: condition.value } };
}

function conditionToPrisma(condition: FilterCondition): Record<string, unknown> {
  switch (condition.field) {
    case 'status':
    case 'priority':
      return condition.operator === 'is'
        ? { [condition.field]: condition.value }
        : { [condition.field]: { not: condition.value } };
    case 'list_status_id':
      if (condition.operator === 'is_set') return { listStatusId: { not: null } };
      if (condition.operator === 'is_not_set') return { listStatusId: null };
      return condition.operator === 'is'
        ? { listStatusId: condition.value }
        : { listStatusId: { not: condition.value } };
    case 'assignee_id':
      if (condition.operator === 'is_set') return { assignees: { some: {} } };
      if (condition.operator === 'is_not_set') return { assignees: { none: {} } };
      return condition.operator === 'is'
        ? { assignees: { some: { userId: condition.value } } }
        : { assignees: { none: { userId: condition.value } } };
    case 'title':
      return { title: { contains: String(condition.value ?? ''), mode: 'insensitive' } };
    case 'due_date':
      return dateCondition('dueDate', condition);
    case 'updated_at':
      return dateCondition('updatedAt', condition);
    case 'task_type_id':
      return idCondition('taskTypeId', condition);
    case 'host_entity_id':
      return idCondition('hostEntityId', condition);
    case 'epic_id':
      return idCondition('epicId', condition);
    case 'sprint_id':
      return idCondition('sprintId', condition);
    case 'list_id':
      return condition.operator === 'is'
        ? { listId: condition.value }
        : { listId: { not: condition.value } };
    case 'key':
      return { key: String(condition.value ?? '') };
    case 'label_id':
      return condition.operator === 'is'
        ? { labels: { some: { labelId: condition.value } } }
        : { labels: { none: { labelId: condition.value } } };
    case 'story_points':
      if (condition.operator === 'is_set') return { storyPoints: { not: null } };
      if (condition.operator === 'is_not_set') return { storyPoints: null };
      if (condition.operator === 'is') return { storyPoints: condition.value };
      if (condition.operator === 'gt') return { storyPoints: { gt: condition.value } };
      if (condition.operator === 'lt') return { storyPoints: { lt: condition.value } };
      throw AppError.badRequest('Невалидный story_points filter');
    default:
      throw AppError.badRequest('Неизвестное поле');
  }
}
