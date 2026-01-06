-- DropForeignKey
ALTER TABLE "public"."Classification" DROP CONSTRAINT "Classification_analysisId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ExclusionCriterion" DROP CONSTRAINT "ExclusionCriterion_parametersId_fkey";

-- DropForeignKey
ALTER TABLE "public"."FormalSource" DROP CONSTRAINT "FormalSource_parametersId_fkey";

-- DropForeignKey
ALTER TABLE "public"."GreySource" DROP CONSTRAINT "GreySource_parametersId_fkey";

-- DropForeignKey
ALTER TABLE "public"."InclusionCriterion" DROP CONSTRAINT "InclusionCriterion_parametersId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ResearchQuestion" DROP CONSTRAINT "ResearchQuestion_studyId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Source" DROP CONSTRAINT "Source_studyId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SourceAnalysis" DROP CONSTRAINT "SourceAnalysis_sourceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StudyParameters" DROP CONSTRAINT "StudyParameters_studyId_fkey";

-- DropTable
DROP TABLE "public"."Classification";

-- DropTable
DROP TABLE "public"."ExclusionCriterion";

-- DropTable
DROP TABLE "public"."FormalSource";

-- DropTable
DROP TABLE "public"."GreySource";

-- DropTable
DROP TABLE "public"."InclusionCriterion";

-- DropTable
DROP TABLE "public"."ResearchQuestion";

-- DropTable
DROP TABLE "public"."Source";

-- DropTable
DROP TABLE "public"."SourceAnalysis";

-- DropTable
DROP TABLE "public"."Study";

-- DropTable
DROP TABLE "public"."StudyParameters";

-- DropEnum
DROP TYPE "public"."Decision";

-- DropEnum
DROP TYPE "public"."FormalSourceType";

-- DropEnum
DROP TYPE "public"."GreySourceType";

-- DropEnum
DROP TYPE "public"."SourceCategory";

-- DropEnum
DROP TYPE "public"."SourceStatus";

-- DropEnum
DROP TYPE "public"."SourceType";

-- DropEnum
DROP TYPE "public"."StudyStatus";

