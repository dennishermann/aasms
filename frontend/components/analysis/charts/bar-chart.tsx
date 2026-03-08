"use client";

import { useMemo, useState, useCallback } from "react";
import { EChartsWrapper, echarts } from "./echarts-wrapper";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportChartAsPNG } from "./chart-export";
import type { FrequencyResult } from "@/types/analysis";
import type { EChartsOption } from "echarts";

interface BarChartProps {
  title?: string;
  data: FrequencyResult | undefined;
  isLoading?: boolean;
  height?: number;
  orientation?: "horizontal" | "vertical";
  showPercentages?: boolean;
  colorScheme?: string[];
  showExport?: boolean;
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

export function AnalysisBarChart({
  title,
  data,
  isLoading = false,
  height = 400,
  orientation = "vertical",
  showPercentages = true,
  colorScheme = DEFAULT_COLORS,
  showExport = false,
  onChartReady,
}: BarChartProps) {
  const [chartInstance, setChartInstance] = useState<echarts.ECharts | null>(null);

  const handleChartReady = useCallback(
    (chart: echarts.ECharts) => {
      setChartInstance(chart);
      onChartReady?.(chart);
    },
    [onChartReady],
  );

  const handleExport = () => {
    exportChartAsPNG(chartInstance, title || "bar-chart");
  };
  const option: EChartsOption = useMemo(() => {
    if (!data || data.items.length === 0) {
      return {};
    }

    const categories = data.items.map((item) => item.label);
    const values = data.items.map((item) => (showPercentages ? item.percentage : item.count));

    const isHorizontal = orientation === "horizontal";

    // Calculate dynamic label width based on longest label
    const maxLabelLength = Math.max(...categories.map((c) => c.length));
    // Estimate ~7px per character, with min 80 and max 200
    const dynamicLabelWidth = Math.min(200, Math.max(80, maxLabelLength * 7));

    // Adjust left margin for horizontal charts based on label length
    const leftMargin = isHorizontal
      ? `${Math.min(35, Math.max(15, maxLabelLength * 0.8))}%`
      : "10%";

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
        formatter: (params: any) => {
          const param = Array.isArray(params) ? params[0] : params;
          const item = data.items[param.dataIndex];
          // Show full label in tooltip - important for truncated labels
          return `<strong>${item.label}</strong><br/>Count: ${item.count}<br/>Percentage: ${item.percentage.toFixed(1)}%`;
        },
      },
      grid: {
        left: leftMargin,
        right: "10%",
        bottom: isHorizontal ? "10%" : "20%",
        top: "10%",
        containLabel: true,
      },
      xAxis: {
        type: isHorizontal ? "value" : "category",
        data: isHorizontal ? undefined : categories,
        axisLabel: {
          rotate: isHorizontal ? 0 : 45,
          interval: 0,
          overflow: "truncate",
          width: isHorizontal ? undefined : dynamicLabelWidth,
        },
        name: showPercentages ? "%" : "Count",
        nameLocation: "middle",
        nameGap: isHorizontal ? 30 : 50,
      },
      yAxis: {
        type: isHorizontal ? "category" : "value",
        data: isHorizontal ? categories : undefined,
        axisLabel: {
          overflow: "truncate",
          width: dynamicLabelWidth,
        },
        name: isHorizontal ? undefined : showPercentages ? "%" : "Count",
        nameLocation: "middle",
        nameGap: 40,
      },
      series: [
        {
          type: "bar",
          data: values,
          itemStyle: {
            color: (params: any) => colorScheme[params.dataIndex % colorScheme.length],
          },
          label: {
            show: true,
            position: isHorizontal ? "right" : "top",
            formatter: (params: any) => {
              return showPercentages ? `${params.value.toFixed(1)}%` : params.value;
            },
          },
        },
      ],
    };
  }, [data, orientation, showPercentages, colorScheme]);

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

  if (!data || data.items.length === 0) {
    return (
      <Card>
        {title && (
          <CardHeader>
            <CardTitle className="text-base">{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent className="py-8 text-center text-muted-foreground">
          No data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          {showExport && (
            <CardAction>
              <Button variant="ghost" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4" />
              </Button>
            </CardAction>
          )}
        </CardHeader>
      )}
      <CardContent>
        <EChartsWrapper option={option} height={height} onChartReady={handleChartReady} />
      </CardContent>
    </Card>
  );
}
