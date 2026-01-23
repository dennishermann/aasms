-- Add enum values (idempotent)
DO $$
BEGIN
  ALTER TYPE "FacetType" ADD VALUE 'OPEN_CODED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create new enums
DO $$
BEGIN
  CREATE TYPE "ClassificationBasis" AS ENUM ('FULL_TEXT', 'METADATA_ONLY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "KeywordMappingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "KeywordMappingSource" AS ENUM ('LLM', 'USER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Alter Source
ALTER TABLE "Source" ADD COLUMN "allowMetadataOnlyClassification" BOOLEAN NOT NULL DEFAULT false;

-- Alter SourceAnalysis
ALTER TABLE "SourceAnalysis" ADD COLUMN "classificationBasis" "ClassificationBasis";

-- Create FacetKeyword table
CREATE TABLE "FacetKeyword" (
  "id" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "facetId" TEXT NOT NULL,
  "keyword" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "evidence" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FacetKeyword_pkey" PRIMARY KEY ("id")
);

-- Create FacetKeywordMapping table
CREATE TABLE "FacetKeywordMapping" (
  "id" TEXT NOT NULL,
  "facetId" TEXT NOT NULL,
  "keyword" TEXT NOT NULL,
  "categoryId" TEXT,
  "status" "KeywordMappingStatus" NOT NULL DEFAULT 'PENDING',
  "confidence" DOUBLE PRECISION,
  "source" "KeywordMappingSource" NOT NULL DEFAULT 'LLM',
  "proposedCategoryName" TEXT,
  "proposedCategoryDescription" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FacetKeywordMapping_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "FacetKeyword_analysisId_facetId_keyword_key" ON "FacetKeyword"("analysisId", "facetId", "keyword");
CREATE INDEX "FacetKeyword_analysisId_idx" ON "FacetKeyword"("analysisId");
CREATE INDEX "FacetKeyword_facetId_idx" ON "FacetKeyword"("facetId");

CREATE UNIQUE INDEX "FacetKeywordMapping_facetId_keyword_key" ON "FacetKeywordMapping"("facetId", "keyword");
CREATE INDEX "FacetKeywordMapping_facetId_idx" ON "FacetKeywordMapping"("facetId");
CREATE INDEX "FacetKeywordMapping_categoryId_idx" ON "FacetKeywordMapping"("categoryId");
CREATE INDEX "FacetKeywordMapping_status_idx" ON "FacetKeywordMapping"("status");

-- Foreign keys
ALTER TABLE "FacetKeyword" ADD CONSTRAINT "FacetKeyword_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "SourceAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacetKeyword" ADD CONSTRAINT "FacetKeyword_facetId_fkey" FOREIGN KEY ("facetId") REFERENCES "Facet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FacetKeywordMapping" ADD CONSTRAINT "FacetKeywordMapping_facetId_fkey" FOREIGN KEY ("facetId") REFERENCES "Facet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacetKeywordMapping" ADD CONSTRAINT "FacetKeywordMapping_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FacetCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
