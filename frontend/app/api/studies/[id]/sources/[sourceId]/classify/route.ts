import { NextRequest, NextResponse } from "next/server";
import { SourceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { downloadFile } from "@/lib/minio";

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { id: studyId, sourceId } = await params;
    const requestBody = await request.json().catch(() => ({}));
    const facetId: string | undefined = requestBody?.facetId;
    const facetName: string | undefined = requestBody?.facetName; // Legacy support

    const source = await prisma.source.findFirst({
      where: { id: sourceId, studyId },
      include: {
        study: {
          include: {
            researchQuestions: { orderBy: { order: "asc" } },
            facets: {
              include: {
                categories: { orderBy: { order: "asc" } },
                researchQuestions: {
                  include: {
                    researchQuestion: true,
                  },
                },
              },
              orderBy: { order: "asc" },
            },
          },
        },
        analysis: true,
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Check for either PDF or extracted text content
    const hasTextContent = !!(
      (source.metadataChosen as any)?.content_excerpt ||
      (source.metadataParsed as any)?.content_excerpt ||
      (source.metadataExtension as any)?.content_excerpt
    );

    if (!source.storagePath && !hasTextContent) {
      return NextResponse.json(
        { error: "Content is required for classification. Please upload a PDF or ensure website content is extracted." },
        { status: 400 }
      );
    }

    // Gate by status
    if (
      !([
        SourceStatus.ANALYZING_CLASSIFICATION,
        SourceStatus.READY_FOR_ANALYSIS,
        SourceStatus.CLASSIFIED,
      ] as SourceStatus[]).includes(source.status)
    ) {
      return NextResponse.json(
        {
          error: `Classification is only allowed when status is ANALYZING_CLASSIFICATION or READY_FOR_ANALYSIS. Current status: ${source.status}`,
        },
        { status: 400 }
      );
    }

    // Get facets from the new Facet model
    let facets = source.study?.facets || [];

    console.log("[classify] facets from database", {
      sourceId,
      totalFacets: facets.length,
      facetNames: facets.map(f => f.name),
    });

    if (facets.length === 0) {
      return NextResponse.json(
        { error: "Classification schema not configured for this study. Please add facets in study parameters." },
        { status: 400 }
      );
    }

    // Filter out facets that are invalid (CLOSED without categories)
    // Accept OPEN facets OR CLOSED facets with categories
    const validFacets = facets.filter((f) => {
      const isOpen = f.type === "OPEN";
      const hasCategories = f.categories && f.categories.length > 0;
      return isOpen || hasCategories;
    });

    console.log("[classify] filtered facets", {
      sourceId,
      totalFacets: facets.length,
      validFacets: validFacets.length,
      openFacets: validFacets.filter(f => f.type === "OPEN").map(f => f.name),
      closedFacets: validFacets.filter(f => f.type === "CLOSED").map(f => f.name),
      invalidFacets: facets.filter(f => f.type === "CLOSED" && (!f.categories || f.categories.length === 0)).map(f => f.name),
    });

    // Optionally narrow to a single facet
    let facetsToUse = validFacets;
    if (facetId) {
      facetsToUse = validFacets.filter(f => f.id === facetId);
    } else if (facetName) {
      facetsToUse = validFacets.filter(f => f.name === facetName);
    }

    if (facetsToUse.length === 0) {
      if (facetId || facetName) {
        return NextResponse.json(
          { error: `Facet '${facetId || facetName}' not found or is invalid (CLOSED facets must have categories defined)` },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "No valid facets found. CLOSED facets must have categories defined, or use OPEN type." },
        { status: 400 }
      );
    }

    // Build classification schema in format Python service expects
    const classificationSchema = facetsToUse.map((facet) => ({
      id: facet.id,
      name: facet.name,
      description: facet.description,
      type: facet.type.toLowerCase(), // CLOSED -> closed, OPEN -> open
      required: facet.required,
      categories: facet.categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
      })),
      researchQuestionIds: facet.researchQuestions.map((frq) => frq.researchQuestionId),
    }));

    // Build source content payload preferring chosen/parsed metadata
    const chosen: any = source.metadataChosen || source.metadataParsed || source.metadataExtension || {};
    const content = {
      title: chosen.title || source.title || "",
      authors: chosen.authors || source.authors || [],
      abstract: chosen.abstract || source.abstract || "",
      venue: chosen.venue || source.venue || "",
      doi: chosen.doi || source.doi || "",
      publication_date: source.publicationDate?.toISOString() || chosen.publicationDate || "",
      content_excerpt: chosen.content_excerpt || "",
    };

    const researchQuestions =
      source.study?.researchQuestions?.map((rq) => rq.question) || [];

    const studyParametersPayload = {
      research_questions: researchQuestions,
      classification_schema: classificationSchema,
    };

    // Download PDF from MinIO for full-text classification if hasPdf is true
    let pdfBuffer: Buffer | null = null;
    if (source.hasPdf) {
      if (!source.storagePath) {
        console.warn("[classify] Source marked as PDF but storagePath missing. Using extracted metadata only.");
      } else {
        try {
          pdfBuffer = await downloadFile(source.storagePath);
          console.log("[classify] PDF downloaded from MinIO", {
            sourceId,
            storagePath: source.storagePath,
            size: pdfBuffer.length,
          });
        } catch (error) {
          console.error("[classify] Failed to download PDF from MinIO", {
            sourceId,
            storagePath: source.storagePath,
            error,
          });
          // Fall through to text-based classification using metadata
        }
      }
    }

    console.log("[classify] payload to python-service", {
      sourceId,
      researchQuestionsCount: researchQuestions.length,
      facetsCount: classificationSchema.length,
      facetNames: classificationSchema.map((f: any) => f.name),
      title: content.title,
      abstractLength: content.abstract?.length || 0,
      hasContentExcerpt: !!content.content_excerpt,
      hasPdf: !!pdfBuffer,
      pdfSize: pdfBuffer?.length || 0,
      hasPublicationDate: !!content.publication_date,
    });

    // Mark as classifying
    await prisma.source.update({
      where: { id: sourceId },
      data: { status: SourceStatus.ANALYZING_CLASSIFICATION },
    });
    console.log("[classify] status -> ANALYZING_CLASSIFICATION", { sourceId });

    // Prepare payload
    const classifyPayload = {
      sourceId: sourceId,
      sourceContent: content,
      studyParameters: studyParametersPayload,
      classificationThreadId: source.classificationThreadId,
    };

    let classifyRes;

    if (source.hasPdf && pdfBuffer && pdfBuffer.length > 0) {
      // STRICT: Call /file endpoint
      const formData = new FormData();
      formData.append("payload", JSON.stringify(classifyPayload));
      const pdfBlob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });
      formData.append("file", pdfBlob, "source.pdf");

      classifyRes = await fetch(`${PYTHON_SERVICE_URL}/api/classify/file`, {
        method: "POST",
        body: formData as any,
      });
    } else {
      // STRICT: Call /text endpoint
      classifyRes = await fetch(`${PYTHON_SERVICE_URL}/api/classify/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(classifyPayload),
      });
    }

    if (!classifyRes.ok) {
      const detail = await classifyRes.json().catch(() => ({}));
      console.error("[classify] python-service failed", {
        sourceId,
        status: classifyRes.status,
        detail,
      });
      return NextResponse.json(
        { error: detail?.detail || detail?.error || "Classification failed" },
        { status: classifyRes.status }
      );
    }

    const classifyJson = await classifyRes.json();
    console.log("[classify] python-service ok", {
      sourceId,
      classifications: Array.isArray(classifyJson.classifications)
        ? classifyJson.classifications.length
        : 0,
    });
    const classifications = Array.isArray(classifyJson.classifications)
      ? classifyJson.classifications
      : [];

    const avgConfidence =
      classifications.length > 0
        ? classifications.reduce((sum: number, c: any) => sum + (c.confidence || 0), 0) /
        classifications.length
        : source.analysis?.confidenceScore || 0.5;

    // Build a map of facet name -> facet id for looking up
    const facetNameToId = new Map(facetsToUse.map(f => [f.name, f.id]));
    const facetIdToCategoryMap = new Map(
      facetsToUse.map(f => [f.id, new Map(f.categories.map(c => [c.name, c.id]))])
    );

    // Determine delete scope
    const deleteScope = facetId
      ? { facetId: facetId }
      : facetName
        ? { facetId: facetNameToId.get(facetName) }
        : {};

    // Convert classifications to use facetId and categoryId
    const createClassifications = classifications.map((c: any) => {
      const cFacetName = c.facetName || c.facet_name || "unknown";
      const cFacetId = c.facetId || facetNameToId.get(cFacetName);
      const categoryMap = cFacetId ? facetIdToCategoryMap.get(cFacetId) : null;
      const cCategoryId = categoryMap?.get(c.category) || null;

      return {
        facetId: cFacetId || facetsToUse[0]?.id, // Fallback to first facet if not found
        categoryId: cCategoryId,
        value: cCategoryId ? null : (c.category || c.value || null), // For OPEN facets
        confidence: parseFloat(c.confidence || 0),
        reasoning: c.reasoning || "",
        isManualOverride: false,
      };
    });

    const analysis = await prisma.sourceAnalysis.upsert({
      where: { sourceId },
      update: {
        confidenceScore: avgConfidence,
        classifications: {
          deleteMany: deleteScope,
          create: createClassifications,
        },
      },
      create: {
        sourceId,
        extractedText: "",
        inclusionRecommendation: source.analysis?.inclusionRecommendation ?? false,
        inclusionReasoning: source.analysis?.inclusionReasoning || "",
        exclusionReasoning: source.analysis?.exclusionReasoning || "",
        confidenceScore: avgConfidence,
        relevanceScore: source.analysis?.relevanceScore || null,
        qualityNotes: source.analysis?.qualityNotes || null,
        inclusionCriteria: source.analysis?.inclusionCriteria || [],
        exclusionCriteria: source.analysis?.exclusionCriteria || [],
        classifications: { create: createClassifications },
      },
      include: {
        classifications: {
          include: {
            facet: true,
            category: true,
          },
        },
      },
    });
    console.log("[classify] analysis saved", {
      sourceId,
      analysisId: analysis.id,
      classifications: analysis.classifications?.length ?? 0,
    });

    // Mark source as analyzed
    await prisma.source.update({
      where: { id: sourceId },
      data: { status: SourceStatus.CLASSIFIED },
    });
    console.log("[classify] status -> CLASSIFIED", { sourceId });

    return NextResponse.json({ data: analysis });
  } catch (error) {
    console.error("Error classifying source:", error);
    // Rollback status to ready if we moved it to classifying
    try {
      await prisma.source.update({
        where: { id: (await params).sourceId },
        data: { status: SourceStatus.READY_FOR_ANALYSIS },
      });
    } catch (e) {
      console.error("Failed to reset status after classification error", e);
    }
    return NextResponse.json(
      { error: "Failed to classify source", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
