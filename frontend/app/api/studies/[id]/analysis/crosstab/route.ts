import { NextRequest, NextResponse } from "next/server";
import { getCrossTabData } from "@/lib/services/analysis";
import type { DimensionConfig, Filter } from "@/types/analysis";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Parse row dimension
    const rowDimensionParam = searchParams.get("rowDimension");
    if (!rowDimensionParam) {
      return NextResponse.json({ error: "rowDimension parameter is required" }, { status: 400 });
    }

    let rowDimension: DimensionConfig;
    try {
      rowDimension = JSON.parse(rowDimensionParam);
    } catch {
      return NextResponse.json(
        { error: "Invalid rowDimension parameter (must be valid JSON)" },
        { status: 400 },
      );
    }

    // Parse col dimension
    const colDimensionParam = searchParams.get("colDimension");
    if (!colDimensionParam) {
      return NextResponse.json({ error: "colDimension parameter is required" }, { status: 400 });
    }

    let colDimension: DimensionConfig;
    try {
      colDimension = JSON.parse(colDimensionParam);
    } catch {
      return NextResponse.json(
        { error: "Invalid colDimension parameter (must be valid JSON)" },
        { status: 400 },
      );
    }

    // Validate dimensions
    if (!rowDimension.type || !colDimension.type) {
      return NextResponse.json({ error: "Both dimensions must have a type" }, { status: 400 });
    }

    if (rowDimension.type === "facet" && !rowDimension.facetId) {
      return NextResponse.json(
        { error: "rowDimension.facetId is required when type is 'facet'" },
        { status: 400 },
      );
    }

    if (colDimension.type === "facet" && !colDimension.facetId) {
      return NextResponse.json(
        { error: "colDimension.facetId is required when type is 'facet'" },
        { status: 400 },
      );
    }

    // Parse optional filters
    let filters: Filter[] | undefined;
    const filtersParam = searchParams.get("filters");
    if (filtersParam) {
      try {
        filters = JSON.parse(filtersParam);
      } catch {
        return NextResponse.json(
          { error: "Invalid filters parameter (must be valid JSON array)" },
          { status: 400 },
        );
      }
    }

    const result = await getCrossTabData(studyId, rowDimension, colDimension, filters);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Error getting crosstab data:", error);
    return NextResponse.json(
      {
        error: "Failed to get cross-tabulation data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
