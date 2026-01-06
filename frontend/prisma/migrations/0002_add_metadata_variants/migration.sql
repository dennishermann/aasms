-- Add metadata variants and chosen marker to Source
ALTER TABLE "Source"
ADD COLUMN "metadataExtension" JSONB,
ADD COLUMN "metadataParsed" JSONB,
ADD COLUMN "metadataChosen" JSONB,
ADD COLUMN "metadataChosenSource" TEXT;





