"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useSummaryStats,
  useFrequencyData,
  useTimeSeriesData,
  useCrossTabData,
  useGapAnalysis,
  useMappingTable,
  useExportData,
} from "./use-analysis";
import type {
  DimensionConfig,
  DimensionType,
  FrequencyResult,
  CrossTabResult,
  TimeSeriesResult,
  GapAnalysis,
  MappingTableResult,
  SummaryStats,
} from "@/types/analysis";

// ============ Types ============

export interface Facet {
  id: string;
  name: string;
  type: "CLOSED" | "OPEN" | "OPEN_CODED";
  categories: Array<{ id: string; name: string }>;
}

export interface Study {
  id: string;
  title: string;
  status: string;
}

export interface DimensionOption {
  value: string;
  label: string;
  dimension: DimensionConfig;
  group: "built-in" | "facet";
}

export interface CellClickData {
  rowId: string;
  colId: string;
  rowLabel: string;
  colLabel: string;
  count: number;
  sourceIds: string[];
}

export interface DrilldownData {
  title: string;
  description: string;
  sourceIds: string[];
}

// Built-in dimensions
export const BUILT_IN_DIMENSIONS: Array<{
  type: DimensionType;
  label: string;
  description: string;
}> = [
    {
      type: "publication-year",
      label: "Publication Year",
      description: "Year of publication",
    },
    {
      type: "venue-type",
      label: "Venue Type",
      description: "Journal, Conference, Workshop, etc.",
    },
    {
      type: "source-category",
      label: "Source Category",
      description: "Formal vs Grey Literature",
    },
  ];

// ============ Fetch Functions ============

async function fetchStudy(id: string): Promise<Study> {
  const response = await fetch(`/api/studies/${id}`);
  if (!response.ok) throw new Error("Failed to fetch study");
  const data = await response.json();
  return data.data;
}

async function fetchFacets(studyId: string): Promise<Facet[]> {
  const response = await fetch(`/api/studies/${studyId}/facets`);
  if (!response.ok) throw new Error("Failed to fetch facets");
  const data = await response.json();
  return data.data;
}

// ============ Hook ============

export interface UseAnalysisPageOptions {
  studyId: string;
}

