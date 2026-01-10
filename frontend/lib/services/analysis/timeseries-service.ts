import { prisma } from "@/lib/db";
import type {
  DimensionConfig,
  Filter,
  TimeSeriesResult,
  TimeSeriesSeries,
} from "@/types/analysis";
import { buildBaseSourceWhere, applyFilters, getSourceDimensionValue } from "./dimension-utils";

/**
 * Get time series data for publication trends
 */
export async function getTimeSeriesData(
  studyId: string,
  groupBy?: DimensionConfig,
  filters?: Filter[]
): Promise<TimeSeriesResult> {
  const baseWhere = buildBaseSourceWhere(studyId);
  const where = applyFilters(baseWhere, filters);

  // Get all sources with publication dates
  const sources = await prisma.source.findMany({
    where: {
      ...where,
      publicationDate: { not: null },
    },
    include: {
      analysis: {
        include: {
          classifications: {
            include: {
              category: true,
            },
          },
        },
      },
    },
  });

  // Find year range
  let minYear = Infinity;
  let maxYear = -Infinity;

  for (const source of sources) {
    if (source.publicationDate) {
      const year = source.publicationDate.getFullYear();
      minYear = Math.min(minYear, year);
      maxYear = Math.max(maxYear, year);
    }
  }

  // Handle edge case of no sources
  if (minYear === Infinity) {
    return {
      years: [],
      series: [],
    };
  }

  // Generate full year range
  const years: number[] = [];
  for (let y = minYear; y <= maxYear; y++) {
    years.push(y);
  }

  if (!groupBy) {
    // Single series (total)
    const countsByYear = new Map<number, number>();
    for (const year of years) {
      countsByYear.set(year, 0);
    }

    for (const source of sources) {
      if (source.publicationDate) {
        const year = source.publicationDate.getFullYear();
        countsByYear.set(year, (countsByYear.get(year) || 0) + 1);
      }
    }

    return {
      years,
      series: [
        {
          id: "total",
          label: "Total",
          data: years.map((y) => countsByYear.get(y) || 0),
        },
      ],
    };
  }

  // Multiple series (grouped by dimension)
  const seriesMap = new Map<string, { label: string; counts: Map<number, number> }>();

  for (const source of sources) {
    if (!source.publicationDate) continue;

    const year = source.publicationDate.getFullYear();
    const groupValues = getGroupValues(source, groupBy);

    for (const groupValue of groupValues) {
      if (!seriesMap.has(groupValue)) {
        const label = getGroupLabel(groupBy, groupValue);
        const counts = new Map<number, number>();
        for (const y of years) {
          counts.set(y, 0);
        }
        seriesMap.set(groupValue, { label, counts });
      }

      const seriesData = seriesMap.get(groupValue)!;
      seriesData.counts.set(year, (seriesData.counts.get(year) || 0) + 1);
    }
  }

  // Convert to array
  const series: TimeSeriesSeries[] = Array.from(seriesMap.entries()).map(
    ([id, data]) => ({
      id,
      label: data.label,
      data: years.map((y) => data.counts.get(y) || 0),
    })
  );

  // Sort series by total count descending
  series.sort((a, b) => {
    const totalA = a.data.reduce((sum, count) => sum + count, 0);
    const totalB = b.data.reduce((sum, count) => sum + count, 0);
    return totalB - totalA;
  });

  return {
    years,
    series,
  };
}

/**
 * Get group values for a source based on dimension
 */
function getGroupValues(
  source: {
    publicationDate?: Date | null;
    venueType?: string | null;
    sourceCategory?: string;
    greyLiteratureTier?: string | null;
    analysis?: {
      classifications: {
        facetId: string;
        categoryId?: string | null;
        value?: string | null;
        category?: { id: string; name: string } | null;
      }[];
    } | null;
  },
  dimension: DimensionConfig
): string[] {
  if (dimension.type === "facet" && dimension.facetId) {
    const classifications =
      source.analysis?.classifications.filter((c) => c.facetId === dimension.facetId) ||
      [];

    if (classifications.length === 0) {
      return ["Unknown"];
    }

    return classifications.map((c) => {
      if (c.category) {
        return c.category.name;
      }
      if (c.value) {
        return c.value;
      }
      return "Unknown";
    });
  }

  return [getSourceDimensionValue(source, dimension)];
}

/**
 * Get label for a group value
 */
function getGroupLabel(dimension: DimensionConfig, value: string): string {
  if (value === "Unknown") return "Unknown";

  switch (dimension.type) {
    case "venue-type":
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
