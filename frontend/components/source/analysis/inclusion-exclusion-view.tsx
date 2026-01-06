"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Ban,
  AlertCircle
} from "lucide-react";
import { AnalysisData, CriterionEval } from "./types";
import { cn } from "@/lib/utils";

interface InclusionExclusionViewProps {
  analysis: Pick<
    AnalysisData,
    | "inclusionRecommendation"
    | "inclusionReasoning"
    | "exclusionReasoning"
    | "confidenceScore"
    | "relevanceScore"
    | "qualityNotes"
    | "inclusionCriteria"
    | "exclusionCriteria"
  >;
  loading?: boolean;
}

const CriterionCard = ({
  criterion,
  type,
}: {
  criterion: CriterionEval;
  type: "inclusion" | "exclusion";
}) => {
  const [expanded, setExpanded] = useState(false);

  // Logic for "Good" vs "Bad" outcome
  // Inclusion: Fulfilled = Good (Included)
  // Exclusion: Fulfilled = Bad (Excluded)
  const isGood = type === "inclusion" ? criterion.fulfilled : !criterion.fulfilled;

  const styles = isGood
    ? {
      border: "border-green-200",
      bg: "bg-green-50",
      icon: <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />,
      text: "text-green-900",
      muted: "text-green-700/80",
      indicatorColor: "bg-green-500",
    }
    : {
      border: "border-red-200",
      bg: "bg-red-50",
      icon: type === "exclusion" ? (
        <Ban className="h-5 w-5 text-red-600 flex-shrink-0" />
      ) : (
        <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
      ),
      text: "text-red-900",
      muted: "text-red-700/80",
      indicatorColor: "bg-red-500",
    };

  return (
    <div
      className={cn(
        "border rounded-lg transition-all duration-200 overflow-hidden",
        styles.border,
        styles.bg
      )}
    >
      <div
        className="p-3 flex items-start gap-3 cursor-pointer hover:opacity-80 active:scale-[0.99] transition-transform select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="mt-0.5">{styles.icon}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={cn("text-sm font-semibold leading-tight", styles.text)}>
              {criterion.criterion}
            </p>
            {expanded ? (
              <ChevronUp className={cn("h-4 w-4", styles.muted)} />
            ) : (
              <ChevronDown className={cn("h-4 w-4", styles.muted)} />
            )}
          </div>

          {!expanded && criterion.reasoning && (
            <p className={cn("text-xs mt-1 line-clamp-1", styles.muted)}>
              {criterion.reasoning}
            </p>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className={cn("p-3 pt-0 text-sm border-t border-black/5", styles.border)}>
            <div className="mt-2">
              <span className={cn("text-xs font-bold uppercase tracking-wider opacity-70 block mb-1", styles.text)}>
                Reasoning
              </span>
              <p className={cn("leading-relaxed", styles.text)}>
                {criterion.reasoning || "No reasoning provided."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export function InclusionExclusionView({ analysis, loading = false }: InclusionExclusionViewProps) {
  const {
    inclusionCriteria,
    exclusionCriteria,
    inclusionRecommendation,
    confidenceScore,
  } = analysis;

  const [showDetails, setShowDetails] = useState(false);

  return (
    <CardContent className="space-y-6 pt-6">
      {/* Header Evaluation Status */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b pb-6">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            Evaluation Result
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h3>
          <div className="flex items-center gap-2">
            <Badge
              variant={inclusionRecommendation ? "default" : "destructive"}
              className="text-sm px-3 py-1"
            >
              {inclusionRecommendation ? "INCLUDE" : "EXCLUDE"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Confidence: {(confidenceScore * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Confidence Bar (Visual) */}
        <div className="w-full md:w-48 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Confidence</span>
            <span>{(confidenceScore * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500 rounded-full",
                confidenceScore > 0.8 ? "bg-green-500" : confidenceScore > 0.5 ? "bg-yellow-500" : "bg-red-500"
              )}
              style={{ width: `${confidenceScore * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Toggle Details */}
      <div className="flex justify-center -mt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="text-muted-foreground text-xs flex items-center gap-1 h-7"
        >
          {showDetails ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Hide Criteria Details
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Show Criteria Details
            </>
          )}
        </Button>
      </div>

      {/* 2-Column Grid */}
      {showDetails && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-200">

          {/* Left Column: Inclusion */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                Inclusion Criteria
                <Badge variant="outline" className="ml-1 text-xs font-normal">
                  {inclusionCriteria?.length || 0}
                </Badge>
              </h4>
            </div>

            <div className="space-y-3">
              {inclusionCriteria?.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No criteria defined.</p>
              )}
              {inclusionCriteria?.map((c, i) => (
                <CriterionCard key={i} criterion={c} type="inclusion" />
              ))}
            </div>
          </div>

          {/* Right Column: Exclusion */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                Exclusion Criteria
                <Badge variant="outline" className="ml-1 text-xs font-normal">
                  {exclusionCriteria?.length || 0}
                </Badge>
              </h4>
            </div>

            <div className="space-y-3">
              {exclusionCriteria?.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No criteria defined.</p>
              )}
              {exclusionCriteria?.map((c, i) => (
                <CriterionCard key={i} criterion={c} type="exclusion" />
              ))}
            </div>
          </div>

        </div>
      )}
    </CardContent>
  );
}




