"use client";

import { Button } from "@/components/ui/button";
import { Plus, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecipeListProps, LocalRecipe, ResearchQuestion } from "./types";
import type { RecipeType, RecipeStatus } from "@/types/recipe";

const RECIPE_TYPE_BADGES: Record<
  RecipeType,
  { label: string; className: string }
> = {
  DISTRIBUTION: { label: "Dist", className: "bg-blue-100 text-blue-700" },
  MAP: { label: "Map", className: "bg-emerald-100 text-emerald-700" },
  TREND: { label: "Trend", className: "bg-amber-100 text-amber-700" },
  GAP: { label: "Gap", className: "bg-rose-100 text-rose-700" },
};

function getStatusIcon(status: RecipeStatus) {
  switch (status) {
    case "VALID":
      return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
    case "BLOCKED":
      return <AlertTriangle className="h-3 w-3 text-amber-500" />;
    case "DRAFT":
    default:
      return <Circle className="h-3 w-3 text-gray-400" />;
  }
}

interface RecipeGroup {
  rqId: string | null;
  rqQuestion: string;
  recipes: LocalRecipe[];
}

function groupRecipesByRQ(
  recipes: LocalRecipe[],
  researchQuestions: ResearchQuestion[]
): RecipeGroup[] {
  const rqMap = new Map(researchQuestions.map((rq) => [rq.id, rq.question]));
  const groups: Map<string | null, LocalRecipe[]> = new Map();

  for (const recipe of recipes) {
    const key = recipe.researchQuestionId ?? null;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(recipe);
  }

  const result: RecipeGroup[] = [];

  // Add groups for each RQ that has recipes
  for (const [rqId, groupRecipes] of groups) {
    if (rqId) {
      result.push({
        rqId,
        rqQuestion: rqMap.get(rqId) ?? "Unknown RQ",
        recipes: groupRecipes,
      });
    }
  }

  // Sort by RQ order
  result.sort((a, b) => {
    const aIndex = researchQuestions.findIndex((rq) => rq.id === a.rqId);
    const bIndex = researchQuestions.findIndex((rq) => rq.id === b.rqId);
    return aIndex - bIndex;
  });

  // Add unlinked recipes at the end
  const unlinked = groups.get(null);
  if (unlinked && unlinked.length > 0) {
    result.push({
      rqId: null,
      rqQuestion: "Unlinked",
      recipes: unlinked,
    });
  }

  return result;
}

export function RecipeList({
  recipes,
  selectedRecipeKey,
  onSelectRecipe,
  onAddRecipe,
  getRecipeKey,
  researchQuestions,
}: RecipeListProps) {
  const groups = groupRecipesByRQ(recipes, researchQuestions);

  return (
    <div className="w-52 shrink-0 border-r bg-muted/30 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b">
        <h3 className="text-sm font-semibold text-muted-foreground">
          RQ Recipes
        </h3>
      </div>

      {/* Recipe Groups */}
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            No recipes yet
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.rqId ?? "unlinked"} className="py-2">
              {/* Group Header */}
              <div className="px-3 py-1 text-xs font-medium text-muted-foreground truncate">
                {group.rqId
                  ? `RQ: ${group.rqQuestion.slice(0, 30)}${
                      group.rqQuestion.length > 30 ? "..." : ""
                    }`
                  : "Unlinked"}
              </div>

              {/* Recipes in Group */}
              {group.recipes.map((recipe) => {
                const key = getRecipeKey(recipe);
                const isSelected = key === selectedRecipeKey;
                const typeBadge = RECIPE_TYPE_BADGES[recipe.type];

                return (
                  <button
                    key={key}
                    onClick={() => onSelectRecipe(key)}
                    className={cn(
                      "w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-muted/50 transition-colors",
                      isSelected && "bg-muted border-l-2 border-primary"
                    )}
                  >
                    {/* Status Icon */}
                    {getStatusIcon(recipe.status)}

                    {/* Type Badge */}
                    <span
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded",
                        typeBadge.className
                      )}
                    >
                      {typeBadge.label}
                    </span>

                    {/* Recipe Name */}
                    <span className="text-sm truncate flex-1">
                      {recipe.name || "Untitled"}
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Add Button */}
      <div className="p-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={onAddRecipe}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Recipe
        </Button>
      </div>
    </div>
  );
}
