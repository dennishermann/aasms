-- Update SourceStatus enum with new values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SourceStatus') THEN
    CREATE TYPE "SourceStatus" AS ENUM ('PENDING', 'ANALYZING', 'ANALYZED', 'INCLUDED', 'EXCLUDED', 'NEEDS_REVIEW');
  END IF;
END$$;

ALTER TYPE "SourceStatus" ADD VALUE IF NOT EXISTS 'PENDING_METADATA';
ALTER TYPE "SourceStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_CLASSIFICATION';
ALTER TYPE "SourceStatus" ADD VALUE IF NOT EXISTS 'CLASSIFYING';
ALTER TYPE "SourceStatus" ADD VALUE IF NOT EXISTS 'CLASSIFIED';

-- Add LLM file/thread tracking columns for classification reuse
ALTER TABLE "Source"
  ADD COLUMN IF NOT EXISTS "classificationFileId" TEXT,
  ADD COLUMN IF NOT EXISTS "classificationThreadId" TEXT;




