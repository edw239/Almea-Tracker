-- Space keys and per-space issue sequence.
ALTER TABLE "task_spaces" ADD COLUMN "key" VARCHAR(10);
ALTER TABLE "task_spaces" ADD COLUMN "task_seq" INTEGER NOT NULL DEFAULT 0;

UPDATE "task_spaces"
SET "key" = CASE "system_key"
  WHEN 'ops' THEN 'OPS'
  WHEN 'personal' THEN 'ME'
  WHEN 'host' THEN 'BR'
  ELSE NULL
END;

WITH "rest" AS (
  SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS "n"
  FROM "task_spaces"
  WHERE "key" IS NULL
)
UPDATE "task_spaces" AS "s"
SET "key" = 'P' || lpad("rest"."n"::text, 2, '0')
FROM "rest"
WHERE "s"."id" = "rest"."id";

ALTER TABLE "task_spaces" ALTER COLUMN "key" SET NOT NULL;
CREATE UNIQUE INDEX "task_spaces_key_key" ON "task_spaces"("key");

-- Task key, rank, and the moment the status last changed.
ALTER TABLE "tasks" ADD COLUMN "key" VARCHAR(24);
ALTER TABLE "tasks" ADD COLUMN "rank" VARCHAR(64);
ALTER TABLE "tasks" ADD COLUMN "status_changed_at" TIMESTAMP(3);

WITH "numbered" AS (
  SELECT
    "t"."id",
    "s"."key" AS "space_key",
    row_number() OVER (PARTITION BY "s"."id" ORDER BY "t"."created_at", "t"."id") AS "n"
  FROM "tasks" AS "t"
  JOIN "task_lists" AS "l" ON "l"."id" = "t"."list_id"
  JOIN "task_spaces" AS "s" ON "s"."id" = "l"."space_id"
)
UPDATE "tasks" AS "t"
SET
  "key" = "numbered"."space_key" || '-' || "numbered"."n"::text,
  "status_changed_at" = COALESCE("t"."completed_at", "t"."updated_at", "t"."created_at")
FROM "numbered"
WHERE "t"."id" = "numbered"."id";

UPDATE "task_spaces" AS "s"
SET "task_seq" = COALESCE((
  SELECT MAX(split_part("t"."key", '-', 2)::integer)
  FROM "tasks" AS "t"
  JOIN "task_lists" AS "l" ON "l"."id" = "t"."list_id"
  WHERE "l"."space_id" = "s"."id"
), 0);

WITH "ranked" AS (
  SELECT "id", row_number() OVER (ORDER BY "position", "created_at", "id") AS "n"
  FROM "tasks"
)
UPDATE "tasks" AS "t"
SET "rank" = 'U' || lpad(to_hex("ranked"."n"), 8, '0')
FROM "ranked"
WHERE "t"."id" = "ranked"."id";

ALTER TABLE "tasks" ALTER COLUMN "key" SET NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "rank" SET NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "status_changed_at" SET NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "status_changed_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "tasks" ALTER COLUMN "rank" SET DATA TYPE VARCHAR(64) COLLATE "C";

CREATE UNIQUE INDEX "tasks_key_key" ON "tasks"("key");
CREATE UNIQUE INDEX "tasks_rank_key" ON "tasks"("rank");
CREATE INDEX "tasks_rank_idx" ON "tasks"("rank");

CREATE TABLE "task_key_aliases" (
  "key" VARCHAR(24) NOT NULL,
  "task_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_key_aliases_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "task_key_aliases_task_id_idx" ON "task_key_aliases"("task_id");

ALTER TABLE "task_key_aliases"
  ADD CONSTRAINT "task_key_aliases_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "task_status_transitions" (
  "id" UUID NOT NULL,
  "task_id" UUID NOT NULL,
  "from_status" "TaskStatus",
  "from_list_status_id" UUID,
  "from_category" "TaskStatus",
  "to_status" "TaskStatus" NOT NULL,
  "to_list_status_id" UUID,
  "to_category" "TaskStatus" NOT NULL,
  "actor_user_id" UUID,
  "reason" VARCHAR(40) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_status_transitions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_status_transitions_task_id_created_at_idx"
  ON "task_status_transitions"("task_id", "created_at");
CREATE INDEX "task_status_transitions_to_category_created_at_idx"
  ON "task_status_transitions"("to_category", "created_at");

ALTER TABLE "task_status_transitions"
  ADD CONSTRAINT "task_status_transitions_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One synthetic transition per existing task so reports have a starting point.
INSERT INTO "task_status_transitions" (
  "id", "task_id", "from_status", "from_list_status_id", "from_category",
  "to_status", "to_list_status_id", "to_category", "actor_user_id", "reason", "created_at"
)
SELECT
  gen_random_uuid(),
  "id",
  NULL,
  NULL,
  NULL,
  "status",
  "list_status_id",
  "status",
  "created_by_user_id",
  'synthetic',
  "created_at"
FROM "tasks";
