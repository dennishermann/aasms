import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  SummaryStats,
  FrequencyResult,
  CrossTabResult,
  TimeSeriesResult,
  GapAnalysis,
  MappingTableResult,
  AnalysisConfiguration,
  DimensionConfig,
  Filter,
  ArtifactConfiguration,
} from "@/types/analysis";

// ============ Summary Stats ============

async function fetchSummaryStats(studyId: string): Promise<SummaryStats> {
  const response = await fetch(`/api/studies/${studyId}/analysis/summary`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch summary stats");
  }
  const data = await response.json();
  return data.data;
}

export function useSummaryStats(studyId: string) {
  return useQuery({
    queryKey: ["analysis", "summary", studyId],
    queryFn: () => fetchSummaryStats(studyId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============ Frequency Data ============

type FrequencyMode = "coverage" | "combinations";

async function fetchFrequencyData(
  studyId: string,
  dimension: DimensionConfig,
  filters?: Filter[],
  mode?: FrequencyMode,
): Promise<FrequencyResult> {
  const params = new URLSearchParams();
  params.set("dimension", JSON.stringify(dimension));
  if (filters && filters.length > 0) {
    params.set("filters", JSON.stringify(filters));
  }
  if (mode) {
    params.set("mode", mode);
  }

  const response = await fetch(`/api/studies/${studyId}/analysis/frequency?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch frequency data");
  }
  const data = await response.json();
  return data.data;
}

export function useFrequencyData(
  studyId: string,
  dimension: DimensionConfig | null,
  filters?: Filter[],
  mode?: FrequencyMode,
) {
  return useQuery({
    queryKey: ["analysis", "frequency", studyId, dimension, filters, mode],
    queryFn: () => fetchFrequencyData(studyId, dimension!, filters, mode),
    enabled: !!dimension,
    staleTime: 5 * 60 * 1000,
  });
}

// ============ CrossTab Data ============

async function fetchCrossTabData(
  studyId: string,
  rowDimension: DimensionConfig,
  colDimension: DimensionConfig,
  filters?: Filter[],
): Promise<CrossTabResult> {
  const params = new URLSearchParams();
  params.set("rowDimension", JSON.stringify(rowDimension));
  params.set("colDimension", JSON.stringify(colDimension));
  if (filters && filters.length > 0) {
    params.set("filters", JSON.stringify(filters));
  }

  const response = await fetch(`/api/studies/${studyId}/analysis/crosstab?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch cross-tabulation data");
  }
  const data = await response.json();
  return data.data;
}

export function useCrossTabData(
  studyId: string,
  rowDimension: DimensionConfig | null,
  colDimension: DimensionConfig | null,
  filters?: Filter[],
) {
  return useQuery({
    queryKey: ["analysis", "crosstab", studyId, rowDimension, colDimension, filters],
    queryFn: () => fetchCrossTabData(studyId, rowDimension!, colDimension!, filters),
    enabled: !!rowDimension && !!colDimension,
    staleTime: 5 * 60 * 1000,
  });
}

// ============ Time Series Data ============

async function fetchTimeSeriesData(
  studyId: string,
  groupBy?: DimensionConfig,
  filters?: Filter[],
): Promise<TimeSeriesResult> {
  const params = new URLSearchParams();
  if (groupBy) {
    params.set("groupBy", JSON.stringify(groupBy));
  }
  if (filters && filters.length > 0) {
    params.set("filters", JSON.stringify(filters));
  }

  const response = await fetch(`/api/studies/${studyId}/analysis/timeseries?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch time series data");
  }
  const data = await response.json();
  return data.data;
}

export function useTimeSeriesData(studyId: string, groupBy?: DimensionConfig, filters?: Filter[]) {
  return useQuery({
    queryKey: ["analysis", "timeseries", studyId, groupBy, filters],
    queryFn: () => fetchTimeSeriesData(studyId, groupBy, filters),
    staleTime: 5 * 60 * 1000,
  });
}

// ============ Gap Analysis ============

async function fetchGapAnalysis(
  studyId: string,
  threshold?: number,
  facetIds?: string[],
): Promise<GapAnalysis> {
  const params = new URLSearchParams();
  if (threshold !== undefined) {
    params.set("threshold", threshold.toString());
  }
  if (facetIds && facetIds.length > 0) {
    params.set("facetIds", facetIds.join(","));
  }

  const response = await fetch(`/api/studies/${studyId}/analysis/gaps?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch gap analysis");
  }
  const data = await response.json();
  return data.data;
}

export function useGapAnalysis(studyId: string, threshold?: number, facetIds?: string[]) {
  return useQuery({
    queryKey: ["analysis", "gaps", studyId, threshold, facetIds],
    queryFn: () => fetchGapAnalysis(studyId, threshold, facetIds),
    staleTime: 5 * 60 * 1000,
  });
}

// ============ Mapping Table ============

interface MappingTableOptions {
  facetIds?: string[];
  includeMetadata?: ("title" | "authors" | "year" | "venue" | "sourceType")[];
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

async function fetchMappingTable(
  studyId: string,
  options: MappingTableOptions = {},
): Promise<MappingTableResult> {
  const params = new URLSearchParams();

  if (options.facetIds && options.facetIds.length > 0) {
    params.set("facetIds", options.facetIds.join(","));
  }
  if (options.includeMetadata && options.includeMetadata.length > 0) {
    params.set("includeMetadata", options.includeMetadata.join(","));
  }
  if (options.page) {
    params.set("page", options.page.toString());
  }
  if (options.pageSize) {
    params.set("pageSize", options.pageSize.toString());
  }
  if (options.sortBy) {
    params.set("sortBy", options.sortBy);
  }
  if (options.sortOrder) {
    params.set("sortOrder", options.sortOrder);
  }

  const response = await fetch(
    `/api/studies/${studyId}/analysis/mapping-table?${params.toString()}`,
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch mapping table");
  }
  const data = await response.json();
  return data.data;
}

export function useMappingTable(studyId: string, options: MappingTableOptions = {}) {
  return useQuery({
    queryKey: ["analysis", "mapping-table", studyId, options],
    queryFn: () => fetchMappingTable(studyId, options),
    staleTime: 5 * 60 * 1000,
  });
}

// ============ Configurations ============

async function fetchConfigurations(studyId: string): Promise<AnalysisConfiguration[]> {
  const response = await fetch(`/api/studies/${studyId}/analysis/configurations`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch configurations");
  }
  const data = await response.json();
  return data.data;
}

export function useAnalysisConfigurations(studyId: string) {
  return useQuery({
    queryKey: ["analysis", "configurations", studyId],
    queryFn: () => fetchConfigurations(studyId),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

async function fetchConfiguration(
  studyId: string,
  configId: string,
): Promise<AnalysisConfiguration> {
  const response = await fetch(`/api/studies/${studyId}/analysis/configurations/${configId}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch configuration");
  }
  const data = await response.json();
  return data.data;
}

export function useAnalysisConfiguration(studyId: string, configId: string | null) {
  return useQuery({
    queryKey: ["analysis", "configuration", studyId, configId],
    queryFn: () => fetchConfiguration(studyId, configId!),
    enabled: !!configId,
  });
}

// ============ Mutations ============

interface CreateConfigurationInput {
  name: string;
  description?: string;
  artifacts: ArtifactConfiguration[];
}

export function useCreateConfiguration(studyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateConfigurationInput) => {
      const response = await fetch(`/api/studies/${studyId}/analysis/configurations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to create configuration");
      }
      const data = await response.json();
      return data.data as AnalysisConfiguration;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["analysis", "configurations", studyId],
      });
    },
  });
}

interface UpdateConfigurationInput {
  name?: string;
  description?: string;
  artifacts?: ArtifactConfiguration[];
}

export function useUpdateConfiguration(studyId: string, configId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateConfigurationInput) => {
      const response = await fetch(`/api/studies/${studyId}/analysis/configurations/${configId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to update configuration");
      }
      const data = await response.json();
      return data.data as AnalysisConfiguration;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["analysis", "configurations", studyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["analysis", "configuration", studyId, configId],
      });
    },
  });
}

export function useDeleteConfiguration(studyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (configId: string) => {
      const response = await fetch(`/api/studies/${studyId}/analysis/configurations/${configId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to delete configuration");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["analysis", "configurations", studyId],
      });
    },
  });
}

// ============ Export ============

interface ExportOptions {
  type: "frequency" | "crosstab" | "mapping-table";
  format: "csv";
  config?: any;
  filters?: Filter[];
}

export function useExportData(studyId: string) {
  return useMutation({
    mutationFn: async (options: ExportOptions) => {
      const response = await fetch(`/api/studies/${studyId}/analysis/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to export data");
      }

      // Get blob and trigger download
      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `export-${Date.now()}.csv`;

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
  });
}
