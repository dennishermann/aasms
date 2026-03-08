import { NextRequest, NextResponse } from "next/server";
import { getTimeSeriesData } from "@/lib/services/analysis";
import type { DimensionConfig, Filter } from "@/types/analysis";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Parse optional groupBy dimension
    let groupBy: DimensionConfig | undefined;
    const groupByParam = searchParams.get("groupBy");
    if (groupByParam) {
      try {
        groupBy = JSON.parse(groupByParam);
      } catch {
        return NextResponse.json(
          { error: "Invalid groupBy parameter (must be valid JSON)" },
          { status: 400 },
        );
      }

      // Validate groupBy
      if (groupBy && !groupBy.type) {
        return NextResponse.json({ error: "groupBy.type is required" }, { status: 400 });
      }

      if (groupBy && groupBy.type === "facet" && !groupBy.facetId) {
        return NextResponse.json(
          { error: "groupBy.facetId is required when type is 'facet'" },
          { status: 400 },
        );
      }
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

    const result = await getTimeSeriesData(studyId, groupBy, filters);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Error getting timeseries data:", error);
    return NextResponse.json(
      {
        error: "Failed to get time series data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
