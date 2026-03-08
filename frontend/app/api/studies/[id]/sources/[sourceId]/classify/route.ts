import { NextRequest, NextResponse } from "next/server";
import { SourceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { downloadFile } from "@/lib/minio";
import { PYTHON_SERVICE_URL } from "@/lib/python-service";
import { STUDY_WITH_FACETS_INCLUDE } from "@/lib/queries/study-includes";


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  try {
    const { id: studyId, sourceId } = await params;
    const requestBody = await request.json().catch(() => ({}));
    const facetId: string | undefined = requestBody?.facetId;
    const facetName: string | undefined = requestBody?.facetName; // Legacy support

    const source = await prisma.source.findFirst({
      where: { id: sourceId, studyId },
      include: {
        study: { include: STUDY_WITH_FACETS_INCLUDE },
        analysis: true,
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    const chosen: any =
      source.metadataChosen || source.metadataParsed || source.metadataExtension || {};
    const hasTextContent = !!chosen.content_excerpt;
    const hasAbstract = !!(chosen.abstract || source.abstract);
    const allowMetadataOnly = source.allowMetadataOnlyClassification && hasAbstract;

    if (!source.storagePath && !hasTextContent && !allowMetadataOnly) {
      return NextResponse.json(
        {
          error:
            "Content is required for classification. Please upload a PDF or enable metadata-only classification.",
        },
        { status: 400 },
      );
    }

    // Gate by status
    const allowedStatuses: SourceStatus[] = [
      SourceStatus.ANALYZING_CLASSIFICATION,
      SourceStatus.READY_FOR_ANALYSIS,
      SourceStatus.CLASSIFIED,
    ];
    if (allowMetadataOnly) {
      allowedStatuses.push(SourceStatus.PENDING);
    }

    if (!allowedStatuses.includes(source.status)) {
      return NextResponse.json(
        {
          error: `Classification is only allowed when status is ANALYZING_CLASSIFICATION or READY_FOR_ANALYSIS. Current status: ${source.status}`,
        },
        { status: 400 },
      );
    }

    // Get facets from the new Facet model
    const facets = source.study?.facets || [];

    console.log("[classify] facets from database", {
      sourceId,
      totalFacets: facets.length,
      facetNames: facets.map((f) => f.name),
    });

    if (facets.length === 0) {
      return NextResponse.json(
        {
          error:
            "Classification schema not configured for this study. Please add facets in study parameters.",
        },
        { status: 400 },
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
      openFacets: validFacets.filter((f) => f.type === "OPEN").map((f) => f.name),
      closedFacets: validFacets.filter((f) => f.type === "CLOSED").map((f) => f.name),
      invalidFacets: facets
        .filter((f) => f.type === "CLOSED" && (!f.categories || f.categories.length === 0))
        .map((f) => f.name),
    });

    // Optionally narrow to a single facet
    let facetsToUse = validFacets;
    if (facetId) {
      facetsToUse = validFacets.filter((f) => f.id === facetId);
    } else if (facetName) {
      facetsToUse = validFacets.filter((f) => f.name === facetName);
    }

    if (facetsToUse.length === 0) {
      if (facetId || facetName) {
        return NextResponse.json(
          {
            error: `Facet '${facetId || facetName}' not found or is invalid (CLOSED facets must have categories defined)`,
          },
          { status: 400 },
        );
      }
      return NextResponse.json(
        {
          error:
            "No valid facets found. CLOSED facets must have categories defined, or use OPEN type.",
        },
        { status: 400 },
      );
    }

    // Build classification schema in format Python service expects
    const classificationSchema = facetsToUse.map((facet) => ({
      id: facet.id,
      name: facet.name,
      description: facet.description,
      type: facet.type === "OPEN_CODED" ? "open" : facet.type.toLowerCase(), // OPEN_CODED uses keyword extraction
      required: facet.required,
      categories: facet.categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
      })),
      researchQuestionIds: facet.researchQuestions.map((frq) => frq.researchQuestionId),
    }));

    // Build source content payload preferring chosen/parsed metadata
    const content = {
      title: chosen.title || source.title || "",
      authors: chosen.authors || source.authors || [],
      abstract: chosen.abstract || source.abstract || "",
      venue: chosen.venue || source.venue || "",
      doi: chosen.doi || source.doi || "",
      publication_date: source.publicationDate?.toISOString() || chosen.publicationDate || "",
      content_excerpt: chosen.content_excerpt || "",
    };

    const researchQuestions = source.study?.researchQuestions?.map((rq) => rq.question) || [];

    const studyParametersPayload = {
      research_questions: researchQuestions,
      classification_schema: classificationSchema,
    };

    // Download PDF from MinIO for full-text classification if hasPdf is true
    let pdfBuffer: Buffer | null = null;
    if (source.hasPdf) {
      if (!source.storagePath) {
        console.warn(
          "[classify] Source marked as PDF but storagePath missing. Using extracted metadata only.",
        );
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
        { status: classifyRes.status },
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

    // Build lookup maps
    const facetNameToId = new Map(facetsToUse.map((f) => [f.name, f.id]));
    const facetIdToCategoryMap = new Map(
      facetsToUse.map((f) => [f.id, new Map(f.categories.map((c) => [c.name, c.id]))]),
    );
    const facetById = new Map(facetsToUse.map((f) => [f.id, f]));
    const facetByName = new Map(facetsToUse.map((f) => [f.name, f]));

    // Determine delete scope
    const deleteScope = facetId
      ? { facetId: facetId }
      : facetName
        ? { facetId: facetNameToId.get(facetName) }
        : {};

    const createClassifications: Array<{
      facetId: string;
      categoryId: string | null;
      value: string | null;
      confidence: number;
      reasoning: string;
      isManualOverride: boolean;
    }> = [];
    const keywordCreates: Array<{
      facetId: string;
      keyword: string;
      confidence: number | null;
    }> = [];
    const keywordDedup = new Set<string>();
    const mappingCache = new Map<
      string,
      Map<string, { categoryId: string | null; status: string }>
    >();

    const getFacetMappings = async (facetId: string) => {
      if (mappingCache.has(facetId)) {
        return mappingCache.get(facetId)!;
      }
      const mappings = await prisma.facetKeywordMapping.findMany({
        where: { facetId },
        select: {
          keyword: true,
          categoryId: true,
          status: true,
        },
      });
      const map = new Map<string, { categoryId: string | null; status: string }>();
      for (const mapping of mappings) {
        map.set(mapping.keyword.toLowerCase(), {
          categoryId: mapping.categoryId,
          status: mapping.status,
        });
      }
      mappingCache.set(facetId, map);
      return map;
    };

    const suggestKeywordMapping = async (keyword: string, facet: (typeof facetsToUse)[number]) => {
      const response = await fetch(`${PYTHON_SERVICE_URL}/api/coding/map-keyword`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          categories: facet.categories.map((cat) => ({
            id: cat.id,
            name: cat.name,
            description: cat.description,
          })),
          facet_name: facet.name,
          facet_description: facet.description,
        }),
      });

      if (!response.ok) {
        return null;
      }
      return response.json();
    };

    for (const c of classifications) {
      const cFacetName = c.facetName || c.facet_name || "unknown";
      const cFacetId = c.facetId || facetNameToId.get(cFacetName);
      const facet = cFacetId ? facetById.get(cFacetId) : facetByName.get(cFacetName);
      if (!facet) {
        continue;
      }

      if (facet.type === "OPEN") {
        const keywords = Array.isArray(c.keywords) ? c.keywords : [];
        if (keywords.length === 0) {
          createClassifications.push({
            facetId: facet.id,
            categoryId: null,
            value: null,
            confidence: parseFloat(c.confidence || "0"),
            reasoning: c.reasoning || "No matching values found",
            isManualOverride: false,
          });
        }
        for (const keyword of keywords) {
          if (typeof keyword !== "string" || !keyword.trim()) {
            continue;
          }
          const normalized = `${facet.id}:${keyword.trim().toLowerCase()}`;
          if (keywordDedup.has(normalized)) {
            continue;
          }
          keywordDedup.add(normalized);
          keywordCreates.push({
            facetId: facet.id,
            keyword: keyword.trim(),
            confidence: c.confidence !== undefined ? parseFloat(c.confidence) : null,
          });
          createClassifications.push({
            facetId: facet.id,
            categoryId: null,
            value: keyword.trim(),
            confidence: parseFloat(c.confidence || 0),
            reasoning: c.reasoning || "",
            isManualOverride: false,
          });
        }
        continue;
      }

      if (facet.type === "OPEN_CODED") {
        const keywords = Array.isArray(c.keywords) ? c.keywords : [];
        if (keywords.length === 0) {
          createClassifications.push({
            facetId: facet.id,
            categoryId: null,
            value: null,
            confidence: parseFloat(c.confidence || "0"),
            reasoning: c.reasoning || "No matching values found",
            isManualOverride: false,
          });
        }
        const mappingMap = await getFacetMappings(facet.id);
        for (const keyword of keywords) {
          if (typeof keyword !== "string" || !keyword.trim()) {
            continue;
          }
          const trimmed = keyword.trim();
          const normalized = trimmed.toLowerCase();
          const dedupKey = `${facet.id}:${normalized}`;
          if (!keywordDedup.has(dedupKey)) {
            keywordDedup.add(dedupKey);
            keywordCreates.push({
              facetId: facet.id,
              keyword: trimmed,
              confidence: c.confidence !== undefined ? parseFloat(c.confidence) : null,
            });
          }

          const existing = mappingMap.get(normalized);
          if (existing && existing.status === "APPROVED" && existing.categoryId) {
            createClassifications.push({
              facetId: facet.id,
              categoryId: existing.categoryId,
              value: null,
              confidence: parseFloat(c.confidence || 0),
              reasoning: c.reasoning || "Mapped from approved keyword",
              isManualOverride: false,
            });
            continue;
          }

          if (!existing) {
            const suggestion = await suggestKeywordMapping(trimmed, facet);
            if (suggestion) {
              const match = facet.categories.find(
                (cat) => cat.name.toLowerCase() === (suggestion.category_name || "").toLowerCase(),
              );
              await prisma.facetKeywordMapping.upsert({
                where: {
                  facetId_keyword: {
                    facetId: facet.id,
                    keyword: trimmed,
                  },
                },
                create: {
                  facetId: facet.id,
                  keyword: trimmed,
                  categoryId: match?.id || null,
                  status: "PENDING",
                  confidence: suggestion.confidence ?? null,
                  source: "LLM",
                  proposedCategoryName: suggestion.proposed_category_name || null,
                  proposedCategoryDescription: suggestion.proposed_category_description || null,
                },
                update: {
                  categoryId: match?.id || null,
                  status: "PENDING",
                  confidence: suggestion.confidence ?? null,
                  source: "LLM",
                  proposedCategoryName: suggestion.proposed_category_name || null,
                  proposedCategoryDescription: suggestion.proposed_category_description || null,
                },
              });
              mappingMap.set(normalized, { categoryId: match?.id || null, status: "PENDING" });
            }
          }
        }
        continue;
      }

      const categoryMap = facetIdToCategoryMap.get(facet.id) || null;
      const cCategoryId = categoryMap?.get(c.category) || null;

      createClassifications.push({
        facetId: facet.id,
        categoryId: cCategoryId,
        value: null,
        confidence: parseFloat(c.confidence || 0),
        reasoning: c.reasoning || "",
        isManualOverride: false,
      });
    }

    const openFacetIds = facetsToUse.filter((f) => f.type === "OPEN").map((f) => f.id);
    const facetKeywordUpdate =
      openFacetIds.length > 0
        ? {
            deleteMany: { facetId: { in: openFacetIds } },
            create: keywordCreates,
          }
        : keywordCreates.length > 0
          ? { create: keywordCreates }
          : undefined;

    const hasFullText = !!content.content_excerpt || (!!pdfBuffer && pdfBuffer.length > 0);
    const classificationBasis = hasFullText ? "FULL_TEXT" : "METADATA_ONLY";

    const analysis = await prisma.sourceAnalysis.upsert({
      where: { sourceId },
      update: {
        classificationBasis,
        classifications: {
          deleteMany: deleteScope,
          create: createClassifications,
        },
        ...(facetKeywordUpdate ? { facetKeywords: facetKeywordUpdate } : {}),
      },
      create: {
        sourceId,
        extractedText: "",
        inclusionRecommendation: source.analysis?.inclusionRecommendation ?? false,
        inclusionReasoning: source.analysis?.inclusionReasoning || "",
        exclusionReasoning: source.analysis?.exclusionReasoning || "",
        confidenceScore: avgConfidence,
        classificationBasis,
        relevanceScore: source.analysis?.relevanceScore || null,
        qualityNotes: source.analysis?.qualityNotes || null,
        inclusionCriteria: source.analysis?.inclusionCriteria || [],
        exclusionCriteria: source.analysis?.exclusionCriteria || [],
        classifications: { create: createClassifications },
        facetKeywords: { create: keywordCreates },
      },
      include: {
        classifications: {
          include: {
            facet: true,
            category: true,
          },
        },
        facetKeywords: true,
      },
    });
    console.log("[classify] analysis saved", {
      sourceId,
      analysisId: analysis.id,
      classifications: analysis.classifications?.length ?? 0,
    });

    // Mark source as analyzed and included
    await prisma.source.update({
      where: { id: sourceId },
      data: {
        status: SourceStatus.CLASSIFIED,
        finalDecision: "INCLUDE",
      },
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
      {
        error: "Failed to classify source",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
