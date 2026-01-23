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

// Updated to use facetId/categoryId instead of facetName/category
const classificationSchema = z.object({
  facetId: z.string(),
  categoryId: z.string().optional().nullable(),  // null for OPEN facets
  value: z.string().optional().nullable(),       // For OPEN facets
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
  isManualOverride: z.boolean().optional(),
});

const updateAnalysisSchema = z.object({
  inclusionRecommendation: z.boolean(),
  inclusionReasoning: z.string(),
  exclusionReasoning: z.string(),
  confidenceScore: z.number().min(0).max(1),
  classifications: z.array(classificationSchema),
  relevanceScore: z.number().min(0).max(1).optional(),
  qualityNotes: z.string().optional(),
  inclusionCriteria: z.array(criterionSchema).optional(),
  exclusionCriteria: z.array(criterionSchema).optional(),
});

// GET /api/studies/[id]/sources/[sourceId]/analysis - Get or generate dummy analysis
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { id: studyId, sourceId } = await params;

    const source = await prisma.source.findFirst({
      where: {
        id: sourceId,
        studyId,
      },
      include: {
        analysis: {
          include: {
            classifications: {
              include: {
                facet: true,
                category: true,
              },
            },
            facetKeywords: {
              include: {
                facet: true,
              },
            },
          },
        },
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    if (!source.analysis) {
      console.log("[analysis:get] no analysis yet", {
        sourceId,
        status: source.status,
      });
      return NextResponse.json({ data: null, message: "Analysis not available yet." }, { status: 200 });
    }

    const inclusionCriteria = (source.analysis as any).inclusionCriteria || [];
    const exclusionCriteria = (source.analysis as any).exclusionCriteria || [];

    console.log("[analysis:get] returning analysis", {
      sourceId,
      status: source.status,
      inclusionCount: inclusionCriteria.length,
      exclusionCount: exclusionCriteria.length,
      classifications: source.analysis.classifications?.length ?? 0,
      inclusionSample: inclusionCriteria.slice(0, 2),
      exclusionSample: exclusionCriteria.slice(0, 2),
    });

    return NextResponse.json({
      data: {
        ...source.analysis,
        inclusionCriteria,
        exclusionCriteria,
      },
    });
  } catch (error) {
    console.error("Error fetching/generating analysis:", error);
    return NextResponse.json({ error: "Failed to fetch analysis" }, { status: 500 });
  }
}

// PUT /api/studies/[id]/sources/[sourceId]/analysis - Save or update analysis
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { id: studyId, sourceId } = await params;
    const body = await request.json();

    const validation = updateAnalysisSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }

    // Verify source exists and belongs to study
    const source = await prisma.source.findFirst({
      where: {
        id: sourceId,
        studyId,
      },
      include: {
        analysis: true,
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    const data = validation.data;
    const editedFields = Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);

    const inclusionCriteria = data.inclusionCriteria ?? source.analysis?.inclusionCriteria ?? [];
    const exclusionCriteria = data.exclusionCriteria ?? source.analysis?.exclusionCriteria ?? [];

    // Update or create analysis
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
          ...(classificationsUpdate ? { classifications: classificationsUpdate } : {}),
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
          extractedText: "", // Will be filled by actual analysis later
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
            create: data.classifications.map((c) => ({
              facetId: c.facetId,
              categoryId: c.categoryId ?? null,
              value: c.value ?? null,
              confidence: c.confidence,
              reasoning: c.reasoning,
              isManualOverride: c.isManualOverride ?? true,
            })),
          },
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

    // Update source status
    await prisma.source.update({
      where: { id: sourceId },
      data: {
        status: data.inclusionRecommendation ? "INCLUDED" : "EXCLUDED",
      },
    });

    return NextResponse.json({
      data: {
        ...analysis,
        inclusionCriteria: (analysis as any).inclusionCriteria || [],
        exclusionCriteria: (analysis as any).exclusionCriteria || [],
      },
    });
  } catch (error) {
    console.error("Error saving analysis:", error);
    return NextResponse.json({ error: "Failed to save analysis" }, { status: 500 });
  }
}
