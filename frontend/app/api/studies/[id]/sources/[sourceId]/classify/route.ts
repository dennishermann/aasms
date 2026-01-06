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
    const facetName: string | undefined = requestBody?.facetName;

    const source = await prisma.source.findFirst({
      where: { id: sourceId, studyId },
      include: {
        study: {
          include: {
            researchQuestions: { orderBy: { order: "asc" } },
            parameters: true,
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

    const classificationSchema = source.study?.parameters?.classificationSchema as any;

    console.log("[classify] raw schema from database", {
      sourceId,
      hasSchema: !!classificationSchema,
      type: Array.isArray(classificationSchema) ? 'array' : typeof classificationSchema,
      schemaKeys: classificationSchema ? Object.keys(classificationSchema) : [],
      schemaSample: Array.isArray(classificationSchema)
        ? JSON.stringify(classificationSchema[0], null, 2)
        : classificationSchema ? JSON.stringify(Object.entries(classificationSchema)[0], null, 2) : null,
    });

    if (!classificationSchema) {
      return NextResponse.json(
        { error: "Classification schema not configured for this study" },
        { status: 400 }
      );
    }

    // Filter out facets that are invalid (closed-set without categories) and optionally narrow to a single facet
    let schemaToUse: any;
    if (Array.isArray(classificationSchema)) {
      // Accept open-set facets OR closed-set facets with categories
      schemaToUse = classificationSchema.filter((f: any) => {
        const isOpen = f.type === "open";
        const hasCategories = f.categories && Array.isArray(f.categories) && f.categories.length > 0;
        return isOpen || hasCategories;
      });

      console.log("[classify] filtered schema", {
        sourceId,
        totalFacets: classificationSchema.length,
        validFacets: schemaToUse.length,
        openSetFacets: schemaToUse.filter((f: any) => f.type === "open").map((f: any) => f.name || f.facet_name),
        closedSetFacets: schemaToUse.filter((f: any) => f.type !== "open").map((f: any) => f.name || f.facet_name),
        invalidFacets: classificationSchema.filter((f: any) => {
          const isOpen = f.type === "open";
          const hasCategories = f.categories && Array.isArray(f.categories) && f.categories.length > 0;
          return !isOpen && !hasCategories;
        }).map((f: any) => f.name || f.facet_name || 'unnamed'),
      });

      if (facetName) {
        schemaToUse = schemaToUse.filter(
          (f: any) => f.name === facetName || f.facet_name === facetName
        );
      }
    } else if (typeof classificationSchema === "object") {
      // Accept open-set facets OR closed-set facets with categories
      schemaToUse = Object.fromEntries(
        Object.entries(classificationSchema).filter(([key, value]: [string, any]) => {
          const isOpen = value?.type === "open";
          const hasCategories = value?.categories && Array.isArray(value.categories) && value.categories.length > 0;
          return isOpen || hasCategories;
        })
      );

      console.log("[classify] filtered schema", {
        sourceId,
        totalFacets: Object.keys(classificationSchema).length,
        validFacets: Object.keys(schemaToUse).length,
        openSetFacets: Object.entries(schemaToUse)
          .filter(([_, value]: [string, any]) => value?.type === "open")
          .map(([key]) => key),
        closedSetFacets: Object.entries(schemaToUse)
          .filter(([_, value]: [string, any]) => value?.type !== "open")
          .map(([key]) => key),
        invalidFacets: Object.entries(classificationSchema)
          .filter(([key, value]: [string, any]) => {
            const isOpen = value?.type === "open";
            const hasCategories = value?.categories && Array.isArray(value.categories) && value.categories.length > 0;
            return !isOpen && !hasCategories;
          })
          .map(([key]) => key),
      });

      if (facetName) {
        schemaToUse = Object.fromEntries(
          Object.entries(schemaToUse).filter(([k]) => k === facetName)
        );
      }
    }

    // Check if we have any valid facets after filtering
    const hasValidFacets = Array.isArray(schemaToUse)
      ? schemaToUse.length > 0
      : Object.keys(schemaToUse || {}).length > 0;

    if (!hasValidFacets) {
      if (facetName) {
        return NextResponse.json(
          { error: `Facet '${facetName}' not found or is invalid (closed-set facets must have categories defined)` },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "No valid facets found in classification schema. Closed-set facets must have categories defined, or use open-set type for LLM-generated categories." },
        { status: 400 }
      );
    }

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
      classification_schema: schemaToUse,
    };

    // Download PDF from MinIO for full-text classification
    // Download PDF from MinIO for full-text classification if hasPdf is true
    let pdfBuffer: Buffer | null = null;
    if (source.hasPdf) {
      if (!source.storagePath) {
        // Since we don't return here, we proceed, but classification without content might fail or just use metadata
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
      facetsCount: Array.isArray(schemaToUse) ? schemaToUse.length : Object.keys(schemaToUse || {}).length,
      facetNames: Array.isArray(schemaToUse)
        ? schemaToUse.map((f: any) => f.name || f.facet_name)
        : Object.keys(schemaToUse || {}),
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

    const deleteScope = facetName
      ? { facetName: facetName }
      : {};

    const createClassifications = classifications.map((c: any) => ({
      facetName: c.facetName || c.facet_name || "unknown",
      category: c.category || "unknown",
      confidence: parseFloat(c.confidence || 0),
      reasoning: c.reasoning || "",
      isManualOverride: false,
    }));

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
      include: { classifications: true },
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
