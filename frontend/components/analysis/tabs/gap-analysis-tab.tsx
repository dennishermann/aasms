"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GapAnalysis } from "../tables/gap-analysis";
import { ChevronDown, ChevronUp, Lightbulb, HelpCircle } from "lucide-react";
import type { GapAnalysis as GapAnalysisType } from "@/types/analysis";
import type { Facet } from "@/hooks/use-analysis-page";

interface GapAnalysisTabProps {
  facets: Facet[];
  threshold: number;
  onThresholdChange: (threshold: number) => void;
  selectedFacetIds: string[];
  onFacetIdsChange: (ids: string[]) => void;
  data: GapAnalysisType | undefined;
  isLoading: boolean;
}

export function GapAnalysisTab({
  facets,
  threshold,
  onThresholdChange,
  selectedFacetIds,
  onFacetIdsChange,
  data,
  isLoading,
}: GapAnalysisTabProps) {
  const [showHelp, setShowHelp] = useState(true);

  // Filter to only CLOSED and OPEN_CODED facets
  const analyzableFacets = facets.filter((f) => f.type === "CLOSED" || f.type === "OPEN_CODED");

  const toggleFacet = (facetId: string) => {
    if (selectedFacetIds.includes(facetId)) {
      onFacetIdsChange(selectedFacetIds.filter((id) => id !== facetId));
    } else {
      onFacetIdsChange([...selectedFacetIds, facetId]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Help Section */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-base text-blue-800 dark:text-blue-300">
                What is Research Gap Analysis?
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelp(!showHelp)}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              {showHelp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {showHelp && (
          <CardContent className="text-sm text-blue-800 dark:text-blue-300 space-y-3">
            <p>
              <strong>Purpose:</strong> Gap analysis helps you identify{" "}
              <em>under-researched areas</em> within your systematic mapping study. These are
              categories in your classification scheme that have few or no publications,
              representing potential research opportunities.
            </p>
            <div className="grid md:grid-cols-2 gap-4 mt-3">
              <div className="space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <span className="inline-block w-2 h-2 bg-red-600 rounded-full" />
                  Empty Categories (0 sources)
                </p>
                <p className="text-xs opacity-80">
                  No publications found — strong signal for future research
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <span className="inline-block w-2 h-2 bg-amber-600 rounded-full" />
                  Low Coverage (≤ threshold)
                </p>
                <p className="text-xs opacity-80">
                  Few publications — may warrant further investigation
                </p>
              </div>
            </div>
            <p className="text-xs border-t border-blue-200 dark:border-blue-800 pt-2 mt-2">
              <strong>Tip:</strong> Use gaps to formulate research questions, justify new studies,
              or identify areas needing more primary research. A low threshold (1-3) highlights
              severe gaps; higher thresholds (5-10) reveal moderate opportunities.
            </p>
          </CardContent>
        )}
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gap Analysis Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Threshold */}
          <div className="space-y-2">
            <Label htmlFor="threshold" className="flex items-center gap-1">
              Gap Threshold
              <span title="Categories with this many publications or fewer are flagged as gaps">
                <HelpCircle className="h-3 w-3 text-muted-foreground" />
              </span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="threshold"
                type="number"
                min={1}
                max={20}
                value={threshold}
                onChange={(e) => onThresholdChange(parseInt(e.target.value, 10) || 3)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">
                Categories with ≤ {threshold} sources are considered gaps
              </span>
            </div>
          </div>

          {/* Facet Filter */}
          {analyzableFacets.length > 0 && (
            <div className="space-y-2">
              <Label>Facets to Analyze</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Select specific facets or leave empty to analyze all
              </p>
              <div className="flex flex-wrap gap-2">
                {analyzableFacets.map((facet) => (
                  <Badge
                    key={facet.id}
                    variant={
                      selectedFacetIds.length === 0 || selectedFacetIds.includes(facet.id)
                        ? "default"
                        : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() => toggleFacet(facet.id)}
                  >
                    {facet.name}
                    {facet.categories.length > 0 && (
                      <span className="ml-1 text-xs opacity-70">({facet.categories.length})</span>
                    )}
                  </Badge>
                ))}
              </div>
              {selectedFacetIds.length > 0 && (
                <button
                  onClick={() => onFacetIdsChange([])}
                  className="text-sm text-muted-foreground hover:text-foreground underline mt-1"
                >
                  Clear selection (analyze all)
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      <GapAnalysis title="Research Gap Analysis Results" data={data} isLoading={isLoading} />
    </div>
  );
}
