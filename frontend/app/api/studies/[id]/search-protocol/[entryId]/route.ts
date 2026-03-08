import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const searchProtocolEntryUpdateSchema = z.object({
  database: z.string().min(1, "Database is required").optional(),
  searchString: z.string().min(1, "Search string is required").optional(),
  dateSearched: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  dateRangeFrom: z.string().or(z.date()).optional().transform((val) => val ? new Date(val) : undefined),
  dateRangeTo: z.string().or(z.date()).optional().transform((val) => val ? new Date(val) : undefined),
  totalResults: z.number().int().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  importBatchId: z.string().optional().nullable(),
});

// PUT /api/studies/[id]/search-protocol/[entryId] - Update an entry
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const { id: studyId, entryId } = await params;
    const body = await request.json();
    const validation = searchProtocolEntryUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }

    // Verify entry exists and belongs to this study
    const entry = await prisma.searchProtocolEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry || entry.studyId !== studyId) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    // If importBatchId is provided, verify it exists and belongs to this study
    if (validation.data.importBatchId) {
      const batch = await prisma.importBatch.findUnique({
        where: { id: validation.data.importBatchId },
      });

      if (!batch || batch.studyId !== studyId) {
        return NextResponse.json({ error: "Invalid import batch" }, { status: 400 });
      }
    }

    const updatedEntry = await prisma.searchProtocolEntry.update({
      where: { id: entryId },
      data: {
        database: validation.data.database,
        searchString: validation.data.searchString,
        dateSearched: validation.data.dateSearched,
        dateRangeFrom: validation.data.dateRangeFrom,
        dateRangeTo: validation.data.dateRangeTo,
        totalResults: validation.data.totalResults,
        notes: validation.data.notes,
        importBatchId: validation.data.importBatchId,
      },
      include: { importBatch: true },
    });

    return NextResponse.json({ data: updatedEntry });
  } catch (error) {
    console.error("Error updating search protocol entry:", error);
    return NextResponse.json({ error: "Failed to update search protocol entry" }, { status: 500 });
  }
}

// DELETE /api/studies/[id]/search-protocol/[entryId] - Delete an entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const { id: studyId, entryId } = await params;

    // Verify entry exists and belongs to this study
    const entry = await prisma.searchProtocolEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry || entry.studyId !== studyId) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    await prisma.searchProtocolEntry.delete({
      where: { id: entryId },
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("Error deleting search protocol entry:", error);
    return NextResponse.json({ error: "Failed to delete search protocol entry" }, { status: 500 });
  }
}
