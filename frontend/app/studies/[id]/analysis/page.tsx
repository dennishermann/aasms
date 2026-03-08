"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { StudyLayout } from "@/components/layout/study-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  Grid3X3,
  AlertTriangle,
  Table2,
  FlaskConical,
  Download,
} from "lucide-react";
import {
  OverviewTab,
  FrequencyTab,
  TrendsTab,
  SystematicMapTab,
  GapAnalysisTab,
  MappingTableTab,
} from "@/components/analysis/tabs";
import { SourceDrilldown } from "@/components/analysis";
import { RqAnswersTab } from "@/components/analysis/rq-answers";
import { CodingWizard } from "@/components/facets";
import { useAnalysisPage, type Facet } from "@/hooks/use-analysis-page";
import { useExport } from "@/hooks/use-export";

// Tab configuration following parameters page pattern
const TAB_CONFIG = {
  overview: {
    icon: LayoutDashboard,
    label: "Overview",
    color: "bg-blue-500",
    lightColor: "bg-blue-100 text-blue-700",
  },
  frequency: {
    icon: BarChart3,
    label: "Distributions",
    color: "bg-purple-500",
    lightColor: "bg-purple-100 text-purple-700",
  },
  trends: {
    icon: TrendingUp,
    label: "Trends",
    color: "bg-amber-500",
    lightColor: "bg-amber-100 text-amber-700",
  },
  "systematic-map": {
    icon: Grid3X3,
    label: "Systematic Maps",
    color: "bg-emerald-500",
    lightColor: "bg-emerald-100 text-emerald-700",
  },
  gaps: {
    icon: AlertTriangle,
    label: "Research Gaps",
    color: "bg-rose-500",
    lightColor: "bg-rose-100 text-rose-700",
  },
  "mapping-table": {
    icon: Table2,
    label: "Data Table",
    color: "bg-cyan-500",
    lightColor: "bg-cyan-100 text-cyan-700",
  },
  "rq-answers": {
    icon: FlaskConical,
    label: "RQ Answers",
    color: "bg-indigo-500",
    lightColor: "bg-indigo-100 text-indigo-700",
  },
} as const;

type TabKey = keyof typeof TAB_CONFIG;

