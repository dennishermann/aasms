import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const criterionSchema = z.object({
  criterion: z.string(),
  fulfilled: z.boolean().optional(),
  decision: z.boolean().optional(),
  reasoning: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const inclusionExclusionSchema = z.object({
  inclusionRecommendation: z.boolean(),
  inclusionReasoning: z.string(),
  exclusionReasoning: z.string(),
  confidenceScore: z.number().min(0).max(1),
  relevanceScore: z.number().min(0).max(1).optional(),
  qualityNotes: z.string().optional(),
  inclusionCriteria: z.array(criterionSchema).optional(),
  exclusionCriteria: z.array(criterionSchema).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  try {
    const { id: studyId, sourceId } = await params;
    const body = await request.json();

    const validation = inclusionExclusionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 },
      );
    }

    const data = validation.data;
    const editedFields = Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);

    const source = await prisma.source.findFirst({
      where: { id: sourceId, studyId },
      include: { analysis: { include: { classifications: true } } },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    const inclusionCriteria = data.inclusionCriteria ?? source.analysis?.inclusionCriteria ?? [];
    const exclusionCriteria = data.exclusionCriteria ?? source.analysis?.exclusionCriteria ?? [];

    const analysis = source.analysis
      ? await prisma.sourceAnalysis.update({
          where: { id: source.analysis.id },
          data: {
            inclusionRecommendation: data.inclusionRecommendation,
            inclusionReasoning: data.inclusionReasoning,
            exclusionReasoning: data.exclusionReasoning,
            confidenceScore: data.confidenceScore,
            relevanceScore: data.relevanceScore,
            qualityNotes: data.qualityNotes,
            inclusionCriteria,
            exclusionCriteria,
            isUserEdited: true,
            editedFields,
          },
          include: { classifications: true },
        })
      : await prisma.sourceAnalysis.create({
          data: {
            sourceId,
            extractedText: "",
            inclusionRecommendation: data.inclusionRecommendation,
            inclusionReasoning: data.inclusionReasoning,
            exclusionReasoning: data.exclusionReasoning,
            confidenceScore: data.confidenceScore,
            relevanceScore: data.relevanceScore,
            qualityNotes: data.qualityNotes,
            inclusionCriteria,
            exclusionCriteria,
            isUserEdited: true,
            editedFields,
            classifications: {
              create: [],
            },
          },
          include: { classifications: true },
        });

    await prisma.source.update({
      where: { id: sourceId },
      data: { status: data.inclusionRecommendation ? "INCLUDED" : "EXCLUDED" },
    });

    return NextResponse.json({
      data: {
        ...analysis,
        inclusionCriteria,
        exclusionCriteria,
      },
    });
  } catch (error) {
    console.error("Error saving inclusion/exclusion:", error);
    return NextResponse.json({ error: "Failed to save inclusion/exclusion" }, { status: 500 });
  }
}
