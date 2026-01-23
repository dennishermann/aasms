"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Trash2, AlertCircle, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { RecipeTypeSelector } from "./recipe-type-selector";
import { DimensionConfig } from "./dimension-config";
import type { RecipeFormProps } from "./types";
import type { RecipeStatus } from "@/types/recipe";

function StatusBadge({
  status,
  reason,
}: {
  status: RecipeStatus;
  reason?: string | null;
}) {
  switch (status) {
    case "VALID":
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Ready
        </Badge>
      );
    case "BLOCKED":
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          Blocked
        </Badge>
      );
    case "DRAFT":
    default:
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
          <Circle className="h-3 w-3 mr-1" />
          Draft
        </Badge>
      );
  }
}

export function RecipeForm({
  recipe,
  recipeKey,
  researchQuestions,
  facets,
  onUpdate,
  onDelete,
  isSaving,
}: RecipeFormProps) {
  const handleConfigUpdate = (key: string, value: any) => {
    onUpdate({
      config: {
        ...recipe.config,
        [key]: value,
      },
    });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header with Status and Delete */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <StatusBadge status={recipe.status} reason={recipe.statusReason} />
            <h2 className="text-xl font-semibold">
              {recipe.name || "Untitled Recipe"}
            </h2>
            {isSaving && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(recipeKey)}
            disabled={isSaving}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>

        {/* Status Warning */}
        {recipe.status === "BLOCKED" && recipe.statusReason && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Recipe blocked:</strong> {recipe.statusReason}
            </AlertDescription>
          </Alert>
        )}

        {/* Draft Status Info */}
        {recipe.status === "DRAFT" && recipe.statusReason && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Incomplete:</strong> {recipe.statusReason}
            </AlertDescription>
          </Alert>
        )}

        {/* Basic Info */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Recipe Name</Label>
            <Input
              id="name"
              value={recipe.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="e.g., Research Methods Distribution"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={recipe.description ?? ""}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Describe what this recipe answers..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Research Question</Label>
            <Select
              value={recipe.researchQuestionId ?? "__none__"}
              onValueChange={(v) => onUpdate({ researchQuestionId: v === "__none__" ? null : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Link to a research question (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No linked RQ</SelectItem>
                {researchQuestions.map((rq) => (
                  <SelectItem key={rq.id} value={rq.id}>
                    {rq.question.slice(0, 80)}
                    {rq.question.length > 80 ? "..." : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Recipe Type */}
        <RecipeTypeSelector
          value={recipe.type}
          onChange={(type) => onUpdate({ type })}
        />

        {/* Type-Specific Configuration */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="font-medium">Dimensions</h3>

          {/* DISTRIBUTION: Single dimension */}
          {recipe.type === "DISTRIBUTION" && (
            <DimensionConfig
              label="Dimension"
              value={recipe.xFacetId}
              onChange={(facetId) => onUpdate({ xFacetId: facetId })}
              facets={facets}
              placeholder="Select the facet to analyze"
            />
          )}

          {/* MAP: Two dimensions */}
          {recipe.type === "MAP" && (
            <>
              <DimensionConfig
                label="Row Dimension"
                value={recipe.xFacetId}
                onChange={(facetId) => onUpdate({ xFacetId: facetId })}
                facets={facets}
                placeholder="Select row facet"
              />
              <DimensionConfig
                label="Column Dimension"
                value={recipe.yFacetId}
                onChange={(facetId) => onUpdate({ yFacetId: facetId })}
                facets={facets}
                placeholder="Select column facet"
              />
            </>
          )}

          {/* TREND: Optional grouping */}
          {recipe.type === "TREND" && (
            <DimensionConfig
              label="Group By (optional)"
              value={recipe.groupByFacetId}
              onChange={(facetId) => onUpdate({ groupByFacetId: facetId })}
              facets={facets}
              placeholder="Group trends by facet (optional)"
            />
          )}

          {/* GAP: Threshold configuration */}
          {recipe.type === "GAP" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Gap Threshold</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={recipe.config.gapThreshold ?? 3}
                  onChange={(e) =>
                    handleConfigUpdate(
                      "gapThreshold",
                      parseInt(e.target.value) || 3
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Categories with this many sources or fewer will be flagged as gaps.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Visualization Preferences */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="font-medium">Visualization</h3>

          {recipe.type === "DISTRIBUTION" && (
            <div className="space-y-2">
              <Label>Chart Type</Label>
              <Select
                value={recipe.config.vizPreference?.chartType ?? "bar"}
                onValueChange={(v) =>
                  handleConfigUpdate("vizPreference", {
                    ...recipe.config.vizPreference,
                    chartType: v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar Chart</SelectItem>
                  <SelectItem value="pie">Pie Chart</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {recipe.type === "MAP" && (
            <div className="space-y-2">
              <Label>Chart Type</Label>
              <Select
                value={recipe.config.vizPreference?.chartType ?? "bubble"}
                onValueChange={(v) =>
                  handleConfigUpdate("vizPreference", {
                    ...recipe.config.vizPreference,
                    chartType: v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bubble">Bubble Plot</SelectItem>
                  <SelectItem value="heatmap">Heatmap</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
