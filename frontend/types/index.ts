import { Prisma } from "@prisma/client";

// ============ Prisma-based Types ============

export type StudyWithRelations = Prisma.StudyGetPayload<{
  include: {
    researchQuestions: true;
    parameters: {
      include: {
        formalSources: true;
        greySources: true;
        inclusionCriteria: true;
        exclusionCriteria: true;
      };
    };
    sources: true;
    facets: {
      include: {
        categories: true;
        researchQuestions: {
          include: {
            researchQuestion: true;
          };
        };
      };
    };
  };
}>;

export type SourceWithAnalysis = Prisma.SourceGetPayload<{
  include: {
    analysis: {
      include: {
        classifications: {
          include: {
            facet: true;
            category: true;
          };
        };
      };
    };
  };
}>;

export type StudyParametersWithRelations = Prisma.StudyParametersGetPayload<{
  include: {
    formalSources: true;
    greySources: true;
    inclusionCriteria: true;
    exclusionCriteria: true;
  };
}>;

export type FacetWithRelations = Prisma.FacetGetPayload<{
  include: {
    categories: true;
    researchQuestions: {
      include: {
        researchQuestion: true;
      };
    };
  };
}>;

export type ClassificationWithRelations = Prisma.ClassificationGetPayload<{
  include: {
    facet: true;
    category: true;
  };
}>;

// ============ Transformed/Frontend Types ============

// Facet type as returned by API (with transformed RQ data)
export interface Facet {
  id: string;
  studyId: string;
  name: string;
  description: string | null;
  type: "CLOSED" | "OPEN";
  required: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  categories: FacetCategory[];
  researchQuestionIds: string[];
  researchQuestions: {
    id: string;
    question: string;
    order: number;
  }[];
}

export interface FacetCategory {
  id: string;
  facetId: string;
  name: string;
  description: string | null;
  order: number;
}

// For creating/updating facets
export interface FacetInput {
  name: string;
  description?: string;
  type?: "CLOSED" | "OPEN";
  required?: boolean;
  categories?: (string | { name: string; description?: string })[];
  researchQuestionIds?: string[];
}

// ============ Enums (mirror Prisma) ============

export type FacetType = "CLOSED" | "OPEN";

export type GreyLiteratureTier = "TIER_1" | "TIER_2" | "TIER_3";

export type VenueType =
  | "JOURNAL"
  | "CONFERENCE"
  | "WORKSHOP"
  | "SYMPOSIUM"
  | "BOOK_CHAPTER"
  | "PREPRINT_SERVER"
  | "TECHNICAL_REPORT"
  | "BLOG"
  | "OTHER";

// ============ API Response Types ============

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
}

// ============ Re-export Analysis Types ============

export * from "./analysis";
