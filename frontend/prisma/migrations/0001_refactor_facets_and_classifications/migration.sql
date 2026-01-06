-- CreateEnum
CREATE TYPE "FacetType" AS ENUM ('CLOSED', 'OPEN');

-- CreateEnum
CREATE TYPE "GreyLiteratureTier" AS ENUM ('TIER_1', 'TIER_2', 'TIER_3');

-- CreateEnum
CREATE TYPE "VenueType" AS ENUM ('JOURNAL', 'CONFERENCE', 'WORKSHOP', 'SYMPOSIUM', 'BOOK_CHAPTER', 'PREPRINT_SERVER', 'TECHNICAL_REPORT', 'BLOG', 'OTHER');

-- CreateEnum
CREATE TYPE "StudyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FormalSourceType" AS ENUM ('ACADEMIC_DATABASE', 'JOURNAL', 'CONFERENCE_PROCEEDINGS');

-- CreateEnum
CREATE TYPE "GreySourceType" AS ENUM ('BLOG', 'WHITE_PAPER', 'TECHNICAL_REPORT', 'PREPRINT_SERVER', 'COMPANY_WEBSITE', 'RESEARCH_LAB_SITE', 'GOVERNMENT_REPORT');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('PDF', 'WEBPAGE', 'PREPRINT', 'TECHNICAL_REPORT', 'WHITE_PAPER', 'BLOG_POST');

