import { NextRequest, NextResponse } from "next/server";
import { SourceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { uploadFile, generateStoragePath, initializeBucket } from "@/lib/minio";
import { z } from "zod";

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

const addSourceSchema = z.object({
  sourceType: z.enum(["pdf", "url"]),
  hasPDF: z.boolean().optional(),
  url: z.string().url().optional(),
  title: z.string().min(1),
  authors: z.array(z.string()).optional(),
  publicationDate: z.string().optional(),
  venue: z.string().optional(),
  venueType: z.enum(["JOURNAL", "CONFERENCE", "WORKSHOP", "SYMPOSIUM", "BOOK_CHAPTER", "PREPRINT_SERVER", "TECHNICAL_REPORT", "BLOG", "OTHER"]).optional().nullable(),
  doi: z.string().optional(),
  abstract: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  sourceCategory: z.enum(["FORMAL", "GREY"]),
  greyLiteratureTier: z.enum(["TIER_1", "TIER_2", "TIER_3"]).optional().nullable(),
  sourceOrigin: z.string().optional(),
  bibtex: z.string().optional(),
  textContent: z.string().optional(),
  content: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;

    // Verify study exists
    const study = await prisma.study.findUnique({
      where: { id: studyId },
      include: {
        researchQuestions: { orderBy: { order: "asc" } },
        parameters: {
          include: {
            inclusionCriteria: { orderBy: { order: "asc" } },
            exclusionCriteria: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    if (!study) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const metadataJson = formData.get("metadata") as string;

    if (!metadataJson) {
      return NextResponse.json({ error: "Metadata is required" }, { status: 400 });
    }

    // Parse and validate metadata
    let metadata: any;
    try {
      metadata = JSON.parse(metadataJson);
      const validation = addSourceSchema.safeParse(metadata);
      if (!validation.success) {
        return NextResponse.json(
          { error: "Invalid metadata", details: validation.error.errors },
          { status: 400 }
        );
      }
      metadata = validation.data;
    } catch (error) {
      return NextResponse.json({ error: "Invalid metadata JSON" }, { status: 400 });
    }

    const isPDF = metadata.sourceType === "pdf";
    const isURL = metadata.sourceType === "url";

    // Validate based on source type
    if (isPDF && !file) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    }

    if (isPDF && file && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    if (isURL && !metadata.url) {
      return NextResponse.json({ error: "URL is required for URL sources" }, { status: 400 });
    }

    let storagePath: string | null = null;
    let sourceType: "PDF" | "WEBPAGE" | "BLOG_POST" = "WEBPAGE";

    let fileBuffer: Buffer | null = null;

    // Handle PDF upload
    if (isPDF && file) {
      sourceType = "PDF";
      // file.name already includes extension; pass empty extension to satisfy signature
      storagePath = generateStoragePath(studyId, file.name, "");

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);

      // Ensure MinIO bucket exists
      await initializeBucket();

      // Upload to MinIO
      await uploadFile(storagePath, fileBuffer, {
        "Content-Type": "application/pdf",
        "Original-Filename": file.name,
      });
    }

    // For URL sources, determine if it's a blog or webpage
    if (isURL && metadata.url) {
      // Simple heuristic: if it's grey literature, likely a blog
      sourceType = metadata.sourceCategory === "GREY" ? "BLOG_POST" : "WEBPAGE";
    }

    // Parse publication date if provided
    let publicationDate: Date | null = null;
    if (metadata.publicationDate) {
      const parsed = new Date(metadata.publicationDate);
      // Validate the date is actually valid (new Date() doesn't throw, returns Invalid Date)
      if (!isNaN(parsed.getTime())) {
        publicationDate = parsed;
      }
    }

    // Create source record in database
    const source = await prisma.source.create({
      data: {
        studyId,
        type: sourceType,
        hasPdf: isPDF,
        sourceCategory: metadata.sourceCategory,
        greyLiteratureTier: metadata.greyLiteratureTier || null,
        venueType: metadata.venueType || null,
        originalUrl: isURL ? metadata.url : null,
        storagePath: storagePath,
        title: metadata.title,
        authors: metadata.authors || [],
        publicationDate,
        venue: metadata.venue || null,
        doi: metadata.doi || null,
        abstract: metadata.abstract || null,
        keywords: metadata.keywords || [],
        sourceOrigin: metadata.sourceOrigin || null,
        bibtex: metadata.bibtex || null,
        status: SourceStatus.PENDING_METADATA,
      },
    });

    // Auto-parse is handled asynchronously below; initialize parsed placeholder
    const metadataParsed: any = null;

    const sourceContentExt = {
      title: metadata.title,
      authors: metadata.authors || [],
      abstract: metadata.abstract || "",
      venue: metadata.venue || "",
      doi: metadata.doi || "",
      bibtex: metadata.bibtex || null,
      content_excerpt: null as string | null,
    };

    // No auto analysis or classification on add; keep pending metadata
    // metadataParsed may be filled by auto-parse (PDF only)
    const metadataUsed: any = null;
    let status: SourceStatus = SourceStatus.PENDING_METADATA;
    const chosenSource = "extension";

    // If PDF present, call python parse-pdf directly, persist parsed metadata, and move to pending metadata
    if (isPDF && fileBuffer) {
      status = SourceStatus.EXTRACTING_METADATA;
      await prisma.source.update({
        where: { id: source.id },
        data: {
          metadataExtension: sourceContentExt,
          metadataParsed: metadataParsed,
          metadataChosen: metadataUsed,
          metadataChosenSource: chosenSource,
          status,
        },
      });

      // Upload PDF to storage with path based on the created source id
      const objectPath = generateStoragePath(studyId, source.id, ".pdf");
      if (fileBuffer) {
        if (!file?.name) {
          return NextResponse.json({ error: "Original filename missing for uploaded PDF" }, { status: 400 });
        }
        const originalFilename = file.name;
        await uploadFile(objectPath, fileBuffer, {
          "Content-Type": "application/pdf",
          "Original-Filename": originalFilename,
        });
        await prisma.source.update({
          where: { id: source.id },
          data: { storagePath: objectPath },
        });
      }

      let parsedPayload: any = null;
      try {
        const fd = new FormData();
        // Convert Buffer to Uint8Array so BlobPart typing is satisfied
        const pdfBlob = new Blob([new Uint8Array(fileBuffer)], { type: "application/pdf" });
        fd.append("file", pdfBlob, "source.pdf");
        const parseRes = await fetch(`${PYTHON_SERVICE_URL}/api/parse-pdf?include_content=false`, {
          method: "POST",
          body: fd as any,
        });
        if (parseRes.ok) {
          parsedPayload = await parseRes.json();
        }
      } catch (e) {
        // swallow and fall through to pending metadata
      }

      const updatedSource = await prisma.source.update({
        where: { id: source.id },
        data: {
          metadataParsed: parsedPayload ?? null,
          status: SourceStatus.PENDING_METADATA,
        },
        include: { analysis: { include: { classifications: true } } },
      });

      return NextResponse.json(
        {
          data: {
            ...updatedSource,
          },
          message: parsedPayload
            ? "PDF uploaded; metadata extraction completed"
            : "PDF uploaded; metadata extraction in progress",
        },
        { status: 201 }
      );
    }

    // Convert to text buffer if textContent exists
    const textContent = metadata.textContent;
    const htmlContent = metadata.content;

    if (isURL && textContent) {
      status = SourceStatus.EXTRACTING_METADATA;
      await prisma.source.update({
        where: { id: source.id },
        data: {
          status,
          metadataExtension: sourceContentExt,
        }
      });

      // 1. Upload HTML Snapshot (Primary Storage for Display)
      // If we have HTML, use it as the main storagePath
      let mainStoragePath: string | null = null;
      if (htmlContent) {
        const htmlPath = generateStoragePath(studyId, source.id, ".html");
        await uploadFile(htmlPath, Buffer.from(htmlContent), {
          "Content-Type": "text/html",
          "Original-Filename": "snapshot.html",
        });
        mainStoragePath = htmlPath;
      }

      // 2. Upload Raw Text (For Analysis/LLM)
      // Even if we have HTML, we save text for easier re-indexing/debugging
      const txtPath = generateStoragePath(studyId, source.id, ".txt");
      const textBuffer = Buffer.from(textContent);
      await uploadFile(txtPath, textBuffer, {
        "Content-Type": "text/plain",
        "Original-Filename": "content.txt",
      });

      // If no HTML, fallback to using text file as storagePath
      if (!mainStoragePath) {
        mainStoragePath = txtPath;
      }

      await prisma.source.update({
        where: { id: source.id },
        data: { storagePath: mainStoragePath },
      });

      // Trigger LLM Extraction
      let parsedPayload: any = null;
      try {
        const parseRes = await fetch(`${PYTHON_SERVICE_URL}/api/parse-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: textContent,
            url: metadata.url,
            title: metadata.title,
          }),
        });
        if (parseRes.ok) {
          parsedPayload = await parseRes.json();
        }
      } catch (e) {
        console.error("Text extraction failed:", e);
      }

      const updatedSource = await prisma.source.update({
        where: { id: source.id },
        data: {
          metadataParsed: parsedPayload ?? null,
          status: SourceStatus.PENDING_METADATA,
        },
        include: { analysis: { include: { classifications: true } } },
      });

      return NextResponse.json(
        {
          data: { ...updatedSource },
          message: parsedPayload ? "Source added; metadata extracted" : "Source added; extraction failed",
        },
        { status: 201 }
      );
    }

    // No PDF: just store extension metadata, stay pending
    const updatedSource = await prisma.source.update({
      where: { id: source.id },
      data: {
        metadataExtension: sourceContentExt,
        metadataParsed: metadataParsed,
        metadataChosen: metadataUsed,
        metadataChosenSource: chosenSource,
        status,
      },
      include: {
        analysis: {
          include: {
            classifications: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        data: {
          ...updatedSource,
          analysis: updatedSource.analysis,
        },
        message: "Source added",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding source:", error);
    return NextResponse.json(
      { error: "Failed to add source", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
