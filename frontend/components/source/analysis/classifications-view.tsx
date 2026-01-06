"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { CardContent } from "@/components/ui/card";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Classification, getFacetName, getCategoryDisplay } from "./types";
import { cn } from "@/lib/utils";

interface ClassificationsViewProps {
  classifications: Classification[];
  loading?: boolean;
}

const ClassificationCard = ({
  facetName,
  category,
  confidence,
  reasoning,
}: {
  facetName: string;
  category: string;
  confidence: number;
  reasoning?: string;
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg transition-all duration-200 bg-card hover:bg-accent/5 overflow-hidden flex flex-col">
      <div
        className="p-4 cursor-pointer select-none flex-1 flex flex-col"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider line-clamp-1" title={facetName}>
            {facetName}
          </Label>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
        </div>

        <div className="mb-3">
          <Badge
            variant="secondary"
            className={cn(
              "text-sm px-2.5 py-1 whitespace-normal text-left h-auto font-medium border-primary/20 w-full block",
              category === "Not Applicable"
                ? "bg-muted text-muted-foreground border-transparent italic"
                : "bg-primary/5 hover:bg-primary/10 text-primary",
              !expanded && "line-clamp-2"
            )}
            title={category}
          >
            {category}
          </Badge>
        </div>

        <div className="mt-auto flex items-end justify-between text-xs text-muted-foreground">
          <span>Confidence</span>
          <span className={cn(
            "font-mono font-medium",
            confidence > 0.8 ? "text-green-600" : confidence > 0.5 ? "text-yellow-600" : "text-red-600"
          )}>
            {(confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out border-t border-border/50 bg-muted/20",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="p-4 pt-3 space-y-3">
            {/* Detailed Confidence Bar */}
            <div className="space-y-1">
              <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    confidence > 0.8 ? "bg-green-500" : confidence > 0.5 ? "bg-yellow-500" : "bg-red-500"
                  )}
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
            </div>

            {/* Reasoning */}
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Reasoning
              </span>
              <p className="text-sm text-foreground/90 leading-relaxed">
                {reasoning || "No reasoning provided."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export function ClassificationsView({ classifications, loading = false }: ClassificationsViewProps) {
  if (!classifications || classifications.length === 0) {
    return (
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Running classification analysis...
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No classifications defined yet.</p>
        )}
      </CardContent>
    );
  }

  return (
    <CardContent className="space-y-6 pt-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-lg font-semibold">Classifications</h3>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classifications.map((classification, index) => {
          return (
            <ClassificationCard
              key={classification.id || index}
              facetName={getFacetName(classification)}
              category={getCategoryDisplay(classification)}
              confidence={classification.confidence}
              reasoning={classification.reasoning}
            />
          );
        })}
      </div>
    </CardContent>
  );
}
