-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "created_by_user_id" UUID;

-- CreateIndex
CREATE INDEX "tasks_created_by_user_id_idx" ON "tasks"("created_by_user_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
