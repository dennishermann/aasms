import { Prisma } from "@prisma/client";

// Type helpers for Prisma relations
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
  };
}>;

export type SourceWithAnalysis = Prisma.SourceGetPayload<{
  include: {
    analysis: {
      include: {
        classifications: true;
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

// Classification schema types
export interface ClassificationFacet {
  name: string;
  description?: string;
  categories: string[];
}

export interface ClassificationSchema {
  [facetName: string]: ClassificationFacet;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
}

