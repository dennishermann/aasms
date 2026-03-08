import { prisma } from "@/lib/db";
import { RecipeStatus, RecipeType, RunStatus } from "@prisma/client";
import type {
  CreateRecipeInput,
  UpdateRecipeInput,
  RqRecipe,
  RqRun,
  RecipeConfig,
} from "@/types/recipe";
import { validateRecipe } from "./recipe-validator";
import { computeDatasetHash } from "./dataset-hash";

// Include relations for recipe queries
const recipeInclude = {
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
};

/**
 * Transform Prisma result to API response format.
 */
function transformRecipe(recipe: any, latestRun?: any): RqRecipe {
  return {
    id: recipe.id,
    studyId: recipe.studyId,
    name: recipe.name,
    description: recipe.description,
    researchQuestionId: recipe.researchQuestionId,
    type: recipe.type as RqRecipe["type"],
    xFacetId: recipe.xFacetId,
    yFacetId: recipe.yFacetId,
    groupByFacetId: recipe.groupByFacetId,
    config: (recipe.config as RecipeConfig) ?? {},
    version: recipe.version,
    status: recipe.status as RqRecipe["status"],
    statusReason: recipe.statusReason,
    order: recipe.order,
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
    researchQuestion: recipe.researchQuestion,
    xFacet: recipe.xFacet,
    yFacet: recipe.yFacet,
    groupByFacet: recipe.groupByFacet,
    latestRun: latestRun ? transformRun(latestRun) : null,
  };
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
 * List all recipes for a study with their latest run.
 */
export async function listRecipes(studyId: string): Promise<RqRecipe[]> {
  const recipes = await prisma.rqRecipe.findMany({
    where: { studyId },
    include: recipeInclude,
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  // Get latest run for each recipe
  const recipeIds = recipes.map((r) => r.id);
  const latestRuns = await prisma.rqRun.findMany({
    where: { recipeId: { in: recipeIds } },
    orderBy: { startedAt: "desc" },
    distinct: ["recipeId"],
  });

  const runMap = new Map(latestRuns.map((r) => [r.recipeId, r]));

  return recipes.map((recipe) => transformRecipe(recipe, runMap.get(recipe.id)));
}

/**
 * Get a single recipe by ID.
 */
export async function getRecipe(recipeId: string): Promise<RqRecipe | null> {
  const recipe = await prisma.rqRecipe.findUnique({
    where: { id: recipeId },
    include: recipeInclude,
  });

  if (!recipe) return null;

  // Get latest run
  const latestRun = await prisma.rqRun.findFirst({
    where: { recipeId },
    orderBy: { startedAt: "desc" },
  });

  return transformRecipe(recipe, latestRun);
}

/**
 * Create a new recipe.
 */
export async function createRecipe(studyId: string, input: CreateRecipeInput): Promise<RqRecipe> {
  // Get next order value
  const maxOrder = await prisma.rqRecipe.aggregate({
    where: { studyId },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  // Create recipe
  const recipe = await prisma.rqRecipe.create({
    data: {
      studyId,
      name: input.name,
      description: input.description,
      researchQuestionId: input.researchQuestionId,
      type: input.type as RecipeType,
      xFacetId: input.xFacetId,
      yFacetId: input.yFacetId,
      groupByFacetId: input.groupByFacetId,
      config: (input.config ?? {}) as object,
      order: nextOrder,
      status: RecipeStatus.DRAFT,
    },
    include: recipeInclude,
  });

  // Validate and update status
  const validation = await validateRecipe({
    type: recipe.type,
    xFacetId: recipe.xFacetId,
    yFacetId: recipe.yFacetId,
    groupByFacetId: recipe.groupByFacetId,
    config: (recipe.config as RecipeConfig) ?? {},
    studyId,
  });

  const updatedRecipe = await prisma.rqRecipe.update({
    where: { id: recipe.id },
    data: {
      status: validation.status,
      statusReason: validation.reason,
    },
    include: recipeInclude,
  });

  return transformRecipe(updatedRecipe);
}

/**
 * Update an existing recipe.
 */
export async function updateRecipe(recipeId: string, input: UpdateRecipeInput): Promise<RqRecipe> {
  // Get current recipe
  const current = await prisma.rqRecipe.findUnique({
    where: { id: recipeId },
    select: {
      studyId: true,
      type: true,
      xFacetId: true,
      yFacetId: true,
      groupByFacetId: true,
      config: true,
      version: true,
    },
  });

  if (!current) {
    throw new Error(`Recipe not found: ${recipeId}`);
  }

  // Determine if this is a substantive change that increments version
  const isSubstantiveChange =
    (input.type !== undefined && input.type !== current.type) ||
    (input.xFacetId !== undefined && input.xFacetId !== current.xFacetId) ||
    (input.yFacetId !== undefined && input.yFacetId !== current.yFacetId) ||
    (input.groupByFacetId !== undefined && input.groupByFacetId !== current.groupByFacetId) ||
    (input.config !== undefined && JSON.stringify(input.config) !== JSON.stringify(current.config));

  // Build update data
  const updateData: any = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.researchQuestionId !== undefined) {
    updateData.researchQuestionId = input.researchQuestionId;
  }
  if (input.type !== undefined) updateData.type = input.type as RecipeType;
  if (input.xFacetId !== undefined) updateData.xFacetId = input.xFacetId;
  if (input.yFacetId !== undefined) updateData.yFacetId = input.yFacetId;
  if (input.groupByFacetId !== undefined) updateData.groupByFacetId = input.groupByFacetId;
  if (input.config !== undefined) updateData.config = input.config as object;
  if (input.order !== undefined) updateData.order = input.order;

  // Increment version for substantive changes
  if (isSubstantiveChange) {
    updateData.version = current.version + 1;
  }

  // Update recipe
  const recipe = await prisma.rqRecipe.update({
    where: { id: recipeId },
    data: updateData,
    include: recipeInclude,
  });

  // Re-validate and update status
  const validation = await validateRecipe({
    type: recipe.type,
    xFacetId: recipe.xFacetId,
    yFacetId: recipe.yFacetId,
    groupByFacetId: recipe.groupByFacetId,
    config: (recipe.config as RecipeConfig) ?? {},
    studyId: recipe.studyId,
  });

  const updatedRecipe = await prisma.rqRecipe.update({
    where: { id: recipeId },
    data: {
      status: validation.status,
      statusReason: validation.reason,
    },
    include: recipeInclude,
  });

  // Get latest run
  const latestRun = await prisma.rqRun.findFirst({
    where: { recipeId },
    orderBy: { startedAt: "desc" },
  });

  return transformRecipe(updatedRecipe, latestRun);
}

/**
 * Delete a recipe and all its runs.
 */
export async function deleteRecipe(recipeId: string): Promise<void> {
  await prisma.rqRecipe.delete({
    where: { id: recipeId },
  });
}

/**
 * Get all runs for a recipe.
 */
export async function listRuns(recipeId: string): Promise<RqRun[]> {
  const runs = await prisma.rqRun.findMany({
    where: { recipeId },
    orderBy: { startedAt: "desc" },
  });

  return runs.map(transformRun);
}

/**
 * Get a single run by ID.
 */
export async function getRun(runId: string): Promise<RqRun | null> {
  const run = await prisma.rqRun.findUnique({
    where: { id: runId },
  });

  return run ? transformRun(run) : null;
}

/**
 * Revalidate all recipes for a study (e.g., after facet changes).
 */
export async function revalidateStudyRecipes(studyId: string): Promise<void> {
  const recipes = await prisma.rqRecipe.findMany({
    where: { studyId },
    select: {
      id: true,
      studyId: true,
      type: true,
      xFacetId: true,
      yFacetId: true,
      groupByFacetId: true,
      config: true,
    },
  });

  for (const recipe of recipes) {
    const validation = await validateRecipe({
      type: recipe.type,
      xFacetId: recipe.xFacetId,
      yFacetId: recipe.yFacetId,
      groupByFacetId: recipe.groupByFacetId,
      config: (recipe.config as RecipeConfig) ?? {},
      studyId: recipe.studyId,
    });

    await prisma.rqRecipe.update({
      where: { id: recipe.id },
      data: {
        status: validation.status,
        statusReason: validation.reason,
      },
    });
  }
}

/**
 * Get recipe status summary for all recipes in a study.
 */
export async function getRecipeStatusSummary(studyId: string): Promise<{
  recipes: Array<{
    id: string;
    name: string;
    type: RecipeType;
    status: RecipeStatus;
    runStatus: RunStatus | "NOT_RUN";
    isStale: boolean;
    researchQuestionId: string | null;
  }>;
  datasetHash: string;
  totalSources: number;
}> {
  const [recipes, datasetHash, totalSources] = await Promise.all([
    prisma.rqRecipe.findMany({
      where: { studyId },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        researchQuestionId: true,
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    computeDatasetHash(studyId),
    prisma.source.count({
      where: {
        studyId,
        status: "CLASSIFIED",
        finalDecision: "INCLUDE",
      },
    }),
  ]);

  // Get latest run for each recipe
  const recipeIds = recipes.map((r) => r.id);
  const latestRuns = await prisma.rqRun.findMany({
    where: { recipeId: { in: recipeIds } },
    orderBy: { startedAt: "desc" },
    distinct: ["recipeId"],
    select: {
      recipeId: true,
      status: true,
      datasetHash: true,
    },
  });

  const runMap = new Map(latestRuns.map((r) => [r.recipeId, r]));

  return {
    recipes: recipes.map((recipe) => {
      const run = runMap.get(recipe.id);
      const isStale = run ? run.datasetHash !== datasetHash : false;

      return {
        id: recipe.id,
        name: recipe.name,
        type: recipe.type,
        status: recipe.status,
        runStatus: run?.status ?? ("NOT_RUN" as const),
        isStale,
        researchQuestionId: recipe.researchQuestionId,
      };
    }),
    datasetHash,
    totalSources,
  };
}
