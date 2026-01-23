import { prisma } from "@/lib/db";
import JSZip from "jszip";
import type { RqRecipe, RqRun, FigureSpec, RecipeConfig } from "@/types/recipe";
import type {
  FrequencyResult,
  CrossTabResult,
  TimeSeriesResult,
  GapAnalysis,
} from "@/types/analysis";

/**
 * Export options for recipe bundle.
 */
export interface ExportOptions {
  includeRecipe?: boolean;
  includeData?: boolean;
  includeSources?: boolean;
  includeFigureSpec?: boolean;
  includeReport?: boolean;
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeRecipe: true,
  includeData: true,
  includeSources: true,
  includeFigureSpec: true,
  includeReport: true,
};

/**
 * Generate a ZIP bundle for a recipe run.
 *
 * Bundle contents:
 * - recipe.json - Full recipe specification
 * - data.csv - Aggregation table
 * - sources.csv - Source-to-category mappings (for drilldown)
 * - figure_spec.json - Chart configuration for client-side rendering
 * - report.md - Markdown snippet with findings
 */
export async function exportRecipeBundle(
  recipeId: string,
  options: ExportOptions = DEFAULT_OPTIONS
): Promise<{ data: Buffer; filename: string }> {
  // Get recipe with relations
  const recipe = await prisma.rqRecipe.findUnique({
    where: { id: recipeId },
    include: {
      researchQuestion: {
        select: { id: true, question: true },
      },
      xFacet: {
        select: { id: true, name: true, type: true },
      },
      yFacet: {
        select: { id: true, name: true, type: true },
      },
      groupByFacet: {
        select: { id: true, name: true, type: true },
      },
      study: {
        select: { id: true, title: true },
      },
    },
  });

  if (!recipe) {
    throw new Error(`Recipe not found: ${recipeId}`);
  }

  // Get latest successful run
  const latestRun = await prisma.rqRun.findFirst({
    where: {
      recipeId,
      status: "UP_TO_DATE",
    },
    orderBy: { startedAt: "desc" },
  });

  if (!latestRun) {
    throw new Error("Recipe has no successful run. Please run the recipe first.");
  }

  const zip = new JSZip();
  const safeName = recipe.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  const timestamp = new Date().toISOString().split("T")[0];

  // Add recipe.json
  if (options.includeRecipe) {
    const recipeJson = {
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      type: recipe.type,
      version: recipe.version,
      status: recipe.status,
      researchQuestion: recipe.researchQuestion?.question ?? null,
      dimensions: {
        x: recipe.xFacet?.name ?? null,
        y: recipe.yFacet?.name ?? null,
        groupBy: recipe.groupByFacet?.name ?? null,
      },
      config: recipe.config,
      study: {
        id: recipe.study.id,
        title: recipe.study.title,
      },
      run: {
        id: latestRun.id,
        version: latestRun.recipeVersion,
        datasetHash: latestRun.datasetHash,
        includedSources: latestRun.includedSourceCount,
        completedAt: latestRun.completedAt?.toISOString() ?? null,
      },
    };
    zip.file("recipe.json", JSON.stringify(recipeJson, null, 2));
  }

  // Add figure_spec.json
  if (options.includeFigureSpec && latestRun.figureSpec) {
    zip.file("figure_spec.json", JSON.stringify(latestRun.figureSpec, null, 2));
  }

  // Add data.csv based on recipe type
  if (options.includeData && latestRun.resultData) {
    const dataCsv = generateDataCsv(recipe.type, latestRun.resultData);
    zip.file("data.csv", dataCsv);
  }

  // Add sources.csv
  if (options.includeSources && latestRun.resultData) {
    const sourcesCsv = await generateSourcesCsv(
      recipe.studyId,
      recipe.type,
      latestRun.resultData
    );
    if (sourcesCsv) {
      zip.file("sources.csv", sourcesCsv);
    }
  }

  // Add report.md
  if (options.includeReport) {
    const reportMd = generateReportMarkdown(
      recipe,
      latestRun,
      latestRun.keyFindings as string[] | null
    );
    zip.file("report.md", reportMd);
  }

  // Generate ZIP buffer
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    data: buffer,
    filename: `${safeName}_${timestamp}.zip`,
  };
}

