-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "VehicleExpenseCategory" AS ENUM ('routine_service', 'repair', 'tires', 'detailing', 'tax_registration', 'insurance', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- If enum already existed, ensure insurance is present
ALTER TYPE "VehicleExpenseCategory" ADD VALUE IF NOT EXISTS 'insurance';

-- CreateTable
CREATE TABLE IF NOT EXISTS "VehicleExpense" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "category" "VehicleExpenseCategory" NOT NULL DEFAULT 'routine_service',
    "amount" DECIMAL(12,2) NOT NULL,
    "odometerKm" INTEGER,
    "vendorName" TEXT,
    "invoiceNumber" TEXT,
    "receiptPath" TEXT,
    "description" TEXT,
    "expenseDate" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "voidedAt" TIMESTAMPTZ(6),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleExpense_pkey" PRIMARY KEY ("id")
);

-- Ensure receiptPath column exists if table was created previously with receiptUrl
ALTER TABLE "VehicleExpense" DROP COLUMN IF EXISTS "receiptUrl";
ALTER TABLE "VehicleExpense" ADD COLUMN IF NOT EXISTS "receiptPath" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VehicleExpense_vehicleId_expenseDate_idx" ON "VehicleExpense"("vehicleId", "expenseDate");
CREATE INDEX IF NOT EXISTS "VehicleExpense_branchId_expenseDate_idx" ON "VehicleExpense"("branchId", "expenseDate");
DROP INDEX IF EXISTS "VehicleExpense_branchId_isVoided_idx";
CREATE INDEX IF NOT EXISTS "VehicleExpense_branchId_isVoided_expenseDate_idx" ON "VehicleExpense"("branchId", "isVoided", "expenseDate");
CREATE INDEX IF NOT EXISTS "VehicleExpense_branchId_vendorName_invoiceNumber_idx" ON "VehicleExpense"("branchId", "vendorName", "invoiceNumber");
CREATE INDEX IF NOT EXISTS "VehicleExpense_category_idx" ON "VehicleExpense"("category");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "VehicleExpense" ADD CONSTRAINT "VehicleExpense_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "VehicleExpense" ADD CONSTRAINT "VehicleExpense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "VehicleExpense" ADD CONSTRAINT "VehicleExpense_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "VehicleExpense" ADD CONSTRAINT "VehicleExpense_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
