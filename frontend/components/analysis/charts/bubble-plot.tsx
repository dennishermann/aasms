"use client";

import { useMemo, useCallback } from "react";
import { EChartsWrapper, echarts } from "./echarts-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CrossTabResult } from "@/types/analysis";
import type { EChartsOption } from "echarts";

interface CellClickData {
  rowId: string;
  colId: string;
  rowLabel: string;
  colLabel: string;
  count: number;
  sourceIds: string[];
}

interface BubblePlotProps {
  title?: string;
  data: CrossTabResult | undefined;
  isLoading?: boolean;
  height?: number;
  showLabels?: boolean;
  colorScheme?: string[];
  onCellClick?: (data: CellClickData) => void;
  onChartReady?: (chart: echarts.ECharts) => void;
}

const DEFAULT_COLORS = ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de"];

export function BubblePlot({
  title,
  data,
  isLoading = false,
  height = 500,
  showLabels = true,
  colorScheme = DEFAULT_COLORS,
  onCellClick,
  onChartReady: onChartReadyProp,
}: BubblePlotProps) {
  const option: EChartsOption = useMemo(() => {
    if (!data || data.cells.length === 0) {
      return {};
    }

    // Map row/col indices
    const rowIndexMap = new Map(data.rowLabels.map((r, i) => [r.id, i]));
    const colIndexMap = new Map(data.colLabels.map((c, i) => [c.id, i]));

    // Find max count for bubble sizing
    const maxCount = Math.max(...data.cells.map((c) => c.count), 1);

    // Transform cells to scatter data [x, y, value, rowLabel, colLabel, rowId, colId, sourceIds]
    const scatterData = data.cells
      .filter((cell) => cell.count > 0)
      .map((cell) => {
        const x = colIndexMap.get(cell.colId) ?? 0;
        const y = rowIndexMap.get(cell.rowId) ?? 0;
        const rowLabel = data.rowLabels.find((r) => r.id === cell.rowId)?.label ?? "";
        const colLabel = data.colLabels.find((c) => c.id === cell.colId)?.label ?? "";
        return {
          value: [x, y, cell.count],
          rowLabel,
          colLabel,
          rowId: cell.rowId,
          colId: cell.colId,
          sourceIds: cell.sourceIds,
        };
      });

    return {
      tooltip: {
        formatter: (params: any) => {
          const { rowLabel, colLabel, value } = params.data;
          const count = value[2];
          return `${rowLabel} × ${colLabel}<br/>Count: ${count}<br/><span style="color:#888;">Click to view sources</span>`;
        },
      },
      grid: {
        left: "15%",
        right: "10%",
        bottom: "20%",
        top: "10%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: data.colLabels.map((c) => c.label),
        axisLabel: {
          rotate: 45,
          interval: 0,
          overflow: "truncate",
          width: 80,
        },
        splitLine: {
          show: true,
          lineStyle: {
            type: "dashed",
            opacity: 0.3,
          },
        },
      },
      yAxis: {
        type: "category",
        data: data.rowLabels.map((r) => r.label),
        axisLabel: {
          overflow: "truncate",
          width: 100,
        },
        splitLine: {
          show: true,
          lineStyle: {
            type: "dashed",
            opacity: 0.3,
          },
        },
      },
      series: [
        {
          type: "scatter",
          data: scatterData,
          symbolSize: (value: any) => {
            // ECharts passes the value array [x, y, count] directly to symbolSize
            const count = Array.isArray(value) ? value[2] : (value?.value?.[2] ?? 0);
            // Scale bubble size between 10 and 50 based on count
            const minSize = 10;
            const maxSize = 50;
            return minSize + (count / maxCount) * (maxSize - minSize);
          },
          cursor: onCellClick ? "pointer" : "default",
          itemStyle: {
            color: colorScheme[0],
            opacity: 0.7,
          },
          emphasis: {
            itemStyle: {
              opacity: 1,
              shadowBlur: 10,
              shadowColor: "rgba(0, 0, 0, 0.3)",
            },
          },
          label: {
            show: showLabels,
            formatter: (params: any) => params.data.value[2],
            position: "inside",
            color: "#fff",
            fontSize: 10,
          },
        },
      ],
    };
  }, [data, showLabels, colorScheme, onCellClick]);

  // Handle chart click events for drill-down
  const handleChartReady = useCallback(
    (chart: echarts.ECharts) => {
      // Pass chart instance to parent for export
      onChartReadyProp?.(chart);

      if (!onCellClick || !data) return;

      chart.on("click", "series.scatter", (params: any) => {
        const { rowId, colId, rowLabel, colLabel, sourceIds, value } = params.data;
        const count = value[2];
        onCellClick({
          rowId,
          colId,
          rowLabel,
          colLabel,
          count,
          sourceIds,
        });
      });
    },
    [onCellClick, data, onChartReadyProp],
  );

  if (isLoading) {
    return (
      <Card>
        {title && (
          <CardHeader>
            <CardTitle className="text-base">{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <Skeleton className="w-full" style={{ height }} />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.cells.length === 0) {
    return (
      <Card>
        {title && (
          <CardHeader>
            <CardTitle className="text-base">{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent className="py-8 text-center text-muted-foreground">
          No cross-tabulation data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <EChartsWrapper option={option} height={height} onChartReady={handleChartReady} />
      </CardContent>
    </Card>
  );
}
