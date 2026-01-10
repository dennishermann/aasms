"use client";

import { useMemo } from "react";
import { EChartsWrapper, echarts } from "./echarts-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TimeSeriesResult } from "@/types/analysis";
import type { EChartsOption } from "echarts";

interface LineChartProps {
  title?: string;
  data: TimeSeriesResult | undefined;
  isLoading?: boolean;
  height?: number;
  showArea?: boolean;
  smooth?: boolean;
  colorScheme?: string[];
  onChartReady?: (chart: echarts.ECharts) => void;
}

const DEFAULT_COLORS = [
  "#5470c6",
  "#91cc75",
  "#fac858",
  "#ee6666",
  "#73c0de",
  "#3ba272",
  "#fc8452",
  "#9a60b4",
  "#ea7ccc",
];

export function AnalysisLineChart({
  title,
  data,
  isLoading = false,
  height = 400,
  showArea = false,
  smooth = true,
  colorScheme = DEFAULT_COLORS,
  onChartReady,
}: LineChartProps) {
  const option: EChartsOption = useMemo(() => {
    if (!data || data.years.length === 0) {
      return {};
    }

    const series = data.series.map((s, index) => ({
      name: s.label,
      type: "line" as const,
      data: s.data,
      smooth,
      areaStyle: showArea ? { opacity: 0.3 } : undefined,
      itemStyle: {
        color: colorScheme[index % colorScheme.length],
      },
      emphasis: {
        focus: "series" as const,
      },
    }));

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
        },
      },
      legend: {
        data: data.series.map((s) => s.label),
        bottom: 0,
        type: "scroll",
      },
      grid: {
        left: "10%",
        right: "10%",
        bottom: data.series.length > 1 ? "15%" : "10%",
        top: "10%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: data.years.map(String),
        boundaryGap: false,
        name: "Year",
        nameLocation: "middle",
        nameGap: 30,
      },
      yAxis: {
        type: "value",
        name: "Publications",
        nameLocation: "middle",
        nameGap: 40,
        minInterval: 1,
      },
      series,
    };
  }, [data, showArea, smooth, colorScheme]);

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

  if (!data || data.years.length === 0) {
    return (
      <Card>
        {title && (
          <CardHeader>
            <CardTitle className="text-base">{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent className="py-8 text-center text-muted-foreground">
          No time series data available
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
        <EChartsWrapper option={option} height={height} onChartReady={onChartReady} />
      </CardContent>
    </Card>
  );
}
