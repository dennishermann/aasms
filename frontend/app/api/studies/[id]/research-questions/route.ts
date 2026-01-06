import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const researchQuestionsSchema = z.object({
  researchQuestions: z.array(
    z.object({
      id: z.string().optional(),
      question: z.string().min(1, "Question is required"),
      order: z.number().int().min(0),
    })
  ),
});

// PUT /api/studies/[id]/research-questions - Replace all research questions for a study
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;
    const body = await request.json();
    const validation = researchQuestionsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }

    // Check if study exists
    const study = await prisma.study.findUnique({
      where: { id: studyId },
    });

    if (!study) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

    // Delete existing research questions
    await prisma.researchQuestion.deleteMany({
      where: { studyId },
    });

    // Create new research questions
    const researchQuestions = await prisma.researchQuestion.createMany({
      data: validation.data.researchQuestions.map((rq) => ({
        studyId,
        question: rq.question,
        order: rq.order,
      })),
    });

    // Fetch the newly created questions to return them
    const updatedQuestions = await prisma.researchQuestion.findMany({
      where: { studyId },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ data: updatedQuestions });
  } catch (error) {
    console.error("Error updating research questions:", error);
    return NextResponse.json({ error: "Failed to update research questions" }, { status: 500 });
  }
}

