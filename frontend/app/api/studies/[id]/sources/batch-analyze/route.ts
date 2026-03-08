import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { downloadFile } from "@/lib/minio";

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;

    console.log("[batch-analyze] start", { studyId });

    // Fetch all PENDING sources
    const pendingSources = await prisma.source.findMany({
      where: { studyId, status: "PENDING" },
      include: {
        study: {
          include: {
            researchQuestions: { orderBy: { order: "asc" } },
            parameters: {
              include: {
                inclusionCriteria: { orderBy: { order: "asc" } },
                exclusionCriteria: { orderBy: { order: "asc" } },
              },
            },
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

    console.log("[batch-analyze] found sources", {
      studyId,
      count: pendingSources.length,
    });

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        let successCount = 0;
        let errorCount = 0;
        const includedCount = { value: 0 };
        const excludedCount = { value: 0 };

        const encoder = new TextEncoder();

        try {
          for (let i = 0; i < pendingSources.length; i++) {
            const source = pendingSources[i];
            const current = i + 1;
            const total = pendingSources.length;

            try {
              console.log(`[batch-analyze] processing ${current}/${total}`, {
                sourceId: source.id,
                title: source.title,
              });

              const chosen: any =
                source.metadataChosen || source.metadataParsed || source.metadataExtension || {};
              const hasTextContent = !!chosen.content_excerpt;
              const hasAbstract = !!(chosen.abstract || source.abstract);

              // Skip if no content
              if (!source.storagePath && !hasTextContent && !hasAbstract) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "progress",
                      current,
                      total,
                      sourceId: source.id,
                      sourceTitle: source.title,
                      status: "skipped",
                      message: "No content available for analysis",
                    })}\n\n`,
                  ),
                );
                errorCount++;
                continue;
              }

              // Gather study parameters
              const studyInclusionCriteria =
                source.study?.parameters?.inclusionCriteria?.map((c) => c.criterion) || [];
              const studyExclusionCriteria =
                source.study?.parameters?.exclusionCriteria?.map((c) => c.criterion) || [];
              const researchQuestions =
                source.study?.researchQuestions?.map((rq) => rq.question) || [];

              // Build classification schema
              const classificationSchema = (source.study?.facets || []).map((facet) => ({
                id: facet.id,
                name: facet.name,
                description: facet.description,
                type: facet.type.toLowerCase(),
                required: facet.required,
                categories: facet.categories.map((cat) => ({
                  id: cat.id,
                  name: cat.name,
                  description: cat.description,
                })),
                researchQuestionIds: facet.researchQuestions.map((frq) => frq.researchQuestionId),
              }));

              // Build source content
              const sourceContent = {
                title: chosen.title || source.title || "",
                authors: chosen.authors || source.authors || [],
                abstract: chosen.abstract || source.abstract || "",
                venue: chosen.venue || source.venue || "",
                doi: chosen.doi || source.doi || "",
                content_excerpt: chosen.content_excerpt || "",
              };

              // Update status
              await prisma.source.update({
                where: { id: source.id },
                data: { status: "ANALYZING_INCLUSION" },
              });

              // Download PDF if available
              let pdfBuffer: Buffer | null = null;
              if (source.hasPdf) {
                if (!source.storagePath) {
                  throw new Error("Source is marked as PDF but has no storage path");
                }
                try {
                  pdfBuffer = await downloadFile(source.storagePath);
                  console.log("[batch-analyze] PDF downloaded", {
                    sourceId: source.id,
                    size: pdfBuffer.length,
                  });
                } catch (error) {
                  console.error("[batch-analyze] PDF download failed", {
                    sourceId: source.id,
                    error,
                  });
                  throw new Error("Failed to download PDF file for analysis");
                }
              }

              // Prepare payload
              const analyzePayload = {
                source_id: source.id,
                study_parameters: {
                  research_questions: researchQuestions,
                  inclusion_criteria: studyInclusionCriteria,
                  exclusion_criteria: studyExclusionCriteria,
                  classification_schema: classificationSchema,
                },
                source_content: sourceContent,
                previous_response_id: source.classificationThreadId,
              };

              // Call Python service
              let analyzeRes;
              if (source.hasPdf && pdfBuffer && pdfBuffer.length > 0) {
                const formData = new FormData();
                formData.append("payload", JSON.stringify(analyzePayload));
                const pdfBlob = new Blob([new Uint8Array(pdfBuffer)], {
                  type: "application/pdf",
                });
                formData.append("file", pdfBlob, "source.pdf");

                analyzeRes = await fetch(`${PYTHON_SERVICE_URL}/api/analyze-inclusion/file`, {
                  method: "POST",
                  body: formData as any,
                });
              } else {
                analyzeRes = await fetch(`${PYTHON_SERVICE_URL}/api/analyze-inclusion/text`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(analyzePayload),
                });
              }

              if (!analyzeRes.ok) {
                const detail = await analyzeRes.json().catch(() => ({}));
                console.error("[batch-analyze] python-service failed", {
                  sourceId: source.id,
                  status: analyzeRes.status,
                });
                throw new Error(`Python service error: ${analyzeRes.status}`);
              }

              const analysisResult = await analyzeRes.json();

              // Normalize field names
              const inclusionCriteria = (
                analysisResult.inclusionCriteria ||
                analysisResult.inclusion_criteria ||
                []
              ).map((c: any) => ({
                criterion: c.criterion,
                fulfilled: c.decision ?? c.fulfilled ?? false,
                reasoning: c.reasoning || "",
                confidence: c.confidence ?? 0.5,
              }));

              const exclusionCriteria = (
                analysisResult.exclusionCriteria ||
                analysisResult.exclusion_criteria ||
                []
              ).map((c: any) => ({
                criterion: c.criterion,
                fulfilled: c.decision ?? c.fulfilled ?? false,
                reasoning: c.reasoning || "",
                confidence: c.confidence ?? 0.5,
              }));

              const inclusionReasoning =
                analysisResult.inclusionReasoning || analysisResult.inclusion_reasoning || "";
              const exclusionReasoning =
                analysisResult.exclusionReasoning || analysisResult.exclusion_reasoning || "";
              const relevanceScore =
                analysisResult.relevanceScore ?? analysisResult.relevance_score ?? null;
              const qualityNotes =
                analysisResult.qualityNotes || analysisResult.quality_notes || null;

              // Extract voting data
              const votingEnabled =
                analysisResult.votingEnabled || analysisResult.voting_enabled || false;
              const votingSummary =
                analysisResult.votingSummary || analysisResult.voting_summary || null;

              // Save analysis
              const analysis = await prisma.sourceAnalysis.upsert({
                where: { sourceId: source.id },
                update: {
                  extractedText: sourceContent.content_excerpt || "",
                  inclusionRecommendation: analysisResult.recommendation === "include",
                  inclusionReasoning,
                  exclusionReasoning,
                  confidenceScore: parseFloat(analysisResult.confidence || 0),
                  relevanceScore,
                  qualityNotes,
                  inclusionCriteria,
                  exclusionCriteria,
                  votingEnabled,
                  votingSummary,
                },
                create: {
                  sourceId: source.id,
                  extractedText: sourceContent.content_excerpt || "",
                  inclusionRecommendation: analysisResult.recommendation === "include",
                  inclusionReasoning,
                  exclusionReasoning,
                  confidenceScore: parseFloat(analysisResult.confidence || 0),
                  relevanceScore,
                  qualityNotes,
                  inclusionCriteria,
                  exclusionCriteria,
                  votingEnabled,
                  votingSummary,
                },
              });

              // Store votes if voting was used
              if (votingEnabled) {
                await prisma.analysisVote.deleteMany({
                  where: { analysisId: analysis.id },
                });

                const votesToCreate: any[] = [];

                inclusionCriteria.forEach((criterion: any, index: number) => {
                  const votingDetails = criterion.votingDetails || criterion.voting_details;
                  if (votingDetails?.votes) {
                    votingDetails.votes.forEach((vote: any) => {
                      votesToCreate.push({
                        analysisId: analysis.id,
                        criterionType: "INCLUSION",
                        criterionIndex: index,
                        criterionText: criterion.criterion,
                        provider: vote.provider,
                        decision: vote.decision,
                        confidence: vote.confidence,
                        reasoning: vote.reasoning || null,
                        error: vote.error || null,
                      });
                    });
                  }
                });

                exclusionCriteria.forEach((criterion: any, index: number) => {
                  const votingDetails = criterion.votingDetails || criterion.voting_details;
                  if (votingDetails?.votes) {
                    votingDetails.votes.forEach((vote: any) => {
                      votesToCreate.push({
                        analysisId: analysis.id,
                        criterionType: "EXCLUSION",
                        criterionIndex: index,
                        criterionText: criterion.criterion,
                        provider: vote.provider,
                        decision: vote.decision,
                        confidence: vote.confidence,
                        reasoning: vote.reasoning || null,
                        error: vote.error || null,
                      });
                    });
                  }
                });

                if (votesToCreate.length > 0) {
                  await prisma.analysisVote.createMany({
                    data: votesToCreate,
                  });
                }
              }

              // Set status based on recommendation
              const newStatus = analysis.inclusionRecommendation
                ? "ANALYZING_CLASSIFICATION"
                : "EXCLUDED";
              await prisma.source.update({
                where: { id: source.id },
                data: {
                  status: newStatus,
                  classificationThreadId:
                    analysisResult.contextResponseId ||
                    analysisResult.context_response_id ||
                    undefined,
                },
              });

              if (newStatus === "ANALYZING_CLASSIFICATION") {
                includedCount.value++;
              } else {
                excludedCount.value++;
              }

              successCount++;
              console.log(`[batch-analyze] completed ${current}/${total}`, {
                sourceId: source.id,
                status: newStatus,
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
                    message: "Analysis completed",
                  })}\n\n`,
                ),
              );
            } catch (itemError) {
              errorCount++;
              console.error(`[batch-analyze] error processing source`, {
                sourceId: source.id,
                error: itemError instanceof Error ? itemError.message : String(itemError),
              });

              // Try to set status to NEEDS_REVIEW
              try {
                await prisma.source.update({
                  where: { id: source.id },
                  data: { status: "NEEDS_REVIEW" },
                });
              } catch (e) {
                console.error("[batch-analyze] failed to set NEEDS_REVIEW", e);
              }

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "progress",
                    current: i + 1,
                    total: pendingSources.length,
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
                  total: pendingSources.length,
                  success: successCount,
                  errors: errorCount,
                  included: includedCount.value,
                  excluded: excludedCount.value,
                },
              })}\n\n`,
            ),
          );

          controller.close();
        } catch (error) {
          console.error("[batch-analyze] stream error", error);
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
    console.error("[batch-analyze] error", error);
    return NextResponse.json(
      {
        error: "Batch analysis failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
