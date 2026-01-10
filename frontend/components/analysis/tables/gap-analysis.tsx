"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle } from "lucide-react";
import type { GapAnalysis as GapAnalysisType } from "@/types/analysis";

interface GapAnalysisProps {
  title?: string;
  data: GapAnalysisType | undefined;
  isLoading?: boolean;
}

export function GapAnalysis({ title, data, isLoading }: GapAnalysisProps) {
  // Calculate summary statistics
  const summary = useMemo(() => {
    if (!data) return null;

    const totalGaps = data.singleDimensionGaps.reduce(
      (sum, facet) => sum + facet.gaps.length + facet.empty.length,
      0
    );

    const emptyCount = data.singleDimensionGaps.reduce(
      (sum, facet) => sum + facet.empty.length,
      0
    );

    const lowCount = data.singleDimensionGaps.reduce(
      (sum, facet) => sum + facet.gaps.length,
      0
    );

    return {
      totalGaps,
      emptyCount,
      lowCount,
      facetsWithGaps: data.singleDimensionGaps.filter(
        (f) => f.gaps.length > 0 || f.empty.length > 0
      ).length,
    };
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        {title && (
          <CardHeader>
            <CardTitle className="text-base">{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        {title && (
          <CardHeader>
            <CardTitle className="text-base">{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent className="py-8 text-center text-muted-foreground">
          No gap analysis data available
        </CardContent>
      </Card>
    );
  }

  const hasGaps = summary && summary.totalGaps > 0;

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-6">
        {/* Summary Alert */}
        {hasGaps ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Found <strong>{summary.totalGaps}</strong> potential research gaps
              across <strong>{summary.facetsWithGaps}</strong> classification
              facets ({summary.emptyCount} empty, {summary.lowCount} with ≤
              {data.threshold} sources).
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              No significant research gaps detected. All categories have more than{" "}
              {data.threshold} sources.
            </AlertDescription>
          </Alert>
        )}

        {/* Facet-by-Facet Gap Analysis */}
        {data.singleDimensionGaps.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No facets available for gap analysis
          </div>
        ) : (
          <div className="space-y-6">
            {data.singleDimensionGaps.map((facet) => {
              const hasAnyGaps =
                facet.gaps.length > 0 || facet.empty.length > 0;

              return (
                <div
                  key={facet.facetId}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{facet.facetName}</h3>
                    {hasAnyGaps ? (
                      <Badge variant="destructive">
                        {facet.gaps.length + facet.empty.length} gaps
                      </Badge>
                    ) : (
                      <Badge variant="secondary">No gaps</Badge>
                    )}
                  </div>

                  {!hasAnyGaps ? (
                    <p className="text-sm text-muted-foreground">
                      All categories in this facet are well-covered.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {/* Empty Categories (0 sources) */}
                      {facet.empty.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <span className="inline-block w-2 h-2 bg-red-600 rounded-full" />
                            Empty Categories (0 sources)
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {facet.empty.map((cat) => (
                              <Badge
                                key={cat.categoryId}
                                variant="outline"
                                className="border-red-600 text-red-600 bg-red-50 dark:bg-red-900/20"
                              >
                                {cat.categoryName}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Low Count Categories (1-threshold sources) */}
                      {facet.gaps.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <span className="inline-block w-2 h-2 bg-amber-600 rounded-full" />
                            Low Coverage (≤{data.threshold} sources)
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {facet.gaps.map((cat) => (
                              <Badge
                                key={cat.categoryId}
                                variant="outline"
                                className="border-amber-600 text-amber-700 bg-amber-50 dark:bg-amber-900/20"
                              >
                                {cat.categoryName}
                                <span className="ml-1 text-xs opacity-70">
                                  ({cat.count})
                                </span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Cross-Tab Gaps (if available) */}
        {data.crossTabGaps && data.crossTabGaps.length > 0 && (
          <div className="border-t pt-6 space-y-4">
            <h3 className="font-semibold">
              Cross-Facet Gaps (2D combinations)
            </h3>
            <p className="text-sm text-muted-foreground">
              These represent sparse or empty cells in cross-tabulations, which
              may indicate interesting research gaps.
            </p>
            <div className="space-y-3">
              {data.crossTabGaps.map((crossTab, idx) => (
                <div key={idx} className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">
                    {crossTab.rowFacetName} × {crossTab.colFacetName}
                  </h4>
                  <div className="text-sm text-muted-foreground">
                    {crossTab.gaps.length} sparse or empty combinations found
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
