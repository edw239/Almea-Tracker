CREATE TYPE "SprintState" AS ENUM ('FUTURE', 'ACTIVE', 'CLOSED');
CREATE TYPE "SprintEventType" AS ENUM (
  'COMMITTED',
  'ADDED',
  'REMOVED',
  'ESTIMATE_CHANGED',
  'DONE',
  'REOPENED',
  'CLOSED_DONE',
  'CLOSED_INCOMPLETE'
);

CREATE TABLE "sprints" (
  "id" UUID NOT NULL,
  "board_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "goal" VARCHAR(500),
  "state" "SprintState" NOT NULL DEFAULT 'FUTURE',
  "start_date" TIMESTAMP(3),
  "end_date" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  "position" DOUBLE PRECISION NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sprints_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sprints_board_id_state_idx" ON "sprints"("board_id", "state");
CREATE INDEX "sprints_board_id_position_idx" ON "sprints"("board_id", "position");

ALTER TABLE "sprints"
  ADD CONSTRAINT "sprints_board_id_fkey"
  FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD COLUMN "sprint_id" UUID;
CREATE INDEX "tasks_sprint_id_idx" ON "tasks"("sprint_id");

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_sprint_id_fkey"
  FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "sprint_events" (
  "id" UUID NOT NULL,
  "sprint_id" UUID NOT NULL,
  "task_id" UUID,
  "type" "SprintEventType" NOT NULL,
  "story_points" DECIMAL(5, 1),
  "actor_user_id" UUID,
  "details" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sprint_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sprint_events_sprint_id_created_at_idx" ON "sprint_events"("sprint_id", "created_at");
CREATE INDEX "sprint_events_task_id_idx" ON "sprint_events"("task_id");

ALTER TABLE "sprint_events"
  ADD CONSTRAINT "sprint_events_sprint_id_fkey"
  FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sprint_events"
  ADD CONSTRAINT "sprint_events_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
