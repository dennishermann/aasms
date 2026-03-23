"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ResearchQuestion } from "@/components/parameters/research-questions-editor";
import { Criterion } from "@/components/parameters/criteria-editor";
import { Facet } from "@/components/parameters/classification-schema-editor";


// API Types
interface Study {
  id: string;
  title: string;
  description: string | null;
  status: string;
  motivation: string | null;
  researchQuestions: Array<{
    id: string;
    question: string;
    order: number;
  }>;
}

interface Parameters {
  inclusionCriteria: Array<{
    criterion: string;
    order: number;
  }>;
  exclusionCriteria: Array<{
    criterion: string;
    order: number;
  }>;
}

interface ApiFacet {
  id: string;
  name: string;
  description: string | null;
  type: "CLOSED" | "OPEN" | "OPEN_CODED";
  required: boolean;
  order: number;
  categories: Array<{
    id: string;
    name: string;
    description: string | null;
    order: number;
  }>;
  researchQuestionIds: string[];
  metadataField?: string | null;
  metadataTransform?: string | null;
}

// Fetch functions
async function fetchStudy(id: string): Promise<Study> {
  const response = await fetch(`/api/studies/${id}`);
  if (!response.ok) throw new Error("Failed to fetch study");
  const data = await response.json();
  return data.data;
}

async function fetchParameters(studyId: string): Promise<Parameters | null> {
  const response = await fetch(`/api/studies/${studyId}/parameters`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) throw new Error("Failed to fetch parameters");
  const data = await response.json();
  return data.data;
}

async function fetchFacets(studyId: string): Promise<ApiFacet[]> {
  const response = await fetch(`/api/studies/${studyId}/facets`);
  if (!response.ok) throw new Error("Failed to fetch facets");
  const data = await response.json();
  return data.data || [];
}

// Convert API facets to editor format
function convertApiFacetToEditorFacet(apiFacet: ApiFacet): Facet {
  return {
    id: apiFacet.id,
    name: apiFacet.name,
    description: apiFacet.description || undefined,
    type: apiFacet.type,
    required: apiFacet.required,
    categories: apiFacet.categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description || undefined,
    })),
    researchQuestionIds: apiFacet.researchQuestionIds,
    metadataField: apiFacet.metadataField,
    metadataTransform: apiFacet.metadataTransform,
  };
}

export interface ParametersFormData {
  title: string;
  description: string;
  status: string;
  motivation: string;
  researchQuestions: ResearchQuestion[];
  inclusionCriteria: Criterion[];
  exclusionCriteria: Criterion[];
  facets: Facet[];
}

export interface UseParametersDataResult {
  // Raw API data
  study: Study | undefined;
  parameters: Parameters | null | undefined;
  apiFacets: ApiFacet[] | undefined;

  // Loading states
  isLoading: boolean;
  studyLoading: boolean;
  parametersLoading: boolean;
  facetsLoading: boolean;
  facetsFetching: boolean;

  // Errors
  studyError: Error | null;

  // Computed initial form data
  initialFormData: ParametersFormData | null;
}

/**
 * Custom hook for fetching all parameters page data.
 * Handles study, parameters, and facets data fetching.
 */
export function useParametersData(studyId: string): UseParametersDataResult {
  const {
    data: study,
    isLoading: studyLoading,
    error: studyError,
  } = useQuery({
    queryKey: ["study", studyId],
    queryFn: () => fetchStudy(studyId),
  });

  const { data: parameters, isLoading: parametersLoading } = useQuery({
    queryKey: ["parameters", studyId],
    queryFn: () => fetchParameters(studyId),
    enabled: !!study,
  });

  const {
    data: apiFacets,
    isLoading: facetsLoading,
    isRefetching: facetsFetching,
  } = useQuery({
    queryKey: ["facets", studyId],
    queryFn: () => fetchFacets(studyId),
    enabled: !!study,
  });

  // Compute initial form data when all data is loaded
  const initialFormData = useMemo<ParametersFormData | null>(() => {
    if (!study || parametersLoading || facetsLoading || facetsFetching) {
      return null;
    }

    return {
      title: study.title,
      description: study.description || "",
      status: study.status,
      motivation: study.motivation || "",
      researchQuestions: study.researchQuestions.map((rq) => ({
        id: rq.id,
        question: rq.question,
        order: rq.order,
      })),
      inclusionCriteria: parameters
        ? parameters.inclusionCriteria.map((ic) => ({
            criterion: ic.criterion,
            order: ic.order,
          }))
        : [],
      exclusionCriteria: parameters
        ? parameters.exclusionCriteria.map((ec) => ({
            criterion: ec.criterion,
            order: ec.order,
          }))
        : [],
      facets: (apiFacets || []).map(convertApiFacetToEditorFacet),
    };
  }, [study, parameters, apiFacets, parametersLoading, facetsLoading, facetsFetching]);

  const isLoading = studyLoading || parametersLoading || facetsLoading;

  return {
    study,
    parameters,
    apiFacets,
    isLoading,
    studyLoading,
    parametersLoading,
    facetsLoading,
    facetsFetching,
    studyError,
    initialFormData,
  };
}

export type { Study, Parameters, ApiFacet };
