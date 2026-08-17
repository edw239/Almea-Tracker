-- CreateEnum
CREATE TYPE "NotificationCode" AS ENUM ('TASK_ASSIGNED', 'TASK_DUE_SOON', 'TASK_OVERDUE', 'TASK_MENTION', 'TASK_COMMENT', 'TASK_REMINDER', 'TASK_STATUS_CHANGED');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "domain_entity_type" VARCHAR(40),
ADD COLUMN     "domain_label" VARCHAR(200);

-- CreateTable
CREATE TABLE "task_notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code" "NotificationCode" NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'LOW',
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "task_id" UUID,
    "read_at" TIMESTAMP(3),
    "snoozed_until" TIMESTAMP(3),
    "cleared_at" TIMESTAMP(3),
    "dedup_key" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_notifications_user_id_cleared_at_created_at_idx" ON "task_notifications"("user_id", "cleared_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "task_notifications_user_id_dedup_key_key" ON "task_notifications"("user_id", "dedup_key");

-- CreateIndex
CREATE INDEX "tasks_domain_entity_type_domain_entity_id_idx" ON "tasks"("domain_entity_type", "domain_entity_id");

-- AddForeignKey
ALTER TABLE "task_notifications" ADD CONSTRAINT "task_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_notifications" ADD CONSTRAINT "task_notifications_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
