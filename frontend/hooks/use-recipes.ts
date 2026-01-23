"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  RqRecipe,
  RqAnswerBundle,
  CreateRecipeInput,
  UpdateRecipeInput,
  RqRun,
} from "@/types/recipe";

// ============ Fetch Functions ============

async function fetchRecipes(studyId: string): Promise<RqRecipe[]> {
  const response = await fetch(`/api/studies/${studyId}/recipes`);
  if (!response.ok) {
    throw new Error("Failed to fetch recipes");
  }
  const data = await response.json();
  return data.data;
}

async function fetchRecipe(
  studyId: string,
  recipeId: string
): Promise<RqRecipe> {
  const response = await fetch(`/api/studies/${studyId}/recipes/${recipeId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch recipe");
  }
  const data = await response.json();
  return data.data;
}

async function fetchRecipeBundle(
  studyId: string,
  recipeId: string
): Promise<RqAnswerBundle> {
  const response = await fetch(
    `/api/studies/${studyId}/recipes/${recipeId}/bundle`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch recipe bundle");
  }
  const data = await response.json();
  return data.data;
}

async function createRecipe(
  studyId: string,
  input: CreateRecipeInput
): Promise<RqRecipe> {
  const response = await fetch(`/api/studies/${studyId}/recipes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error ?? "Failed to create recipe");
  }
  const data = await response.json();
  return data.data;
}

async function updateRecipe(
  studyId: string,
  recipeId: string,
  input: UpdateRecipeInput
): Promise<RqRecipe> {
  const response = await fetch(`/api/studies/${studyId}/recipes/${recipeId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error ?? "Failed to update recipe");
  }
  const data = await response.json();
  return data.data;
}

async function deleteRecipe(studyId: string, recipeId: string): Promise<void> {
  const response = await fetch(`/api/studies/${studyId}/recipes/${recipeId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error ?? "Failed to delete recipe");
  }
}

async function runRecipe(
  studyId: string,
  recipeId: string
): Promise<{ run: RqRun; isNew: boolean }> {
  const response = await fetch(
    `/api/studies/${studyId}/recipes/${recipeId}/run`,
    {
      method: "POST",
    }
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error ?? "Failed to run recipe");
  }
  const data = await response.json();
  return data.data;
}

// ============ Query Hooks ============

/**
 * Get all recipes for a study.
 */
export function useRecipes(studyId: string) {
  return useQuery({
    queryKey: ["recipes", studyId],
    queryFn: () => fetchRecipes(studyId),
    enabled: !!studyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get a single recipe.
 */
export function useRecipe(studyId: string, recipeId: string | null) {
  return useQuery({
    queryKey: ["recipe", studyId, recipeId],
    queryFn: () => fetchRecipe(studyId, recipeId!),
    enabled: !!studyId && !!recipeId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get answer bundle for a recipe.
 */
export function useRecipeBundle(studyId: string, recipeId: string | null) {
  return useQuery({
    queryKey: ["recipe-bundle", studyId, recipeId],
    queryFn: () => fetchRecipeBundle(studyId, recipeId!),
    enabled: !!studyId && !!recipeId,
    staleTime: 60 * 1000, // 1 minute (check staleness more frequently)
  });
}

// ============ Mutation Hooks ============

/**
 * Create a new recipe.
 */
export function useCreateRecipe(studyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRecipeInput) => createRecipe(studyId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes", studyId] });
    },
  });
}

/**
 * Update a recipe.
 */
export function useUpdateRecipe(studyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      input,
    }: {
      recipeId: string;
      input: UpdateRecipeInput;
    }) => updateRecipe(studyId, recipeId, input),
    onSuccess: (data, { recipeId }) => {
      queryClient.invalidateQueries({ queryKey: ["recipes", studyId] });
      queryClient.invalidateQueries({
        queryKey: ["recipe", studyId, recipeId],
      });
      queryClient.invalidateQueries({
        queryKey: ["recipe-bundle", studyId, recipeId],
      });
    },
  });
}

/**
 * Delete a recipe.
 */
export function useDeleteRecipe(studyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipeId: string) => deleteRecipe(studyId, recipeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes", studyId] });
    },
  });
}

/**
 * Execute a recipe.
 */
export function useRunRecipe(studyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipeId: string) => runRecipe(studyId, recipeId),
    onSuccess: (data, recipeId) => {
      queryClient.invalidateQueries({ queryKey: ["recipes", studyId] });
      queryClient.invalidateQueries({
        queryKey: ["recipe-bundle", studyId, recipeId],
      });
    },
  });
}

/**
 * Export a recipe run as a ZIP bundle.
 */
export function useExportRecipe(studyId: string) {
  return useMutation({
    mutationFn: async (recipeId: string) => {
      const response = await fetch(
        `/api/studies/${studyId}/recipes/${recipeId}/export`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? "Failed to export recipe");
      }

      // Get filename from content-disposition header
      const contentDisposition = response.headers.get("content-disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? "recipe_export.zip";

      // Get blob and trigger download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true, filename };
    },
  });
}
