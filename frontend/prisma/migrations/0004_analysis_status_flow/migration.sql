-- Ensure SourceStatus enum exists, then add new values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SourceStatus') THEN
    CREATE TYPE "SourceStatus" AS ENUM (
      'PENDING',
      'ANALYZING',
      'ANALYZED',
      'INCLUDED',
      'EXCLUDED',
      'NEEDS_REVIEW',
      'PENDING_METADATA',
      'CLASSIFIED'
    );
  END IF;
END$$;

ALTER TYPE "SourceStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_ANALYSIS';
ALTER TYPE "SourceStatus" ADD VALUE IF NOT EXISTS 'ANALYZING_INCLUSION';
ALTER TYPE "SourceStatus" ADD VALUE IF NOT EXISTS 'ANALYZING_CLASSIFICATION';




