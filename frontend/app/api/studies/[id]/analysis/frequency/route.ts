import { NextRequest, NextResponse } from "next/server";
import { getFrequencyData } from "@/lib/services/analysis";
import type { DimensionConfig, Filter } from "@/types/analysis";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studyId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Parse dimension from query params
    const dimensionParam = searchParams.get("dimension");
    if (!dimensionParam) {
      return NextResponse.json(
        { error: "dimension parameter is required" },
        { status: 400 }
      );
    }

    let dimension: DimensionConfig;
    try {
      dimension = JSON.parse(dimensionParam);
    } catch {
      return NextResponse.json(
        { error: "Invalid dimension parameter (must be valid JSON)" },
        { status: 400 }
      );
    }

    // Validate dimension
    if (!dimension.type) {
      return NextResponse.json(
        { error: "dimension.type is required" },
        { status: 400 }
      );
    }

    if (dimension.type === "facet" && !dimension.facetId) {
      return NextResponse.json(
        { error: "dimension.facetId is required when type is 'facet'" },
        { status: 400 }
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
          { status: 400 }
        );
      }
    }

    const result = await getFrequencyData(studyId, dimension, filters);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Error getting frequency data:", error);
    return NextResponse.json(
      {
        error: "Failed to get frequency data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
