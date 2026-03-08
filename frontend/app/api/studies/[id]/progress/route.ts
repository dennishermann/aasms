import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studyId } = await params;

    // Count sources by status
    const [
      totalSources,
      includedSources,
      excludedSources,
      classifiedSources,
      sourcesWithPdf,
      sourcesNeedingPdf,
      pendingSources,
      totalRecipes,
      recipesWithRuns,
    ] = await Promise.all([
      prisma.source.count({ where: { studyId } }),
      prisma.source.count({
        where: { studyId, finalDecision: "INCLUDE" },
      }),
      prisma.source.count({
        where: { studyId, finalDecision: "EXCLUDE" },
      }),
      prisma.source.count({
        where: { studyId, status: "CLASSIFIED" },
      }),
      prisma.source.count({
        where: { studyId, hasPdf: true },
      }),
      prisma.source.count({
        where: { studyId, needsPdf: true },
      }),
      prisma.source.count({
        where: { studyId, status: "PENDING" },
      }),
      prisma.rqRecipe.count({
        where: { studyId },
      }),
      prisma.rqRecipe.count({
        where: { studyId, runs: { some: {} } },
      }),
    ]);

    // Analyzed sources = included + excluded (screened)
    const analyzedSources = includedSources + excludedSources;

    return NextResponse.json({
      data: {
        totalSources,
        sourcesWithPdf,
        sourcesNeedingPdf,
        pendingSources,
        analyzedSources,
        includedSources,
        excludedSources,
        classifiedSources,
        totalRecipes,
        recipesRun: recipesWithRuns,
      },
    });
  } catch (error) {
    console.error("Error getting progress data:", error);
    return NextResponse.json(
      { error: "Failed to get progress data" },
      { status: 500 }
    );
  }
}
