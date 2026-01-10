-- CreateTable
CREATE TABLE "AnalysisConfiguration" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "artifacts" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalysisConfiguration_studyId_idx" ON "AnalysisConfiguration"("studyId");

-- AddForeignKey
ALTER TABLE "AnalysisConfiguration" ADD CONSTRAINT "AnalysisConfiguration_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;
