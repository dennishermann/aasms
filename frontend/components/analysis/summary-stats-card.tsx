"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { SummaryStats } from "@/types/analysis";
import {
  FileText,
  CheckCircle,
  XCircle,
  Calendar,
  Building,
  Layers,
  Bookmark,
} from "lucide-react";

interface SummaryStatsCardProps {
  stats: SummaryStats | undefined;
  isLoading: boolean;
}

export function SummaryStatsCard({ stats, isLoading }: SummaryStatsCardProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
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
          No analysis data available
        </CardContent>
      </Card>
    );
  }

  const statItems = [
    {
      label: "Total Sources",
      value: stats.totalSources,
      icon: FileText,
      color: "text-muted-foreground",
    },
    {
      label: "Included",
      value: stats.includedSources,
      icon: CheckCircle,
      color: "text-green-600",
    },
    {
      label: "Excluded",
      value: stats.excludedSources,
      icon: XCircle,
      color: "text-red-600",
    },
    {
      label: "Classified",
      value: stats.classifiedSources,
      icon: Layers,
      color: "text-blue-600",
    },
    {
      label: "Formal Sources",
      value: stats.formalSources,
      icon: Bookmark,
      color: "text-purple-600",
    },
    {
      label: "Grey Literature",
      value: stats.greySources,
      icon: Bookmark,
      color: "text-orange-600",
    },
    {
      label: "Year Range",
      value:
        stats.yearRange.min && stats.yearRange.max
          ? `${stats.yearRange.min} - ${stats.yearRange.max}`
          : "N/A",
      icon: Calendar,
      color: "text-muted-foreground",
    },
    {
      label: "Unique Venues",
      value: stats.uniqueVenues,
      icon: Building,
      color: "text-muted-foreground",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${item.color}`} />
                  <p className={`text-2xl font-bold ${item.color}`}>
                    {item.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {stats.topVenues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top Venues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.topVenues.map((venue) => (
                <Badge key={venue.name} variant="secondary">
                  {venue.name} ({venue.count})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats.facetCoverage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Classification Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.facetCoverage.map((facet) => (
                <div key={facet.facetId} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{facet.facetName}</span>
                    <span className="text-muted-foreground">
                      {facet.classified}/{facet.classified + facet.unclassified} (
                      {facet.coveragePercent.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${facet.coveragePercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
