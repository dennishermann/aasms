import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const classificationSchema = z.object({
  facetName: z.string(),
  category: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
  isManualOverride: z.boolean().optional(),
});

const classificationsPayloadSchema = z.object({
  classifications: z.array(classificationSchema),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { id: studyId, sourceId } = await params;
    const body = await request.json();

    const validation = classificationsPayloadSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;
    const editedFields = ["classifications"];

    const source = await prisma.source.findFirst({
      where: { id: sourceId, studyId },
      include: { analysis: true },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    const analysis = source.analysis
      ? await prisma.sourceAnalysis.update({
          where: { id: source.analysis.id },
          data: {
            classifications: {
              deleteMany: {},
              create: data.classifications.map((c) => ({
                facetName: c.facetName,
                category: c.category,
                confidence: c.confidence,
                reasoning: c.reasoning,
                isManualOverride: c.isManualOverride ?? true,
              })),
            },
            isUserEdited: true,
            editedFields,
          },
          include: { classifications: true },
        })
      : await prisma.sourceAnalysis.create({
          data: {
            sourceId,
            extractedText: "",
            inclusionRecommendation: false,
            inclusionReasoning: "",
            exclusionReasoning: "",
            confidenceScore: 0.5,
            relevanceScore: null,
            qualityNotes: null,
            inclusionCriteria: [],
            exclusionCriteria: [],
            classifications: {
              create: data.classifications.map((c) => ({
                facetName: c.facetName,
                category: c.category,
                confidence: c.confidence,
                reasoning: c.reasoning,
                isManualOverride: c.isManualOverride ?? true,
              })),
            },
            isUserEdited: true,
            editedFields,
          },
          include: { classifications: true },
        });

    return NextResponse.json({ data: analysis });
  } catch (error) {
    console.error("Error saving classifications:", error);
    return NextResponse.json({ error: "Failed to save classifications" }, { status: 500 });
  }
}




