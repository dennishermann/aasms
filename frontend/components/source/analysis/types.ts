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

// ============ Criterion Evaluation (from LLM) ============

export interface CriterionEval {
  criterion: string;
  fulfilled?: boolean;
  decision?: boolean;
  reasoning?: string;
  confidence?: number;
  votingDetails?: VotingDetails | null;
}

// ============ Classification ============

export interface Classification {
  id: string;
  facetId: string;
  categoryId: string | null;
  value: string | null; // For OPEN facets
  confidence: number;
  reasoning?: string;
  isManualOverride?: boolean;
  // Populated from relations for display
  facet?: {
    id: string;
    name: string;
    type: "CLOSED" | "OPEN" | "OPEN_CODED";
  };
  category?: {
    id: string;
    name: string;
  } | null;
}

export interface FacetKeyword {
  id: string;
  facetId: string;
  keyword: string;
  confidence?: number | null;
  evidence?: string | null;
  facet?: {
    id: string;
    name: string;
    type: "CLOSED" | "OPEN" | "OPEN_CODED";
  };
}

// ============ Analysis Data ============

export interface AnalysisData {
  inclusionRecommendation: boolean;
  inclusionReasoning: string;
  exclusionReasoning: string;
  confidenceScore: number;
  classifications: Classification[];
  facetKeywords?: FacetKeyword[];
  relevanceScore?: number;
  qualityNotes?: string;
  classificationBasis?: "FULL_TEXT" | "METADATA_ONLY";
  inclusionCriteria?: CriterionEval[];
  exclusionCriteria?: CriterionEval[];
  // Voting fields
  votingEnabled?: boolean;
  votingSummary?: VotingSummary | null;
}

// ============ Facet (for UI components) ============

export interface Facet {
  id: string;
  name: string;
  description?: string;
  type: "CLOSED" | "OPEN" | "OPEN_CODED";
  required: boolean;
  categories: FacetCategory[];
  researchQuestionIds: string[];
  metadataField?: string | null;
  metadataTransform?: string | null;
}

export interface FacetCategory {
  id: string;
  name: string;
  description?: string;
}

// ============ Display Helpers ============

// Helper to get facet name from classification
export function getFacetName(c: Classification): string {
  return c.facet?.name ?? "Unknown";
}

// Helper to get category/value for display
export function getCategoryDisplay(c: Classification): string {
  return c.category?.name ?? c.value ?? "Unknown";
}
