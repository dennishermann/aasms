import { NextRequest, NextResponse } from "next/server";
import { SourceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { downloadFile } from "@/lib/minio";
import { PYTHON_SERVICE_URL } from "@/lib/python-service";


export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;

    console.log("[batch-classify] start", { studyId });

    // Fetch all ANALYZING_CLASSIFICATION sources or CLASSIFIED sources without classification
    const sources = await prisma.source.findMany({
      where: {
        studyId,
        OR: [
          { status: "ANALYZING_CLASSIFICATION" },
          {
            status: "CLASSIFIED",
            analysis: {
              classifications: { none: {} },
            },
          },
        ],
      },
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
        analysis: {
          include: {
            classifications: true,
          },
        },
      },
    });

    console.log("[batch-classify] found sources", {
      studyId,
      count: sources.length,
    });

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        let successCount = 0;
        let errorCount = 0;

        const encoder = new TextEncoder();

        try {
          for (let i = 0; i < sources.length; i++) {
            const source = sources[i];
            const current = i + 1;
            const total = sources.length;

            try {
              console.log(`[batch-classify] processing ${current}/${total}`, {
                sourceId: source.id,
                title: source.title,
              });

              const chosen: any =
                source.metadataChosen || source.metadataParsed || source.metadataExtension || {};
              const hasTextContent = !!chosen.content_excerpt;
              const hasAbstract = !!(chosen.abstract || source.abstract);
              const allowMetadataOnly = source.allowMetadataOnlyClassification && hasAbstract;

              // Skip if no content
              if (!source.storagePath && !hasTextContent && !allowMetadataOnly) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "progress",
                      current,
                      total,
                      sourceId: source.id,
                      sourceTitle: source.title,
                      status: "skipped",
                      message: "No content available for classification",
                    })}\n\n`,
                  ),
                );
                errorCount++;
                continue;
              }

              // Get facets
              const facets = source.study?.facets || [];

              if (facets.length === 0) {
                throw new Error("Classification schema not configured for this study");
              }

              // Filter valid facets
              const validFacets = facets.filter((f) => {
                const isOpen = f.type === "OPEN";
                const hasCategories = f.categories && f.categories.length > 0;
                return isOpen || hasCategories;
              });

              if (validFacets.length === 0) {
                throw new Error("No valid facets found for classification");
              }

              // Build classification schema
              const classificationSchema = validFacets.map((facet) => ({
                id: facet.id,
                name: facet.name,
                description: facet.description,
                type: facet.type === "OPEN_CODED" ? "open" : facet.type.toLowerCase(),
                required: facet.required,
                categories: facet.categories.map((cat) => ({
                  id: cat.id,
                  name: cat.name,
                  description: cat.description,
                })),
                researchQuestionIds: facet.researchQuestions.map((frq) => frq.researchQuestionId),
              }));

              // Build source content
              const content = {
                title: chosen.title || source.title || "",
                authors: chosen.authors || source.authors || [],
                abstract: chosen.abstract || source.abstract || "",
                venue: chosen.venue || source.venue || "",
                doi: chosen.doi || source.doi || "",
                publication_date:
                  source.publicationDate?.toISOString() || chosen.publicationDate || "",
                content_excerpt: chosen.content_excerpt || "",
              };

              const researchQuestions =
                source.study?.researchQuestions?.map((rq) => rq.question) || [];

              const studyParametersPayload = {
                research_questions: researchQuestions,
                classification_schema: classificationSchema,
              };

              // Update status
              await prisma.source.update({
                where: { id: source.id },
                data: { status: SourceStatus.ANALYZING_CLASSIFICATION },
              });

              // Download PDF if available
              let pdfBuffer: Buffer | null = null;
              if (source.hasPdf) {
                if (!source.storagePath) {
                  console.warn("[batch-classify] Source marked as PDF but storagePath missing");
                } else {
                  try {
                    pdfBuffer = await downloadFile(source.storagePath);
                    console.log("[batch-classify] PDF downloaded", {
                      sourceId: source.id,
                      size: pdfBuffer.length,
                    });
                  } catch (error) {
                    console.error("[batch-classify] PDF download failed", {
                      sourceId: source.id,
                      error,
                    });
                  }
                }
              }

              // Prepare payload
              const classifyPayload = {
                sourceId: source.id,
                sourceContent: content,
                studyParameters: studyParametersPayload,
                classificationThreadId: source.classificationThreadId,
              };

              // Call Python service
              let classifyRes;
              if (source.hasPdf && pdfBuffer && pdfBuffer.length > 0) {
                const formData = new FormData();
                formData.append("payload", JSON.stringify(classifyPayload));
                const pdfBlob = new Blob([new Uint8Array(pdfBuffer)], {
                  type: "application/pdf",
                });
                formData.append("file", pdfBlob, "source.pdf");

                classifyRes = await fetch(`${PYTHON_SERVICE_URL}/api/classify/file`, {
                  method: "POST",
                  body: formData as any,
                });
              } else {
                classifyRes = await fetch(`${PYTHON_SERVICE_URL}/api/classify/text`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(classifyPayload),
                });
              }

              if (!classifyRes.ok) {
                const detail = await classifyRes.json().catch(() => ({}));
                console.error("[batch-classify] python-service failed", {
                  sourceId: source.id,
                  status: classifyRes.status,
                });
                throw new Error(`Python service error: ${classifyRes.status}`);
              }

              const classifyJson = await classifyRes.json();
              const classifications = Array.isArray(classifyJson.classifications)
                ? classifyJson.classifications
                : [];

              const avgConfidence =
                classifications.length > 0
                  ? classifications.reduce((sum: number, c: any) => sum + (c.confidence || 0), 0) /
                    classifications.length
                  : source.analysis?.confidenceScore || 0.5;

              // Build lookup maps
              const facetNameToId = new Map(validFacets.map((f) => [f.name, f.id]));
              const facetIdToCategoryMap = new Map(
                validFacets.map((f) => [f.id, new Map(f.categories.map((c) => [c.name, c.id]))]),
              );
              const facetById = new Map(validFacets.map((f) => [f.id, f]));
              const facetByName = new Map(validFacets.map((f) => [f.name, f]));

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

              const suggestKeywordMapping = async (
                keyword: string,
                facet: (typeof validFacets)[number],
              ) => {
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
                          (cat) =>
                            cat.name.toLowerCase() ===
                            (suggestion.category_name || "").toLowerCase(),
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
                            proposedCategoryDescription:
                              suggestion.proposed_category_description || null,
                          },
                          update: {
                            categoryId: match?.id || null,
                            status: "PENDING",
                            confidence: suggestion.confidence ?? null,
                            source: "LLM",
                            proposedCategoryName: suggestion.proposed_category_name || null,
                            proposedCategoryDescription:
                              suggestion.proposed_category_description || null,
                          },
                        });
                        mappingMap.set(normalized, {
                          categoryId: match?.id || null,
                          status: "PENDING",
                        });
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

              const openFacetIds = validFacets.filter((f) => f.type === "OPEN").map((f) => f.id);
              const facetKeywordUpdate =
                openFacetIds.length > 0
                  ? {
                      deleteMany: { facetId: { in: openFacetIds } },
                      create: keywordCreates,
                    }
                  : keywordCreates.length > 0
                    ? { create: keywordCreates }
                    : undefined;

              const hasFullText =
                !!content.content_excerpt || (!!pdfBuffer && pdfBuffer.length > 0);
              const classificationBasis = hasFullText ? "FULL_TEXT" : "METADATA_ONLY";

              const analysis = await prisma.sourceAnalysis.upsert({
                where: { sourceId: source.id },
                update: {
                  classificationBasis,
                  classifications: {
                    deleteMany: {},
                    create: createClassifications,
                  },
                  ...(facetKeywordUpdate ? { facetKeywords: facetKeywordUpdate } : {}),
                },
                create: {
                  sourceId: source.id,
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
              });

              // Update source status
              await prisma.source.update({
                where: { id: source.id },
                data: {
                  status: SourceStatus.CLASSIFIED,
                  finalDecision: "INCLUDE",
                },
              });

              successCount++;
              console.log(`[batch-classify] completed ${current}/${total}`, {
                sourceId: source.id,
              });

              // Send progress event
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "progress",
                    current,
                    total,
                    sourceId: source.id,
                    sourceTitle: source.title,
                    status: "success",
                    message: "Classification completed",
                  })}\n\n`,
                ),
              );
            } catch (itemError) {
              errorCount++;
              console.error(`[batch-classify] error processing source`, {
                sourceId: source.id,
                error: itemError instanceof Error ? itemError.message : String(itemError),
              });

              // Try to rollback status
              try {
                await prisma.source.update({
                  where: { id: source.id },
                  data: { status: SourceStatus.READY_FOR_ANALYSIS },
                });
              } catch (e) {
                console.error("[batch-classify] failed to reset status", e);
              }

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "progress",
                    current: i + 1,
                    total: sources.length,
                    sourceId: source.id,
                    sourceTitle: source.title,
                    status: "error",
                    message: itemError instanceof Error ? itemError.message : "Unknown error",
                  })}\n\n`,
                ),
              );
            }
          }

          // Send completion event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "complete",
                summary: {
                  total: sources.length,
                  success: successCount,
                  errors: errorCount,
                },
              })}\n\n`,
            ),
          );

          controller.close();
        } catch (error) {
          console.error("[batch-classify] stream error", error);
          controller.error(error);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[batch-classify] error", error);
    return NextResponse.json(
      {
        error: "Batch classification failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
