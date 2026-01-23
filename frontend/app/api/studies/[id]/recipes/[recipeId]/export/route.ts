import { NextRequest, NextResponse } from "next/server";
import { exportRecipeBundle, type ExportOptions } from "@/lib/services/recipe/export-service";

/**
 * POST /api/studies/[id]/recipes/[recipeId]/export
 * Export a recipe run as a ZIP bundle.
 *
 * Request body (optional):
 * {
 *   includeRecipe?: boolean;
 *   includeData?: boolean;
 *   includeSources?: boolean;
 *   includeFigureSpec?: boolean;
 *   includeReport?: boolean;
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recipeId: string }> }
) {
  try {
    const { recipeId } = await params;

    // Parse optional export options from body
    let options: ExportOptions = {};
    try {
      const body = await request.json();
      options = {
        includeRecipe: body.includeRecipe,
        includeData: body.includeData,
        includeSources: body.includeSources,
        includeFigureSpec: body.includeFigureSpec,
        includeReport: body.includeReport,
      };
    } catch {
      // If no body or parse error, use defaults
    }

    const { data, filename } = await exportRecipeBundle(recipeId, options);

    // Return ZIP file as binary response
    // Convert Buffer to Uint8Array for NextResponse compatibility
    const uint8Array = new Uint8Array(data);
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(data.length),
      },
    });
  } catch (error) {
    console.error("Error exporting recipe:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export recipe" },
      { status: 500 }
    );
  }
}
