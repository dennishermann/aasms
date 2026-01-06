import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createStudySchema } from "@/lib/validations";

// GET /api/studies - List all studies
export async function GET() {
  try {
    const studies = await prisma.study.findMany({
      include: {
        researchQuestions: {
          orderBy: { order: "asc" },
        },
        parameters: {
          include: {
            formalSources: true,
            greySources: true,
            inclusionCriteria: { orderBy: { order: "asc" } },
            exclusionCriteria: { orderBy: { order: "asc" } },
          },
        },
        _count: {
          select: {
            sources: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: studies });
  } catch (error) {
    console.error("Error fetching studies:", error);
    return NextResponse.json({ error: "Failed to fetch studies" }, { status: 500 });
  }
}

// POST /api/studies - Create a new study
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createStudySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { title, description, motivation, status, researchQuestions } = validation.data;

    const study = await prisma.study.create({
      data: {
        title,
        description,
        motivation,
        status,
        researchQuestions: researchQuestions
          ? {
              create: researchQuestions.map((rq) => ({
                question: rq.question,
                order: rq.order,
              })),
            }
          : undefined,
      },
      include: {
        researchQuestions: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json({ data: study }, { status: 201 });
  } catch (error) {
    console.error("Error creating study:", error);
    return NextResponse.json({ error: "Failed to create study" }, { status: 500 });
  }
}

