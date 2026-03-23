"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { CardContent } from "@/components/ui/card";
import { Classification, Facet } from "./types";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClassificationsEditorProps {
  classifications: Classification[];
  facets: Facet[];
  onChangeClassifications: (next: Classification[]) => void;
  disabled?: boolean;
  loading?: boolean;
}

export function ClassificationsEditor({
  classifications,
  facets,
  onChangeClassifications,
  disabled = false,
  loading = false,
}: ClassificationsEditorProps) {
  const updateClassification = (index: number, patch: Partial<Classification>) => {
    const next = [...classifications];
    next[index] = { ...next[index], ...patch };
    onChangeClassifications(next);
  };

  // Helper to get display values from classification
  const getDisplayInfo = (classification: Classification) => {
    const facetName = classification.facet?.name ?? "Unknown";
    const categoryOrValue = classification.category?.name ?? classification.value ?? "Unknown";
    return { facetName, categoryOrValue };
  };

  // Helper to find facet by ID or name
  const findFacet = (classification: Classification): Facet | undefined => {
    // Try by facetId first
    let facet = facets.find((f) => f.id === classification.facetId);
    // Fallback to name match
    if (!facet && classification.facet?.name) {
      facet = facets.find((f) => f.name.toLowerCase() === classification.facet!.name.toLowerCase());
    }
    return facet;
  };

  // Update category by ID (for CLOSED facets)
  const updateCategoryById = (index: number, categoryId: string, facet: Facet) => {
    const category = facet.categories.find((c) => c.id === categoryId);
    updateClassification(index, {
      categoryId: categoryId,
      category: category ? { id: category.id, name: category.name } : null,
      value: null,
    });
  };

  // Update value (for OPEN facets)
  const updateValue = (index: number, value: string) => {
    updateClassification(index, {
      categoryId: null,
      category: null,
      value: value,
    });
  };

  if (!classifications || classifications.length === 0) {
    return (
      <CardContent>
        <p className="text-sm text-muted-foreground">No classifications defined yet.</p>
      </CardContent>
    );
  }

  return (
    <CardContent className="space-y-4 pt-6">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Running classification analysis...
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classifications.map((classification, index) => {
          const { facetName, categoryOrValue } = getDisplayInfo(classification);
          const facet = findFacet(classification);
          const isConstrained =
            facet && facet.type === "CLOSED" && facet.categories && facet.categories.length > 0;

          // Generate unique IDs for accessibility and extensions
          const safeFacetName = facetName.replace(/[^a-zA-Z0-9]/g, "_");
          const categoryId = `classification_${index}_${safeFacetName}_category`;
          const confidenceId = `classification_${index}_${safeFacetName}_confidence`;
          const reasoningId = `classification_${index}_${safeFacetName}_reasoning`;

          return (
            <div
              key={index}
              className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors flex flex-col gap-4 h-full"
            >
              {/* Header: Facet Name */}
              <div className="flex items-center justify-between">
                <Label
                  className="text-xs font-bold uppercase text-muted-foreground tracking-wider line-clamp-1"
                  title={facetName}
                >
                  {facetName}
                </Label>
              </div>

              {/* Category Input (Select or Text) */}
              <div className="space-y-1.5 shrink-0">
                <Label htmlFor={categoryId} className="text-xs font-medium text-foreground/70">
                  Category
                </Label>
                {isConstrained ? (
                  <Select
                    value={classification.categoryId || ""}
                    onValueChange={(value) => updateCategoryById(index, value, facet!)}
                    disabled={disabled}
                    name={categoryId}
                  >
                    <SelectTrigger id={categoryId} className="w-full h-9 text-sm">
                      <SelectValue placeholder={categoryOrValue} />
                    </SelectTrigger>
                    <SelectContent>
                      {facet!.categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="text-sm">
                          {cat.name}
                        </SelectItem>
                      ))}
                      {/* Add "Not Applicable" option */}
                      <SelectItem value="not-applicable" className="text-sm">
                        Not Applicable
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      id={categoryId}
                      name={categoryId}
                      value={classification.value || categoryOrValue}
                      onChange={(e) => updateValue(index, e.target.value)}
                      disabled={disabled}
                      className="min-h-[60px] text-sm resize-none"
                      placeholder="Enter value..."
                      autoComplete="off"
                      data-lpignore="true"
                      data-form-type="other"
                    />
                    {!facet && (
                      <p className="text-[10px] text-muted-foreground">
                        Open Entry (Facet not found)
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Confidence Slider */}
              <div className="space-y-3 shrink-0">
                <div className="flex justify-between items-center">
                  <Label htmlFor={confidenceId} className="text-xs font-medium text-foreground/70">
                    Confidence
                  </Label>
                  <span
                    className={cn(
                      "text-xs font-mono font-medium",
                      classification.confidence > 0.8
                        ? "text-green-600"
                        : classification.confidence > 0.5
                          ? "text-yellow-600"
                          : "text-red-600",
                    )}
                  >
                    {(classification.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  id={confidenceId}
                  name={confidenceId}
                  value={[classification.confidence]}
                  onValueChange={(value) => updateClassification(index, { confidence: value[0] })}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                  disabled={disabled}
                />
              </div>

              {/* Reasoning Input */}
              <div className="flex-1 flex flex-col min-h-[100px]">
                <Label
                  htmlFor={reasoningId}
                  className="text-xs font-medium text-foreground/70 mb-1.5 block"
                >
                  Reasoning
                </Label>
                <Textarea
                  id={reasoningId}
                  name={reasoningId}
                  value={classification.reasoning || ""}
                  onChange={(e) => updateClassification(index, { reasoning: e.target.value })}
                  placeholder="Reasoning..."
                  disabled={disabled}
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  className="text-xs resize-none flex-1 bg-background/50 h-full min-h-[100px]"
                />
              </div>
            </div>
          );
        })}

      </div>
    </CardContent>
  );
}