-- CreateEnum
CREATE TYPE "SourceCategory" AS ENUM ('FORMAL', 'GREY');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('PENDING', 'ANALYZING', 'ANALYZED', 'INCLUDED', 'EXCLUDED', 'NEEDS_REVIEW', 'EXTRACTING_METADATA', 'PENDING_METADATA', 'READY_FOR_ANALYSIS', 'ANALYZING_INCLUSION', 'ANALYZING_CLASSIFICATION', 'CLASSIFIED', 'READY_FOR_CLASSIFICATION', 'CLASSIFYING');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('INCLUDE', 'EXCLUDE');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateTable
CREATE TABLE "Study" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "StudyStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "motivation" TEXT,
    "importStatistics" JSONB,

    CONSTRAINT "Study_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchQuestion" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ResearchQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyParameters" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyParameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormalSource" (
    "id" TEXT NOT NULL,
    "parametersId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FormalSourceType" NOT NULL,
    "searchString" TEXT,
    "dateRange" JSONB,

    CONSTRAINT "FormalSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GreySource" (
    "id" TEXT NOT NULL,
    "parametersId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GreySourceType" NOT NULL,
    "url" TEXT,
    "searchStrategy" TEXT,

    CONSTRAINT "GreySource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InclusionCriterion" (
    "id" TEXT NOT NULL,
    "parametersId" TEXT NOT NULL,
    "criterion" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "InclusionCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExclusionCriterion" (
    "id" TEXT NOT NULL,
    "parametersId" TEXT NOT NULL,
    "criterion" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ExclusionCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facet" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "FacetType" NOT NULL DEFAULT 'CLOSED',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacetCategory" (
    "id" TEXT NOT NULL,
    "facetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FacetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacetResearchQuestion" (
    "id" TEXT NOT NULL,
    "facetId" TEXT NOT NULL,
    "researchQuestionId" TEXT NOT NULL,

    CONSTRAINT "FacetResearchQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "sourceCategory" "SourceCategory" NOT NULL,
    "originalUrl" TEXT,
    "storagePath" TEXT,
    "classificationFileId" TEXT,
    "classificationThreadId" TEXT,
    "hasPdf" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "authors" TEXT[],
    "publicationDate" TIMESTAMP(3),
    "venue" TEXT,
    "venueType" "VenueType",
    "doi" TEXT,
    "abstract" TEXT,
    "keywords" TEXT[],
    "sourceOrigin" TEXT,
    "sourceOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importBatchId" TEXT,
    "needsPdf" BOOLEAN NOT NULL DEFAULT false,
    "status" "SourceStatus" NOT NULL DEFAULT 'PENDING',
    "greyLiteratureTier" "GreyLiteratureTier",
    "metadataExtension" JSONB,
    "metadataParsed" JSONB,
    "metadataChosen" JSONB,
    "metadataChosenSource" TEXT,
    "finalDecision" "Decision",
    "decisionRationale" TEXT,
    "bibtex" TEXT,
    "decisionMadeAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceAnalysis" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "inclusionRecommendation" BOOLEAN NOT NULL,
    "inclusionReasoning" TEXT NOT NULL,
    "exclusionReasoning" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "relevanceScore" DOUBLE PRECISION,
    "qualityNotes" TEXT,
    "isUserEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedFields" TEXT[],
    "analysisDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "exclusionCriteria" JSONB,
    "inclusionCriteria" JSONB,

    CONSTRAINT "SourceAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classification" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "facetId" TEXT NOT NULL,
    "categoryId" TEXT,
    "value" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasoning" TEXT,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Classification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "databaseSource" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "newSources" INTEGER NOT NULL DEFAULT 0,
    "relevant" INTEGER NOT NULL DEFAULT 0,
    "irrelevant" INTEGER NOT NULL DEFAULT 0,
    "needsPdf" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "errorLog" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchQuestion_studyId_idx" ON "ResearchQuestion"("studyId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyParameters_studyId_key" ON "StudyParameters"("studyId");

-- CreateIndex
CREATE INDEX "StudyParameters_studyId_idx" ON "StudyParameters"("studyId");

-- CreateIndex
CREATE INDEX "FormalSource_parametersId_idx" ON "FormalSource"("parametersId");

-- CreateIndex
CREATE INDEX "GreySource_parametersId_idx" ON "GreySource"("parametersId");

-- CreateIndex
CREATE INDEX "InclusionCriterion_parametersId_idx" ON "InclusionCriterion"("parametersId");

-- CreateIndex
CREATE INDEX "ExclusionCriterion_parametersId_idx" ON "ExclusionCriterion"("parametersId");

-- CreateIndex
CREATE INDEX "Facet_studyId_idx" ON "Facet"("studyId");

-- CreateIndex
CREATE INDEX "FacetCategory_facetId_idx" ON "FacetCategory"("facetId");

-- CreateIndex
CREATE UNIQUE INDEX "FacetCategory_facetId_name_key" ON "FacetCategory"("facetId", "name");

-- CreateIndex
CREATE INDEX "FacetResearchQuestion_facetId_idx" ON "FacetResearchQuestion"("facetId");

-- CreateIndex
CREATE INDEX "FacetResearchQuestion_researchQuestionId_idx" ON "FacetResearchQuestion"("researchQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "FacetResearchQuestion_facetId_researchQuestionId_key" ON "FacetResearchQuestion"("facetId", "researchQuestionId");

-- CreateIndex
CREATE INDEX "Source_studyId_idx" ON "Source"("studyId");

-- CreateIndex
CREATE INDEX "Source_status_idx" ON "Source"("status");

-- CreateIndex
CREATE INDEX "Source_importBatchId_idx" ON "Source"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceAnalysis_sourceId_key" ON "SourceAnalysis"("sourceId");

-- CreateIndex
CREATE INDEX "SourceAnalysis_sourceId_idx" ON "SourceAnalysis"("sourceId");

-- CreateIndex
CREATE INDEX "Classification_analysisId_idx" ON "Classification"("analysisId");

-- CreateIndex
CREATE INDEX "Classification_facetId_idx" ON "Classification"("facetId");

-- CreateIndex
CREATE INDEX "Classification_categoryId_idx" ON "Classification"("categoryId");

-- CreateIndex
CREATE INDEX "ImportBatch_studyId_idx" ON "ImportBatch"("studyId");

-- CreateIndex
CREATE INDEX "ImportBatch_status_idx" ON "ImportBatch"("status");

-- AddForeignKey
ALTER TABLE "ResearchQuestion" ADD CONSTRAINT "ResearchQuestion_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyParameters" ADD CONSTRAINT "StudyParameters_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormalSource" ADD CONSTRAINT "FormalSource_parametersId_fkey" FOREIGN KEY ("parametersId") REFERENCES "StudyParameters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreySource" ADD CONSTRAINT "GreySource_parametersId_fkey" FOREIGN KEY ("parametersId") REFERENCES "StudyParameters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InclusionCriterion" ADD CONSTRAINT "InclusionCriterion_parametersId_fkey" FOREIGN KEY ("parametersId") REFERENCES "StudyParameters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExclusionCriterion" ADD CONSTRAINT "ExclusionCriterion_parametersId_fkey" FOREIGN KEY ("parametersId") REFERENCES "StudyParameters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facet" ADD CONSTRAINT "Facet_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacetCategory" ADD CONSTRAINT "FacetCategory_facetId_fkey" FOREIGN KEY ("facetId") REFERENCES "Facet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacetResearchQuestion" ADD CONSTRAINT "FacetResearchQuestion_facetId_fkey" FOREIGN KEY ("facetId") REFERENCES "Facet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacetResearchQuestion" ADD CONSTRAINT "FacetResearchQuestion_researchQuestionId_fkey" FOREIGN KEY ("researchQuestionId") REFERENCES "ResearchQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAnalysis" ADD CONSTRAINT "SourceAnalysis_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classification" ADD CONSTRAINT "Classification_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "SourceAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classification" ADD CONSTRAINT "Classification_facetId_fkey" FOREIGN KEY ("facetId") REFERENCES "Facet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classification" ADD CONSTRAINT "Classification_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FacetCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;

