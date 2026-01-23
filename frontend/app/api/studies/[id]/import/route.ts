import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

/**
 * Parse publication date from various formats.
 * Handles ISO date strings (e.g., "2023-03-15") and year-only fallback.
 */
function parsePublicationDate(
  publicationDate: string | undefined,
  year: number | undefined
): Date | null {
  // First try the full publication_date string (e.g., "2023-03-15" from ACM)
  if (publicationDate) {
    const parsed = new Date(publicationDate);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  // Fallback to year-only (January 1st)
  if (year && year > 1900 && year < 2100) {
    return new Date(year, 0, 1);
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studyId } = await params;

    // 1. Verify study exists
    const study = await prisma.study.findUnique({
      where: { id: studyId },
      include: {
        sources: {
          select: {
            id: true,
            doi: true,
            title: true,
            sourceOrigins: true,
          },
        },
      },
    });

    if (!study) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const databaseSource = formData.get("databaseSource") as string;

    if (!file || !databaseSource) {
      return NextResponse.json({ error: "Missing file or database source" }, { status: 400 });
    }

    // 2. Parse File (Call Python)
    const pythonFormData = new FormData();
    pythonFormData.append("file", file);
    pythonFormData.append("database_source", databaseSource);
    pythonFormData.append("skip_relevance_check", "true");

    const parseResponse = await fetch(`${PYTHON_SERVICE_URL}/api/import/parse`, {
      method: "POST",
      body: pythonFormData as any,
    });

    if (!parseResponse.ok) {
      const errorText = await parseResponse.text();
      return NextResponse.json(
        { error: "Failed to parse import file", details: errorText },
        { status: parseResponse.status }
      );
    }

    const parsedSources = await parseResponse.json();

    // 3. Create Import Batch
    const batch = await prisma.importBatch.create({
      data: {
        studyId,
        fileName: file.name,
        databaseSource,
        status: "PROCESSING",
        totalRecords: parsedSources.length,
      },
    });

    // 4. Deduplicate & Create Sources
    // We do this in a loop to get IDs.
    const createdSourceIds: string[] = [];
    const duplicates: any[] = [];
    let newCount = 0;
    let duplicateCount = 0;

    for (const source of parsedSources) {
      // Basic duplicate check (DOI or Title)
      // Note: Python used to do this more robustly with fuzzy matching?
      // For now, let's look for exact DOI match for simplicity in this refactor, 
      // or title match.
      // Ideally we should reuse Python's duplicate detector but that requires sending all sources back and forth.
      // Let's implement a decent check here.

      const existingByDoi = source.doi ? study.sources.find(s => s.doi === source.doi) : null;
      const existingByTitle = !existingByDoi ? study.sources.find(s => s.title.toLowerCase() === source.title.toLowerCase()) : null;
      const existing = existingByDoi || existingByTitle;

      if (existing) {
        duplicates.push({
          existingId: existing.id,
          source: source
        });
        duplicateCount++;

        // Add source origin if new
        if (!existing.sourceOrigins.includes(databaseSource)) {
          await prisma.source.update({
            where: { id: existing.id },
            data: { sourceOrigins: { push: databaseSource } }
          });
        }
      } else {
        // Create new source
        const newSource = await prisma.source.create({
          data: {
            studyId,
            importBatchId: batch.id,
            type: "PDF", // Default type, maybe infer from import?
            sourceCategory: "FORMAL",
            title: source.title,
            authors: source.authors,
            publicationDate: parsePublicationDate(source.publication_date, source.year),
            venue: source.venue,
            doi: source.doi,
            abstract: source.abstract,
            sourceOrigins: [databaseSource],
            bibtex: source.bibtex,
            status: "ANALYZING_INCLUSION", // Mark as pending analysis
            originalUrl: source.url,
            // Bulk imported sources start needing PDF
            needsPdf: true,
            // Store raw data if needed
            metadataExtension: {
              database_source: databaseSource,
              raw_entry: source.raw_entry,
              database_specific: source.database_specific
            }
          },
        });
        createdSourceIds.push(newSource.id);
        newCount++;
      }
    }

    // Update batch stats (initial)
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        duplicates: duplicateCount,
        newSources: newCount,
        // status remains PROCESSING until client finishes? 
        // Or we leave it PROCESSING and client updates it?
        // Let's leave it PROCESSING.
      }
    });

    return NextResponse.json({
      batchId: batch.id,
      totalParsed: parsedSources.length,
      newSourceIds: createdSourceIds,
      duplicateCount,
    });

  } catch (error) {
    console.error("Import start error:", error);
    return NextResponse.json(
      { error: "Failed to start import", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
