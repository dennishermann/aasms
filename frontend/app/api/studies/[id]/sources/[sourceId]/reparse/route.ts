import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { downloadFile } from "@/lib/minio";

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  try {
    const { id: studyId, sourceId } = await params;

    const source = await prisma.source.findFirst({
      where: { id: sourceId, studyId },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    console.log(`Reparse request for source ${sourceId}, type: ${source.type}`);
    console.log(`StoragePath: ${source.storagePath}`);
    console.log(
      `MetadataExtension keys: ${source.metadataExtension ? Object.keys(source.metadataExtension as object).join(",") : "null"}`,
    );

    // Check if source has textContent directly (websites)
    let hasTextContent = false;
    let textToParse = "";

    if (source.metadataExtension && typeof source.metadataExtension === "object") {
      const ext = source.metadataExtension as any;
      if (ext.textContent) {
        hasTextContent = true;
        textToParse = ext.textContent;
      }
    }

    // Determine strategy: PDF parsing vs Text parsing
    const isPdf =
      source.type === "PDF" || (source.storagePath && source.storagePath.endsWith(".pdf"));

    // mark as extracting metadata
    await prisma.source.update({
      where: { id: sourceId },
      data: { status: "EXTRACTING_METADATA" },
    });

    let data;

    if (isPdf && source.storagePath) {
      // PDF Strategy
      const buffer = await downloadFile(source.storagePath);
      const fd = new FormData();
      fd.append(
        "file",
        new Blob([new Uint8Array(buffer)], { type: "application/pdf" }),
        "source.pdf",
      );

      const res = await fetch(`${PYTHON_SERVICE_URL}/api/parse-pdf?include_content=false`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(`Parse PDF failed: ${JSON.stringify(detail)}`);
      }
      data = await res.json();
    } else if (hasTextContent) {
      // Text Strategy (Websites)
      const res = await fetch(`${PYTHON_SERVICE_URL}/api/parse-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToParse,
          url: source.originalUrl || "",
          title: source.title,
        }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(`Parse Text failed: ${JSON.stringify(detail)}`);
      }
      data = await res.json();
    } else if (source.storagePath && (source.type === "WEBPAGE" || source.type === "BLOG_POST")) {
      // Fallback: If textContent is missing, download the HTML file from storage
      console.log("Downloading HTML content from storagePath:", source.storagePath);
      const buffer = await downloadFile(source.storagePath);
      textToParse = buffer.toString("utf-8"); // Assume UTF-8 encoded HTML
      hasTextContent = true;

      const res = await fetch(`${PYTHON_SERVICE_URL}/api/parse-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToParse,
          url: source.originalUrl || "",
          title: source.title,
        }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(`Parse Text from File failed: ${JSON.stringify(detail)}`);
      }
      data = await res.json();
    } else {
      console.error(
        "No content available. isPdf:",
        isPdf,
        "hasTextContent:",
        hasTextContent,
        "storagePath:",
        source.storagePath,
      );
      return NextResponse.json(
        { error: "No content available to parse (PDF or Text)" },
        { status: 400 },
      );
    }

    // persist parsed metadata and set status to pending metadata review
    const updated = await prisma.source.update({
      where: { id: sourceId },
      data: {
        metadataParsed: data,
        status: "PENDING_METADATA",
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error("Error re-parsing source:", error);
    return NextResponse.json(
      { error: "Failed to re-parse source", details: error.message },
      { status: 500 },
    );
  }
}