/**
 * Generate CSV for aggregation data based on recipe type.
 */
function generateDataCsv(type: string, resultData: unknown): string {
  switch (type) {
    case "DISTRIBUTION":
      return generateDistributionCsv(resultData as FrequencyResult);
    case "MAP":
      return generateCrossTabCsv(resultData as CrossTabResult);
    case "TREND":
      return generateTimeSeriesCsv(resultData as TimeSeriesResult);
    case "GAP":
      return generateGapCsv(resultData as GapAnalysis);
    default:
      return "";
  }
}

/**
 * Generate CSV for distribution (frequency) data.
 */
function generateDistributionCsv(data: FrequencyResult): string {
  const rows: string[] = [];
  rows.push("Category,Count,Percentage");

  for (const item of data.items) {
    const label = escapeCsvValue(item.label);
    rows.push(`${label},${item.count},${item.percentage.toFixed(2)}`);
  }

  rows.push(`Total,${data.total},100.00`);
  return rows.join("\n");
}

/**
 * Generate CSV for cross-tabulation data.
 */
function generateCrossTabCsv(data: CrossTabResult): string {
  const rows: string[] = [];

  // Header row
  const colHeaders = data.colLabels.map((c) => escapeCsvValue(c.label));
  rows.push(["", ...colHeaders, "Total"].join(","));

  // Data rows
  for (const row of data.rowLabels) {
    const rowLabel = escapeCsvValue(row.label);
    const cellValues = data.colLabels.map((col) => {
      const cell = data.cells.find((c) => c.rowId === row.id && c.colId === col.id);
      return cell?.count ?? 0;
    });
    const rowTotal = data.rowTotals.find((t) => t.id === row.id)?.count ?? 0;
    rows.push([rowLabel, ...cellValues, rowTotal].join(","));
  }

  // Total row
  const colTotals = data.colLabels.map((col) => {
    return data.colTotals.find((t) => t.id === col.id)?.count ?? 0;
  });
  rows.push(["Total", ...colTotals, data.grandTotal].join(","));

  return rows.join("\n");
}

/**
 * Generate CSV for time series data.
 */
function generateTimeSeriesCsv(data: TimeSeriesResult): string {
  const rows: string[] = [];

  // Header row
  const seriesNames = data.series.map((s) => escapeCsvValue(s.label));
  if (data.series.length > 1) {
    rows.push(["Year", ...seriesNames, "Total"].join(","));
  } else {
    rows.push(["Year", ...seriesNames].join(","));
  }

  // Data rows
  for (let i = 0; i < data.years.length; i++) {
    const year = data.years[i];
    const values = data.series.map((s) => s.data[i] ?? 0);
    if (data.series.length > 1) {
      const total = values.reduce((a, b) => a + b, 0);
      rows.push([year, ...values, total].join(","));
    } else {
      rows.push([year, ...values].join(","));
    }
  }

  return rows.join("\n");
}

/**
 * Generate CSV for gap analysis data.
 */
function generateGapCsv(data: GapAnalysis): string {
  const rows: string[] = [];
  rows.push("Facet,Category,Count,Status");

  for (const facetGaps of data.singleDimensionGaps) {
    const facetName = escapeCsvValue(facetGaps.facetName);

    // Empty categories
    for (const empty of facetGaps.empty) {
      const catName = escapeCsvValue(empty.categoryName);
      rows.push(`${facetName},${catName},0,Empty`);
    }

    // Gap categories (low count)
    for (const gap of facetGaps.gaps) {
      const catName = escapeCsvValue(gap.categoryName);
      rows.push(`${facetName},${catName},${gap.count},Gap`);
    }
  }

  return rows.join("\n");
}

/**
 * Generate CSV for source-to-category mappings.
 */
