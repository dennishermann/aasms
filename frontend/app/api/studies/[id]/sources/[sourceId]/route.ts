import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateSourceSchema = z.object({
  title: z.string().min(1).optional(),
  authors: z.array(z.string()).optional(),
  publicationDate: z.string().optional(),
  venue: z.string().optional(),
  doi: z.string().optional(),
  abstract: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  sourceCategory: z.enum(["FORMAL", "GREY"]).optional(),
  bibtex: z.string().optional(),
  status: z.enum([
    "PENDING",
    "ANALYZING",
    "ANALYZED",
    "INCLUDED",
    "EXCLUDED",
    "NEEDS_REVIEW",
    "PENDING_METADATA",
    "EXTRACTING_METADATA",
    "READY_FOR_ANALYSIS",
    "ANALYZING_INCLUSION",
    "ANALYZING_CLASSIFICATION",
    "CLASSIFIED",
  ]).optional(),
  metadataExtension: z.any().optional(),
  metadataParsed: z.any().optional(),
  metadataChosen: z.any().optional(),
  metadataChosenSource: z.string().optional(),
});

// GET /api/studies/[id]/sources/[sourceId] - Get source details
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
        study: {
          include: {
            parameters: true,
          },
        },
        analysis: {
          include: {
            classifications: true,
          },
        },
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    return NextResponse.json({ data: source });
  } catch (error) {
    console.error("Error fetching source:", error);
    return NextResponse.json({ error: "Failed to fetch source" }, { status: 500 });
  }
}

// PATCH /api/studies/[id]/sources/[sourceId] - Update source metadata
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { id: studyId, sourceId } = await params;
    const body = await request.json();

    const validation = updateSourceSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }

    // Verify source belongs to study
    const existingSource = await prisma.source.findFirst({
      where: {
        id: sourceId,
        studyId,
      },
    });

    if (!existingSource) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Parse publication date if provided
    let publicationDate: Date | null | undefined = undefined;
    if (validation.data.publicationDate !== undefined) {
      try {
        publicationDate = validation.data.publicationDate
          ? new Date(validation.data.publicationDate)
          : null;
      } catch (e) {
        // Ignore invalid dates
      }
    }

    const dataToUpdate: any = {
      ...validation.data,
      publicationDate,
    };

    // When metadataChosen is provided and status not explicitly set, move to READY_FOR_ANALYSIS
    if (validation.data.metadataChosen !== undefined && validation.data.status === undefined) {
      dataToUpdate.status = "READY_FOR_ANALYSIS";
    }

    const updatedSource = await prisma.source.update({
      where: { id: sourceId },
      data: dataToUpdate,
      include: {
        analysis: {
          include: {
            classifications: true,
          },
        },
      },
    });

    return NextResponse.json({ data: updatedSource });
  } catch (error) {
    console.error("Error updating source:", error);
    return NextResponse.json({ error: "Failed to update source" }, { status: 500 });
  }
}

// DELETE /api/studies/[id]/sources/[sourceId] - Delete source
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { id: studyId, sourceId } = await params;

    // Verify source belongs to study
    const existingSource = await prisma.source.findFirst({
      where: {
        id: sourceId,
        studyId,
      },
    });

    if (!existingSource) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Delete source (cascade will handle analysis and classifications)
    await prisma.source.delete({
      where: { id: sourceId },
    });

    // TODO: Also delete file from MinIO if it has a storagePath

    return NextResponse.json({ message: "Source deleted successfully" });
  } catch (error) {
    console.error("Error deleting source:", error);
    return NextResponse.json({ error: "Failed to delete source" }, { status: 500 });
  }
}

