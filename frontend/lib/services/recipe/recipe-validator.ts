import { prisma } from "@/lib/db";
import { FacetType, RecipeStatus, RecipeType } from "@prisma/client";
import type { RecipeValidationResult, RecipeValidationWarning, RecipeConfig } from "@/types/recipe";

interface RecipeToValidate {
  type: RecipeType;
  xFacetId?: string | null;
  yFacetId?: string | null;
  groupByFacetId?: string | null;
  config: RecipeConfig;
  studyId: string;
}

/**
 * Validate a recipe and determine its status.
 *
 * Status rules:
 * - DRAFT: Missing required fields (type-specific dimensions)
 * - BLOCKED: Referenced facet deleted, or OPEN facet used for aggregation
 * - VALID: All required fields present and facets are valid
 */
export async function validateRecipe(recipe: RecipeToValidate): Promise<RecipeValidationResult> {
  const warnings: RecipeValidationWarning[] = [];
  const status: RecipeStatus = RecipeStatus.VALID;
  let reason: string | undefined;

  // Check type-specific required fields
  const missingFields = getMissingFields(recipe);
  if (missingFields.length > 0) {
    return {
      status: RecipeStatus.DRAFT,
      reason: `Missing required fields: ${missingFields.join(", ")}`,
      warnings: [],
    };
  }

  // Collect facet IDs to validate
  const facetIdsToCheck: string[] = [];
  if (recipe.xFacetId) facetIdsToCheck.push(recipe.xFacetId);
  if (recipe.yFacetId) facetIdsToCheck.push(recipe.yFacetId);
  if (recipe.groupByFacetId) facetIdsToCheck.push(recipe.groupByFacetId);
  if (recipe.config.gapFacetIds) {
    facetIdsToCheck.push(...recipe.config.gapFacetIds);
  }

  // Fetch facets
  const facets = await prisma.facet.findMany({
    where: {
      id: { in: facetIdsToCheck },
      studyId: recipe.studyId,
    },
    select: {
      id: true,
      name: true,
      type: true,
      _count: {
        select: { classifications: true, categories: true },
      },
    },
  });

  const facetMap = new Map(facets.map((f) => [f.id, f]));

  // Check for deleted facets
  for (const facetId of facetIdsToCheck) {
    if (!facetMap.has(facetId)) {
      return {
        status: RecipeStatus.BLOCKED,
        reason: `Referenced facet was deleted (ID: ${facetId})`,
        warnings: [],
      };
    }
  }

  // Check facet types based on recipe type
  const facetTypeValidation = validateFacetTypes(recipe, facetMap);
  if (facetTypeValidation.blocked) {
    return {
      status: RecipeStatus.BLOCKED,
      reason: facetTypeValidation.reason,
      warnings: [],
    };
  }
  warnings.push(...facetTypeValidation.warnings);

  // Check for low coverage warnings
  const coverageWarnings = await checkCoverageWarnings(recipe.studyId, facets);
  warnings.push(...coverageWarnings);

  return {
    status,
    reason,
    warnings: warnings.map((w) => w.message),
  };
}

/**
 * Get list of missing required fields based on recipe type.
 */
function getMissingFields(recipe: RecipeToValidate): string[] {
  const missing: string[] = [];

  switch (recipe.type) {
    case RecipeType.DISTRIBUTION:
      if (!recipe.xFacetId) {
        missing.push("xFacetId (primary dimension)");
      }
      break;

    case RecipeType.MAP:
      if (!recipe.xFacetId) {
        missing.push("xFacetId (row dimension)");
      }
      if (!recipe.yFacetId) {
        missing.push("yFacetId (column dimension)");
      }
      break;

    case RecipeType.TREND:
      // groupByFacetId is optional for TREND
      break;

    case RecipeType.GAP:
      if (!recipe.config.gapFacetIds || recipe.config.gapFacetIds.length === 0) {
        missing.push("gapFacetIds (facets to analyze)");
      }
      break;
  }

  return missing;
}

interface FacetTypeValidationResult {
  blocked: boolean;
  reason?: string;
  warnings: RecipeValidationWarning[];
}

/**
 * Validate that facet types are appropriate for the recipe type.
 */
