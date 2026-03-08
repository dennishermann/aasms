import { prisma } from "@/lib/db";
import { SourceStatus, Decision } from "@prisma/client";
import crypto from "crypto";

/**
 * Compute a deterministic hash of the current dataset state.
 *
 * The hash is based on:
 * - IDs of all included, classified sources (sorted)
 * - Their update timestamps
 * - Their classification data (facetId + categoryId/value)
 *
 * This ensures that any change to the dataset (new sources, re-classification,
 * or decision changes) will produce a different hash.
 */
export async function computeDatasetHash(studyId: string): Promise<string> {
  const sources = await prisma.source.findMany({
    where: {
      studyId,
      status: SourceStatus.CLASSIFIED,
      finalDecision: Decision.INCLUDE,
    },
    select: {
      id: true,
      updatedAt: true,
      analysis: {
        select: {
          updatedAt: true,
          classifications: {
            select: {
              facetId: true,
              categoryId: true,
              value: true,
            },
            orderBy: { facetId: "asc" },
          },
          facetKeywords: {
            select: {
              facetId: true,
              keyword: true,
            },
            orderBy: { facetId: "asc" },
          },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  // Build a deterministic string representation
  const hashInput = sources.map((source) => ({
    id: source.id,
    updated: source.updatedAt.toISOString(),
    analysisUpdated: source.analysis?.updatedAt.toISOString() ?? null,
    classifications: (source.analysis?.classifications ?? []).map((c) => ({
      facetId: c.facetId,
      categoryId: c.categoryId,
      value: c.value,
    })),
    facetKeywords: (source.analysis?.facetKeywords ?? []).map((k) => ({
      facetId: k.facetId,
      keyword: k.keyword,
    })),
  }));

  // Create SHA-256 hash and return first 16 characters
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(hashInput))
    .digest("hex")
    .substring(0, 16);

  return hash;
}

/**
 * Get the count of included, classified sources.
 */
export async function getIncludedSourceCount(studyId: string): Promise<number> {
  return prisma.source.count({
    where: {
      studyId,
      status: SourceStatus.CLASSIFIED,
      finalDecision: Decision.INCLUDE,
    },
  });
}

/**
 * Check if a run's dataset hash matches the current dataset state.
 */
export async function isRunStale(studyId: string, runDatasetHash: string): Promise<boolean> {
  const currentHash = await computeDatasetHash(studyId);
  return currentHash !== runDatasetHash;
}

/**
 * Get both hash and count in a single call for efficiency.
 */
export async function getDatasetState(studyId: string): Promise<{
  hash: string;
  count: number;
}> {
  const [hash, count] = await Promise.all([
    computeDatasetHash(studyId),
    getIncludedSourceCount(studyId),
  ]);

  return { hash, count };
}
