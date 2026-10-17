-- AlterTable
ALTER TABLE "users" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Dubai',
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'ru',
ADD COLUMN     "job_title" TEXT,
ADD COLUMN     "password_changed_at" TIMESTAMP(3);
