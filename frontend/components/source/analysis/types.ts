// ============ Criterion Evaluation (from LLM) ============

export interface CriterionEval {
  criterion: string;
  fulfilled?: boolean;
  decision?: boolean;
  reasoning?: string;
  confidence?: number;
}

// ============ Classification ============

export interface Classification {
  id: string;
  facetId: string;
  categoryId: string | null;
  value: string | null;  // For OPEN facets
  confidence: number;
  reasoning?: string;
  isManualOverride?: boolean;
  // Populated from relations for display
  facet?: {
    id: string;
    name: string;
    type: "CLOSED" | "OPEN";
  };
  category?: {
    id: string;
    name: string;
  } | null;
}

// ============ Analysis Data ============

export interface AnalysisData {
  inclusionRecommendation: boolean;
  inclusionReasoning: string;
  exclusionReasoning: string;
  confidenceScore: number;
  classifications: Classification[];
  relevanceScore?: number;
  qualityNotes?: string;
  inclusionCriteria?: CriterionEval[];
  exclusionCriteria?: CriterionEval[];
}

// ============ Facet (for UI components) ============

export interface Facet {
  id: string;
  name: string;
  description?: string;
  type: "CLOSED" | "OPEN";
  required: boolean;
  categories: FacetCategory[];
  researchQuestionIds: string[];
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
