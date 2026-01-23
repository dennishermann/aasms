import { Prisma } from "@prisma/client";

// ============ Prisma-based Types ============

export type AnalysisConfigurationWithRelations = Prisma.AnalysisConfigurationGetPayload<{
  include: {
    study: true;
  };
}>;

// ============ Dimension Types ============

export type DimensionType =
  | "facet" // Any user-defined facet
  | "publication-year" // Built-in: year(publicationDate)
  | "venue-type" // Built-in: venueType
  | "source-category" // Built-in: FORMAL/GREY
  | "grey-tier"; // Built-in: greyLiteratureTier

export interface DimensionConfig {
  type: DimensionType;
  facetId?: string; // Required when type is 'facet'
}

// ============ Filter Types ============

export type FilterOperator = "equals" | "not-equals" | "in" | "not-in" | "between";

export interface Filter {
  dimension: DimensionConfig;
  operator: FilterOperator;
  values: (string | number)[];
}

// ============ Chart Configuration Types ============

export type SortOrder = "count-asc" | "count-desc" | "alpha" | "custom";
export type Orientation = "horizontal" | "vertical";

export interface ChartConfig {
  // For single-dimension charts (bar, pie, line)
  dimension?: DimensionConfig;

  // For two-dimension charts (bubble, heatmap)
  xDimension?: DimensionConfig;
  yDimension?: DimensionConfig;

  // Display options
  showCounts?: boolean;
  showPercentages?: boolean;
  sortBy?: SortOrder;
  customOrder?: string[];

  // Styling
  colorScheme?: string;
  orientation?: Orientation;
}

// ============ Table Configuration Types ============

export interface TableConfig {
  // For frequency tables
  dimension?: DimensionConfig;

  // For cross-tabulation tables
  rowDimension?: DimensionConfig;
  colDimension?: DimensionConfig;

  // For mapping tables
  includedFacets?: string[];
  includeMetadata?: ("title" | "authors" | "year" | "venue" | "sourceType")[];

  // Display options
  showTotals?: boolean;
  showPercentages?: boolean;
  highlightGaps?: boolean;
  gapThreshold?: number;
}

// ============ Artifact Types ============

export type ArtifactType =
  | "bar-chart"
  | "line-chart"
  | "pie-chart"
  | "bubble-plot"
  | "heatmap"
  | "frequency-table"
  | "crosstab-table"
  | "mapping-table"
  | "summary-stats";

export interface ArtifactConfiguration {
  id: string;
  type: ArtifactType;
  title: string;
  description?: string;
  config: ChartConfig | TableConfig;
  filters?: Filter[];
}

export interface AnalysisConfiguration {
  id: string;
  studyId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  artifacts: ArtifactConfiguration[];
}

// ============ Analysis Result Types ============

export interface FrequencyItem {
  id: string; // Category ID or dimension value
  label: string; // Display name
  count: number;
  percentage: number;
  sourceIds: string[];
}

export interface FrequencyResult {
  dimension: DimensionConfig;
  total: number;
  items: FrequencyItem[];
  /** Metadata for multi-classification facets */
  multiClassification?: {
    /** True if this facet allows multiple categories per source */
    isMultiClass: boolean;
    /** Total number of classifications (can exceed total sources) */
    totalClassifications: number;
    /** Average categories per source */
    avgCategoriesPerSource: number;
  };
}

export interface CrossTabCell {
  rowId: string;
  colId: string;
  count: number;
  percentage: number;
  sourceIds: string[];
}

export interface LabeledItem {
  id: string;
  label: string;
}

export interface CrossTabResult {
  rowDimension: DimensionConfig;
  colDimension: DimensionConfig;
  rowLabels: LabeledItem[];
  colLabels: LabeledItem[];
  cells: CrossTabCell[];
  rowTotals: { id: string; count: number }[];
  colTotals: { id: string; count: number }[];
  grandTotal: number;
}

export interface TimeSeriesSeries {
  id: string;
  label: string;
  data: number[]; // Count per year, aligned with years array
}

export interface TimeSeriesResult {
  years: number[];
  series: TimeSeriesSeries[];
}

export interface FacetCoverage {
  facetId: string;
  facetName: string;
  classified: number;
  unclassified: number;
  coveragePercent: number;
}

export interface VenueCount {
  name: string;
  count: number;
}

export interface SummaryStats {
  totalSources: number;
  includedSources: number;
  excludedSources: number;
  classifiedSources: number;
  formalSources: number;
  greySources: number;
  yearRange: { min: number | null; max: number | null };
  uniqueVenues: number;
  topVenues: VenueCount[];
  facetCoverage: FacetCoverage[];
}

export interface GapCategory {
  categoryId: string;
  categoryName: string;
  count: number;
}

export interface SingleDimensionGap {
  facetId: string;
  facetName: string;
  gaps: GapCategory[];
  empty: Omit<GapCategory, "count">[];
}

export interface CrossTabGapCell {
  rowId: string;
  colId: string;
  count: number;
}

export interface CrossTabGap {
  rowFacetId: string;
  rowFacetName: string;
  colFacetId: string;
  colFacetName: string;
  gaps: CrossTabGapCell[];
}

export interface GapAnalysis {
  threshold: number;
  singleDimensionGaps: SingleDimensionGap[];
  crossTabGaps: CrossTabGap[];
}

export interface MappingTableSource {
  id: string;
  title?: string;
  authors?: string[];
  year?: number | null;
  venue?: string | null;
  sourceCategory?: string;
  classifications: {
    [facetId: string]: string[]; // Array of category names or values
  };
}

export interface MappingTableResult {
  sources: MappingTableSource[];
  total: number;
  page: number;
  pageSize: number;
}

// ============ API Request Types ============

export interface FrequencyRequest {
  dimension: DimensionConfig;
  filters?: Filter[];
}

export interface CrossTabRequest {
  rowDimension: DimensionConfig;
  colDimension: DimensionConfig;
  filters?: Filter[];
}

export interface TimeSeriesRequest {
  groupBy?: DimensionConfig;
  filters?: Filter[];
}

export interface GapsRequest {
  threshold?: number;
  facetIds?: string[];
}

export interface MappingTableRequest {
  facetIds?: string[];
  includeMetadata?: ("title" | "authors" | "year" | "venue" | "sourceType")[];
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ExportRequest {
  type: "frequency" | "crosstab" | "mapping-table";
  format: "csv" | "png";
  config: ChartConfig | TableConfig;
  filters?: Filter[];
}

// ============ Multi-LLM Voting Types ============

export interface VoteDetail {
  provider: string;
  decision: boolean;
  confidence: number;
  reasoning?: string | null;
  error?: string | null;
}

export interface VotingDetails {
  votes: VoteDetail[];
  agreementRatio: number;
  voteCount: number;
  totalVoters: number;
}

export interface VotingSummary {
  totalProviders: number;
  providersUsed: string[];
  overallAgreementRatio: number;
  totalCriteriaEvaluated: number;
  unanimousDecisions: number;
  splitDecisions: number;
}

export interface CriterionEvalWithVoting {
  criterion: string;
  decision: boolean;
  reasoning: string;
  confidence: number;
  votingDetails?: VotingDetails | null;
}

export interface AnalysisWithVoting {
  votingEnabled: boolean;
  votingSummary?: VotingSummary | null;
  inclusionCriteria?: CriterionEvalWithVoting[];
  exclusionCriteria?: CriterionEvalWithVoting[];
}

// ============ API Response Types ============

export interface AnalysisApiResponse<T> {
  data?: T;
  error?: string;
}
