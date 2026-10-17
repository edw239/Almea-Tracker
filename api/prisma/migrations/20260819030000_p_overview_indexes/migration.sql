-- CreateIndex
CREATE INDEX "tasks_status_updated_at_idx" ON "tasks"("status", "updated_at") WHERE "deleted_at" IS NULL;
