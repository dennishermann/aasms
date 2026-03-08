import { NextRequest, NextResponse } from "next/server";
import { getMappingTableData } from "@/lib/services/analysis";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Parse optional facetIds
    const facetIdsParam = searchParams.get("facetIds");
    const facetIds = facetIdsParam ? facetIdsParam.split(",").filter(Boolean) : undefined;

    // Parse optional includeMetadata
    const metadataParam = searchParams.get("includeMetadata");
    const includeMetadata = metadataParam
      ? (metadataParam.split(",").filter(Boolean) as (
          | "title"
          | "authors"
          | "year"
          | "venue"
          | "sourceType"
        )[])
      : undefined;

    // Parse pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);

    if (isNaN(page) || page < 1) {
      return NextResponse.json(
        { error: "Invalid page parameter (must be a positive integer)" },
        { status: 400 },
      );
    }

    if (isNaN(pageSize) || pageSize < 1 || pageSize > 200) {
      return NextResponse.json(
        { error: "Invalid pageSize parameter (must be between 1 and 200)" },
        { status: 400 },
      );
    }

    // Parse sorting
    const sortBy = searchParams.get("sortBy") || "title";
    const sortOrder = (searchParams.get("sortOrder") || "asc") as "asc" | "desc";

    const validSortFields = ["title", "year", "venue"];
    if (!validSortFields.includes(sortBy)) {
      return NextResponse.json(
        { error: `Invalid sortBy parameter (must be one of: ${validSortFields.join(", ")})` },
        { status: 400 },
      );
    }

    const result = await getMappingTableData(studyId, {
      facetIds,
      includeMetadata,
      page,
      pageSize,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Error getting mapping table data:", error);
    return NextResponse.json(
      {
        error: "Failed to get mapping table data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
