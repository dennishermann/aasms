"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Tags } from "lucide-react";
import { Facet } from "./types";

interface FacetListProps {
  facets: Facet[];
  selectedFacetKey: string | null;
  onSelectFacet: (facetKey: string) => void;
  onAddFacet: () => void;
  getFacetKey: (facet: Facet) => string;
}

export function FacetList({
  facets,
  selectedFacetKey,
  onSelectFacet,
  onAddFacet,
  getFacetKey,
}: FacetListProps) {
  const getTypeBadge = (type: Facet["type"]) => {
    switch (type) {
      case "CLOSED":
        return { label: "Cat", className: "bg-blue-100 text-blue-700" };
      case "OPEN":
        return { label: "Open", className: "bg-green-100 text-green-700" };
      case "OPEN_CODED":
        return { label: "Coded", className: "bg-purple-100 text-purple-700" };
    }
  };

  return (
    <div className="w-56 shrink-0 border-r bg-muted/30">
      <div className="p-3 border-b">
        <h3 className="text-sm font-semibold text-muted-foreground">Facets</h3>
      </div>

      <div className="p-2 space-y-1">
        {facets.map((facet, index) => {
          const facetKey = getFacetKey(facet);
          const isSelected = selectedFacetKey === facetKey;
          const badge = getTypeBadge(facet.type);

          return (
            <button
              key={facetKey}
              onClick={() => onSelectFacet(facetKey)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "flex items-center gap-2",
                isSelected && "bg-accent text-accent-foreground font-medium",
              )}
            >
              <span className="text-xs font-mono text-muted-foreground shrink-0">F{index + 1}</span>
              <span className="truncate flex-1" title={facet.name || "Untitled"}>{facet.name || "Untitled"}</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0",
                  badge.className,
                )}
              >
                {badge.label}
              </span>
            </button>
          );
        })}

        {facets.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Tags className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No facets yet</p>
          </div>
        )}
      </div>

      <div className="p-2 border-t">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={onAddFacet}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Facet
        </Button>
      </div>
    </div>
  );
}