export default function AnalysisPage() {
  const params = useParams();
  const studyId = params.id as string;
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const analysis = useAnalysisPage({ studyId });
  const { exportFullDataset, isLoading: isExporting, error: exportError } = useExport();

  const handleExportDataset = async () => {
    try {
      await exportFullDataset(studyId, analysis.study?.title);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const handleFacetClick = (facet: Facet) => {
    if (facet.type === "CLOSED" || facet.type === "OPEN_CODED") {
      // Switch to frequency tab and select this facet
      analysis.frequency.handleDimensionChange(`facet:${facet.id}`);
      setActiveTab("frequency");
    } else if (facet.type === "OPEN") {
      // Open coding wizard
      analysis.codingWizard.open(facet);
    }
  };

  return (
    <StudyLayout
      studyId={studyId}
      studyTitle={analysis.study?.title ?? "Analysis"}
      studyStatus={analysis.study?.status}
    >
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Analysis Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Explore and visualize your systematic mapping study data
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleExportDataset}
              disabled={isExporting}
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "Exporting..." : "Export Full Dataset"}
            </Button>
            <Button variant="outline" size="sm" onClick={analysis.refreshAll}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
        {exportError && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-6 text-sm">
            Export error: {exportError}
          </div>
        )}

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="w-full">
          <TabsList className="mb-6 h-11 flex-wrap">
            {(Object.entries(TAB_CONFIG) as [TabKey, (typeof TAB_CONFIG)[TabKey]][]).map(
              ([key, config]) => {
                const Icon = config.icon;
                return (
                  <TabsTrigger key={key} value={key} className="gap-2 px-4 relative">
                    <span
                      className={`absolute left-1 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full ${config.color} opacity-50`}
                    />
                    <Icon className="h-4 w-4 ml-1" />
                    {config.label}
                  </TabsTrigger>
                );
              },
            )}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-0">
            <OverviewTab
              stats={analysis.summary.data}
              isLoading={analysis.summary.isLoading}
              facets={analysis.facets}
              onFacetClick={handleFacetClick}
            />
          </TabsContent>

          {/* Frequency/Distributions Tab */}
          <TabsContent value="frequency" className="mt-0">
            <FrequencyTab
              dimensionOptions={analysis.dimensionOptions}
              selectedValue={analysis.frequency.selectedValue}
              selectedLabel={analysis.frequency.selectedLabel}
              onDimensionChange={analysis.frequency.handleDimensionChange}
              chartType={analysis.frequency.chartType}
              onChartTypeChange={analysis.frequency.setChartType}
              data={analysis.frequency.data}
              isLoading={analysis.frequency.isLoading}
              onExportCSV={analysis.export.exportFrequency}
              isExporting={analysis.export.isPending}
            />
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="mt-0">
            <TrendsTab
              baseData={analysis.trends.baseData}
              baseIsLoading={analysis.trends.baseIsLoading}
              groupedData={analysis.trends.groupedData}
              groupedIsLoading={analysis.trends.groupedIsLoading}
              dimensionOptions={analysis.dimensionOptions}
              selectedDimension={analysis.trends.selectedDimension}
              onDimensionChange={analysis.trends.handleDimensionChange}
              onClearDimension={analysis.trends.clearDimension}
            />
          </TabsContent>

          {/* Systematic Maps Tab */}
          <TabsContent value="systematic-map" className="mt-0">
            <SystematicMapTab
              dimensionOptions={analysis.dimensionOptions}
              rowValue={analysis.systematicMap.rowValue}
              colValue={analysis.systematicMap.colValue}
              rowLabel={analysis.systematicMap.rowLabel}
              colLabel={analysis.systematicMap.colLabel}
              onRowDimensionChange={analysis.systematicMap.handleRowDimensionChange}
              onColDimensionChange={analysis.systematicMap.handleColDimensionChange}
              viewType={analysis.systematicMap.viewType}
              onViewTypeChange={analysis.systematicMap.setViewType}
              data={analysis.systematicMap.data}
              isLoading={analysis.systematicMap.isLoading}
              onCellClick={analysis.drilldown.open}
              onExportCSV={analysis.export.exportCrossTab}
              isExporting={analysis.export.isPending}
            />
          </TabsContent>

          {/* Gap Analysis Tab */}
          <TabsContent value="gaps" className="mt-0">
            <GapAnalysisTab
              facets={analysis.facets}
              threshold={analysis.gaps.threshold}
              onThresholdChange={analysis.gaps.setThreshold}
              selectedFacetIds={analysis.gaps.facetIds}
              onFacetIdsChange={analysis.gaps.setFacetIds}
              data={analysis.gaps.data}
              isLoading={analysis.gaps.isLoading}
            />
          </TabsContent>

          {/* Mapping Table Tab */}
          <TabsContent value="mapping-table" className="mt-0">
            <MappingTableTab
              studyId={studyId}
              facets={analysis.facets}
              selectedFacetIds={analysis.mappingTable.facetIds}
              onFacetsChange={analysis.mappingTable.setFacetIds}
              page={analysis.mappingTable.page}
              pageSize={analysis.mappingTable.pageSize}
              onPageChange={analysis.mappingTable.setPage}
              onPageSizeChange={analysis.mappingTable.setPageSize}
              data={analysis.mappingTable.data}
              isLoading={analysis.mappingTable.isLoading}
              onExportCSV={analysis.export.exportMappingTable}
              isExporting={analysis.export.isPending}
            />
          </TabsContent>

          {/* RQ Answers Tab */}
          <TabsContent value="rq-answers" className="mt-0">
            <RqAnswersTab studyId={studyId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Source Drilldown Modal */}
      {analysis.drilldown.data && (
        <SourceDrilldown
          isOpen={analysis.drilldown.isOpen}
          onClose={analysis.drilldown.close}
          studyId={studyId}
          title={analysis.drilldown.data.title}
          description={analysis.drilldown.data.description}
          sourceIds={analysis.drilldown.data.sourceIds}
        />
      )}

      {/* Coding Wizard Modal */}
      {analysis.codingWizard.facet && (
        <CodingWizard
          open={analysis.codingWizard.isOpen}
          onOpenChange={(open) => {
            if (!open) analysis.codingWizard.close();
          }}
          studyId={studyId}
          facetId={analysis.codingWizard.facet.id}
          facetName={analysis.codingWizard.facet.name}
          onSuccess={() => {
            analysis.refetchFacets();
            analysis.codingWizard.close();
          }}
        />
      )}
    </StudyLayout>
  );
}
