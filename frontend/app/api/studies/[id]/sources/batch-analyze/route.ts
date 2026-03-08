import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { STUDY_WITH_CRITERIA_AND_FACETS_INCLUDE } from "@/lib/queries/study-includes";
import {
  getChosenMetadata,
  buildSourceContent,
  buildClassificationSchema,
  downloadSourcePdf,
  callPythonService,
} from "@/lib/api-utils/source-preparation";
import {
  normalizeInclusionResult,
  persistInclusionAnalysis,
  persistVotingData,
  updateSourceStatusAfterAnalysis,
} from "@/lib/api-utils/analysis-persistence";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;

    console.log("[batch-analyze] start", { studyId });

    const pendingSources = await prisma.source.findMany({
      where: { studyId, status: "PENDING" },
      include: {
        study: { include: STUDY_WITH_CRITERIA_AND_FACETS_INCLUDE },
        analysis: true,
      },
    });

    console.log("[batch-analyze] found sources", { studyId, count: pendingSources.length });

    const stream = new ReadableStream({
      async start(controller) {
        let successCount = 0;
        let errorCount = 0;
        const includedCount = { value: 0 };
        const excludedCount = { value: 0 };
        const encoder = new TextEncoder();

        const sendEvent = (data: Record<string, any>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

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

              const chosen = getChosenMetadata(source);
              const hasTextContent = !!chosen.content_excerpt;
              const hasAbstract = !!(chosen.abstract || source.abstract);

              if (!source.storagePath && !hasTextContent && !hasAbstract) {
                sendEvent({
                  type: "progress",
                  current,
                  total,
                  sourceId: source.id,
                  sourceTitle: source.title,
                  status: "skipped",
                  message: "No content available for analysis",
                });
                errorCount++;
                continue;
              }

              // Build payloads
              const sourceContent = buildSourceContent(source, chosen);
              const researchQuestions = source.study?.researchQuestions?.map((rq) => rq.question) || [];
              const inclusionCriteriaList =
                source.study?.parameters?.inclusionCriteria?.map((c) => c.criterion) || [];
              const exclusionCriteriaList =
                source.study?.parameters?.exclusionCriteria?.map((c) => c.criterion) || [];
              const classificationSchema = buildClassificationSchema(source.study?.facets || []);

              // Set status to analyzing
              await prisma.source.update({
                where: { id: source.id },
                data: { status: "ANALYZING_INCLUSION" },
              });

              // Download PDF if available
              const pdfBuffer = await downloadSourcePdf(source, {
                throwOnError: true,
                logPrefix: "[batch-analyze]",
              });

              // Call Python service
              const analyzePayload = {
                source_id: source.id,
                study_parameters: {
                  research_questions: researchQuestions,
                  inclusion_criteria: inclusionCriteriaList,
                  exclusion_criteria: exclusionCriteriaList,
                  classification_schema: classificationSchema,
                },
                source_content: sourceContent,
                previous_response_id: source.classificationThreadId,
              };

              const endpoint = pdfBuffer
                ? "/api/analyze-inclusion/file"
                : "/api/analyze-inclusion/text";
              const analyzeRes = await callPythonService(endpoint, analyzePayload, pdfBuffer);

              if (!analyzeRes.ok) {
                console.error("[batch-analyze] python-service failed", {
                  sourceId: source.id,
                  status: analyzeRes.status,
                });
                throw new Error(`Python service error: ${analyzeRes.status}`);
              }

              const analysisResult = await analyzeRes.json();

              // Normalize, persist, and update status
              const normalized = normalizeInclusionResult(analysisResult);
              const analysis = await persistInclusionAnalysis(
                source.id,
                sourceContent.content_excerpt,
                analysisResult,
                normalized,
              );

              if (normalized.votingEnabled) {
                await persistVotingData(
                  analysis.id,
                  normalized.inclusionCriteria,
                  normalized.exclusionCriteria,
                );
              }

              const newStatus = await updateSourceStatusAfterAnalysis(
                source.id,
                analysis,
                normalized.contextResponseId,
              );

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

              sendEvent({
                type: "progress",
                current,
                total,
                sourceId: source.id,
                sourceTitle: source.title,
                status: "success",
                message: "Analysis completed",
              });
            } catch (itemError) {
              errorCount++;
              console.error("[batch-analyze] error processing source", {
                sourceId: source.id,
                error: itemError instanceof Error ? itemError.message : String(itemError),
              });

              try {
                await prisma.source.update({
                  where: { id: source.id },
                  data: { status: "NEEDS_REVIEW" },
                });
              } catch (e) {
                console.error("[batch-analyze] failed to set NEEDS_REVIEW", e);
              }

              sendEvent({
                type: "progress",
                current: i + 1,
                total: pendingSources.length,
                sourceId: source.id,
                sourceTitle: source.title,
                status: "error",
                message: itemError instanceof Error ? itemError.message : "Unknown error",
              });
            }
          }

          sendEvent({
            type: "complete",
            summary: {
              total: pendingSources.length,
              success: successCount,
              errors: errorCount,
              included: includedCount.value,
              excluded: excludedCount.value,
            },
          });

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
