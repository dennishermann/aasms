import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studyId } = await params;

    // Aggregate statistics from import batches
    const batches = await prisma.importBatch.findMany({
      where: { studyId },
      orderBy: { startedAt: "desc" },
    });

    const sources = await prisma.source.findMany({
      where: { studyId },
      select: {
        status: true,
        finalDecision: true,
        needsPdf: true,
        sourceOrigins: true,
      },
    });

    // Calculate statistics
    const stats = {
      totalImports: batches.length,
      totalRecords: batches.reduce((sum, b) => sum + b.totalRecords, 0),
      duplicates: batches.reduce((sum, b) => sum + b.duplicates, 0),
      uniqueSources: sources.length,
      relevant:
        sources.filter(
          (s) => s.finalDecision === "INCLUDE" || s.status === "INCLUDED"
        ).length,
      irrelevant: sources.filter((s) => s.finalDecision === "EXCLUDE").length,
      pending: sources.filter((s) => !s.finalDecision).length,
      needsPdf: sources.filter((s) => s.needsPdf).length,
      multipleOrigins: sources.filter((s) => s.sourceOrigins.length > 1).length,
      byDatabase: {} as Record<string, number>,
      lastImport: batches.length > 0 ? batches[0].startedAt.toISOString() : null,
    };

    // Count by database
    for (const source of sources) {
      for (const origin of source.sourceOrigins) {
        stats.byDatabase[origin] = (stats.byDatabase[origin] || 0) + 1;
      }
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching statistics:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch statistics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
