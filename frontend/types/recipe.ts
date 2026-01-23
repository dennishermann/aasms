import type { Filter, FrequencyResult, CrossTabResult, TimeSeriesResult, GapAnalysis } from "./analysis";

// ============ Enums ============

export type RecipeType = "DISTRIBUTION" | "MAP" | "TREND" | "GAP";
export type RecipeStatus = "DRAFT" | "VALID" | "BLOCKED";
export type RunStatus = "NOT_RUN" | "UP_TO_DATE" | "STALE" | "RUNNING" | "ERROR";

// ============ Recipe Configuration ============

export interface VizPreference {
  chartType?: "bar" | "pie" | "line" | "bubble" | "heatmap";
  showCounts?: boolean;
  showPercentages?: boolean;
  orientation?: "horizontal" | "vertical";
  colorScheme?: string;
}

export interface RecipeConfig {
  // Filters applied to sources before aggregation
  filters?: Filter[];

  // Metric type for display
  metric?: "count" | "percentage";

  // Missing data handling
  missingHandling?: "exclude" | "include_as_unknown";

  // Sort order for results
  sortOrder?: "count-desc" | "count-asc" | "alpha";
  customOrder?: string[];

  // Visualization preferences
  vizPreference?: VizPreference;

  // GAP-specific configuration
  gapThreshold?: number;
  gapFacetIds?: string[];
}

// ============ Recipe Types ============

export interface RqRecipeBase {
  id: string;
  studyId: string;
  name: string;
  description?: string | null;
  researchQuestionId?: string | null;
  type: RecipeType;
  xFacetId?: string | null;
  yFacetId?: string | null;
  groupByFacetId?: string | null;
  config: RecipeConfig;
  version: number;
  status: RecipeStatus;
  statusReason?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface RqRecipeRelations {
  researchQuestion?: {
    id: string;
    question: string;
  } | null;
  xFacet?: {
    id: string;
    name: string;
    type: string;
  } | null;
  yFacet?: {
    id: string;
    name: string;
    type: string;
  } | null;
  groupByFacet?: {
    id: string;
    name: string;
    type: string;
  } | null;
  latestRun?: RqRun | null;
}

export type RqRecipe = RqRecipeBase & RqRecipeRelations;

// ============ Run Types ============

export interface RqRun {
  id: string;
  recipeId: string;
  recipeVersion: number;
  datasetHash: string;
  includedSourceCount: number;
  status: RunStatus;
  errorMessage?: string | null;
  resultData?: RecipeResultData | null;
  keyFindings?: string[] | null;
  figureSpec?: FigureSpec | null;
  startedAt: string;
  completedAt?: string | null;
}

// Result data can be any of the analysis result types
export type RecipeResultData =
  | FrequencyResult
  | CrossTabResult
  | TimeSeriesResult
  | GapAnalysis;

// Figure specification for chart rendering
export interface FigureSpec {
  type: "bar" | "pie" | "line" | "bubble" | "heatmap";
  title: string;
  subtitle?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  showLegend?: boolean;
  options?: Record<string, unknown>;
}

// ============ Answer Bundle ============

export interface RqAnswerBundle {
  recipe: RqRecipe;
  run: RqRun | null;
  status: RunStatus;
  isStale: boolean;
  staleSince?: string;
  currentDatasetHash: string;
}

// ============ API Request/Response Types ============

export interface CreateRecipeInput {
  name: string;
  description?: string;
  researchQuestionId?: string;
  type: RecipeType;
  xFacetId?: string;
  yFacetId?: string;
  groupByFacetId?: string;
  config?: RecipeConfig;
}

export interface UpdateRecipeInput {
  name?: string;
  description?: string;
  researchQuestionId?: string | null;
  type?: RecipeType;
  xFacetId?: string | null;
  yFacetId?: string | null;
  groupByFacetId?: string | null;
  config?: RecipeConfig;
  order?: number;
}

export interface RecipeListResponse {
  data: RqRecipe[];
}

export interface RecipeResponse {
  data: RqRecipe;
}

export interface RecipeBundleResponse {
  data: RqAnswerBundle;
}

export interface RunRecipeResponse {
  data: {
    run: RqRun;
    isNew: boolean;
  };
}

export interface RecipeStatusSummary {
  id: string;
  name: string;
  type: RecipeType;
  status: RecipeStatus;
  runStatus: RunStatus;
  isStale: boolean;
  researchQuestionId?: string | null;
}

export interface RecipeStatusResponse {
  data: {
    recipes: RecipeStatusSummary[];
    datasetHash: string;
    totalSources: number;
  };
}

// ============ Export Types ============

export interface ExportRecipeOptions {
  format: "zip";
  include: {
    figure?: boolean;
    table?: boolean;
    sources?: boolean;
    recipe?: boolean;
    report?: boolean;
  };
}

// ============ Validation Types ============

export interface RecipeValidationResult {
  status: RecipeStatus;
  reason?: string;
  warnings: string[];
}

export interface RecipeValidationWarning {
  type: "low_coverage" | "uncoded_facet" | "small_n" | "missing_data";
  message: string;
  facetId?: string;
}
