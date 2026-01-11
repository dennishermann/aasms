"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StudySummaryStats } from "@/components/shared/study-summary-stats";
import type { SummaryStats } from "@/types/analysis";

interface SummaryStatsCardProps {
  stats: SummaryStats | undefined;
  isLoading: boolean;
}

export function SummaryStatsCard({ stats, isLoading }: SummaryStatsCardProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
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

  // Transform SummaryStats to the format expected by StudySummaryStats
  const sourceStats = {
    total: stats.totalSources,
    included: stats.includedSources,
    excluded: stats.excludedSources,
    pending: stats.totalSources - stats.includedSources - stats.excludedSources,
    yearRange: stats.yearRange,
    uniqueVenues: stats.uniqueVenues,
  };

  return (
    <div className="space-y-6">
      {/* Core stats using shared component */}
      <StudySummaryStats stats={sourceStats} variant="full" />

      {/* Top Venues - specific to Analysis page */}
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

      {/* Classification Coverage - specific to Analysis page */}
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
