"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AnalysisLineChart } from "../charts";
import { DimensionSelector } from "../shared/dimension-selector";
import { ExportButton } from "../shared/export-button";
import type { TimeSeriesResult, DimensionConfig } from "@/types/analysis";
import type { DimensionOption } from "@/hooks/use-analysis-page";

interface TrendsTabProps {
  // Base trends data (all publications)
  baseData: TimeSeriesResult | undefined;
  baseIsLoading: boolean;
  // Grouped trends data (when dimension selected)
  groupedData: TimeSeriesResult | undefined;
  groupedIsLoading: boolean;
  // Dimension selection
  dimensionOptions: DimensionOption[];
  selectedDimension: DimensionConfig | null;
  onDimensionChange: (value: string) => void;
  onClearDimension: () => void;
}

export function TrendsTab({
  baseData,
  baseIsLoading,
  groupedData,
  groupedIsLoading,
  dimensionOptions,
  selectedDimension,
  onDimensionChange,
  onClearDimension,
}: TrendsTabProps) {
  const [chartInstance, setChartInstance] = useState<any>(null);
  const [selectedSeriesIds, setSelectedSeriesIds] = useState<Set<string>>(new Set());
  const [showAllSeries, setShowAllSeries] = useState(true);

  const handleChartReady = useCallback((chart: any) => {
    setChartInstance(chart);
  }, []);

  // Determine which data to show
  const displayData = selectedDimension ? groupedData : baseData;
  const isLoading = selectedDimension ? groupedIsLoading : baseIsLoading;

  // Get available series for category selection
  const availableSeries = useMemo(() => {
    if (!groupedData?.series) return [];
    return groupedData.series.map((s) => ({
      id: s.id,
      label: s.label,
      total: s.data.reduce((a, b) => a + b, 0),
    })).sort((a, b) => b.total - a.total);
  }, [groupedData]);

  // Filter data based on selected series
  const filteredData = useMemo((): TimeSeriesResult | undefined => {
    if (!displayData) return undefined;

    if (!selectedDimension || showAllSeries || selectedSeriesIds.size === 0) {
      return displayData;
    }

    return {
      ...displayData,
      series: displayData.series.filter((s) => selectedSeriesIds.has(s.id)),
    };
  }, [displayData, selectedDimension, showAllSeries, selectedSeriesIds]);

  const toggleSeries = (seriesId: string) => {
    const newSelected = new Set(selectedSeriesIds);
    if (newSelected.has(seriesId)) {
      newSelected.delete(seriesId);
    } else {
      newSelected.add(seriesId);
    }
    setSelectedSeriesIds(newSelected);
    if (newSelected.size > 0) {
      setShowAllSeries(false);
    }
  };

  const selectTopN = (n: number) => {
    const topN = availableSeries.slice(0, n).map((s) => s.id);
    setSelectedSeriesIds(new Set(topN));
    setShowAllSeries(false);
  };

  // Calculate statistics from base data
  const stats =
    baseData && baseData.years.length > 0 && baseData.series[0]
      ? {
        yearRange: `${baseData.years[0]} - ${baseData.years[baseData.years.length - 1]}`,
        totalYears: baseData.years.length,
        peakYear:
          baseData.years[
          baseData.series[0].data.indexOf(Math.max(...baseData.series[0].data))
          ],
        average: (
          baseData.series[0].data.reduce((a, b) => a + b, 0) / baseData.years.length
        ).toFixed(1),
      }
      : null;

  return (
    <div className="space-y-4">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trend Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <Label>Group by Dimension</Label>
              <p className="text-xs text-muted-foreground">
                Compare trends across categories
              </p>
            </div>
            <DimensionSelector
              value={selectedDimension ?
                (selectedDimension.type === "facet" ? `facet:${selectedDimension.facetId}` : selectedDimension.type)
                : ""
              }
              onValueChange={onDimensionChange}
              options={dimensionOptions}
              placeholder="None (total only)"
              className="w-[220px]"
            />
            {selectedDimension && (
              <button
                onClick={onClearDimension}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Selection */}
          {selectedDimension && availableSeries.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label>Categories to Compare</Label>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => { setShowAllSeries(true); setSelectedSeriesIds(new Set()); }}
                    className={`hover:underline ${showAllSeries ? "font-semibold" : "text-muted-foreground"}`}
                  >
                    All
                  </button>
                  <span className="text-muted-foreground">|</span>
                  <button
                    onClick={() => selectTopN(3)}
                    className="text-muted-foreground hover:underline"
                  >
                    Top 3
                  </button>
                  <button
                    onClick={() => selectTopN(5)}
                    className="text-muted-foreground hover:underline"
                  >
                    Top 5
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {availableSeries.map((series) => (
                  <Badge
                    key={series.id}
                    variant={
                      showAllSeries || selectedSeriesIds.has(series.id)
                        ? "default"
                        : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() => toggleSeries(series.id)}
                  >
                    {series.label}
                    <span className="ml-1 text-xs opacity-70">({series.total})</span>
                  </Badge>
                ))}
              </div>
              {!showAllSeries && selectedSeriesIds.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  Showing {selectedSeriesIds.size} of {availableSeries.length} categories
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {selectedDimension ? "Publication Trends by Category" : "Publications Over Time"}
            </CardTitle>
            <ExportButton
              chartInstance={chartInstance}
              chartTitle="publication-trends"
            />
          </div>
        </CardHeader>
        <CardContent>
          <AnalysisLineChart
            data={filteredData}
            isLoading={isLoading}
            showArea={!selectedDimension}
            height={400}
            onChartReady={handleChartReady}
          />
        </CardContent>
      </Card>

      {/* Statistics */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Publication Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Year Range</p>
                <p className="text-lg font-semibold">{stats.yearRange}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Years</p>
                <p className="text-lg font-semibold">{stats.totalYears}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Peak Year</p>
                <p className="text-lg font-semibold">{stats.peakYear}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average per Year</p>
                <p className="text-lg font-semibold">{stats.average}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
