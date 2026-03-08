"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart, ScatterChart, HeatmapChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  LegendComponent,
  VisualMapComponent,
} from "echarts/components";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

// Register required components
echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  LegendComponent,
  VisualMapComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  HeatmapChart,
]);

interface EChartsWrapperProps {
  option: EChartsOption;
  height?: number | string;
  className?: string;
  onChartReady?: (chart: echarts.ECharts) => void;
}

export function EChartsWrapper({
  option,
  height = 400,
  className = "",
  onChartReady,
}: EChartsWrapperProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const onChartReadyRef = useRef(onChartReady);

  // Keep callback ref updated
  useEffect(() => {
    onChartReadyRef.current = onChartReady;
  }, [onChartReady]);

  // Initialize and update chart
  useEffect(() => {
    if (!chartRef.current) return;

    // Dispose existing chart if any (handles Strict Mode remounting)
    if (chartInstance.current) {
      chartInstance.current.dispose();
      chartInstance.current = null;
    }

    // Initialize new chart
    chartInstance.current = echarts.init(chartRef.current);

    // Call the ready callback
    if (onChartReadyRef.current) {
      onChartReadyRef.current(chartInstance.current);
    }

    // Set options
    if (Object.keys(option).length > 0) {
      chartInstance.current.setOption(option, true);
    }

    // Handle resize
    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener("resize", handleResize);

    // Cleanup on unmount
    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []); // Only run on mount/unmount

  // Update chart options when they change
  useEffect(() => {
    if (chartInstance.current && Object.keys(option).length > 0) {
      chartInstance.current.setOption(option, true);
    }
  }, [option]);

  return (
    <div
      ref={chartRef}
      className={className}
      style={{ height: typeof height === "number" ? `${height}px` : height }}
    />
  );
}

export { echarts };