export function useAnalysisPage({ studyId }: UseAnalysisPageOptions) {
  // ============ Base Queries ============

  const studyQuery = useQuery({
    queryKey: ["study", studyId],
    queryFn: () => fetchStudy(studyId),
  });

  const facetsQuery = useQuery({
    queryKey: ["facets", studyId],
    queryFn: () => fetchFacets(studyId),
  });

  const facets = facetsQuery.data ?? [];

  // ============ Dimension Options ============

  const dimensionOptions = useMemo<DimensionOption[]>(() => {
    const options: DimensionOption[] = [];

    // Get facet names for similarity checking (lowercase for comparison)
    const facetNames = facets
      .filter((f) => f.type === "CLOSED" || f.type === "OPEN_CODED")
      .map((f) => f.name.toLowerCase());

    // Keywords to check for each built-in dimension
    const builtInKeywords: Record<string, string[]> = {
      "publication-year": ["year", "publication year", "pub year", "date"],
      "venue-type": ["venue", "publication venue", "venue type"],
      "source-category": ["source category", "category", "source type", "literature type"],
    };

    // Add built-in dimensions only if no similar facet exists
    BUILT_IN_DIMENSIONS.forEach((d) => {
      const keywords = builtInKeywords[d.type] || [];
      const hasSimilarFacet = facetNames.some((facetName) =>
        keywords.some((keyword) =>
          facetName.includes(keyword) || keyword.includes(facetName)
        )
      );

      if (!hasSimilarFacet) {
        options.push({
          value: d.type,
          label: d.label,
          dimension: { type: d.type },
          group: "built-in",
        });
      }
    });

    // Add facet dimensions (CLOSED and OPEN_CODED facets only)
    facets
      .filter((f) => f.type === "CLOSED" || f.type === "OPEN_CODED")
      .forEach((f) => {
        options.push({
          value: `facet:${f.id}`,
          label: f.name,
          dimension: { type: "facet", facetId: f.id },
          group: "facet",
        });
      });

    return options;
  }, [facets]);

  // Helper to get dimension value string
  const getDimensionValue = useCallback(
    (dimension: DimensionConfig | null): string => {
      if (!dimension) return "";
      return dimension.type === "facet"
        ? `facet:${dimension.facetId}`
        : dimension.type;
    },
    []
  );

  // Helper to get dimension label
  const getDimensionLabel = useCallback(
    (dimension: DimensionConfig | null): string => {
      if (!dimension) return "";
      const value = getDimensionValue(dimension);
      return dimensionOptions.find((o) => o.value === value)?.label ?? "";
    },
    [dimensionOptions, getDimensionValue]
  );

  // Helper to find dimension from value string
  const findDimension = useCallback(
    (value: string): DimensionConfig | null => {
      const option = dimensionOptions.find((o) => o.value === value);
      return option?.dimension ?? null;
    },
    [dimensionOptions]
  );

  // ============ Frequency Tab State ============

  const [selectedDimension, setSelectedDimension] =
    useState<DimensionConfig | null>(null);
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");

  // Set default dimension when facets load
  useEffect(() => {
    if (!selectedDimension && dimensionOptions.length > 0) {
      setSelectedDimension(dimensionOptions[0].dimension);
    }
  }, [dimensionOptions, selectedDimension]);

  const handleDimensionChange = useCallback(
    (value: string) => {
      const dimension = findDimension(value);
      if (dimension) {
        setSelectedDimension(dimension);
      }
    },
    [findDimension]
  );

  // ============ Systematic Map State ============

  const [rowDimension, setRowDimension] = useState<DimensionConfig | null>(null);
  const [colDimension, setColDimension] = useState<DimensionConfig | null>(null);
  const [mapViewType, setMapViewType] = useState<"bubble" | "heatmap">("bubble");

  const handleRowDimensionChange = useCallback(
    (value: string) => {
      const dimension = findDimension(value);
      setRowDimension(dimension);
    },
    [findDimension]
  );

  const handleColDimensionChange = useCallback(
    (value: string) => {
      const dimension = findDimension(value);
      setColDimension(dimension);
    },
    [findDimension]
  );

  // ============ Gap Analysis State ============

  const [gapThreshold, setGapThreshold] = useState(3);
  const [gapFacetIds, setGapFacetIds] = useState<string[]>([]);

  // ============ Mapping Table State ============

  const [mappingFacetIds, setMappingFacetIds] = useState<string[]>([]);
  const [mappingPage, setMappingPage] = useState(1);
  const [mappingPageSize, setMappingPageSize] = useState(25);

  // ============ Drilldown State ============

  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownData, setDrilldownData] = useState<DrilldownData | null>(null);

  const openDrilldown = useCallback((data: CellClickData) => {
    setDrilldownData({
      title: `${data.rowLabel} × ${data.colLabel}`,
      description: `${data.count} sources in this category combination`,
      sourceIds: data.sourceIds,
    });
    setDrilldownOpen(true);
  }, []);

  const closeDrilldown = useCallback(() => {
    setDrilldownOpen(false);
    setDrilldownData(null);
  }, []);

  // ============ Coding Wizard State ============

  const [codingWizardOpen, setCodingWizardOpen] = useState(false);
  const [codingFacet, setCodingFacet] = useState<Facet | null>(null);

  const openCodingWizard = useCallback((facet: Facet) => {
    setCodingFacet(facet);
    setCodingWizardOpen(true);
  }, []);

  const closeCodingWizard = useCallback(() => {
    setCodingWizardOpen(false);
    setCodingFacet(null);
  }, []);

  // ============ Trends Tab State ============

  const [trendsDimension, setTrendsDimension] = useState<DimensionConfig | null>(null);

  const handleTrendsDimensionChange = useCallback(
    (value: string) => {
      const dimension = findDimension(value);
      setTrendsDimension(dimension);
    },
    [findDimension]
  );

  const clearTrendsDimension = useCallback(() => {
    setTrendsDimension(null);
  }, []);

  // ============ Analysis Queries ============

  const summaryQuery = useSummaryStats(studyId);

  // Determine frequency mode: pie chart with facet dimension uses "combinations" for exclusive slices
  const frequencyMode = useMemo(() => {
    if (chartType === "pie" && selectedDimension?.type === "facet") {
      return "combinations" as const;
    }
    return "coverage" as const;
  }, [chartType, selectedDimension]);

  const frequencyQuery = useFrequencyData(studyId, selectedDimension, undefined, frequencyMode);
  const baseTimeSeriesQuery = useTimeSeriesData(studyId);
  const groupedTimeSeriesQuery = useTimeSeriesData(studyId, trendsDimension ?? undefined);
  const crossTabQuery = useCrossTabData(studyId, rowDimension, colDimension);
  const gapQuery = useGapAnalysis(
    studyId,
    gapThreshold,
    gapFacetIds.length > 0 ? gapFacetIds : undefined
  );
  const mappingTableQuery = useMappingTable(studyId, {
    facetIds: mappingFacetIds.length > 0 ? mappingFacetIds : undefined,
    includeMetadata: ["title", "authors", "year", "venue", "sourceType"],
    page: mappingPage,
    pageSize: mappingPageSize,
  });

  const exportMutation = useExportData(studyId);

  // ============ Actions ============

  const refreshAll = useCallback(() => {
    summaryQuery.refetch();
    frequencyQuery.refetch();
    baseTimeSeriesQuery.refetch();
    if (trendsDimension) {
      groupedTimeSeriesQuery.refetch();
    }
    if (rowDimension && colDimension) {
      crossTabQuery.refetch();
    }
    gapQuery.refetch();
    mappingTableQuery.refetch();
  }, [
    summaryQuery,
    frequencyQuery,
    baseTimeSeriesQuery,
    groupedTimeSeriesQuery,
    crossTabQuery,
    gapQuery,
    mappingTableQuery,
    rowDimension,
    colDimension,
    trendsDimension,
  ]);

  const exportFrequency = useCallback(() => {
    if (selectedDimension) {
      exportMutation.mutate({
        type: "frequency",
        format: "csv",
        config: { dimension: selectedDimension },
      });
    }
  }, [selectedDimension, exportMutation]);

  const exportCrossTab = useCallback(() => {
    if (rowDimension && colDimension) {
      exportMutation.mutate({
        type: "crosstab",
        format: "csv",
        config: { rowDimension, colDimension },
      });
    }
  }, [rowDimension, colDimension, exportMutation]);

  const exportMappingTable = useCallback(() => {
    exportMutation.mutate({
      type: "mapping-table",
      format: "csv",
      config: {
        includedFacets: mappingFacetIds.length > 0 ? mappingFacetIds : undefined,
        includeMetadata: ["title", "authors", "year", "venue", "sourceType"],
      },
    });
  }, [mappingFacetIds, exportMutation]);

  // ============ Return ============

  return {
    // Study & Facets
    study: studyQuery.data,
    studyLoading: studyQuery.isLoading,
    facets,
    facetsLoading: facetsQuery.isLoading,
    refetchFacets: facetsQuery.refetch,

    // Dimension helpers
    dimensionOptions,
    getDimensionValue,
    getDimensionLabel,
    findDimension,

    // Frequency tab
    frequency: {
      selectedDimension,
      chartType,
      setChartType,
      handleDimensionChange,
      data: frequencyQuery.data,
      isLoading: frequencyQuery.isLoading,
      refetch: frequencyQuery.refetch,
      selectedValue: getDimensionValue(selectedDimension),
      selectedLabel: getDimensionLabel(selectedDimension),
    },

    // Trends tab
    trends: {
      baseData: baseTimeSeriesQuery.data,
      baseIsLoading: baseTimeSeriesQuery.isLoading,
      groupedData: groupedTimeSeriesQuery.data,
      groupedIsLoading: groupedTimeSeriesQuery.isLoading,
      selectedDimension: trendsDimension,
      handleDimensionChange: handleTrendsDimensionChange,
      clearDimension: clearTrendsDimension,
      refetch: () => {
        baseTimeSeriesQuery.refetch();
        if (trendsDimension) groupedTimeSeriesQuery.refetch();
      },
    },

    // Systematic map tab
    systematicMap: {
      rowDimension,
      colDimension,
      viewType: mapViewType,
      setViewType: setMapViewType,
      handleRowDimensionChange,
      handleColDimensionChange,
      data: crossTabQuery.data,
      isLoading: crossTabQuery.isLoading,
      refetch: crossTabQuery.refetch,
      rowValue: getDimensionValue(rowDimension),
      colValue: getDimensionValue(colDimension),
      rowLabel: getDimensionLabel(rowDimension),
      colLabel: getDimensionLabel(colDimension),
    },

    // Gap analysis tab
    gaps: {
      threshold: gapThreshold,
      setThreshold: setGapThreshold,
      facetIds: gapFacetIds,
      setFacetIds: setGapFacetIds,
      data: gapQuery.data,
      isLoading: gapQuery.isLoading,
      refetch: gapQuery.refetch,
    },

    // Mapping table tab
    mappingTable: {
      facetIds: mappingFacetIds,
      setFacetIds: setMappingFacetIds,
      page: mappingPage,
      setPage: setMappingPage,
      pageSize: mappingPageSize,
      setPageSize: setMappingPageSize,
      data: mappingTableQuery.data,
      isLoading: mappingTableQuery.isLoading,
      refetch: mappingTableQuery.refetch,
    },

    // Summary stats
    summary: {
      data: summaryQuery.data,
      isLoading: summaryQuery.isLoading,
      refetch: summaryQuery.refetch,
    },

    // Drilldown
    drilldown: {
      isOpen: drilldownOpen,
      data: drilldownData,
      open: openDrilldown,
      close: closeDrilldown,
    },

    // Coding wizard
    codingWizard: {
      isOpen: codingWizardOpen,
      facet: codingFacet,
      open: openCodingWizard,
      close: closeCodingWizard,
    },

    // Export
    export: {
      exportFrequency,
      exportCrossTab,
      exportMappingTable,
      isPending: exportMutation.isPending,
    },

    // Global actions
    refreshAll,
  };
}

export type UseAnalysisPageReturn = ReturnType<typeof useAnalysisPage>;
