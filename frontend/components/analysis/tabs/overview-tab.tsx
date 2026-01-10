"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SummaryStatsCard } from "../summary-stats-card";
import type { SummaryStats } from "@/types/analysis";
import type { Facet } from "@/hooks/use-analysis-page";

interface OverviewTabProps {
  stats: SummaryStats | undefined;
  isLoading: boolean;
  facets: Facet[];
  onFacetClick: (facet: Facet) => void;
}

export function OverviewTab({
  stats,
  isLoading,
  facets,
  onFacetClick,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Summary Statistics</h2>
        <SummaryStatsCard stats={stats} isLoading={isLoading} />
      </div>

      {/* Available Classification Facets */}
      {facets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Available Classification Facets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Click on a facet to view its distribution analysis. Open facets can
              be coded to create categories.
            </p>
            <div className="flex flex-wrap gap-2">
              {facets.map((facet) => (
                <Badge
                  key={facet.id}
                  variant={
                    facet.type === "CLOSED" || facet.type === "OPEN_CODED"
                      ? "default"
                      : "secondary"
                  }
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => onFacetClick(facet)}
                >
                  {facet.name}
                  {facet.type === "OPEN" && " (Open)"}
                  {facet.type === "OPEN_CODED" && " (Coded)"}
                  {facet.categories.length > 0 && (
                    <span className="ml-1 text-xs opacity-70">
                      ({facet.categories.length})
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
