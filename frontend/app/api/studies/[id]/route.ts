import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateStudySchema } from "@/lib/validations";

export const dynamic = 'force-dynamic';

// GET /api/studies/[id] - Get a single study
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const study = await prisma.study.findUnique({
      where: { id },
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
        sources: {
          include: {
            analysis: {
              include: {
                classifications: true,
              },
            },
          },
          orderBy: { uploadedAt: "desc" },
        },
      },
    });

    if (!study) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

    return NextResponse.json({ data: study });
  } catch (error) {
    console.error("Error fetching study:", error);
    return NextResponse.json({ error: "Failed to fetch study" }, { status: 500 });
  }
}

// PATCH /api/studies/[id] - Update a study
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validation = updateStudySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }

    const study = await prisma.study.update({
      where: { id },
      data: validation.data,
      include: {
        researchQuestions: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json({ data: study });
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }
    console.error("Error updating study:", error);
    return NextResponse.json({ error: "Failed to update study" }, { status: 500 });
  }
}

// DELETE /api/studies/[id] - Delete a study
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.study.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Study deleted successfully" });
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }
    console.error("Error deleting study:", error);
    return NextResponse.json({ error: "Failed to delete study" }, { status: 500 });
  }
}

