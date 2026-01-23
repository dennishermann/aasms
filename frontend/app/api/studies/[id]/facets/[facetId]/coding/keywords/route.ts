import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string; facetId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: studyId, facetId } = await params;

    const facet = await prisma.facet.findFirst({
      where: { id: facetId, studyId },
    });
    if (!facet) {
      return NextResponse.json({ error: "Facet not found" }, { status: 404 });
    }

    const keywords = await prisma.facetKeyword.findMany({
      where: { facetId },
      select: {
        keyword: true,
        analysisId: true,
      },
    });

    const counts: Record<string, number> = {};
    for (const item of keywords) {
      counts[item.keyword] = (counts[item.keyword] || 0) + 1;
    }

    return NextResponse.json({
      data: Object.entries(counts).map(([keyword, count]) => ({
        keyword,
        count,
      })),
    });
  } catch (error) {
    console.error("[coding/keywords] Error:", error);
    return NextResponse.json({ error: "Failed to fetch keywords" }, { status: 500 });
  }
}
