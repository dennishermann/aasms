export interface CriterionEval {
  criterion: string;
  fulfilled?: boolean;
  decision?: boolean;
  reasoning?: string;
  confidence?: number;
}

export interface Classification {
  facetName: string;
  category: string;
  confidence: number;
  reasoning?: string;
  isManualOverride?: boolean;
}

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

export interface Facet {
  id: string;
  name: string;
  categories: string[];
}




