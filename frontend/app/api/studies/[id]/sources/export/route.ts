import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateBibTeXFile } from "@/lib/services/export/bibtex-generator";
import { generateRISFile } from "@/lib/services/export/ris-generator";
import { Decision, SourceStatus } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studyId } = await params;
    const { searchParams } = new URL(request.url);

    // Get query parameters
    const format = searchParams.get("format"); // "bibtex" | "ris"
    const filter = searchParams.get("filter") || "included"; // "all" | "included" | "excluded" | "pending"

    // Validate format
    if (!format || !["bibtex", "ris"].includes(format)) {
      return NextResponse.json(
        { error: 'format parameter must be "bibtex" or "ris"' },
        { status: 400 }
      );
    }

    // Validate filter
    if (!["all", "included", "excluded", "pending"].includes(filter)) {
      return NextResponse.json(
        { error: 'filter parameter must be "all", "included", "excluded", or "pending"' },
        { status: 400 }
      );
    }

    // Verify study exists
    const study = await prisma.study.findUnique({
      where: { id: studyId },
      select: { id: true, title: true },
    });

    if (!study) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

    // Build where clause based on filter
    let whereClause: any = { studyId };

    if (filter === "included") {
      // Include sources that have been explicitly marked INCLUDE
      whereClause = {
        ...whereClause,
        OR: [
          { finalDecision: Decision.INCLUDE },
          { status: SourceStatus.INCLUDED },
        ],
      };
    } else if (filter === "excluded") {
      // Exclude sources that have been explicitly marked EXCLUDE
      whereClause = {
        ...whereClause,
        OR: [
          { finalDecision: Decision.EXCLUDE },
          {
            status: {
              in: [SourceStatus.EXCLUDED],
            },
          },
        ],
      };
    } else if (filter === "pending") {
      // Pending sources (not yet classified)
      whereClause = {
        ...whereClause,
        status: SourceStatus.PENDING,
      };
    }
    // For "all", use the basic studyId filter

    // Fetch sources
    const sources = await prisma.source.findMany({
      where: whereClause,
      orderBy: { uploadedAt: "asc" },
    });

    // Check if there are any sources to export
    if (sources.length === 0) {
      return NextResponse.json(
        { error: `No sources found for filter: ${filter}` },
        { status: 400 }
      );
    }

    // Generate content based on format
    let content: string;
    let contentType: string;
    let filename: string;

    if (format === "bibtex") {
      content = generateBibTeXFile(sources);
      contentType = "application/x-bibtex";
      filename = `study-sources-${filter}.bib`;
    } else {
      // format === "ris"
      content = generateRISFile(sources);
      contentType = "application/x-research-info-systems";
      filename = `study-sources-${filter}.ris`;
    }

    // Return file as downloadable attachment
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": Buffer.byteLength(content).toString(),
      },
    });
  } catch (error) {
    console.error("Error exporting sources:", error);
    return NextResponse.json(
      {
        error: "Failed to export sources",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