async function generateSourcesCsv(
  studyId: string,
  type: string,
  resultData: unknown
): Promise<string | null> {
  // Collect all unique source IDs from result data
  const sourceIds = collectSourceIds(type, resultData);

  if (sourceIds.length === 0) {
    return null;
  }

  // Fetch source details
  const sources = await prisma.source.findMany({
    where: {
      id: { in: sourceIds },
    },
    select: {
      id: true,
      title: true,
      authors: true,
      publicationDate: true,
      venue: true,
      sourceCategory: true,
    },
  });

  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  const rows: string[] = [];
  rows.push("Source ID,Title,Authors,Year,Venue,Category");

  for (const id of sourceIds) {
    const source = sourceMap.get(id);
    if (source) {
      const title = escapeCsvValue(source.title ?? "");
      const authors = escapeCsvValue((source.authors as string[])?.join("; ") ?? "");
      const year = source.publicationDate
        ? new Date(source.publicationDate).getFullYear()
        : "";
      const venue = escapeCsvValue(source.venue ?? "");
      const category = source.sourceCategory ?? "";
      rows.push(`${id},${title},${authors},${year},${venue},${category}`);
    }
  }

  return rows.join("\n");
}

/**
 * Collect all unique source IDs from result data.
 */
function collectSourceIds(type: string, resultData: unknown): string[] {
  const ids = new Set<string>();

  switch (type) {
    case "DISTRIBUTION": {
      const data = resultData as FrequencyResult;
      for (const item of data.items) {
        for (const id of item.sourceIds) {
          ids.add(id);
        }
      }
      break;
    }
    case "MAP": {
      const data = resultData as CrossTabResult;
      for (const cell of data.cells) {
        for (const id of cell.sourceIds) {
          ids.add(id);
        }
      }
      break;
    }
    // TREND and GAP don't have sourceIds in results
  }

  return Array.from(ids);
}

/**
 * Generate markdown report with key findings.
 */
function generateReportMarkdown(
  recipe: {
    name: string;
    description: string | null;
    type: string;
    version: number;
    researchQuestion: { question: string } | null;
    xFacet: { name: string } | null;
    yFacet: { name: string } | null;
    groupByFacet: { name: string } | null;
    study: { title: string };
  },
  run: {
    includedSourceCount: number;
    completedAt: Date | null;
  },
  keyFindings: string[] | null
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${recipe.name}`);
  lines.push("");

  // Study and RQ
  lines.push(`**Study:** ${recipe.study.title}`);
  if (recipe.researchQuestion) {
    lines.push(`**Research Question:** ${recipe.researchQuestion.question}`);
  }
  lines.push("");

  // Recipe info
  lines.push("## Recipe Configuration");
  lines.push("");
  lines.push(`- **Type:** ${formatRecipeType(recipe.type)}`);
  lines.push(`- **Version:** ${recipe.version}`);
  if (recipe.xFacet) {
    lines.push(`- **Primary Dimension:** ${recipe.xFacet.name}`);
  }
  if (recipe.yFacet) {
    lines.push(`- **Secondary Dimension:** ${recipe.yFacet.name}`);
  }
  if (recipe.groupByFacet) {
    lines.push(`- **Group By:** ${recipe.groupByFacet.name}`);
  }
  if (recipe.description) {
    lines.push(`- **Description:** ${recipe.description}`);
  }
  lines.push("");

  // Run info
  lines.push("## Analysis Run");
  lines.push("");
  lines.push(`- **Sources Included:** ${run.includedSourceCount}`);
  if (run.completedAt) {
    lines.push(`- **Completed:** ${run.completedAt.toISOString()}`);
  }
  lines.push("");

  // Key findings
  if (keyFindings && keyFindings.length > 0) {
    lines.push("## Key Findings");
    lines.push("");
    for (const finding of keyFindings) {
      lines.push(`- ${finding}`);
    }
    lines.push("");
  }

  // Footer
  lines.push("---");
  lines.push("");
  lines.push("*Generated by AASMS (Automated Academic Systematic Mapping Study)*");

  return lines.join("\n");
}

/**
 * Format recipe type for display.
 */
function formatRecipeType(type: string): string {
  switch (type) {
    case "DISTRIBUTION":
      return "Distribution Analysis";
    case "MAP":
      return "Systematic Map";
    case "TREND":
      return "Trend Analysis";
    case "GAP":
      return "Gap Analysis";
    default:
      return type;
  }
}

/**
 * Escape CSV value.
 */
function escapeCsvValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
