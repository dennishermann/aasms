import { prisma } from "@/lib/db";
import type { GapAnalysis, SingleDimensionGap, CrossTabGap, GapCategory } from "@/types/analysis";
import { getFrequencyData } from "./frequency-service";
import { getCrossTabData } from "./crosstab-service";

/**
 * Get gap analysis for a study
 */
export async function getGapAnalysis(
  studyId: string,
  threshold: number = 3,
  facetIds?: string[],
): Promise<GapAnalysis> {
  // Get facets to analyze
  const facets = await prisma.facet.findMany({
    where: {
      studyId,
      ...(facetIds && facetIds.length > 0 ? { id: { in: facetIds } } : {}),
    },
    orderBy: { order: "asc" },
    include: {
      categories: { orderBy: { order: "asc" } },
    },
  });

  // Analyze single dimension gaps for each facet
  const singleDimensionGaps: SingleDimensionGap[] = await Promise.all(
    facets.map(async (facet) => {
      const frequencyData = await getFrequencyData(studyId, {
        type: "facet",
        facetId: facet.id,
      });

      const gaps: GapCategory[] = frequencyData.items
        .filter((item) => item.count > 0 && item.count <= threshold)
        .map((item) => ({
          categoryId: item.id,
          categoryName: item.label,
          count: item.count,
        }));

      const empty = frequencyData.items
        .filter((item) => item.count === 0)
        .map((item) => ({
          categoryId: item.id,
          categoryName: item.label,
        }));

      return {
        facetId: facet.id,
        facetName: facet.name,
        gaps,
        empty,
      };
    }),
  );

  // Analyze cross-tabulation gaps (only for CLOSED facets with reasonable category counts)
  const closedFacets = facets.filter(
    (f) => f.type === "CLOSED" && f.categories.length > 0 && f.categories.length <= 15,
  );

  const crossTabGaps: CrossTabGap[] = [];

  // Only do crosstab analysis for pairs of facets (avoid combinatorial explosion)
  for (let i = 0; i < closedFacets.length; i++) {
    for (let j = i + 1; j < closedFacets.length; j++) {
      const rowFacet = closedFacets[i];
      const colFacet = closedFacets[j];

      try {
        const crossTabData = await getCrossTabData(
          studyId,
          { type: "facet", facetId: rowFacet.id },
          { type: "facet", facetId: colFacet.id },
        );

        const gaps = crossTabData.cells
          .filter((cell) => cell.count > 0 && cell.count <= threshold)
          .map((cell) => ({
            rowId: cell.rowId,
            colId: cell.colId,
            count: cell.count,
          }));

        if (gaps.length > 0) {
          crossTabGaps.push({
            rowFacetId: rowFacet.id,
            rowFacetName: rowFacet.name,
            colFacetId: colFacet.id,
            colFacetName: colFacet.name,
            gaps,
          });
        }
      } catch (error) {
        // Skip failed crosstab analyses
        console.warn(`Failed to analyze crosstab for ${rowFacet.name} × ${colFacet.name}:`, error);
      }
    }
  }

  return {
    threshold,
    singleDimensionGaps,
    crossTabGaps,
  };
}
