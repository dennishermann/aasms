"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    FileText,
    CheckCircle,
    XCircle,
    Clock,
    Calendar,
    Building,
} from "lucide-react";

interface SourceStats {
    total: number;
    included: number;
    excluded: number;
    pending: number;
    yearRange?: { min: number | null; max: number | null };
    uniqueVenues?: number;
}

interface StudySummaryStatsProps {
    stats: SourceStats | undefined;
    isLoading?: boolean;
    /** Whether to show year range and venues (full mode) or just counts (compact mode) */
    variant?: "full" | "compact";
}

export function StudySummaryStats({
    stats,
    isLoading,
    variant = "full",
}: StudySummaryStatsProps) {
    if (isLoading) {
        const skeletonCount = variant === "full" ? 6 : 4;
        return (
            <div className={`grid grid-cols-2 md:grid-cols-${variant === "full" ? 3 : 4} lg:grid-cols-${skeletonCount} gap-4`}>
                {Array.from({ length: skeletonCount }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="pb-2">
                            <Skeleton className="h-4 w-20" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-12" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (!stats) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                    No data available
                </CardContent>
            </Card>
        );
    }

    const statItems: Array<{
        label: string;
        value: number | string;
        icon: typeof FileText;
        color: string;
        bgColor: string;
    }> = [
        {
            label: "Total Sources",
            value: stats.total,
            icon: FileText,
            color: "text-slate-600",
            bgColor: "bg-slate-50",
        },
        {
            label: "Included",
            value: stats.included,
            icon: CheckCircle,
            color: "text-green-600",
            bgColor: "bg-green-50",
        },
        {
            label: "Excluded",
            value: stats.excluded,
            icon: XCircle,
            color: "text-red-600",
            bgColor: "bg-red-50",
        },
        {
            label: "Pending",
            value: stats.pending,
            icon: Clock,
            color: "text-amber-600",
            bgColor: "bg-amber-50",
        },
    ];

    // Add year range and venues for full variant
    if (variant === "full") {
        const yearRangeValue =
            stats.yearRange?.min && stats.yearRange?.max
                ? `${stats.yearRange.min} - ${stats.yearRange.max}`
                : "—";

        statItems.push(
            {
                label: "Year Range",
                value: yearRangeValue,
                icon: Calendar,
                color: "text-blue-600",
                bgColor: "bg-blue-50",
            },
            {
                label: "Unique Venues",
                value: stats.uniqueVenues ?? 0,
                icon: Building,
                color: "text-purple-600",
                bgColor: "bg-purple-50",
            }
        );
    }

    const gridCols = variant === "full"
        ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
        : "grid-cols-2 md:grid-cols-4";

    return (
        <div className={`grid ${gridCols} gap-4`}>
            {statItems.map((item) => {
                const Icon = item.icon;
                return (
                    <Card key={item.label} className={`${item.bgColor} border-0`}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                {item.label}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <Icon className={`h-5 w-5 ${item.color}`} />
                                <p className={`text-2xl font-bold ${item.color}`}>
                                    {item.value}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
