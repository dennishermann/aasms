"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";
import type { DimensionConfigProps } from "./types";

export function DimensionConfig({
  label,
  value,
  onChange,
  facets,
  allowedTypes = ["CLOSED", "OPEN_CODED"],
  placeholder = "Select a facet",
}: DimensionConfigProps) {
  const filteredFacets = facets.filter((f) =>
    allowedTypes.includes(f.type)
  );

  // Check if there are OPEN facets that aren't showing
  const openFacets = facets.filter((f) => f.type === "OPEN");
  const hasHiddenOpenFacets = openFacets.length > 0 && !allowedTypes.includes("OPEN");

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value ?? ""}
        onValueChange={(v) => onChange(v || null)}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {filteredFacets.length === 0 ? (
            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
              No categorical facets available.
              {hasHiddenOpenFacets && (
                <p className="mt-2 text-amber-600">
                  {openFacets.length} OPEN facet{openFacets.length > 1 ? "s" : ""} need coding before they can be used.
                </p>
              )}
            </div>
          ) : (
            filteredFacets.map((facet) => (
              <SelectItem key={facet.id} value={facet.id}>
                <div className="flex items-center gap-2">
                  <span>{facet.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({facet.type === "OPEN_CODED" ? "Coded" : "Category"})
                  </span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {hasHiddenOpenFacets && filteredFacets.length > 0 && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <Info className="h-3 w-3 shrink-0" />
          {openFacets.length} OPEN facet{openFacets.length > 1 ? "s" : ""} hidden.
          Run &quot;Develop Coding&quot; in Analysis to convert them.
        </p>
      )}
      {filteredFacets.length > 0 && !hasHiddenOpenFacets && (
        <p className="text-xs text-muted-foreground">
          Only categorical facets (CLOSED or Coded) can be used for aggregation.
        </p>
      )}
    </div>
  );
}
