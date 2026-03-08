import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

// Updated schema to use facetId and categoryId instead of facetName/category
const classificationSchema = z.object({
  facetId: z.string(),
  categoryId: z.string().optional().nullable(), // null for OPEN facets
  value: z.string().optional().nullable(), // For OPEN facets
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
  isManualOverride: z.boolean().optional(),
});

const classificationsPayloadSchema = z.object({
  classifications: z.array(classificationSchema),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  try {
    const { id: studyId, sourceId } = await params;
    const body = await request.json();

    const validation = classificationsPayloadSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 },
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

    const facetIds = data.classifications.map((c) => c.facetId).filter(Boolean);
    const hasClassifications = data.classifications.length > 0;
    const classificationsUpdate = hasClassifications
      ? {
          deleteMany: { facetId: { in: facetIds } },
          create: data.classifications.map((c) => ({
            facetId: c.facetId,
            categoryId: c.categoryId ?? null,
            value: c.value ?? null,
            confidence: c.confidence,
            reasoning: c.reasoning,
            isManualOverride: c.isManualOverride ?? true,
          })),
        }
      : undefined;

    const analysis = source.analysis
      ? await prisma.sourceAnalysis.update({
          where: { id: source.analysis.id },
          data: {
            ...(classificationsUpdate ? { classifications: classificationsUpdate } : {}),
            isUserEdited: true,
            editedFields,
          },
          include: {
            classifications: {
              include: {
                facet: true,
                category: true,
              },
            },
          },
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
                facetId: c.facetId,
                categoryId: c.categoryId ?? null,
                value: c.value ?? null,
                confidence: c.confidence,
                reasoning: c.reasoning,
                isManualOverride: c.isManualOverride ?? true,
              })),
            },
            isUserEdited: true,
            editedFields,
          },
          include: {
            classifications: {
              include: {
                facet: true,
                category: true,
              },
            },
          },
        });

    return NextResponse.json({ data: analysis });
  } catch (error) {
    console.error("Error saving classifications:", error);
    return NextResponse.json({ error: "Failed to save classifications" }, { status: 500 });
  }
}
