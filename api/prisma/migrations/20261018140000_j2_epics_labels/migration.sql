ALTER TABLE "tasks" ADD COLUMN "epic_id" UUID;
ALTER TABLE "tasks" ADD COLUMN "story_points" DECIMAL(5, 1);

CREATE INDEX "tasks_epic_id_idx" ON "tasks"("epic_id");

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_epic_id_fkey"
  FOREIGN KEY ("epic_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "labels" (
  "id" UUID NOT NULL,
  "name" VARCHAR(40) NOT NULL,
  "name_key" VARCHAR(40) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "labels_name_key_key" ON "labels"("name_key");

CREATE TABLE "task_labels" (
  "task_id" UUID NOT NULL,
  "label_id" UUID NOT NULL,
  CONSTRAINT "task_labels_pkey" PRIMARY KEY ("task_id", "label_id")
);

CREATE INDEX "task_labels_label_id_idx" ON "task_labels"("label_id");

ALTER TABLE "task_labels"
  ADD CONSTRAINT "task_labels_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_labels"
  ADD CONSTRAINT "task_labels_label_id_fkey"
  FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "task_types" ("id", "space_id", "key", "name", "color", "is_system", "position", "created_at", "updated_at")
SELECT gen_random_uuid(), "s"."id", 'epic', 'Эпик', '#8b5cf6', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "task_spaces" AS "s"
WHERE NOT EXISTS (
  SELECT 1 FROM "task_types" AS "t" WHERE "t"."space_id" = "s"."id" AND "t"."key" = 'epic'
);
