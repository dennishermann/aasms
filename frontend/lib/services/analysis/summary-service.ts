import { prisma } from "@/lib/db";
import type { SummaryStats, FacetCoverage, VenueCount } from "@/types/analysis";
import { SourceStatus, Decision, SourceCategory } from "@prisma/client";

/**
 * Get summary statistics for a study
 */
export async function getSummaryStats(studyId: string): Promise<SummaryStats> {
  // Get source counts
  const [
    totalSources,
    includedSources,
    excludedSources,
    classifiedSources,
    formalSources,
    greySources,
    importBatchAgg,
  ] = await Promise.all([
    prisma.source.count({ where: { studyId } }),
    prisma.source.count({
      where: { studyId, finalDecision: Decision.INCLUDE },
    }),
    prisma.source.count({
      where: { studyId, finalDecision: Decision.EXCLUDE },
    }),
    prisma.source.count({
      where: { studyId, status: SourceStatus.CLASSIFIED },
    }),
    prisma.source.count({
      where: {
        studyId,
        sourceCategory: SourceCategory.FORMAL,
        finalDecision: Decision.INCLUDE,
      },
    }),
    prisma.source.count({
      where: {
        studyId,
        sourceCategory: SourceCategory.GREY,
        finalDecision: Decision.INCLUDE,
      },
    }),
    prisma.importBatch.aggregate({
      where: { studyId },
      _sum: { totalRecords: true, duplicates: true },
    }),
  ]);

  // Get year range from included sources
  const yearStats = await prisma.source.aggregate({
    where: {
      studyId,
      finalDecision: Decision.INCLUDE,
      publicationDate: { not: null },
    },
    _min: { publicationDate: true },
    _max: { publicationDate: true },
  });

  const minYear = yearStats._min.publicationDate
    ? yearStats._min.publicationDate.getFullYear()
    : null;
  const maxYear = yearStats._max.publicationDate
    ? yearStats._max.publicationDate.getFullYear()
    : null;

  // Get unique venues and top venues
  const venueGroups = await prisma.source.groupBy({
    by: ["venue"],
    where: {
      studyId,
      finalDecision: Decision.INCLUDE,
      venue: { not: null },
    },
    _count: { venue: true },
    orderBy: { _count: { venue: "desc" } },
    take: 10,
  });

  const uniqueVenues = await prisma.source.findMany({
    where: {
      studyId,
      finalDecision: Decision.INCLUDE,
      venue: { not: null },
    },
    select: { venue: true },
    distinct: ["venue"],
  });

  const topVenues: VenueCount[] = venueGroups.map((g) => ({
    name: g.venue || "Unknown",
    count: g._count.venue,
  }));

  // Get facet coverage
  const facets = await prisma.facet.findMany({
    where: { studyId },
    orderBy: { order: "asc" },
    include: {
      categories: true,
    },
  });

  const facetCoverage: FacetCoverage[] = await Promise.all(
    facets.map(async (facet) => {
      // Count sources that have a classification for this facet
      const classifiedCount = await prisma.source.count({
        where: {
          studyId,
          status: SourceStatus.CLASSIFIED,
          finalDecision: Decision.INCLUDE,
          analysis: {
            classifications: {
              some: {
                facetId: facet.id,
              },
            },
          },
        },
      });

      const totalIncluded = includedSources;
      const unclassified = totalIncluded - classifiedCount;
      const coveragePercent =
        totalIncluded > 0 ? Math.round((classifiedCount / totalIncluded) * 100) : 0;

      return {
        facetId: facet.id,
        facetName: facet.name,
        classified: classifiedCount,
        unclassified: unclassified,
        coveragePercent,
      };
    }),
  );

  const totalRecordsIdentified = importBatchAgg._sum.totalRecords ?? totalSources;
  const duplicatesRemoved = importBatchAgg._sum.duplicates ?? 0;

  return {
    totalSources,
    includedSources,
    excludedSources,
    classifiedSources,
    formalSources,
    greySources,
    yearRange: { min: minYear, max: maxYear },
    uniqueVenues: uniqueVenues.length,
    topVenues,
    facetCoverage,
    prismaFlow: {
      totalRecordsIdentified,
      duplicatesRemoved,
    },
  };
}
