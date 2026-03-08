"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Play,
  RefreshCw,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  XCircle,
  ChevronRight,
  Download,
  BarChart3,
  Grid3X3,
  TrendingUp,
  AlertTriangle,
  FlaskConical,
} from "lucide-react";
import { useRecipes, useRecipeBundle, useRunRecipe, useExportRecipe } from "@/hooks/use-recipes";
import type { RqRecipe, RqAnswerBundle, RunStatus, RecipeType } from "@/types/recipe";
import { AnswerViewer } from "./answer-viewer";

interface RqAnswersTabProps {
  studyId: string;
}

// Recipe type icons
const RECIPE_TYPE_ICONS: Record<RecipeType, typeof BarChart3> = {
  DISTRIBUTION: BarChart3,
  MAP: Grid3X3,
  TREND: TrendingUp,
  GAP: AlertTriangle,
};

const RECIPE_TYPE_LABELS: Record<RecipeType, string> = {
  DISTRIBUTION: "Distribution",
  MAP: "Systematic Map",
  TREND: "Trend Analysis",
  GAP: "Gap Analysis",
};

// Run status badge component
function RunStatusBadge({ status, isStale }: { status: RunStatus; isStale?: boolean }) {
  if (isStale) {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
        <Clock className="h-3 w-3 mr-1" />
        Stale
      </Badge>
    );
  }

  switch (status) {
    case "UP_TO_DATE":
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Up to date
        </Badge>
      );
    case "RUNNING":
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Running
        </Badge>
      );
    case "ERROR":
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      );
    case "NOT_RUN":
    default:
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
          <Clock className="h-3 w-3 mr-1" />
          Not run
        </Badge>
      );
  }
}

