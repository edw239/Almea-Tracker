import { TaskPriority } from '@prisma/client';
import { z } from 'zod';
import { TEMPLATE_ITEMS_MAX, TITLE_MAX_LENGTH } from '../../common/constants';
import { AppError } from '../../common/errors';

const checklistSchema = z.object({
  text: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
});

const subtaskSchema = z.object({
  title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
  priority: z.nativeEnum(TaskPriority).optional(),
});

const itemSchema = z.object({
  title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
  description: z.string().trim().max(5000).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  checklist: z.array(checklistSchema).max(50).optional(),
  subtasks: z.array(subtaskSchema).max(20).optional(),
});

const itemsSchema = z.array(itemSchema).min(1).max(TEMPLATE_ITEMS_MAX);

export type TemplateItem = z.infer<typeof itemSchema>;

/** Validates template items JSON at API boundary. */
export function parseTemplateItems(raw: unknown): TemplateItem[] {
  const parsed = itemsSchema.safeParse(raw);
  if (!parsed.success) {
    throw AppError.badRequest('Некорректный формат items шаблона');
  }
  return parsed.data;
}