function validateFacetTypes(
  recipe: RecipeToValidate,
  facetMap: Map<
    string,
    {
      id: string;
      name: string;
      type: FacetType;
      _count: { classifications: number; categories: number };
    }
  >,
): FacetTypeValidationResult {
  const warnings: RecipeValidationWarning[] = [];

  // Helper to check if facet is aggregatable (CLOSED or OPEN_CODED)
  const isAggregatable = (facetId: string): boolean => {
    const facet = facetMap.get(facetId);
    return facet?.type === FacetType.CLOSED || facet?.type === FacetType.OPEN_CODED;
  };

  const getFacetName = (facetId: string): string => {
    return facetMap.get(facetId)?.name ?? facetId;
  };

  switch (recipe.type) {
    case RecipeType.DISTRIBUTION:
      if (recipe.xFacetId && !isAggregatable(recipe.xFacetId)) {
        return {
          blocked: true,
          reason: `Cannot create distribution for OPEN facet "${getFacetName(
            recipe.xFacetId,
          )}". Please code the facet first.`,
          warnings: [],
        };
      }
      break;

    case RecipeType.MAP:
      if (recipe.xFacetId && !isAggregatable(recipe.xFacetId)) {
        return {
          blocked: true,
          reason: `Cannot use OPEN facet "${getFacetName(
            recipe.xFacetId,
          )}" as row dimension. Please code the facet first.`,
          warnings: [],
        };
      }
      if (recipe.yFacetId && !isAggregatable(recipe.yFacetId)) {
        return {
          blocked: true,
          reason: `Cannot use OPEN facet "${getFacetName(
            recipe.yFacetId,
          )}" as column dimension. Please code the facet first.`,
          warnings: [],
        };
      }
      break;

    case RecipeType.TREND:
      // groupByFacetId should be aggregatable if provided
      if (recipe.groupByFacetId && !isAggregatable(recipe.groupByFacetId)) {
        return {
          blocked: true,
          reason: `Cannot group by OPEN facet "${getFacetName(
            recipe.groupByFacetId,
          )}". Please code the facet first.`,
          warnings: [],
        };
      }
      break;

    case RecipeType.GAP:
      // GAP requires CLOSED facets only (not OPEN_CODED)
      for (const facetId of recipe.config.gapFacetIds ?? []) {
        const facet = facetMap.get(facetId);
        if (facet?.type !== FacetType.CLOSED) {
          return {
            blocked: true,
            reason: `Gap analysis requires CLOSED facets only. "${getFacetName(
              facetId,
            )}" is ${facet?.type ?? "unknown"}.`,
            warnings: [],
          };
        }
      }
      break;
  }

  return { blocked: false, warnings };
}

/**
 * Check for coverage warnings (low classification coverage).
 */
async function checkCoverageWarnings(
  studyId: string,
  facets: Array<{
    id: string;
    name: string;
    _count: { classifications: number; categories: number };
  }>,
): Promise<RecipeValidationWarning[]> {
  const warnings: RecipeValidationWarning[] = [];

  // Get total included sources
  const totalSources = await prisma.source.count({
    where: {
      studyId,
      status: "CLASSIFIED",
      finalDecision: "INCLUDE",
    },
  });

  if (totalSources === 0) {
    warnings.push({
      type: "small_n",
      message: "No classified sources yet. Results will be empty.",
    });
    return warnings;
  }

  // Check coverage for each facet
  for (const facet of facets) {
    const coverage = facet._count.classifications / totalSources;

    if (coverage < 0.5) {
      warnings.push({
        type: "low_coverage",
        message: `"${facet.name}" has low coverage (${Math.round(
          coverage * 100,
        )}%). Results may be incomplete.`,
        facetId: facet.id,
      });
    }
  }

  // Warn if small dataset
  if (totalSources < 10) {
    warnings.push({
      type: "small_n",
      message: `Small dataset (${totalSources} sources). Statistical patterns may not be meaningful.`,
    });
  }

  return warnings;
}

/**
 * Quick check if a recipe can be executed (status is VALID).
 */
export async function canExecuteRecipe(
  recipe: RecipeToValidate,
): Promise<{ canExecute: boolean; reason?: string }> {
  const validation = await validateRecipe(recipe);

  if (validation.status === RecipeStatus.VALID) {
    return { canExecute: true };
  }

  return {
    canExecute: false,
    reason: validation.reason ?? `Recipe status is ${validation.status}`,
  };
}