export function RqAnswersTab({ studyId }: RqAnswersTabProps) {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  // Fetch recipes
  const { data: recipes, isLoading: recipesLoading } = useRecipes(studyId);

  // Fetch bundle for selected recipe
  const { data: bundle, isLoading: bundleLoading } = useRecipeBundle(studyId, selectedRecipeId);

  // Run recipe mutation
  const runMutation = useRunRecipe(studyId);

  // Export recipe mutation
  const exportMutation = useExportRecipe(studyId);

  // Group recipes by research question
  const groupedRecipes = useMemo(() => {
    if (!recipes) return [];

    const groups: Array<{
      rqId: string | null;
      rqQuestion: string | null;
      recipes: RqRecipe[];
    }> = [];

    const rqMap = new Map<string | null, RqRecipe[]>();

    recipes.forEach((recipe) => {
      const key = recipe.researchQuestionId ?? null;
      if (!rqMap.has(key)) {
        rqMap.set(key, []);
      }
      rqMap.get(key)!.push(recipe);
    });

    // Sort groups: linked RQs first, then unlinked
    const sortedKeys = Array.from(rqMap.keys()).sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return 0;
    });

    sortedKeys.forEach((key) => {
      const groupRecipes = rqMap.get(key)!;
      const firstRecipe = groupRecipes[0];
      groups.push({
        rqId: key,
        rqQuestion: firstRecipe.researchQuestion?.question ?? null,
        recipes: groupRecipes.sort((a, b) => a.order - b.order),
      });
    });

    return groups;
  }, [recipes]);

  // Auto-select first recipe
  if (!selectedRecipeId && recipes && recipes.length > 0) {
    setSelectedRecipeId(recipes[0].id);
  }

  const handleRunRecipe = async (recipeId: string) => {
    try {
      await runMutation.mutateAsync(recipeId);
    } catch (error) {
      console.error("Failed to run recipe:", error);
    }
  };

  // Loading state
  if (recipesLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!recipes || recipes.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No RQ Recipes</h3>
          <p className="text-muted-foreground mb-4">
            Create recipes in Study Parameters to define how to answer your research questions.
          </p>
          <Button variant="outline" asChild>
            <a href={`/studies/${studyId}/parameters`}>Go to Parameters</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId);

  return (
    <div className="flex border rounded-lg overflow-hidden bg-background min-h-[600px]">
      {/* Left sidebar - Recipe list */}
      <div className="w-72 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">RQ Recipes</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {recipes.length} recipe{recipes.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {groupedRecipes.map((group) => (
            <div key={group.rqId ?? "unlinked"} className="border-b last:border-b-0">
              {/* Group header */}
              <div className="px-4 py-2 bg-muted/50">
                <p className="text-xs font-medium text-muted-foreground truncate">
                  {group.rqQuestion
                    ? group.rqQuestion.slice(0, 50) + (group.rqQuestion.length > 50 ? "..." : "")
                    : "Unlinked Recipes"}
                </p>
              </div>

              {/* Recipes in group */}
              {group.recipes.map((recipe) => {
                const TypeIcon = RECIPE_TYPE_ICONS[recipe.type];
                const isSelected = selectedRecipeId === recipe.id;
                const latestRun = recipe.latestRun;
                const runStatus = latestRun?.status ?? "NOT_RUN";

                return (
                  <button
                    key={recipe.id}
                    onClick={() => setSelectedRecipeId(recipe.id)}
                    className={`w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3 ${
                      isSelected ? "bg-muted" : ""
                    }`}
                  >
                    <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{recipe.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {RECIPE_TYPE_LABELS[recipe.type]}
                      </p>
                    </div>
                    {runStatus === "UP_TO_DATE" && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    )}
                    {runStatus === "ERROR" && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                    {runStatus === "RUNNING" && (
                      <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
                    )}
                    {isSelected && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - Answer viewer */}
      <div className="flex-1 overflow-y-auto">
        {selectedRecipe ? (
          <div className="p-6">
            {/* Recipe header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-semibold">{selectedRecipe.name}</h2>
                  <RunStatusBadge status={bundle?.status ?? "NOT_RUN"} isStale={bundle?.isStale} />
                </div>
                {selectedRecipe.description && (
                  <p className="text-sm text-muted-foreground mb-2">{selectedRecipe.description}</p>
                )}
                {selectedRecipe.researchQuestion && (
                  <p className="text-sm text-indigo-600">
                    Answers: {selectedRecipe.researchQuestion.question}
                  </p>
                )}
              </div>
              <Button
                onClick={() => handleRunRecipe(selectedRecipe.id)}
                disabled={runMutation.isPending || selectedRecipe.status !== "VALID"}
              >
                {runMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    {bundle?.status === "NOT_RUN" ? "Run Recipe" : "Re-run Recipe"}
                  </>
                )}
              </Button>
            </div>

            {/* Recipe status warning */}
            {selectedRecipe.status === "BLOCKED" && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {selectedRecipe.statusReason ?? "This recipe is blocked and cannot be run."}
                </AlertDescription>
              </Alert>
            )}

            {selectedRecipe.status === "DRAFT" && (
              <Alert className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This recipe is still in draft. Complete the configuration in Study Parameters
                  before running.
                </AlertDescription>
              </Alert>
            )}

            {/* Stale warning */}
            {bundle?.isStale && bundle.staleSince && (
              <Alert className="mb-6 border-amber-200 bg-amber-50">
                <Clock className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Results are stale. Data has changed since the last run. Re-run the recipe to
                  update results.
                </AlertDescription>
              </Alert>
            )}

            {/* Bundle loading */}
            {bundleLoading && (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            )}

            {/* Answer viewer */}
            {!bundleLoading && bundle && (
              <AnswerViewer
                bundle={bundle}
                studyId={studyId}
                onExport={async () => {
                  await exportMutation.mutateAsync(selectedRecipe.id);
                }}
                isExporting={exportMutation.isPending}
              />
            )}

            {/* Not run state */}
            {!bundleLoading && bundle?.status === "NOT_RUN" && (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <Play className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Recipe Not Run</h3>
                  <p className="text-muted-foreground mb-4">
                    Click &quot;Run Recipe&quot; to generate results.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Select a recipe to view results</p>
          </div>
        )}
      </div>
    </div>
  );
}
