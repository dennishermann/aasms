"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { type SortingState } from "@tanstack/react-table";
import { toast } from "sonner";
import { Source } from "@/types/source";

interface Study {
  id: string;
  title: string;
  status: string;
  sources: Source[];
}

async function fetchStudy(id: string): Promise<Study> {
  const response = await fetch(`/api/studies/${id}`);
  if (!response.ok) throw new Error("Failed to fetch study");
  const data = await response.json();
  return data.data;
}

export function useSourcesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const studyId = params.id as string;
  const queryClient = useQueryClient();
  const filterParam = searchParams.get("filter");
  const batchIdParam = searchParams.get("batchId");
  const sourceIdParam = searchParams.get("sourceId");

  const [tab, setTab] = useState<string>(filterParam || "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [suggestions, setSuggestions] = useState<Record<string, any>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<Source | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Fetch study data
  const {
    data: study,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["study", studyId],
    queryFn: () => fetchStudy(studyId),
  });

  // Sync tab with URL parameter
  useEffect(() => {
    const targetTab = filterParam || "all";
    if (tab !== targetTab) {
      setTab(targetTab);
    }
  }, [filterParam, tab, setTab]);

  // Handle tab change
  const handleTabChange = (newTab: string) => {
    setTab(newTab);
    setIsEditMode(false);
    const newParams = new URLSearchParams(searchParams.toString());
    if (newTab === "all") {
      newParams.delete("filter");
    } else {
      newParams.set("filter", newTab);
    }
    newParams.delete("sourceId");
    router.push(`/studies/${studyId}/sources?${newParams.toString()}`, { scroll: false });
  };

  // Reset search when tab changes
  useEffect(() => {
    setSearchQuery("");
  }, [tab]);

  // Filter logic
  const filterSources = (sources: Source[], activeTab: string) => {
    switch (activeTab) {
      case "new_import":
        return batchIdParam ? sources.filter((s) => s.importBatchId === batchIdParam) : sources;
      case "needs_pdf":
        return sources.filter((s) => s.needsPdf);
      case "pending":
        return sources.filter(
          (s) =>
            (s.status === "PENDING" ||
              s.status === "PENDING_METADATA" ||
              s.status === "EXTRACTING_METADATA") &&
            !s.needsPdf,
        );
      case "analyzing":
        return sources.filter(
          (s) =>
            s.status === "READY_FOR_ANALYSIS" ||
            s.status === "READY_FOR_CLASSIFICATION" ||
            s.status === "ANALYZING" ||
            s.status === "ANALYZING_INCLUSION" ||
            s.status === "ANALYZING_CLASSIFICATION" ||
            s.status === "CLASSIFYING",
        );
      case "included":
        return sources.filter(
          (s) =>
            s.finalDecision === "INCLUDE" ||
            ((s.status === "ANALYZED" ||
              s.status === "INCLUDED" ||
              s.status === "CLASSIFIED" ||
              s.status === "NEEDS_REVIEW") &&
              !s.finalDecision),
        );
      case "excluded":
        return sources.filter((s) => s.finalDecision === "EXCLUDE" || s.status === "EXCLUDED");
      default:
        return sources;
    }
  };

  const filteredSources = study ? filterSources(study.sources, tab) : [];

  // Search logic
  const searchedSources = useMemo(() => {
    if (!searchQuery.trim()) return filteredSources;
    const q = searchQuery.toLowerCase();
    return filteredSources.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.authors?.some((a) => a.toLowerCase().includes(q)),
    );
  }, [filteredSources, searchQuery]);

  // Store source IDs in sessionStorage for prev/next navigation
  const navKey = `sources-nav-${studyId}-${tab}`;
  useEffect(() => {
    if (searchedSources.length > 0) {
      try {
        sessionStorage.setItem(navKey, JSON.stringify(searchedSources.map((s) => s.id)));
      } catch {
        // sessionStorage might be full or unavailable
      }
    }
  }, [searchedSources, navKey]);

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const res = await fetch(`/api/studies/${studyId}/sources/${sourceId}`, { method: "DELETE" });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error || "Failed to delete source");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study", studyId] });
      setDeleteTarget(null);
      toast.success("Source deleted");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch(`/api/studies/${studyId}/sources/bulk-delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error || "Failed to delete sources");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["study", studyId] });
      setSelectedIds(new Set());
      setIsEditMode(false);
      setShowBulkDeleteConfirm(false);
      toast.success(`Deleted ${data.count} sources`);
    },
  });

  const handleReparse = async (sourceId: string) => {
    setLoadingMap((m) => ({ ...m, [sourceId]: true }));
    try {
      const res = await fetch(`/api/studies/${studyId}/sources/${sourceId}/reparse`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to re-parse PDF");
      const payload = await res.json();
      setSuggestions((s) => ({ ...s, [sourceId]: payload.data }));
    } catch (e) {
      console.error(e);
      toast.error("Failed to re-parse");
    } finally {
      setLoadingMap((m) => ({ ...m, [sourceId]: false }));
    }
  };

  const applySuggestions = async (sourceId: string) => {
    const suggestion = suggestions[sourceId];
    if (!suggestion) return;
    setLoadingMap((m) => ({ ...m, [sourceId]: true }));
    try {
      await fetch(`/api/studies/${studyId}/sources/${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: suggestion.title,
          authors: suggestion.authors,
          abstract: suggestion.abstract,
          venue: suggestion.venue,
          doi: suggestion.doi,
          publicationDate: suggestion.publicationDate,
          status: "ANALYZED",
        }),
      });
      setSuggestions((s) => {
        const next = { ...s };
        delete next[sourceId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["study", studyId] });
    } catch (e) {
      console.error(e);
      toast.error("Failed to apply suggestions");
    } finally {
      setLoadingMap((m) => ({ ...m, [sourceId]: false }));
    }
  };

  const toggleSelection = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) newSelected.add(id);
    else newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const ids = searchedSources.map((s) => s.id);
      setSelectedIds(new Set(ids));
    } else {
      setSelectedIds(new Set());
    }
  };

  return {
    studyId,
    study,
    isLoading,
    error,
    tab,
    filteredSources: searchedSources,
    searchQuery,
    setSearchQuery,
    sorting,
    setSorting,
    navKey,
    counts: study
      ? {
          all: study.sources.length,
          new_import: batchIdParam
            ? study.sources.filter((s) => s.importBatchId === batchIdParam).length
            : 0,
          needs_pdf: study.sources.filter((s) => s.needsPdf).length,
          pending: study.sources.filter(
            (s) =>
              (s.status === "PENDING" ||
                s.status === "PENDING_METADATA" ||
                s.status === "EXTRACTING_METADATA") &&
              !s.needsPdf,
          ).length,
          analyzing: study.sources.filter((s) =>
            [
              "READY_FOR_ANALYSIS",
              "READY_FOR_CLASSIFICATION",
              "ANALYZING",
              "ANALYZING_INCLUSION",
              "ANALYZING_CLASSIFICATION",
              "CLASSIFYING",
            ].includes(s.status),
          ).length,
          included: study.sources.filter(
            (s) =>
              s.finalDecision === "INCLUDE" ||
              (["ANALYZED", "INCLUDED", "CLASSIFIED", "NEEDS_REVIEW"].includes(s.status) &&
                !s.finalDecision),
          ).length,
          excluded: study.sources.filter(
            (s) => s.finalDecision === "EXCLUDE" || s.status === "EXCLUDED",
          ).length,
        }
      : { all: 0, new_import: 0, needs_pdf: 0, pending: 0, analyzing: 0, included: 0, excluded: 0 },
    batchIdParam,
    isEditMode,
    setIsEditMode,
    selectedIds,
    toggleSelection,
    toggleSelectAll,
    deleteTarget,
    setDeleteTarget,
    deleteMutation,
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    bulkDeleteMutation,
    handleTabChange,
    handleReparse,
    applySuggestions,
    suggestions,
    loadingMap,
  };
}
