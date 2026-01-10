"use client";

import { MappingTable } from "../tables/mapping-table";
import type { MappingTableResult } from "@/types/analysis";
import type { Facet } from "@/hooks/use-analysis-page";

interface MappingTableTabProps {
  studyId: string;
  facets: Facet[];
  selectedFacetIds: string[];
  onFacetsChange: (facetIds: string[]) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  data: MappingTableResult | undefined;
  isLoading: boolean;
  onExportCSV: () => void;
  isExporting: boolean;
}

export function MappingTableTab({
  studyId,
  facets,
  selectedFacetIds,
  onFacetsChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  data,
  isLoading,
  onExportCSV,
  isExporting,
}: MappingTableTabProps) {
  // Filter to only CLOSED and OPEN_CODED facets
  const analyzableFacets = facets
    .filter((f) => f.type === "CLOSED" || f.type === "OPEN_CODED")
    .map((f) => ({ id: f.id, name: f.name }));

  return (
    <MappingTable
      title="Source-Level Classification Mapping"
      data={data}
      isLoading={isLoading}
      studyId={studyId}
      facets={analyzableFacets}
      selectedFacetIds={selectedFacetIds}
      onFacetsChange={onFacetsChange}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      onExport={onExportCSV}
      isExporting={isExporting}
    />
  );
}
