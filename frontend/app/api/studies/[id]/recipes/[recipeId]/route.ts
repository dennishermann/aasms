import { NextRequest, NextResponse } from "next/server";
import { getRecipe, updateRecipe, deleteRecipe } from "@/lib/services/recipe";
import type { UpdateRecipeInput } from "@/types/recipe";

/**
 * GET /api/studies/[id]/recipes/[recipeId]
 * Get a single recipe by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recipeId: string }> }
) {
  try {
    const { recipeId } = await params;
    const recipe = await getRecipe(recipeId);

    if (!recipe) {
      return NextResponse.json(
        { error: "Recipe not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: recipe });
  } catch (error) {
    console.error("Error getting recipe:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get recipe" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/studies/[id]/recipes/[recipeId]
 * Update a recipe.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recipeId: string }> }
) {
  try {
    const { recipeId } = await params;
    const body: UpdateRecipeInput = await request.json();

    const recipe = await updateRecipe(recipeId, body);

    return NextResponse.json({ data: recipe });
  } catch (error) {
    console.error("Error updating recipe:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update recipe" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/studies/[id]/recipes/[recipeId]
 * Delete a recipe and all its runs.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recipeId: string }> }
) {
  try {
    const { recipeId } = await params;

    await deleteRecipe(recipeId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting recipe:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete recipe" },
      { status: 500 }
    );
  }
}
