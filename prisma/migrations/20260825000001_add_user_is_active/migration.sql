-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_branchId_role_idx" ON "User"("branchId", "role");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_branchId_isActive_idx" ON "User"("branchId", "isActive");
