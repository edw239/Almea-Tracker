-- CreateTable
CREATE TABLE "host_entities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "name_key" VARCHAR(200) NOT NULL,
    "external_key" VARCHAR(100),
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "host_entities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "host_entities_entity_type_name_key_key" ON "host_entities"("entity_type", "name_key");
CREATE INDEX "host_entities_entity_type_is_archived_idx" ON "host_entities"("entity_type", "is_archived");

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "host_entity_id" UUID;
ALTER TABLE "task_lists" ADD COLUMN "host_entity_id" UUID;

-- Backfill from tasks (label preferred over raw id)
INSERT INTO "host_entities" ("entity_type", "name", "name_key", "updated_at")
SELECT DISTINCT
  t."domain_entity_type",
  COALESCE(NULLIF(trim(t."domain_label"), ''), t."domain_entity_id"),
  lower(trim(COALESCE(NULLIF(trim(t."domain_label"), ''), t."domain_entity_id"))),
  CURRENT_TIMESTAMP
FROM "tasks" t
WHERE t."domain_entity_type" IS NOT NULL
  AND t."domain_entity_id" IS NOT NULL
  AND length(trim(COALESCE(NULLIF(trim(t."domain_label"), ''), t."domain_entity_id"))) > 0
ON CONFLICT ("entity_type", "name_key") DO NOTHING;

-- Backfill from host lists: system_key = entity:{type}:{legacyId}
INSERT INTO "host_entities" ("entity_type", "name", "name_key", "updated_at")
SELECT DISTINCT
  split_part(l."system_key", ':', 2),
  l."name",
  lower(trim(l."name")),
  CURRENT_TIMESTAMP
FROM "task_lists" l
WHERE l."system_key" LIKE 'entity:%:%'
  AND split_part(l."system_key", ':', 2) <> ''
  AND length(trim(l."name")) > 0
ON CONFLICT ("entity_type", "name_key") DO NOTHING;

UPDATE "tasks" t
SET "host_entity_id" = h."id"
FROM "host_entities" h
WHERE t."host_entity_id" IS NULL
  AND t."domain_entity_type" IS NOT NULL
  AND t."domain_entity_id" IS NOT NULL
  AND h."entity_type" = t."domain_entity_type"
  AND h."name_key" = lower(trim(COALESCE(NULLIF(trim(t."domain_label"), ''), t."domain_entity_id")));

UPDATE "task_lists" l
SET "host_entity_id" = h."id"
FROM "host_entities" h
WHERE l."host_entity_id" IS NULL
  AND l."system_key" LIKE 'entity:%:%'
  AND h."entity_type" = split_part(l."system_key", ':', 2)
  AND h."name_key" = lower(trim(l."name"));

-- AddForeignKey
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_host_entity_id_fkey"
  FOREIGN KEY ("host_entity_id") REFERENCES "host_entities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "task_lists"
  ADD CONSTRAINT "task_lists_host_entity_id_fkey"
  FOREIGN KEY ("host_entity_id") REFERENCES "host_entities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tasks_host_entity_id_idx" ON "tasks"("host_entity_id");
CREATE INDEX "task_lists_host_entity_id_idx" ON "task_lists"("host_entity_id");
