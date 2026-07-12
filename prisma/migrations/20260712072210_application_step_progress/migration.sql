-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "completedSteps" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
