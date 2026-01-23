import { NextRequest, NextResponse } from "next/server";
import { executeRecipe } from "@/lib/services/recipe";

/**
 * POST /api/studies/[id]/recipes/[recipeId]/run
 * Execute a recipe and create a new run with results.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recipeId: string }> }
) {
  try {
    const { recipeId } = await params;

    const result = await executeRecipe(recipeId);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Error executing recipe:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to execute recipe" },
      { status: 500 }
    );
  }
}
