-- Stuck flag (F7) + due move counter (F9)
ALTER TABLE "tasks"
  ADD COLUMN "is_stuck" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stuck_at" TIMESTAMP(3),
  ADD COLUMN "stuck_reason" VARCHAR(500),
  ADD COLUMN "stuck_by_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN "due_date_move_count" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "tasks_is_stuck_idx" ON "tasks"("is_stuck") WHERE "is_stuck";

ALTER TYPE "NotificationCode" ADD VALUE 'TASK_STUCK';
