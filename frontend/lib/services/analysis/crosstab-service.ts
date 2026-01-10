import { prisma } from "@/lib/db";
import type {
  DimensionConfig,
  Filter,
  CrossTabResult,
  CrossTabCell,
  LabeledItem,
} from "@/types/analysis";
import {
  getDimensionLabels,
  buildBaseSourceWhere,
  applyFilters,
  getSourceDimensionValue,
} from "./dimension-utils";

/**
 * Get cross-tabulation data for two dimensions
 */
export async function getCrossTabData(
  studyId: string,
  rowDimension: DimensionConfig,
  colDimension: DimensionConfig,
  filters?: Filter[]
): Promise<CrossTabResult> {
  const baseWhere = buildBaseSourceWhere(studyId);
  const where = applyFilters(baseWhere, filters);

  // Get labels for both dimensions
  const [rowLabels, colLabels] = await Promise.all([
    getDimensionLabels(studyId, rowDimension),
    getDimensionLabels(studyId, colDimension),
  ]);

  // Get all sources with their classifications
  const sources = await prisma.source.findMany({
    where,
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

  // Build cross-tabulation matrix
  const cellMap = new Map<string, { count: number; sourceIds: Set<string> }>();

  // Initialize all cells with 0
  for (const row of rowLabels) {
    for (const col of colLabels) {
      const key = `${row.id}|${col.id}`;
      cellMap.set(key, { count: 0, sourceIds: new Set() });
    }
  }

  // Count sources per cell
  for (const source of sources) {
    const rowValues = getDimensionValues(source, rowDimension);
    const colValues = getDimensionValues(source, colDimension);

    // For multi-value facets, source contributes to all combinations
    for (const rowVal of rowValues) {
      for (const colVal of colValues) {
        const key = `${rowVal}|${colVal}`;
        const cell = cellMap.get(key);
        if (cell) {
          cell.count++;
          cell.sourceIds.add(source.id);
        }
      }
    }
  }

  // Build cells array
  const cells: CrossTabCell[] = [];
  let grandTotal = 0;
  const rowTotals = new Map<string, number>();
  const colTotals = new Map<string, number>();

  // Initialize totals
  for (const row of rowLabels) {
    rowTotals.set(row.id, 0);
  }
  for (const col of colLabels) {
    colTotals.set(col.id, 0);
  }

  // Build cells and accumulate totals
  for (const row of rowLabels) {
    for (const col of colLabels) {
      const key = `${row.id}|${col.id}`;
      const cell = cellMap.get(key)!;

      cells.push({
        rowId: row.id,
        colId: col.id,
        count: cell.count,
        percentage: 0, // Will calculate after we know grandTotal
        sourceIds: Array.from(cell.sourceIds),
      });

      // Accumulate totals
      rowTotals.set(row.id, (rowTotals.get(row.id) || 0) + cell.count);
      colTotals.set(col.id, (colTotals.get(col.id) || 0) + cell.count);
      grandTotal += cell.count;
    }
  }

  // Calculate percentages
  for (const cell of cells) {
    cell.percentage =
      grandTotal > 0 ? Math.round((cell.count / grandTotal) * 1000) / 10 : 0;
  }

  return {
    rowDimension,
    colDimension,
    rowLabels,
    colLabels,
    cells,
    rowTotals: Array.from(rowTotals.entries()).map(([id, count]) => ({ id, count })),
    colTotals: Array.from(colTotals.entries()).map(([id, count]) => ({ id, count })),
    grandTotal,
  };
}

/**
 * Get all values for a dimension from a source (supports multi-value facets)
 */
function getDimensionValues(
  source: {
    id: string;
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
      if (c.categoryId) {
        return c.categoryId;
      }
      if (c.value) {
        return c.value;
      }
      return "Unknown";
    });
  }

  // Built-in dimensions always return single value
  return [getSourceDimensionValue(source, dimension)];
}
