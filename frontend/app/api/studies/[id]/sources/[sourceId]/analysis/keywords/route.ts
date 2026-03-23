import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const keywordsPayloadSchema = z.object({
  facetId: z.string(),
  keywords: z.array(
    z.object({
      keyword: z.string().min(1),
      confidence: z.number().min(0).max(1).nullable().optional(),
      evidence: z.string().nullable().optional(),
    }),
  ),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  try {
    const { id: studyId, sourceId } = await params;
    const body = await request.json();

    const validation = keywordsPayloadSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 },
      );
    }

    const { facetId, keywords } = validation.data;

    const source = await prisma.source.findFirst({
      where: { id: sourceId, studyId },
      include: { analysis: true },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Ensure analysis exists
    let analysisId: string;
    if (source.analysis) {
      analysisId = source.analysis.id;
    } else {
      const newAnalysis = await prisma.sourceAnalysis.create({
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
          isUserEdited: true,
          editedFields: ["keywords"],
        },
      });
      analysisId = newAnalysis.id;
    }

    // Delete existing keywords for this facet, then create new ones
    await prisma.$transaction([
      prisma.facetKeyword.deleteMany({
        where: { analysisId, facetId },
      }),
      ...(keywords.length > 0
        ? [
            prisma.facetKeyword.createMany({
              data: keywords.map((kw) => ({
                analysisId,
                facetId,
                keyword: kw.keyword,
                confidence: kw.confidence ?? null,
                evidence: kw.evidence ?? null,
              })),
            }),
          ]
        : []),
    ]);

    // Update edited fields
    await prisma.sourceAnalysis.update({
      where: { id: analysisId },
      data: {
        isUserEdited: true,
        editedFields: {
          push: "keywords",
        },
      },
    });

    // Return updated analysis with keywords
    const analysis = await prisma.sourceAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        classifications: {
          include: { facet: true, category: true },
        },
        facetKeywords: {
          include: { facet: true },
        },
      },
    });

    return NextResponse.json({ data: analysis });
  } catch (error) {
    console.error("Error saving keywords:", error);
    return NextResponse.json({ error: "Failed to save keywords" }, { status: 500 });
  }
}
