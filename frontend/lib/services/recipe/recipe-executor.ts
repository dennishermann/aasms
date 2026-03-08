import { prisma } from "@/lib/db";
import { RecipeStatus, RecipeType, RunStatus } from "@prisma/client";
import type { RqRun, RecipeConfig, FigureSpec } from "@/types/recipe";
import type { DimensionConfig } from "@/types/analysis";
import { getDatasetState } from "./dataset-hash";
import { canExecuteRecipe } from "./recipe-validator";
import { generateKeyFindings } from "./findings-generator";
import { getFrequencyData } from "../analysis/frequency-service";
import { getCrossTabData } from "../analysis/crosstab-service";
import { getTimeSeriesData } from "../analysis/timeseries-service";
import { getGapAnalysis } from "../analysis/gaps-service";

/**
 * Execute a recipe and create a new run with results.
 *
 * Flow:
 * 1. Validate recipe can be executed (status is VALID)
 * 2. Compute current dataset hash
 * 3. Check for existing run with same version + hash (cache hit)
 * 4. If cache hit, return existing run
 * 5. Create new run with RUNNING status
 * 6. Execute analysis based on recipe type
 * 7. Generate key findings
 * 8. Generate figure spec
 * 9. Update run with results
 * 10. Return completed run
 */
export async function executeRecipe(recipeId: string): Promise<{
  run: RqRun;
  isNew: boolean;
}> {
  // Get recipe
  const recipe = await prisma.rqRecipe.findUnique({
    where: { id: recipeId },
    select: {
      id: true,
      studyId: true,
      name: true,
      type: true,
      xFacetId: true,
      yFacetId: true,
      groupByFacetId: true,
      config: true,
      version: true,
      status: true,
    },
  });

  if (!recipe) {
    throw new Error(`Recipe not found: ${recipeId}`);
  }

  // Validate recipe can be executed
  const canExecute = await canExecuteRecipe({
    type: recipe.type,
    xFacetId: recipe.xFacetId,
    yFacetId: recipe.yFacetId,
    groupByFacetId: recipe.groupByFacetId,
    config: (recipe.config as RecipeConfig) ?? {},
    studyId: recipe.studyId,
  });

  if (!canExecute.canExecute) {
    throw new Error(`Cannot execute recipe: ${canExecute.reason}`);
  }

  // Get current dataset state
  const { hash: datasetHash, count: includedSourceCount } = await getDatasetState(recipe.studyId);

  // Check for existing run with same version and hash (cache hit)
  const existingRun = await prisma.rqRun.findFirst({
    where: {
      recipeId,
      recipeVersion: recipe.version,
      datasetHash,
      status: RunStatus.UP_TO_DATE,
    },
    orderBy: { startedAt: "desc" },
  });

  if (existingRun) {
    return {
      run: transformRun(existingRun),
      isNew: false,
    };
  }

  // Create new run with RUNNING status
  const run = await prisma.rqRun.create({
    data: {
      recipeId,
      recipeVersion: recipe.version,
      datasetHash,
      includedSourceCount,
      status: RunStatus.RUNNING,
    },
  });

  try {
    // Execute analysis based on recipe type
    const config = (recipe.config as RecipeConfig) ?? {};
    const { resultData, figureSpec } = await executeAnalysis(
      recipe.studyId,
      recipe.type,
      recipe.xFacetId,
      recipe.yFacetId,
      recipe.groupByFacetId,
      config,
    );

    // Generate key findings
    const keyFindings = generateKeyFindings(recipe.type, resultData);

    // Update run with results
    const completedRun = await prisma.rqRun.update({
      where: { id: run.id },
      data: {
        status: RunStatus.UP_TO_DATE,
        resultData: resultData as object,
        keyFindings: keyFindings as unknown as object,
        figureSpec: figureSpec as object,
        completedAt: new Date(),
      },
    });

    return {
      run: transformRun(completedRun),
      isNew: true,
    };
  } catch (error) {
    // Update run with error status
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const failedRun = await prisma.rqRun.update({
      where: { id: run.id },
      data: {
        status: RunStatus.ERROR,
        errorMessage,
        completedAt: new Date(),
      },
    });

    return {
      run: transformRun(failedRun),
      isNew: true,
    };
  }
}

/**
 * Execute the appropriate analysis based on recipe type.
 */
