-- CreateEnum
CREATE TYPE "ScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "task_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "list_id" UUID NOT NULL,
    "template_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "frequency" "ScheduleFrequency" NOT NULL,
    "by_weekday" SMALLINT,
    "by_monthday" SMALLINT,
    "at_minute" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "assignee_user_id" UUID,
    "due_in_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "next_run_at" TIMESTAMP(3) NOT NULL,
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "task_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_schedules_next_run_at_idx" ON "task_schedules"("next_run_at") WHERE "is_active";

CREATE TABLE "task_schedule_runs" (
    "schedule_id" UUID NOT NULL,
    "period_key" VARCHAR(40) NOT NULL,
    "task_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_schedule_runs_pkey" PRIMARY KEY ("schedule_id", "period_key")
);

ALTER TABLE "task_schedules"
  ADD CONSTRAINT "task_schedules_list_id_fkey"
  FOREIGN KEY ("list_id") REFERENCES "task_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_schedules"
  ADD CONSTRAINT "task_schedules_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "task_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "task_schedules"
  ADD CONSTRAINT "task_schedules_assignee_user_id_fkey"
  FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "task_schedule_runs"
  ADD CONSTRAINT "task_schedule_runs_schedule_id_fkey"
  FOREIGN KEY ("schedule_id") REFERENCES "task_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_schedule_runs"
  ADD CONSTRAINT "task_schedule_runs_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
