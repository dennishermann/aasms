import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;
    const { doi, title, authors } = await request.json();

    if (!doi && !title) {
      return NextResponse.json({ error: "Either DOI or title is required" }, { status: 400 });
    }

    // Check for duplicate using same logic as import
    const existingSource = await prisma.source.findFirst({
      where: {
        studyId,
        OR: [
          doi ? { doi } : undefined,
          title && authors?.[0]
            ? {
                AND: [
                  { title: { contains: title, mode: "insensitive" } },
                  { authors: { has: authors[0] } },
                ],
              }
            : undefined,
        ].filter(Boolean) as any,
      },
      select: {
        id: true,
        title: true,
        needsPdf: true,
        study: {
          select: { title: true },
        },
      },
    });

    if (!existingSource) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
      exists: true,
      needsPdf: existingSource.needsPdf,
      source: {
        id: existingSource.id,
        title: existingSource.title,
        studyTitle: (existingSource as any).study?.title,
      },
    });
  } catch (error) {
    console.error("Error checking duplicate:", error);
    return NextResponse.json(
      {
        error: "Failed to check duplicate",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
