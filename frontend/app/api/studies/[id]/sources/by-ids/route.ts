import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/studies/[id]/sources/by-ids?ids=id1,id2,id3
 * Fetch multiple sources by their IDs for drilldown functionality
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;
    const idsParam = request.nextUrl.searchParams.get("ids");

    if (!idsParam || idsParam.trim() === "") {
      return NextResponse.json({ error: "ids parameter is required" }, { status: 400 });
    }

    const ids = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json({ data: { sources: [] } });
    }

    // Limit to prevent abuse
    if (ids.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 source IDs allowed per request" },
        { status: 400 },
      );
    }

    const sources = await prisma.source.findMany({
      where: {
        id: { in: ids },
        studyId,
      },
      select: {
        id: true,
        title: true,
        authors: true,
        publicationDate: true,
        venue: true,
        sourceCategory: true,
        abstract: true,
        doi: true,
      },
      orderBy: {
        title: "asc",
      },
    });

    return NextResponse.json({
      data: {
        sources,
      },
    });
  } catch (error) {
    console.error("Error fetching sources by IDs:", error);
    return NextResponse.json({ error: "Failed to fetch sources" }, { status: 500 });
  }
}
