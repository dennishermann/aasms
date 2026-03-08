import { prisma } from "@/lib/db";
import type { DimensionConfig, Filter, LabeledItem } from "@/types/analysis";
import { Prisma, SourceStatus, Decision } from "@prisma/client";

/**
 * Get labels for a dimension (facet categories or built-in values)
 */
export async function getDimensionLabels(
  studyId: string,
  dimension: DimensionConfig,
): Promise<LabeledItem[]> {
  if (dimension.type === "facet" && dimension.facetId) {
    // Get facet with categories
    const facet = await prisma.facet.findUnique({
      where: { id: dimension.facetId },
      include: {
        categories: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!facet) {
      throw new Error(`Facet not found: ${dimension.facetId}`);
    }

    // CLOSED and OPEN_CODED facets have predefined categories
    if (facet.type === "CLOSED" || facet.type === "OPEN_CODED") {
      return facet.categories.map((cat) => ({
        id: cat.id,
        label: cat.name,
      }));
    } else {
      // OPEN facet: get unique values from classifications
      const classifications = await prisma.classification.findMany({
        where: {
          facetId: dimension.facetId,
          value: { not: null },
          analysis: {
            source: {
              studyId,
              status: SourceStatus.CLASSIFIED,
              finalDecision: Decision.INCLUDE,
            },
          },
        },
        select: { value: true },
        distinct: ["value"],
      });

      return classifications
        .filter((c) => c.value !== null)
        .map((c) => ({
          id: c.value!,
          label: c.value!,
        }));
    }
  }

  // Built-in dimensions
  switch (dimension.type) {
    case "publication-year": {
      const sources = await prisma.source.findMany({
        where: {
          studyId,
          status: SourceStatus.CLASSIFIED,
          finalDecision: Decision.INCLUDE,
          publicationDate: { not: null },
        },
        select: { publicationDate: true },
      });

      const years = new Set<number>();
      sources.forEach((s) => {
        if (s.publicationDate) {
          years.add(s.publicationDate.getFullYear());
        }
      });

      return Array.from(years)
        .sort((a, b) => a - b)
        .map((y) => ({ id: String(y), label: String(y) }));
    }

    case "venue-type": {
      const venueTypes = [
        "JOURNAL",
        "CONFERENCE",
        "WORKSHOP",
        "SYMPOSIUM",
        "BOOK_CHAPTER",
        "PREPRINT_SERVER",
        "TECHNICAL_REPORT",
        "BLOG",
        "OTHER",
        "Unknown",
      ];
      return venueTypes.map((v) => ({ id: v, label: v }));
    }

    case "source-category": {
      return [
        { id: "FORMAL", label: "Formal" },
        { id: "GREY", label: "Grey" },
      ];
    }

    case "grey-tier": {
      return [
        { id: "TIER_1", label: "Tier 1" },
        { id: "TIER_2", label: "Tier 2" },
        { id: "TIER_3", label: "Tier 3" },
      ];
    }

    default:
      throw new Error(`Unknown dimension type: ${dimension.type}`);
  }
}

/**
 * Build base Prisma where clause for sources (included + classified)
 */
export function buildBaseSourceWhere(studyId: string): Prisma.SourceWhereInput {
  return {
    studyId,
    status: SourceStatus.CLASSIFIED,
    finalDecision: Decision.INCLUDE,
  };
}

/**
 * Apply filters to a Prisma where clause
 */
export function applyFilters(
  baseWhere: Prisma.SourceWhereInput,
  filters?: Filter[],
): Prisma.SourceWhereInput {
  if (!filters || filters.length === 0) {
    return baseWhere;
  }

  const conditions: Prisma.SourceWhereInput[] = [baseWhere];

  for (const filter of filters) {
    const condition = buildFilterCondition(filter);
    if (condition) {
      conditions.push(condition);
    }
  }

  return { AND: conditions };
}

/**
 * Build a single filter condition
 */
function buildFilterCondition(filter: Filter): Prisma.SourceWhereInput | null {
  const { dimension, operator, values } = filter;

  if (dimension.type === "facet" && dimension.facetId) {
    // Facet filter: filter by classification
    const classificationCondition: Prisma.ClassificationWhereInput = {
      facetId: dimension.facetId,
    };

    switch (operator) {
      case "equals":
        classificationCondition.OR = [
          { categoryId: values[0] as string },
          { value: values[0] as string },
        ];
        break;
      case "in":
        classificationCondition.OR = [
          { categoryId: { in: values as string[] } },
          { value: { in: values as string[] } },
        ];
        break;
      case "not-equals":
        classificationCondition.AND = [
          { categoryId: { not: values[0] as string } },
          { value: { not: values[0] as string } },
        ];
        break;
      case "not-in":
        classificationCondition.AND = [
          { categoryId: { notIn: values as string[] } },
          { value: { notIn: values as string[] } },
        ];
        break;
    }

    return {
      analysis: {
        classifications: {
          some: classificationCondition,
        },
      },
    };
  }

  // Built-in dimensions
  switch (dimension.type) {
    case "publication-year": {
      const years = values.map((v) => Number(v));
      if (operator === "between" && years.length === 2) {
        return {
          publicationDate: {
            gte: new Date(years[0], 0, 1),
            lt: new Date(years[1] + 1, 0, 1),
          },
        };
      }
      // For in/equals, we need to check year part
      // This is complex in Prisma, so we use a range approach
      if (operator === "equals" || operator === "in") {
        return {
          OR: years.map((y) => ({
            publicationDate: {
              gte: new Date(y, 0, 1),
              lt: new Date(y + 1, 0, 1),
            },
          })),
        };
      }
      break;
    }

    case "venue-type": {
      const unknownIncluded = values.includes("Unknown");
      const venueTypes = values.filter((v) => v !== "Unknown");

      if (operator === "equals" || operator === "in") {
        const conditions: Prisma.SourceWhereInput[] = [];
        if (venueTypes.length > 0) {
          conditions.push({
            venueType: { in: venueTypes as any[] },
          });
        }
        if (unknownIncluded) {
          conditions.push({ venueType: null });
        }
        return { OR: conditions };
      }
      break;
    }

    case "source-category": {
      if (operator === "equals" || operator === "in") {
        return {
          sourceCategory: { in: values as any[] },
        };
      }
      break;
    }

    case "grey-tier": {
      if (operator === "equals" || operator === "in") {
        return {
          greyLiteratureTier: { in: values as any[] },
        };
      }
      break;
    }
  }

  return null;
}

/**
 * Get the value for a dimension from a source (for grouping)
 */
export function getSourceDimensionValue(
  source: {
    publicationDate?: Date | null;
    venueType?: string | null;
    sourceCategory?: string;
    greyLiteratureTier?: string | null;
  },
  dimension: DimensionConfig,
): string {
  switch (dimension.type) {
    case "publication-year":
      return source.publicationDate ? String(source.publicationDate.getFullYear()) : "Unknown";

    case "venue-type":
      return source.venueType || "Unknown";

    case "source-category":
      return source.sourceCategory || "Unknown";

    case "grey-tier":
      return source.greyLiteratureTier || "Unknown";

    default:
      return "Unknown";
  }
}
