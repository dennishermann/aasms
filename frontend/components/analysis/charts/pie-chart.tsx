"use client";

import { useMemo } from "react";
import { EChartsWrapper, echarts } from "./echarts-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { FrequencyResult } from "@/types/analysis";
import type { EChartsOption } from "echarts";

interface PieChartProps {
  title?: string;
  data: FrequencyResult | undefined;
  isLoading?: boolean;
  height?: number;
  showLabels?: boolean;
  donut?: boolean;
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

export function AnalysisPieChart({
  title,
  data,
  isLoading = false,
  height = 400,
  showLabels = true,
  donut = false,
  colorScheme = DEFAULT_COLORS,
  onChartReady,
}: PieChartProps) {
  const option: EChartsOption = useMemo(() => {
    if (!data || data.items.length === 0) {
      return {};
    }

    const pieData = data.items.map((item, index) => ({
      name: item.label,
      value: item.count,
      itemStyle: {
        color: colorScheme[index % colorScheme.length],
      },
    }));

    return {
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          const item = data.items.find((i) => i.label === params.name);
          if (!item) return params.name;
          return `${item.label}<br/>Count: ${item.count}<br/>Percentage: ${item.percentage.toFixed(1)}%`;
        },
      },
      legend: {
        orient: "vertical",
        right: "5%",
        top: "center",
        type: "scroll",
      },
      series: [
        {
          type: "pie",
          radius: donut ? ["40%", "70%"] : "70%",
          center: ["40%", "50%"],
          data: pieData,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
          },
          label: {
            show: showLabels,
            formatter: "{b}: {d}%",
          },
          labelLine: {
            show: showLabels,
          },
        },
      ],
    };
  }, [data, donut, showLabels, colorScheme]);

  if (isLoading) {
    return (
      <Card>
        {title && (
          <CardHeader>
            <CardTitle className="text-base">{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <Skeleton className="w-full rounded-full mx-auto" style={{ height, width: height }} />
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
        </CardHeader>
      )}
      <CardContent>
        <EChartsWrapper option={option} height={height} onChartReady={onChartReady} />
      </CardContent>
    </Card>
  );
}
