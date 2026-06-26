-- CreateEnum
CREATE TYPE "SchemeLevel" AS ENUM ('CENTRAL', 'STATE');

-- CreateEnum
CREATE TYPE "RuleOperator" AS ENUM ('EQ', 'NEQ', 'LT', 'LTE', 'GT', 'GTE', 'IN', 'NOT_IN', 'BETWEEN');

-- CreateEnum
CREATE TYPE "SocialCategory" AS ENUM ('GENERAL', 'OBC', 'SC', 'ST');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SAVED', 'IN_PROGRESS', 'APPLIED');

-- CreateTable
CREATE TABLE "Scheme" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ministry" TEXT,
    "category" TEXT,
    "level" "SchemeLevel" NOT NULL DEFAULT 'CENTRAL',
    "state" TEXT,
    "summary" TEXT NOT NULL,
    "benefits" TEXT,
    "howToApply" TEXT,
    "sourceUrl" TEXT,
    "translations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityRule" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "operator" "RuleOperator" NOT NULL,
    "value" JSONB NOT NULL,
    "orGroup" TEXT,
    "rawText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EligibilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequiredDocument" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "digilockerDocType" TEXT,

    CONSTRAINT "RequiredDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationStep" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,

    CONSTRAINT "ApplicationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitizenProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "state" TEXT,
    "annualIncome" INTEGER,
    "occupation" TEXT,
    "socialCategory" "SocialCategory",
    "isDisabled" BOOLEAN,
    "rationCardType" TEXT,
    "attributes" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CitizenProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SAVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigiLockerLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigiLockerLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDocument" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "uri" TEXT,
    "issuedAt" TIMESTAMP(3),

    CONSTRAINT "UserDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Scheme_slug_key" ON "Scheme"("slug");

-- CreateIndex
CREATE INDEX "Scheme_category_idx" ON "Scheme"("category");

-- CreateIndex
CREATE INDEX "Scheme_level_state_idx" ON "Scheme"("level", "state");

-- CreateIndex
CREATE INDEX "EligibilityRule_schemeId_idx" ON "EligibilityRule"("schemeId");

-- CreateIndex
CREATE INDEX "RequiredDocument_schemeId_idx" ON "RequiredDocument"("schemeId");

-- CreateIndex
CREATE INDEX "ApplicationStep_schemeId_idx" ON "ApplicationStep"("schemeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "CitizenProfile_userId_key" ON "CitizenProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_userId_schemeId_key" ON "Application"("userId", "schemeId");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_schemeId_key" ON "Bookmark"("userId", "schemeId");

-- CreateIndex
CREATE UNIQUE INDEX "DigiLockerLink_userId_key" ON "DigiLockerLink"("userId");

-- CreateIndex
CREATE INDEX "UserDocument_linkId_idx" ON "UserDocument"("linkId");

-- AddForeignKey
ALTER TABLE "EligibilityRule" ADD CONSTRAINT "EligibilityRule_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequiredDocument" ADD CONSTRAINT "RequiredDocument_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStep" ADD CONSTRAINT "ApplicationStep_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitizenProfile" ADD CONSTRAINT "CitizenProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigiLockerLink" ADD CONSTRAINT "DigiLockerLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDocument" ADD CONSTRAINT "UserDocument_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "DigiLockerLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
