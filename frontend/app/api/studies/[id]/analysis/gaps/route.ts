import { NextRequest, NextResponse } from "next/server";
import { getGapAnalysis } from "@/lib/services/analysis";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studyId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Parse optional threshold
    const thresholdParam = searchParams.get("threshold");
    const threshold = thresholdParam ? parseInt(thresholdParam, 10) : 3;

    if (isNaN(threshold) || threshold < 0) {
      return NextResponse.json(
        { error: "Invalid threshold parameter (must be a non-negative integer)" },
        { status: 400 }
      );
    }

    // Parse optional facetIds
    const facetIdsParam = searchParams.get("facetIds");
    const facetIds = facetIdsParam ? facetIdsParam.split(",").filter(Boolean) : undefined;

    const result = await getGapAnalysis(studyId, threshold, facetIds);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Error getting gap analysis:", error);
    return NextResponse.json(
      {
        error: "Failed to get gap analysis",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
