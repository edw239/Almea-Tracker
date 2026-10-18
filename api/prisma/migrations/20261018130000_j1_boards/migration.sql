-- New favorite target. Not used in this migration, so it is safe inside the transaction.
ALTER TYPE "FavoriteEntityType" ADD VALUE 'BOARD';

CREATE TYPE "BoardType" AS ENUM ('KANBAN', 'SCRUM');
CREATE TYPE "BoardSwimlane" AS ENUM ('NONE', 'ASSIGNEE', 'EPIC', 'BRAND', 'PRIORITY', 'QUERIES');
CREATE TYPE "BoardCardColor" AS ENUM ('NONE', 'PRIORITY', 'TYPE', 'ASSIGNEE');

CREATE TABLE "boards" (
  "id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "type" "BoardType" NOT NULL,
  "owner_id" UUID NOT NULL,
  "filter" JSONB,
  "swimlane_by" "BoardSwimlane" NOT NULL DEFAULT 'NONE',
  "swimlane_queries" JSONB,
  "backlog_enabled" BOOLEAN NOT NULL DEFAULT false,
  "done_hide_days" INTEGER,
  "default_list_id" UUID,
  "card_color_by" "BoardCardColor" NOT NULL DEFAULT 'NONE',
  "card_fields" JSONB,
  "is_archived" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "boards_owner_id_idx" ON "boards"("owner_id");

ALTER TABLE "boards"
  ADD CONSTRAINT "boards_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "boards"
  ADD CONSTRAINT "boards_default_list_id_fkey"
  FOREIGN KEY ("default_list_id") REFERENCES "task_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "board_sources" (
  "id" UUID NOT NULL,
  "board_id" UUID NOT NULL,
  "space_id" UUID,
  "folder_id" UUID,
  "list_id" UUID,
  CONSTRAINT "board_sources_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "board_sources_one_target" CHECK (
    (("space_id" IS NOT NULL)::int + ("folder_id" IS NOT NULL)::int + ("list_id" IS NOT NULL)::int) = 1
  )
);

CREATE INDEX "board_sources_board_id_idx" ON "board_sources"("board_id");
CREATE INDEX "board_sources_space_id_idx" ON "board_sources"("space_id");
CREATE INDEX "board_sources_folder_id_idx" ON "board_sources"("folder_id");
CREATE INDEX "board_sources_list_id_idx" ON "board_sources"("list_id");

ALTER TABLE "board_sources"
  ADD CONSTRAINT "board_sources_board_id_fkey"
  FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "board_sources"
  ADD CONSTRAINT "board_sources_space_id_fkey"
  FOREIGN KEY ("space_id") REFERENCES "task_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "board_sources"
  ADD CONSTRAINT "board_sources_folder_id_fkey"
  FOREIGN KEY ("folder_id") REFERENCES "task_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "board_sources"
  ADD CONSTRAINT "board_sources_list_id_fkey"
  FOREIGN KEY ("list_id") REFERENCES "task_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "board_columns" (
  "id" UUID NOT NULL,
  "board_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "position" DOUBLE PRECISION NOT NULL,
  "status_names" TEXT[] NOT NULL,
  "min_wip" INTEGER,
  "max_wip" INTEGER,
  CONSTRAINT "board_columns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "board_columns_board_id_position_idx" ON "board_columns"("board_id", "position");

ALTER TABLE "board_columns"
  ADD CONSTRAINT "board_columns_board_id_fkey"
  FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "board_quick_filters" (
  "id" UUID NOT NULL,
  "board_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "filter" JSONB NOT NULL,
  "position" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "board_quick_filters_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "board_quick_filters_board_id_position_idx" ON "board_quick_filters"("board_id", "position");

ALTER TABLE "board_quick_filters"
  ADD CONSTRAINT "board_quick_filters_board_id_fkey"
  FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
