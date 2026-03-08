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
import { Label } from "@/components/ui/label";
import { Grid3X3 } from "lucide-react";
import { DimensionSelector } from "../shared/dimension-selector";
import { ExportButton } from "../shared/export-button";
import { BubblePlot, Heatmap } from "../charts";
import { CrossTabTable } from "../tables";
import type { CrossTabResult } from "@/types/analysis";
import type { DimensionOption, CellClickData } from "@/hooks/use-analysis-page";

interface SystematicMapTabProps {
  dimensionOptions: DimensionOption[];
  rowValue: string;
  colValue: string;
  rowLabel: string;
  colLabel: string;
  onRowDimensionChange: (value: string) => void;
  onColDimensionChange: (value: string) => void;
  viewType: "bubble" | "heatmap";
  onViewTypeChange: (type: "bubble" | "heatmap") => void;
  data: CrossTabResult | undefined;
  isLoading: boolean;
  onCellClick: (data: CellClickData) => void;
  onExportCSV: () => void;
  isExporting: boolean;
}

export function SystematicMapTab({
  dimensionOptions,
  rowValue,
  colValue,
  rowLabel,
  colLabel,
  onRowDimensionChange,
  onColDimensionChange,
  viewType,
  onViewTypeChange,
  data,
  isLoading,
  onCellClick,
  onExportCSV,
  isExporting,
}: SystematicMapTabProps) {
  const [chartInstance, setChartInstance] = useState<any>(null);

  const handleChartReady = useCallback((chart: any) => {
    setChartInstance(chart);
  }, []);

  const hasBothDimensions = rowValue && colValue;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create Systematic Map</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Dimension Selectors */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="space-y-2">
            <Label>Row Dimension (Y-axis)</Label>
            <DimensionSelector
              value={rowValue}
              onValueChange={onRowDimensionChange}
              options={dimensionOptions}
              placeholder="Select row dimension"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label>Column Dimension (X-axis)</Label>
            <DimensionSelector
              value={colValue}
              onValueChange={onColDimensionChange}
              options={dimensionOptions}
              placeholder="Select column dimension"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label>Visualization Type</Label>
            <Select
              value={viewType}
              onValueChange={(v) => onViewTypeChange(v as "bubble" | "heatmap")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bubble">Bubble Plot</SelectItem>
                <SelectItem value="heatmap">Heatmap</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Visualization */}
        {hasBothDimensions ? (
          <div className="space-y-6">
            {/* Export button */}
            <div className="flex justify-end">
              <ExportButton
                onExportCSV={onExportCSV}
                isExportingCSV={isExporting}
                chartInstance={chartInstance}
                chartTitle={`${rowLabel}-vs-${colLabel}`}
              />
            </div>

            {/* Chart */}
            {viewType === "bubble" ? (
              <BubblePlot
                title={`${rowLabel} × ${colLabel}`}
                data={data}
                isLoading={isLoading}
                onCellClick={onCellClick}
                height={Math.max(400, (data?.rowLabels.length ?? 5) * 50)}
                onChartReady={handleChartReady}
              />
            ) : (
              <Heatmap
                title={`${rowLabel} × ${colLabel}`}
                data={data}
                isLoading={isLoading}
                onCellClick={onCellClick}
                gapThreshold={1}
                height={Math.max(400, (data?.rowLabels.length ?? 5) * 50)}
                onChartReady={handleChartReady}
              />
            )}

            {/* Table */}
            <CrossTabTable
              title="Cross-Tabulation Details"
              data={data}
              isLoading={isLoading}
              onCellClick={onCellClick}
              gapThreshold={1}
            />
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            <Grid3X3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select both row and column dimensions to generate a systematic map</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
