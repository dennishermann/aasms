import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Source } from "../types/source";
import { AnalysisData } from "@/components/source/analysis/types";

async function fetchSource(studyId: string, sourceId: string): Promise<Source> {
  const response = await fetch(`/api/studies/${studyId}/sources/${sourceId}`);
  if (!response.ok) throw new Error("Failed to fetch source");
  const data = await response.json();
  return data.data;
}

async function fetchAnalysis(studyId: string, sourceId: string) {
  const response = await fetch(`/api/studies/${studyId}/sources/${sourceId}/analysis`);
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail?.error || detail?.detail || "Failed to fetch analysis");
  }
  const data = await response.json();
  return data;
}

async function reparseSource(studyId: string, sourceId: string) {
  const res = await fetch(`/api/studies/${studyId}/sources/${sourceId}/reparse`, {
    method: "POST",
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || "Failed to re-parse PDF");
  }
  const data = await res.json();
  return data.data;
}

export function useSourceDetails(studyId: string, sourceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reparseLoading, setReparseLoading] = useState(false);
  const [reparseError, setReparseError] = useState<string | null>(null);
  const [autoAnalyzeError, setAutoAnalyzeError] = useState<string | null>(null);
  const [loadingInclusionAnalysis, setLoadingInclusionAnalysis] = useState(false);
  const [loadingClassificationAnalysis, setLoadingClassificationAnalysis] = useState(false);

  // We expose these state setters if the UI needs to react to mutation success
  // (e.g. setting parsedSuggestion, which is a UI concern)
  // Instead of returning setters, we can accept callbacks.

  const {
    data: source,
    isLoading: sourceLoading,
    error: sourceError,
  } = useQuery({
    queryKey: ["source", studyId, sourceId],
    queryFn: () => fetchSource(studyId, sourceId),
    refetchInterval: (query) => {
      const data = query.state.data as Source | undefined;
      if (!data) return false;
      // Removed strict PDF check to allow polling for WEBPAGE/BLOG_POST
      const needsParsed = !data.metadataParsed;
      const watchStatuses = ["EXTRACTING_METADATA", "PENDING_METADATA"];
      return needsParsed && watchStatuses.includes(data.status) ? 2000 : false;
    },
    refetchIntervalInBackground: true,
  });

  const {
    data: analysisData,
    isLoading: analysisLoading,
    error: analysisError,
    isError: analysisIsError,
  } = useQuery({
    queryKey: ["analysis", studyId, sourceId],
    queryFn: () => fetchAnalysis(studyId, sourceId),
    enabled: !!source,
    retry: 1,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/studies/${studyId}/sources/${sourceId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete source");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study", studyId] });
      router.push(`/studies/${studyId}/sources`);
    },
  });

  const reparseMutation = useMutation({
    mutationFn: async () => {
      setReparseLoading(true);
      setReparseError(null);
      try {
        return await reparseSource(studyId, sourceId);
      } catch (e: any) {
        setReparseError(e?.message || "Failed to re-parse");
        throw e;
      } finally {
        setReparseLoading(false);
      }
    },
  });

  const patchMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/studies/${studyId}/sources/${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error || "Failed to update source");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source", studyId, sourceId] });
      queryClient.invalidateQueries({ queryKey: ["study", studyId] });
      queryClient.invalidateQueries({ queryKey: ["analysis", studyId, sourceId] });

      // Auto-run inclusion/exclusion, then classification only if included
      (async () => {
        try {
          setAutoAnalyzeError(null);

          // Step 1: Run inclusion/exclusion analysis
          setLoadingInclusionAnalysis(true);
          const analyzeRes = await fetch(`/api/studies/${studyId}/sources/${sourceId}/analyze`, {
            method: "POST",
          });
          if (!analyzeRes.ok) {
            const detail = await analyzeRes.json().catch(() => ({}));
            throw new Error(detail.error || "Inclusion/exclusion analysis failed");
          }

          // Get the analysis result to check recommendation
          const analyzeData = await analyzeRes.json();

          // Immediately refetch so inclusion/exclusion panel shows results
          await queryClient.invalidateQueries({ queryKey: ["source", studyId, sourceId] });
          await queryClient.invalidateQueries({ queryKey: ["analysis", studyId, sourceId] });

          setLoadingInclusionAnalysis(false);

          // Step 2: Only run classification if recommendation is INCLUDE
          const inclusionRecommendation = analyzeData?.data?.inclusionRecommendation;
          if (inclusionRecommendation) {
            setLoadingClassificationAnalysis(true);
            const classifyRes = await fetch(
              `/api/studies/${studyId}/sources/${sourceId}/classify`,
              { method: "POST" },
            );
            if (!classifyRes.ok) {
              const detail = await classifyRes.json().catch(() => ({}));
              throw new Error(detail.error || "Classification failed");
            }
            await queryClient.invalidateQueries({ queryKey: ["source", studyId, sourceId] });
            await queryClient.invalidateQueries({ queryKey: ["analysis", studyId, sourceId] });
          }
        } catch (e: any) {
          setAutoAnalyzeError(e?.message || "Auto analysis failed");
        } finally {
          setLoadingInclusionAnalysis(false);
          setLoadingClassificationAnalysis(false);
        }
      })();
    },
  });

  const classifyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/studies/${studyId}/sources/${sourceId}/classify`, {
        method: "POST",
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error || "Failed to classify source");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analysis", studyId, sourceId] });
      queryClient.invalidateQueries({ queryKey: ["source", studyId, sourceId] });
    },
  });

  return {
    source,
    sourceLoading,
    sourceError,
    analysisData,
    analysisLoading,
    analysisError,
    analysisIsError,
    deleteMutation,
    reparseMutation,
    patchMutation,
    classifyMutation,
    reparseLoading,
    reparseError,
    autoAnalyzeError,
    loadingInclusionAnalysis,
    loadingClassificationAnalysis,
  };
}
