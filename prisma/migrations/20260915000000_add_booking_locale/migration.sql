-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "Locale" AS ENUM ('id', 'en');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "locale" "Locale" NOT NULL DEFAULT 'id';
