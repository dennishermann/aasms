/**
 * Metadata extracted from various sources (extension, PDF parsing, user edits).
 * Uses an index signature for flexibility since different extractors may
 * produce additional fields beyond the common ones.
 */
export interface SourceMetadata {
  title?: string;
  authors?: string[];
  abstract?: string;
  venue?: string;
  doi?: string;
  publicationDate?: string;
  keywords?: string[];
  content_excerpt?: string;
  year?: number | string;
  pdf_link?: string;
  database_specific?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Lightweight analysis summary included when fetching sources.
 * The full analysis (with classifications, votes, etc.) is fetched separately.
 */
export interface SourceAnalysisSummary {
  id: string;
  sourceId: string;
  inclusionRecommendation: boolean;
  inclusionReasoning: string;
  exclusionReasoning: string;
  confidenceScore: number;
  relevanceScore?: number | null;
  qualityNotes?: string | null;
  classificationBasis?: string | null;
  votingEnabled: boolean;
  votingSummary?: Record<string, unknown> | null;
  inclusionCriteria?: unknown[];
  exclusionCriteria?: unknown[];
  updatedAt: string;
}

/**
 * Minimal study info included on source responses.
 */
export interface SourceStudySummary {
  id: string;
  title: string;
  status: string;
  [key: string]: unknown;
}

export interface Source {
  id: string;
  studyId: string;
  type: string;
  sourceCategory: string;
  originalUrl: string | null;
  storagePath: string | null;
  title: string;
  authors: string[];
  publicationDate: string | null;
  venue: string | null;
  doi: string | null;
  abstract: string | null;
  keywords: string[];
  status: string;
  analysis: SourceAnalysisSummary | null;
  study: SourceStudySummary | null;
  metadataExtension?: SourceMetadata;
  metadataParsed?: SourceMetadata;
  metadataChosen?: SourceMetadata;
  metadataChosenSource?: string | null;
  bibtex?: string | null;
  hasPdf?: boolean;
  needsPdf?: boolean;
  sourceOrigin?: string | null;
  sourceOrigins?: string[];
  finalDecision?: string | null;
  decisionRationale?: string | null;
  importBatchId?: string | null;
  allowMetadataOnlyClassification?: boolean;
}
