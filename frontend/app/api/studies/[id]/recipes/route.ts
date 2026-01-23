import { NextRequest, NextResponse } from "next/server";
import { listRecipes, createRecipe } from "@/lib/services/recipe";
import type { CreateRecipeInput } from "@/types/recipe";

/**
 * GET /api/studies/[id]/recipes
 * List all recipes for a study with their latest run status.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studyId } = await params;
    const recipes = await listRecipes(studyId);

    return NextResponse.json({ data: recipes });
  } catch (error) {
    console.error("Error listing recipes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list recipes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/studies/[id]/recipes
 * Create a new recipe.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studyId } = await params;
    const body: CreateRecipeInput = await request.json();

    // Validate required fields
    if (!body.name || !body.type) {
      return NextResponse.json(
        { error: "name and type are required" },
        { status: 400 }
      );
    }

    const recipe = await createRecipe(studyId, body);

    return NextResponse.json({ data: recipe }, { status: 201 });
  } catch (error) {
    console.error("Error creating recipe:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create recipe" },
      { status: 500 }
    );
  }
}
