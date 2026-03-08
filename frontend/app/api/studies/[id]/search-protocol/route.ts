import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const searchProtocolEntrySchema = z.object({
  database: z.string().min(1, "Database is required"),
  searchString: z.string().min(1, "Search string is required"),
  dateSearched: z.string().or(z.date()).transform((val) => new Date(val)),
  dateRangeFrom: z.string().or(z.date()).optional().transform((val) => val ? new Date(val) : undefined),
  dateRangeTo: z.string().or(z.date()).optional().transform((val) => val ? new Date(val) : undefined),
  totalResults: z.number().int().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  importBatchId: z.string().optional().nullable(),
});

// GET /api/studies/[id]/search-protocol - List all entries for the study
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;

    // Check if study exists
    const study = await prisma.study.findUnique({
      where: { id: studyId },
    });

    if (!study) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

    const entries = await prisma.searchProtocolEntry.findMany({
      where: { studyId },
      include: { importBatch: true },
      orderBy: { dateSearched: "desc" },
    });

    return NextResponse.json({ data: entries });
  } catch (error) {
    console.error("Error fetching search protocol entries:", error);
    return NextResponse.json({ error: "Failed to fetch search protocol entries" }, { status: 500 });
  }
}

// POST /api/studies/[id]/search-protocol - Create a new entry
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;
    const body = await request.json();
    const validation = searchProtocolEntrySchema.safeParse(body);

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

    // If importBatchId is provided, verify it exists and belongs to this study
    if (validation.data.importBatchId) {
      const batch = await prisma.importBatch.findUnique({
        where: { id: validation.data.importBatchId },
      });

      if (!batch || batch.studyId !== studyId) {
        return NextResponse.json({ error: "Invalid import batch" }, { status: 400 });
      }
    }

    const entry = await prisma.searchProtocolEntry.create({
      data: {
        studyId,
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

    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error) {
    console.error("Error creating search protocol entry:", error);
    return NextResponse.json({ error: "Failed to create search protocol entry" }, { status: 500 });
  }
}