async function executeAnalysis(
  studyId: string,
  type: RecipeType,
  xFacetId: string | null,
  yFacetId: string | null,
  groupByFacetId: string | null,
  config: RecipeConfig,
): Promise<{ resultData: any; figureSpec: FigureSpec }> {
  switch (type) {
    case RecipeType.DISTRIBUTION: {
      if (!xFacetId) {
        throw new Error("xFacetId is required for DISTRIBUTION recipe");
      }

      const dimension: DimensionConfig = { type: "facet", facetId: xFacetId };
      const resultData = await getFrequencyData(studyId, dimension, config.filters);

      const figureSpec: FigureSpec = {
        type: config.vizPreference?.chartType === "pie" ? "pie" : "bar",
        title: `Distribution`,
        showLegend: true,
        options: {
          orientation: config.vizPreference?.orientation ?? "horizontal",
          showCounts: config.vizPreference?.showCounts ?? true,
          showPercentages: config.vizPreference?.showPercentages ?? true,
        },
      };

      return { resultData, figureSpec };
    }

    case RecipeType.MAP: {
      if (!xFacetId || !yFacetId) {
        throw new Error("xFacetId and yFacetId are required for MAP recipe");
      }

      const rowDimension: DimensionConfig = { type: "facet", facetId: xFacetId };
      const colDimension: DimensionConfig = { type: "facet", facetId: yFacetId };
      const resultData = await getCrossTabData(studyId, rowDimension, colDimension, config.filters);

      const figureSpec: FigureSpec = {
        type: config.vizPreference?.chartType === "heatmap" ? "heatmap" : "bubble",
        title: `Systematic Map`,
        xAxisLabel: resultData.colDimension.facetId,
        yAxisLabel: resultData.rowDimension.facetId,
        showLegend: true,
        options: {
          showCounts: config.vizPreference?.showCounts ?? true,
          showPercentages: config.vizPreference?.showPercentages ?? false,
        },
      };

      return { resultData, figureSpec };
    }

    case RecipeType.TREND: {
      const groupBy: DimensionConfig | undefined = groupByFacetId
        ? { type: "facet", facetId: groupByFacetId }
        : undefined;

      const resultData = await getTimeSeriesData(studyId, groupBy, config.filters);

      const figureSpec: FigureSpec = {
        type: "line",
        title: `Publication Trends`,
        xAxisLabel: "Year",
        yAxisLabel: "Number of Publications",
        showLegend: !!groupByFacetId,
        options: {
          showCounts: true,
        },
      };

      return { resultData, figureSpec };
    }

    case RecipeType.GAP: {
      const threshold = config.gapThreshold ?? 3;
      const facetIds = config.gapFacetIds;

      const resultData = await getGapAnalysis(studyId, threshold, facetIds);

      const figureSpec: FigureSpec = {
        type: "bar",
        title: `Research Gaps (threshold: ${threshold})`,
        showLegend: false,
        options: {
          highlightEmpty: true,
        },
      };

      return { resultData, figureSpec };
    }

    default:
      throw new Error(`Unknown recipe type: ${type}`);
  }
}

/**
 * Transform Prisma run to API response format.
 */
function transformRun(run: any): RqRun {
  return {
    id: run.id,
    recipeId: run.recipeId,
    recipeVersion: run.recipeVersion,
    datasetHash: run.datasetHash,
    includedSourceCount: run.includedSourceCount,
    status: run.status as RqRun["status"],
    errorMessage: run.errorMessage,
    resultData: run.resultData,
    keyFindings: run.keyFindings,
    figureSpec: run.figureSpec,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  };
}

/**
 * Get the answer bundle for a recipe (recipe + latest run + staleness).
 */
export async function getAnswerBundle(recipeId: string): Promise<{
  recipe: any;
  run: RqRun | null;
  status: RunStatus | "NOT_RUN";
  isStale: boolean;
  currentDatasetHash: string;
}> {
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
    },
  });

  if (!recipe) {
    throw new Error(`Recipe not found: ${recipeId}`);
  }

  // Get latest run
  const latestRun = await prisma.rqRun.findFirst({
    where: { recipeId },
    orderBy: { startedAt: "desc" },
  });

  // Get current dataset hash
  const { hash: currentDatasetHash } = await getDatasetState(recipe.studyId);

  // Determine staleness
  const isStale = latestRun ? latestRun.datasetHash !== currentDatasetHash : false;

  return {
    recipe: {
      id: recipe.id,
      studyId: recipe.studyId,
      name: recipe.name,
      description: recipe.description,
      researchQuestionId: recipe.researchQuestionId,
      type: recipe.type,
      xFacetId: recipe.xFacetId,
      yFacetId: recipe.yFacetId,
      groupByFacetId: recipe.groupByFacetId,
      config: recipe.config,
      version: recipe.version,
      status: recipe.status,
      statusReason: recipe.statusReason,
      order: recipe.order,
      createdAt: recipe.createdAt.toISOString(),
      updatedAt: recipe.updatedAt.toISOString(),
      researchQuestion: recipe.researchQuestion,
      xFacet: recipe.xFacet,
      yFacet: recipe.yFacet,
      groupByFacet: recipe.groupByFacet,
    },
    run: latestRun ? transformRun(latestRun) : null,
    status: latestRun?.status ?? ("NOT_RUN" as const),
    isStale,
    currentDatasetHash,
  };
}
