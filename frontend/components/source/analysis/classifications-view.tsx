"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, ChevronDown, ChevronUp, AlertCircle, Database, ShieldCheck, Sparkles, Info } from "lucide-react";
import { Classification, FacetKeyword, getFacetName, getCategoryDisplay, Facet } from "./types";
import { cn } from "@/lib/utils";

interface ClassificationsViewProps {
  classifications: Classification[];
  facetKeywords?: FacetKeyword[];
  facets?: Facet[];  // All facets from schema to show "Not Set" for missing ones
  classificationBasis?: "FULL_TEXT" | "METADATA_ONLY";
  loading?: boolean;
}

interface KeywordData {
  keyword: string;
  confidence?: number | null;
  evidence?: string | null;
}

interface ClassificationGroup {
  facetId: string;
  facetName: string;
  facetType: "CLOSED" | "OPEN" | "OPEN_CODED";
  required: boolean;
  items: Array<{
    id: string;
    category: string;
    confidence: number;
    reasoning?: string;
  }>;
  keywordData?: KeywordData[];
  isMetadata?: boolean;
}

const MetadataClassificationCard = ({
  facetName,
  items,
  notSet,
}: {
  facetName: string;
  items: ClassificationGroup["items"];
  notSet?: boolean;
}) => {
  // If not set or no items
  if (notSet || items.length === 0) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/10">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{facetName}</span>
        </div>
        <Badge variant="outline" className="text-xs bg-muted/50 text-muted-foreground font-normal">
          Not available
        </Badge>
      </div>
    );
  }

  const item = items[0]; // Metadata usually single value
  const isVerified = item.confidence > 0.95;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">{facetName}</span>
        <span className="font-medium text-base truncate max-w-[200px]" title={item.category}>
          {item.category === "No Match" ? <span className="text-muted-foreground italic">No Match</span> : item.category}
        </span>
      </div>
      {isVerified ? (
        <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100 dark:bg-green-900/20 dark:border-green-900/50">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span className="text-[10px] font-semibold uppercase tracking-wide">Verified</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5" title="Inferred by AI">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className={cn(
            "text-xs font-mono font-medium",
            item.confidence > 0.8 ? "text-green-600" : item.confidence > 0.5 ? "text-amber-600" : "text-red-600"
          )}>
            {(item.confidence * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
};

const FacetClassificationCard = ({
  facetName,
  facetType,
  required,
  items,
  keywordData,
  notSet,
}: {
  facetName: string;
  facetType: "CLOSED" | "OPEN" | "OPEN_CODED";
  required: boolean;
  items: ClassificationGroup["items"];
  keywordData?: KeywordData[];
  notSet?: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);

  // Handle not set case
  if (notSet) {
    return (
      <div className="border rounded-lg bg-card overflow-hidden flex flex-col border-dashed">
        <div className="p-4 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider line-clamp-1" title={facetName}>
                {facetName}
              </Label>
              {!required && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                  Optional
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm italic">Not classified yet</span>
          </div>
        </div>
      </div>
    );
  }

  // For OPEN facets, show keywords directly
  const isOpenWithKeywords = facetType === "OPEN" && keywordData && keywordData.length > 0;

  // Calculate average confidence for multi-category (only for non-keyword items)
  const avgConfidence = items.length > 0
    ? items.reduce((sum, i) => sum + i.confidence, 0) / items.length
    : 0;
  const isMultiCategory = items.length > 1;

  return (
    <div className="border rounded-lg transition-all duration-200 bg-card hover:bg-accent/5 overflow-hidden flex flex-col">
      <div
        className="p-4 cursor-pointer select-none flex-1 flex flex-col"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider line-clamp-1" title={facetName}>
              {facetName}
            </Label>
            {isMultiCategory && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {items.length}
              </Badge>
            )}
            {isOpenWithKeywords && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {keywordData.length}
              </Badge>
            )}
          </div>
          {(items.length > 0 || isOpenWithKeywords) && (expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ))}
        </div>

        {/* Display keywords for OPEN facets with confidence tooltips */}
        {isOpenWithKeywords && (
          <TooltipProvider>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {keywordData.map((kw, idx) => (
                <Tooltip key={idx}>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-sm px-2.5 py-1 whitespace-normal text-left h-auto font-medium cursor-help",
                        kw.confidence && kw.confidence > 0.7
                          ? "bg-green-50 text-green-700 border-green-200"
                          : kw.confidence && kw.confidence > 0.4
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-50 text-slate-700 border-slate-200",
                        !expanded && "line-clamp-1"
                      )}
                    >
                      {kw.keyword}
                      {kw.confidence != null && (
                        <span className="ml-1.5 text-[10px] opacity-70 font-mono">
                          {Math.round(kw.confidence * 100)}%
                        </span>
                      )}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-medium">{kw.keyword}</p>
                      {kw.confidence != null && (
                        <p className="text-xs text-muted-foreground">
                          Confidence: {Math.round(kw.confidence * 100)}%
                        </p>
                      )}
                      {kw.evidence && (
                        <p className="text-xs text-muted-foreground italic">
                          {kw.evidence}
                        </p>
                      )}
                      {!kw.evidence && !kw.confidence && (
                        <p className="text-xs text-muted-foreground italic">
                          No additional information
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        )}

        {/* Display categories for CLOSED/OPEN_CODED facets */}
        {!isOpenWithKeywords && items.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {items.map((item, idx) => (
              <Badge
                key={item.id || idx}
                variant="secondary"
                className={cn(
                  "text-sm px-2.5 py-1 whitespace-normal text-left h-auto font-medium border-primary/20",
                  item.category === "Not Applicable" || item.category === "No Match"
                    ? "bg-muted text-muted-foreground border-transparent italic"
                    : "bg-primary/5 hover:bg-primary/10 text-primary",
                  !expanded && "line-clamp-1"
                )}
                title={item.category}
              >
                {item.category}
              </Badge>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-auto flex items-end justify-between text-xs text-muted-foreground">
            <span>Confidence{isMultiCategory ? " (avg)" : ""}</span>
            <span className={cn(
              "font-mono font-medium",
              avgConfidence > 0.8 ? "text-green-600" : avgConfidence > 0.5 ? "text-yellow-600" : "text-red-600"
            )}>
              {(avgConfidence * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* Expanded details */}
      {(items.length > 0 || isOpenWithKeywords) && (
        <div
          className={cn(
            "grid transition-all duration-200 ease-in-out border-t border-border/50 bg-muted/20",
            expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <div className="p-4 pt-3 space-y-3">
              {items.map((item, idx) => (
                <div key={item.id || idx} className="space-y-2">
                  {isMultiCategory && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {item.category}
                      </Badge>
                      <span className={cn(
                        "text-xs font-mono",
                        item.confidence > 0.8 ? "text-green-600" : item.confidence > 0.5 ? "text-yellow-600" : "text-red-600"
                      )}>
                        {(item.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                  {/* Confidence Bar */}
                  <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        item.confidence > 0.8 ? "bg-green-500" : item.confidence > 0.5 ? "bg-yellow-500" : "bg-red-500"
                      )}
                      style={{ width: `${item.confidence * 100}%` }}
                    />
                  </div>
                  {/* Reasoning */}
                  {item.reasoning && (
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      {item.reasoning}
                    </p>
                  )}
                  {!item.reasoning && !isMultiCategory && (
                    <p className="text-sm text-muted-foreground italic">No reasoning provided.</p>
                  )}
                  {isMultiCategory && idx < items.length - 1 && (
                    <div className="border-b my-2" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export function ClassificationsView({
  classifications,
  facetKeywords = [],
  facets = [],
  classificationBasis,
  loading = false,
}: ClassificationsViewProps) {
  const hasClassifications = classifications && classifications.length > 0;
  const hasKeywords = facetKeywords && facetKeywords.length > 0;
  const hasFacets = facets.length > 0;

  if (!hasClassifications && !hasKeywords && !hasFacets) {
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

  // Build a unified map of all facets with their classifications and keywords
  const metadataGroups: ClassificationGroup[] = [];
  const analysisGroups: ClassificationGroup[] = [];
  const facetMap = new Map<string, ClassificationGroup>();

  // First, add all schema facets (so we show "Not Set" for missing ones)
  for (const facet of facets) {
    if (facet.id) {
      const group: ClassificationGroup = {
        facetId: facet.id,
        facetName: facet.name,
        facetType: facet.type,
        required: facet.required,
        items: [],
        keywordData: [],
        isMetadata: !!facet.metadataField
      };
      facetMap.set(facet.id, group);

      if (facet.metadataField) {
        metadataGroups.push(group);
      } else {
        analysisGroups.push(group);
      }
    }
  }

  // Add classifications
  for (const c of classifications) {
    const facetId = c.facetId;
    let group = facetMap.get(facetId);

    if (!group) {
      // Facet not in schema (maybe deleted), still show it
      group = {
        facetId,
        facetName: getFacetName(c),
        facetType: c.facet?.type || "CLOSED",
        required: false,
        items: [],
        keywordData: [],
        isMetadata: false // Assume analysis if unknown
      };
      facetMap.set(facetId, group);
      analysisGroups.push(group);
    }

    group.items.push({
      id: c.id,
      category: (c.category?.name || c.value) ? getCategoryDisplay(c) : "No Match",
      confidence: c.confidence,
      reasoning: c.reasoning,
    });
  }

  // Add keywords to OPEN facets
  for (const keyword of facetKeywords) {
    const facetId = keyword.facetId;
    let group = facetMap.get(facetId);

    if (!group) {
      group = {
        facetId,
        facetName: keyword.facet?.name || "Unknown",
        facetType: keyword.facet?.type || "OPEN",
        required: false,
        items: [],
        keywordData: [],
        isMetadata: false
      };
      facetMap.set(facetId, group);
      analysisGroups.push(group);
    }

    if (!group.keywordData) group.keywordData = [];
    group.keywordData.push({
      keyword: keyword.keyword,
      confidence: keyword.confidence,
      evidence: keyword.evidence,
    });
  }

  // Sort groups
  const sortFn = (a: ClassificationGroup, b: ClassificationGroup) => {
    // Put verified/filled items first
    const aHasData = a.items.length > 0 || (a.keywordData && a.keywordData.length > 0);
    const bHasData = b.items.length > 0 || (b.keywordData && b.keywordData.length > 0);
    if (aHasData && !bHasData) return -1;
    if (!aHasData && bHasData) return 1;
    return a.facetName.localeCompare(b.facetName);
  };

  metadataGroups.sort(sortFn);
  analysisGroups.sort(sortFn);

  return (
    <CardContent className="space-y-8 pt-6 animate-in fade-in duration-300">
      {classificationBasis === "METADATA_ONLY" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
          Classification based on metadata and abstract only (full text not available).
        </div>
      )}

      {/* Metadata Section */}
      {metadataGroups.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b">
            <Database className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Source Properties</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {metadataGroups.map(group => (
              <MetadataClassificationCard
                key={group.facetId}
                facetName={group.facetName}
                items={group.items}
                notSet={group.items.length === 0}
              />
            ))}
          </div>
        </div>
      )}

      {/* Analysis Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Research Analysis</h3>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analysisGroups.map((group) => {
            const hasData = group.items.length > 0 || (group.keywordData && group.keywordData.length > 0);
            return (
              <FacetClassificationCard
                key={group.facetId}
                facetName={group.facetName}
                facetType={group.facetType}
                required={group.required}
                items={group.items}
                keywordData={group.keywordData}
                notSet={!hasData}
              />
            );
          })}
        </div>
      </div>
    </CardContent>
  );
}
