"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Distribution Analysis</CardTitle>
          <div className="flex items-center gap-2">
            <DimensionSelector
              value={selectedValue}
              onValueChange={onDimensionChange}
              options={dimensionOptions}
              placeholder="Select dimension"
            />

            <Select
              value={chartType}
              onValueChange={(v) => onChartTypeChange(v as "bar" | "pie")}
            >
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
              chartTitle={`${selectedLabel}-distribution`}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {selectedValue && (
          <div className="grid md:grid-cols-2 gap-6">
            {chartType === "bar" ? (
              <AnalysisBarChart
                title={`${selectedLabel} Distribution`}
                data={data}
                isLoading={isLoading}
                orientation="horizontal"
                height={Math.max(300, (data?.items.length ?? 5) * 40)}
                onChartReady={handleChartReady}
              />
            ) : (
              <AnalysisPieChart
                title={`${selectedLabel} Distribution`}
                data={data}
                isLoading={isLoading}
                donut
                onChartReady={handleChartReady}
              />
            )}
            <FrequencyTable
              title={`${selectedLabel} Breakdown`}
              data={data}
              isLoading={isLoading}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
