import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET - List all facets for a study (with categories and research questions)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;

    const facets = await prisma.facet.findMany({
      where: { studyId },
      include: {
        categories: {
          orderBy: { order: "asc" },
        },
        researchQuestions: {
          include: {
            researchQuestion: true,
          },
        },
      },
      orderBy: { order: "asc" },
    });

    // Transform to a cleaner format
    const transformedFacets = facets.map((facet) => ({
      ...facet,
      researchQuestionIds: facet.researchQuestions.map((frq) => frq.researchQuestionId),
      researchQuestions: facet.researchQuestions.map((frq) => ({
        id: frq.researchQuestion.id,
        question: frq.researchQuestion.question,
        order: frq.researchQuestion.order,
      })),
    }));

    return NextResponse.json({ data: transformedFacets });
  } catch (error) {
    console.error("Error fetching facets:", error);
    return NextResponse.json({ error: "Failed to fetch facets" }, { status: 500 });
  }
}

// POST - Create a new facet
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;
    const body = await request.json();

    const {
      name,
      description,
      type = "CLOSED",
      required = true,
      categories = [],
      researchQuestionIds = [],
      metadataField = null,
      metadataTransform = null,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Facet name is required" }, { status: 400 });
    }

    // Get the next order value
    const lastFacet = await prisma.facet.findFirst({
      where: { studyId },
      orderBy: { order: "desc" },
    });
    const nextOrder = (lastFacet?.order ?? -1) + 1;

    // Create facet with categories and RQ links
    const facet = await prisma.facet.create({
      data: {
        studyId,
        name,
        description,
        type,
        required,
        order: nextOrder,
        metadataField,
        metadataTransform,
        categories: {
          create: categories.map((cat: { name: string; description?: string }, index: number) => ({
            name: typeof cat === "string" ? cat : cat.name,
            description: typeof cat === "string" ? null : cat.description,
            order: index,
          })),
        },
        researchQuestions: {
          create: researchQuestionIds.map((rqId: string) => ({
            researchQuestionId: rqId,
          })),
        },
      },
      include: {
        categories: {
          orderBy: { order: "asc" },
        },
        researchQuestions: {
          include: {
            researchQuestion: true,
          },
        },
      },
    });

    // Transform response
    const transformedFacet = {
      ...facet,
      researchQuestionIds: facet.researchQuestions.map((frq) => frq.researchQuestionId),
      researchQuestions: facet.researchQuestions.map((frq) => ({
        id: frq.researchQuestion.id,
        question: frq.researchQuestion.question,
        order: frq.researchQuestion.order,
      })),
    };

    return NextResponse.json({ data: transformedFacet }, { status: 201 });
  } catch (error) {
    console.error("Error creating facet:", error);
    return NextResponse.json({ error: "Failed to create facet" }, { status: 500 });
  }
}

// PUT - Bulk update facets (for reordering or batch updates)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;
    const body = await request.json();
    const { facets } = body;

    if (!Array.isArray(facets)) {
      return NextResponse.json({ error: "facets array is required" }, { status: 400 });
    }

    // Update each facet's order
    await Promise.all(
      facets.map((facet: { id: string; order: number }) =>
        prisma.facet.update({
          where: { id: facet.id, studyId },
          data: { order: facet.order },
        }),
      ),
    );

    // Fetch updated facets
    const updatedFacets = await prisma.facet.findMany({
      where: { studyId },
      include: {
        categories: {
          orderBy: { order: "asc" },
        },
        researchQuestions: {
          include: {
            researchQuestion: true,
          },
        },
      },
      orderBy: { order: "asc" },
    });

    const transformedFacets = updatedFacets.map((facet) => ({
      ...facet,
      researchQuestionIds: facet.researchQuestions.map((frq) => frq.researchQuestionId),
      researchQuestions: facet.researchQuestions.map((frq) => ({
        id: frq.researchQuestion.id,
        question: frq.researchQuestion.question,
        order: frq.researchQuestion.order,
      })),
    }));

    return NextResponse.json({ data: transformedFacets });
  } catch (error) {
    console.error("Error updating facets:", error);
    return NextResponse.json({ error: "Failed to update facets" }, { status: 500 });
  }
}
