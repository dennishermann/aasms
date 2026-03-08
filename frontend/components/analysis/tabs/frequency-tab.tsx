"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DimensionSelector } from "../shared/dimension-selector";
import { ExportButton } from "../shared/export-button";
import { AnalysisBarChart, AnalysisPieChart } from "../charts";
import { FrequencyTable } from "../frequency-table";
import type { FrequencyResult } from "@/types/analysis";
import type { DimensionOption } from "@/hooks/use-analysis-page";

interface FrequencyTabProps {
  dimensionOptions: DimensionOption[];
  selectedValue: string;
  selectedLabel: string;
  onDimensionChange: (value: string) => void;
  chartType: "bar" | "pie";
  onChartTypeChange: (type: "bar" | "pie") => void;
  data: FrequencyResult | undefined;
  isLoading: boolean;
  onExportCSV: () => void;
  isExporting: boolean;
}

export function FrequencyTab({
  dimensionOptions,
  selectedValue,
  selectedLabel,
  onDimensionChange,
  chartType,
  onChartTypeChange,
  data,
  isLoading,
  onExportCSV,
  isExporting,
}: FrequencyTabProps) {
  const [chartInstance, setChartInstance] = useState<any>(null);

  const handleChartReady = useCallback((chart: any) => {
    setChartInstance(chart);
  }, []);

  // Determine if this is a multi-classification facet (only available in coverage mode)
  const isMultiClass = data?.multiClassification?.isMultiClass ?? false;
  const avgCategories = data?.multiClassification?.avgCategoriesPerSource ?? 0;

  // Check if we're showing combinations (pie chart mode shows exclusive combinations)
  const isCombinationsMode = chartType === "pie" && selectedValue.startsWith("facet:");

  // Dynamic chart title based on mode
  const chartTitle = useMemo(() => {
    if (isCombinationsMode) {
      return `${selectedLabel} Combinations`;
    }
    if (isMultiClass) {
      return `${selectedLabel} Coverage`;
    }
    return `${selectedLabel} Distribution`;
  }, [selectedLabel, isCombinationsMode, isMultiClass]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Category Frequency</CardTitle>
            {isMultiClass && !isCombinationsMode && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      Sources may belong to multiple categories. Average: {avgCategories} categories
                      per source. Percentages show coverage, not distribution.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DimensionSelector
              value={selectedValue}
              onValueChange={onDimensionChange}
              options={dimensionOptions}
              placeholder="Select dimension"
            />

            <Select value={chartType} onValueChange={(v) => onChartTypeChange(v as "bar" | "pie")}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Bar Chart</SelectItem>
                <SelectItem value="pie">Pie Chart</SelectItem>
              </SelectContent>
            </Select>

            <ExportButton
              onExportCSV={onExportCSV}
              isExportingCSV={isExporting}
              chartInstance={chartInstance}
              chartTitle={`${selectedLabel}-frequency`}
            />
          </div>
        </div>
        {(isMultiClass || isCombinationsMode) && (
          <CardDescription className="text-xs text-muted-foreground mt-1">
            {isCombinationsMode
              ? "Showing unique category combinations (each source appears in exactly one slice)"
              : "Multi-classification: sources may appear in multiple categories"}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {selectedValue && (
          <div className="grid md:grid-cols-2 gap-6">
            {chartType === "bar" ? (
              <AnalysisBarChart
                title={chartTitle}
                data={data}
                isLoading={isLoading}
                orientation="horizontal"
                height={Math.max(300, (data?.items.length ?? 5) * 40)}
                onChartReady={handleChartReady}
              />
            ) : (
              <AnalysisPieChart
                title={chartTitle}
                data={data}
                isLoading={isLoading}
                donut
                onChartReady={handleChartReady}
              />
            )}
            <FrequencyTable
              title={
                isCombinationsMode ? `${selectedLabel} Combinations` : `${selectedLabel} Breakdown`
              }
              data={data}
              isLoading={isLoading}
              showMultiClassInfo={isMultiClass && !isCombinationsMode}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
