CREATE TABLE "task_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "space_id" UUID NOT NULL,
  "key" VARCHAR(40) NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "color" VARCHAR(20),
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_types_space_id_key_key" ON "task_types"("space_id", "key");

ALTER TABLE "task_types"
  ADD CONSTRAINT "task_types_space_id_fkey"
  FOREIGN KEY ("space_id") REFERENCES "task_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks"
  ADD COLUMN "task_type_id" UUID;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_task_type_id_fkey"
  FOREIGN KEY ("task_type_id") REFERENCES "task_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tasks_task_type_id_idx" ON "tasks"("task_type_id");
