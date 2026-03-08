import type { Prisma } from "@prisma/client";

/**
 * Shared Prisma include for fetching facets with categories and RQ mappings.
 * Used by analyze, classify, batch-analyze, batch-classify, and upload-pdf routes.
 */
export const FACETS_WITH_CATEGORIES_INCLUDE = {
  include: {
    categories: { orderBy: { order: "asc" as const } },
    researchQuestions: {
      include: {
        researchQuestion: true,
      },
    },
  },
  orderBy: { order: "asc" as const },
} satisfies Prisma.FacetFindManyArgs;

/**
 * Study include with research questions, parameters (criteria), and facets.
 * Used by analyze and batch-analyze routes (need inclusion/exclusion criteria).
 */
export const STUDY_WITH_CRITERIA_AND_FACETS_INCLUDE = {
  researchQuestions: { orderBy: { order: "asc" as const } },
  parameters: {
    include: {
      inclusionCriteria: { orderBy: { order: "asc" as const } },
      exclusionCriteria: { orderBy: { order: "asc" as const } },
    },
  },
  facets: FACETS_WITH_CATEGORIES_INCLUDE,
} satisfies Prisma.StudyInclude;

/**
 * Study include with research questions and facets (no parameters/criteria).
 * Used by classify and batch-classify routes.
 */
export const STUDY_WITH_FACETS_INCLUDE = {
  researchQuestions: { orderBy: { order: "asc" as const } },
  facets: FACETS_WITH_CATEGORIES_INCLUDE,
} satisfies Prisma.StudyInclude;
