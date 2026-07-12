-- AlterTable
ALTER TABLE "Scheme" ADD COLUMN     "closeDate" TIMESTAMP(3),
ADD COLUMN     "eligibilityText" TEXT,
ADD COLUMN     "openDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Scheme_closeDate_idx" ON "Scheme"("closeDate");
