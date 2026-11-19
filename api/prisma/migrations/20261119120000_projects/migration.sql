-- Commitment with an end date. Separate from host entities (brand) and from spaces.
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ON_HOLD', 'CLOSED');
CREATE TYPE "ProjectMemberRole" AS ENUM ('SPONSOR', 'LEAD', 'CONTRIBUTOR');

CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "name_key" VARCHAR(200) NOT NULL,
    "outcome" VARCHAR(2000),
    "start_date" DATE,
    "target_end_date" DATE,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "closed_at" TIMESTAMP(3),
    "close_note" VARCHAR(2000),
    "list_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "projects_name_key_key" ON "projects"("name_key");
CREATE UNIQUE INDEX "projects_list_id_key" ON "projects"("list_id");
CREATE INDEX "projects_status_target_end_date_idx" ON "projects"("status", "target_end_date");

CREATE TABLE "project_members" (
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "ProjectMemberRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_members_pkey" PRIMARY KEY ("project_id", "user_id")
);

CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

ALTER TABLE "tasks" ADD COLUMN "project_id" UUID;
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_list_id_fkey"
  FOREIGN KEY ("list_id") REFERENCES "task_lists"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_members"
  ADD CONSTRAINT "project_members_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_members"
  ADD CONSTRAINT "project_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
