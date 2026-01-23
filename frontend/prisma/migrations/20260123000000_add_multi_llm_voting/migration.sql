-- CreateEnum
CREATE TYPE "CriterionType" AS ENUM ('INCLUSION', 'EXCLUSION');

-- AlterTable: Add voting fields to SourceAnalysis
ALTER TABLE "SourceAnalysis" ADD COLUMN IF NOT EXISTS "votingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SourceAnalysis" ADD COLUMN IF NOT EXISTS "votingSummary" JSONB;

-- CreateTable: AnalysisVote for storing individual LLM votes
CREATE TABLE IF NOT EXISTS "AnalysisVote" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "criterionType" "CriterionType" NOT NULL,
    "criterionIndex" INTEGER NOT NULL,
    "criterionText" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "decision" BOOLEAN NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasoning" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnalysisVote_analysisId_idx" ON "AnalysisVote"("analysisId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnalysisVote_analysisId_criterionType_idx" ON "AnalysisVote"("analysisId", "criterionType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnalysisVote_provider_idx" ON "AnalysisVote"("provider");

-- AddForeignKey
ALTER TABLE "AnalysisVote" ADD CONSTRAINT "AnalysisVote_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "SourceAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
