-- AlterTable
ALTER TABLE "users" ADD COLUMN "quiet_hours_from" INTEGER,
ADD COLUMN "quiet_hours_to" INTEGER,
ADD COLUMN "snooze_hours_default" INTEGER;

-- CreateTable
CREATE TABLE "user_notification_settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code" "NotificationCode" NOT NULL,
    "in_app" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_notification_settings_user_id_idx" ON "user_notification_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_notification_settings_user_id_code_key" ON "user_notification_settings"("user_id", "code");

-- AddForeignKey
ALTER TABLE "user_notification_settings" ADD CONSTRAINT "user_notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
