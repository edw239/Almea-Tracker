-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "review_required" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tasks" ADD COLUMN "submitted_at" TIMESTAMP(3);

CREATE INDEX "tasks_review_required_status_idx" ON "tasks"("review_required", "status");

-- Shift Done/Cancelled to make room for «На проверке» at order 2
UPDATE "task_list_statuses"
SET "order" = "order" + 1
WHERE "name" IN ('Готово', 'Отменено')
  AND "order" >= 2;

-- Idempotent seed of «На проверке» for every existing status board
INSERT INTO "task_list_statuses" (
  "id", "space_id", "list_id", "name", "color", "order", "category", "is_default", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  boards."space_id",
  boards."list_id",
  'На проверке',
  '#d97706',
  2,
  'IN_PROGRESS',
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "space_id", "list_id" FROM "task_list_statuses"
) AS boards
WHERE NOT EXISTS (
  SELECT 1
  FROM "task_list_statuses" existing
  WHERE existing."space_id" = boards."space_id"
    AND existing."list_id" IS NOT DISTINCT FROM boards."list_id"
    AND existing."name" = 'На проверке'
);
