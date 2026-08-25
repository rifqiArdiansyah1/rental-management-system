-- AlterTable
ALTER TABLE "Branch" ADD COLUMN "openTime" TEXT NOT NULL DEFAULT '08:00',
ADD COLUMN "closeTime" TEXT NOT NULL DEFAULT '21:00';

-- CreateIndex
CREATE UNIQUE INDEX "Branch_name_key" ON "Branch"("name");

-- CreateIndex
CREATE INDEX "Branch_isActive_idx" ON "Branch"("isActive");
