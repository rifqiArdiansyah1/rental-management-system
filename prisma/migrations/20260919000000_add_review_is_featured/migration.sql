-- AlterTable
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "featuredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Review_isFeatured_isPublished_featuredAt_idx" ON "Review"("isFeatured", "isPublished", "featuredAt" DESC);
