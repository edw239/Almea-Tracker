-- CreateTable
CREATE TABLE "task_templates" (
    "id" UUID NOT NULL,
    "space_id" UUID,
    "list_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "items" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_templates_space_id_is_active_idx" ON "task_templates"("space_id", "is_active");

-- CreateIndex
CREATE INDEX "task_templates_list_id_is_active_idx" ON "task_templates"("list_id", "is_active");

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "task_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "task_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
