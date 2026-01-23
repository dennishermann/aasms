import { NextRequest, NextResponse } from "next/server";
import { getAnswerBundle } from "@/lib/services/recipe";

/**
 * GET /api/studies/[id]/recipes/[recipeId]/bundle
 * Get the answer bundle for a recipe (recipe + latest run + staleness status).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recipeId: string }> }
) {
  try {
    const { recipeId } = await params;

    const bundle = await getAnswerBundle(recipeId);

    return NextResponse.json({ data: bundle });
  } catch (error) {
    console.error("Error getting answer bundle:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get answer bundle" },
      { status: 500 }
    );
  }
}
