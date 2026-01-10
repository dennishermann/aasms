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

interface HeatmapProps {
    title?: string;
    data: CrossTabResult | undefined;
    isLoading?: boolean;
    height?: number;
    gapThreshold?: number; // Cells with count <= this are highlighted as gaps
    onCellClick?: (data: CellClickData) => void;
    colorRange?: [string, string]; // [low, high] colors
    onChartReady?: (chart: echarts.ECharts) => void;
}

const DEFAULT_COLOR_RANGE: [string, string] = ["#f3f4f6", "#3b82f6"];

export function Heatmap({
    title,
    data,
    isLoading = false,
    height = 500,
    gapThreshold = 0,
    onCellClick,
    colorRange = DEFAULT_COLOR_RANGE,
    onChartReady: onChartReadyProp,
}: HeatmapProps) {
    const option: EChartsOption = useMemo(() => {
        if (!data || data.cells.length === 0) {
            return {};
        }

        // Map row/col indices
        const rowIndexMap = new Map(data.rowLabels.map((r, i) => [r.id, i]));
        const colIndexMap = new Map(data.colLabels.map((c, i) => [c.id, i]));

        // Find max count for color scaling
        const maxCount = Math.max(...data.cells.map((c) => c.count), 1);

        // Transform cells to heatmap data [x, y, value, rowId, colId, rowLabel, colLabel, sourceIds]
        const heatmapData = data.cells.map((cell) => {
            const x = colIndexMap.get(cell.colId) ?? 0;
            const y = rowIndexMap.get(cell.rowId) ?? 0;
            const rowLabel =
                data.rowLabels.find((r) => r.id === cell.rowId)?.label ?? "";
            const colLabel =
                data.colLabels.find((c) => c.id === cell.colId)?.label ?? "";
            return {
                value: [x, y, cell.count],
                rowId: cell.rowId,
                colId: cell.colId,
                rowLabel,
                colLabel,
                sourceIds: cell.sourceIds,
                isGap: cell.count <= gapThreshold,
            };
        });

        return {
            tooltip: {
                position: "top",
                formatter: (params: any) => {
                    const { rowLabel, colLabel, value, isGap } = params.data;
                    const count = value[2];
                    const gapLabel = isGap
                        ? '<br/><span style="color:#dc2626;">⚠ Research Gap</span>'
                        : "";
                    return `${rowLabel} × ${colLabel}<br/>Count: ${count}${gapLabel}<br/><span style="color:#888;">Click to view sources</span>`;
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
                splitArea: {
                    show: true,
                },
            },
            yAxis: {
                type: "category",
                data: data.rowLabels.map((r) => r.label),
                axisLabel: {
                    overflow: "truncate",
                    width: 100,
                },
                splitArea: {
                    show: true,
                },
            },
            visualMap: {
                min: 0,
                max: maxCount,
                calculable: true,
                orient: "horizontal",
                left: "center",
                bottom: "0%",
                inRange: {
                    color: colorRange,
                },
            },
            series: [
                {
                    type: "heatmap",
                    data: heatmapData,
                    label: {
                        show: true,
                        formatter: (params: any) => {
                            const count = params.data.value[2];
                            return count > 0 ? count.toString() : "";
                        },
                    },
                    itemStyle: {
                        borderColor: "#fff",
                        borderWidth: 1,
                    },
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowColor: "rgba(0, 0, 0, 0.3)",
                        },
                    },
                },
            ],
        };
    }, [data, gapThreshold, colorRange]);

    // Handle chart click events for drill-down
    const handleChartReady = useCallback(
        (chart: echarts.ECharts) => {
            // Pass chart instance to parent for export
            onChartReadyProp?.(chart);

            if (!onCellClick || !data) return;

            chart.on("click", "series.heatmap", (params: any) => {
                const { rowId, colId, rowLabel, colLabel, sourceIds, value } =
                    params.data;
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
        [onCellClick, data, onChartReadyProp]
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
                <EChartsWrapper
                    option={option}
                    height={height}
                    onChartReady={handleChartReady}
                />
            </CardContent>
        </Card>
    );
}

export type { CellClickData };
