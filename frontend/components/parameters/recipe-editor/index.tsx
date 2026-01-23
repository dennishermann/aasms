"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RecipeList } from "./recipe-list";
import { RecipeForm } from "./recipe-form";
import type { RecipeEditorProps, LocalRecipe } from "./types";
import type { RecipeType, RqRecipe } from "@/types/recipe";
import {
  useCreateRecipe,
  useUpdateRecipe,
  useDeleteRecipe,
} from "@/hooks/use-recipes";

// Re-export types
export type { LocalRecipe } from "./types";

function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyRecipe(order: number): LocalRecipe {
  return {
    tempId: generateTempId(),
    name: "",
    type: "DISTRIBUTION" as RecipeType,
    config: {},
    status: "DRAFT",
    order,
  };
}

// Convert API recipe to local recipe format
function apiToLocalRecipe(recipe: RqRecipe): LocalRecipe {
  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description ?? undefined,
    researchQuestionId: recipe.researchQuestionId,
    type: recipe.type,
    xFacetId: recipe.xFacetId,
    yFacetId: recipe.yFacetId,
    groupByFacetId: recipe.groupByFacetId,
    config: recipe.config,
    status: recipe.status,
    statusReason: recipe.statusReason,
    order: recipe.order,
  };
}

export function RecipeEditor({
  studyId,
  recipes,
  facets,
  researchQuestions,
}: RecipeEditorProps) {
  const [selectedRecipeKey, setSelectedRecipeKey] = useState<string | null>(null);
  const [pendingRecipe, setPendingRecipe] = useState<LocalRecipe | null>(null);

  // Mutations
  const createMutation = useCreateRecipe(studyId);
  const updateMutation = useUpdateRecipe(studyId);
  const deleteMutation = useDeleteRecipe(studyId);

  // Convert API recipes to local format
  const localRecipes: LocalRecipe[] = useMemo(() => {
    const converted = recipes.map(apiToLocalRecipe);
    // Add pending recipe if it exists
    if (pendingRecipe) {
      return [...converted, pendingRecipe];
    }
    return converted;
  }, [recipes, pendingRecipe]);

  // Get unique key for a recipe
  const getRecipeKey = useCallback((recipe: LocalRecipe): string => {
    return recipe.id ?? recipe.tempId ?? "";
  }, []);

  // Auto-select first recipe when list changes
  useEffect(() => {
    if (localRecipes.length > 0 && !selectedRecipeKey) {
      setSelectedRecipeKey(getRecipeKey(localRecipes[0]));
    } else if (localRecipes.length === 0) {
      setSelectedRecipeKey(null);
    } else if (
      selectedRecipeKey &&
      !localRecipes.find((r) => getRecipeKey(r) === selectedRecipeKey)
    ) {
      // Selected recipe was deleted, select first one
      setSelectedRecipeKey(localRecipes.length > 0 ? getRecipeKey(localRecipes[0]) : null);
    }
  }, [localRecipes, selectedRecipeKey, getRecipeKey]);

  // Add new recipe (creates pending local recipe)
  const handleAddRecipe = useCallback(() => {
    const newRecipe = createEmptyRecipe(localRecipes.length);
    setPendingRecipe(newRecipe);
    setSelectedRecipeKey(getRecipeKey(newRecipe));
  }, [localRecipes.length, getRecipeKey]);

  // Update a recipe
  const handleUpdateRecipe = useCallback(
    async (key: string, updates: Partial<LocalRecipe>) => {
      // Check if this is the pending recipe
      if (pendingRecipe && getRecipeKey(pendingRecipe) === key) {
        const updatedPending = { ...pendingRecipe, ...updates };
        setPendingRecipe(updatedPending);

        // If name is now set, save to API
        if (updatedPending.name.trim()) {
          try {
            const created = await createMutation.mutateAsync({
              name: updatedPending.name,
              description: updatedPending.description,
              researchQuestionId: updatedPending.researchQuestionId ?? undefined,
              type: updatedPending.type,
              xFacetId: updatedPending.xFacetId ?? undefined,
              yFacetId: updatedPending.yFacetId ?? undefined,
              groupByFacetId: updatedPending.groupByFacetId ?? undefined,
              config: updatedPending.config,
            });
            // Clear pending and select the new recipe
            setPendingRecipe(null);
            setSelectedRecipeKey(created.id);
          } catch (error) {
            console.error("Failed to create recipe:", error);
          }
        }
        return;
      }

      // Update existing recipe via API
      const recipe = localRecipes.find((r) => getRecipeKey(r) === key);
      if (recipe?.id) {
        try {
          await updateMutation.mutateAsync({
            recipeId: recipe.id,
            input: {
              name: updates.name ?? recipe.name,
              description: updates.description ?? recipe.description,
              researchQuestionId: updates.researchQuestionId !== undefined
                ? updates.researchQuestionId
                : recipe.researchQuestionId,
              type: updates.type ?? recipe.type,
              xFacetId: updates.xFacetId !== undefined ? updates.xFacetId : recipe.xFacetId,
              yFacetId: updates.yFacetId !== undefined ? updates.yFacetId : recipe.yFacetId,
              groupByFacetId: updates.groupByFacetId !== undefined
                ? updates.groupByFacetId
                : recipe.groupByFacetId,
              config: updates.config ?? recipe.config,
            },
          });
        } catch (error) {
          console.error("Failed to update recipe:", error);
        }
      }
    },
    [localRecipes, pendingRecipe, getRecipeKey, createMutation, updateMutation]
  );

  // Delete a recipe
  const handleDeleteRecipe = useCallback(
    async (key: string) => {
      // Check if this is the pending recipe
      if (pendingRecipe && getRecipeKey(pendingRecipe) === key) {
        setPendingRecipe(null);
        // Select next recipe
        if (recipes.length > 0) {
          setSelectedRecipeKey(recipes[0].id);
        } else {
          setSelectedRecipeKey(null);
        }
        return;
      }

      // Delete existing recipe via API
      const recipe = localRecipes.find((r) => getRecipeKey(r) === key);
      if (recipe?.id) {
        try {
          await deleteMutation.mutateAsync(recipe.id);
        } catch (error) {
          console.error("Failed to delete recipe:", error);
        }
      }
    },
    [localRecipes, pendingRecipe, recipes, getRecipeKey, deleteMutation]
  );

  // Find selected recipe
  const selectedRecipe = localRecipes.find(
    (r) => getRecipeKey(r) === selectedRecipeKey
  );

  // Check if any mutation is pending
  const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  // Empty state: no research questions
  if (researchQuestions.length === 0) {
    return (
      <div className="flex border rounded-lg overflow-hidden bg-background min-h-[500px] items-center justify-center">
        <div className="text-center p-8">
          <h3 className="font-medium mb-2">No Research Questions</h3>
          <p className="text-sm text-muted-foreground">
            Please add research questions first before creating recipes.
          </p>
        </div>
      </div>
    );
  }

  // Empty state: no facets
  if (facets.length === 0) {
    return (
      <div className="flex border rounded-lg overflow-hidden bg-background min-h-[500px] items-center justify-center">
        <div className="text-center p-8">
          <h3 className="font-medium mb-2">No Classification Facets</h3>
          <p className="text-sm text-muted-foreground">
            Please add facets to the classification schema before creating recipes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex border rounded-lg overflow-hidden bg-background min-h-[500px]">
      {/* Sidebar */}
      <RecipeList
        recipes={localRecipes}
        selectedRecipeKey={selectedRecipeKey}
        onSelectRecipe={setSelectedRecipeKey}
        onAddRecipe={handleAddRecipe}
        getRecipeKey={getRecipeKey}
        researchQuestions={researchQuestions}
      />

      {/* Main Editor Panel */}
      {selectedRecipe ? (
        <RecipeForm
          recipe={selectedRecipe}
          recipeKey={selectedRecipeKey!}
          researchQuestions={researchQuestions}
          facets={facets}
          onUpdate={(updates) =>
            handleUpdateRecipe(selectedRecipeKey!, updates)
          }
          onDelete={handleDeleteRecipe}
          isSaving={isSaving}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p>Select a recipe to edit or add a new one</p>
          </div>
        </div>
      )}
    </div>
  );
}
