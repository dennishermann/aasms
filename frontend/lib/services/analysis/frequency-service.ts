import { prisma } from "@/lib/db";
import type { DimensionConfig, Filter, FrequencyResult, FrequencyItem } from "@/types/analysis";
import { SourceStatus, Decision } from "@prisma/client";
import {
  getDimensionLabels,
  buildBaseSourceWhere,
  applyFilters,
  getSourceDimensionValue,
} from "./dimension-utils";

/**
 * Get frequency distribution for a single dimension
 */
export async function getFrequencyData(
  studyId: string,
  dimension: DimensionConfig,
  filters?: Filter[]
): Promise<FrequencyResult> {
  const baseWhere = buildBaseSourceWhere(studyId);
  const where = applyFilters(baseWhere, filters);

  if (dimension.type === "facet" && dimension.facetId) {
    return getFrequencyByFacet(studyId, dimension.facetId, where);
  }

  return getFrequencyByBuiltinDimension(studyId, dimension, where);
}

/**
 * Get frequency distribution for a facet dimension
 */
async function getFrequencyByFacet(
  studyId: string,
  facetId: string,
  where: any
): Promise<FrequencyResult> {
  const facet = await prisma.facet.findUnique({
    where: { id: facetId },
    include: {
      categories: { orderBy: { order: "asc" } },
    },
  });

  if (!facet) {
    throw new Error(`Facet not found: ${facetId}`);
  }

  // Get all classifications for this facet from included sources
  const classifications = await prisma.classification.findMany({
    where: {
      facetId,
      analysis: {
        source: where,
      },
    },
    include: {
      category: true,
      analysis: {
        select: { sourceId: true },
      },
    },
  });

  // Group by category or value
  const countMap = new Map<string, { count: number; sourceIds: Set<string>; label: string }>();

  if (facet.type === "CLOSED" || facet.type === "OPEN_CODED") {
    // Both CLOSED and OPEN_CODED facets: group by category
    // Initialize with all categories (including 0 counts)
    for (const cat of facet.categories) {
      countMap.set(cat.id, { count: 0, sourceIds: new Set(), label: cat.name });
    }

    for (const c of classifications) {
      if (c.categoryId) {
        const existing = countMap.get(c.categoryId);
        if (existing) {
          existing.count++;
          existing.sourceIds.add(c.analysis.sourceId);
        }
      }
    }
  } else {
    // OPEN facet: group by value
    for (const c of classifications) {
      if (c.value) {
        const existing = countMap.get(c.value);
        if (existing) {
          existing.count++;
          existing.sourceIds.add(c.analysis.sourceId);
        } else {
          countMap.set(c.value, {
            count: 1,
            sourceIds: new Set([c.analysis.sourceId]),
            label: c.value,
          });
        }
      }
    }
  }

  // Calculate total (unique sources)
  const allSourceIds = new Set<string>();
  classifications.forEach((c) => allSourceIds.add(c.analysis.sourceId));
  const total = allSourceIds.size;

  // Build result items
  const items: FrequencyItem[] = Array.from(countMap.entries()).map(([id, data]) => ({
    id,
    label: data.label,
    count: data.count,
    percentage: total > 0 ? Math.round((data.count / total) * 1000) / 10 : 0,
    sourceIds: Array.from(data.sourceIds),
  }));

  // Sort by count descending
  items.sort((a, b) => b.count - a.count);

  return {
    dimension: { type: "facet", facetId },
    total,
    items,
  };
}

/**
 * Get frequency distribution for a built-in dimension
 */
async function getFrequencyByBuiltinDimension(
  studyId: string,
  dimension: DimensionConfig,
  where: any
): Promise<FrequencyResult> {
  const sources = await prisma.source.findMany({
    where,
    select: {
      id: true,
      publicationDate: true,
      venueType: true,
      sourceCategory: true,
      greyLiteratureTier: true,
    },
  });

  // Group by dimension value
  const countMap = new Map<string, { count: number; sourceIds: string[] }>();

  for (const source of sources) {
    const value = getSourceDimensionValue(source, dimension);
    const existing = countMap.get(value);
    if (existing) {
      existing.count++;
      existing.sourceIds.push(source.id);
    } else {
      countMap.set(value, { count: 1, sourceIds: [source.id] });
    }
  }

  const total = sources.length;

  // Build result items with proper labels
  const items: FrequencyItem[] = Array.from(countMap.entries()).map(([id, data]) => ({
    id,
    label: getLabelForBuiltinValue(dimension.type, id),
    count: data.count,
    percentage: total > 0 ? Math.round((data.count / total) * 1000) / 10 : 0,
    sourceIds: data.sourceIds,
  }));

  // Sort appropriately
  if (dimension.type === "publication-year") {
    // Sort years ascending
    items.sort((a, b) => {
      if (a.id === "Unknown") return 1;
      if (b.id === "Unknown") return -1;
      return Number(a.id) - Number(b.id);
    });
  } else {
    // Sort by count descending
    items.sort((a, b) => b.count - a.count);
  }

  return {
    dimension,
    total,
    items,
  };
}

/**
 * Get a human-readable label for a built-in dimension value
 */
function getLabelForBuiltinValue(dimensionType: string, value: string): string {
  if (value === "Unknown") return "Unknown";

  switch (dimensionType) {
    case "venue-type":
      // Convert SCREAMING_CASE to Title Case
      return value
        .split("_")
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(" ");

    case "source-category":
      return value.charAt(0) + value.slice(1).toLowerCase();

    case "grey-tier":
      return value.replace("_", " ");

    default:
      return value;
  }
}
