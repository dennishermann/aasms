import { NextRequest, NextResponse } from "next/server";
import { SourceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { STUDY_WITH_FACETS_INCLUDE } from "@/lib/queries/study-includes";
import {
  getChosenMetadata,
  buildSourceContent,
  buildClassificationSchema,
  downloadSourcePdf,
  callPythonService,
} from "@/lib/api-utils/source-preparation";
import { processClassificationResults } from "@/lib/api-utils/classification-persistence";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;

    console.log("[batch-classify] start", { studyId });

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
        study: { include: STUDY_WITH_FACETS_INCLUDE },
        analysis: {
          include: {
            classifications: true,
          },
        },
      },
    });

    console.log("[batch-classify] found sources", { studyId, count: sources.length });

    const stream = new ReadableStream({
      async start(controller) {
        let successCount = 0;
        let errorCount = 0;
        const encoder = new TextEncoder();

        const sendEvent = (data: Record<string, any>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

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

              const chosen = getChosenMetadata(source);
              const hasTextContent = !!chosen.content_excerpt;
              const hasAbstract = !!(chosen.abstract || source.abstract);
              const allowMetadataOnly = source.allowMetadataOnlyClassification && hasAbstract;

              if (!source.storagePath && !hasTextContent && !allowMetadataOnly) {
                sendEvent({
                  type: "progress",
                  current,
                  total,
                  sourceId: source.id,
                  sourceTitle: source.title,
                  status: "skipped",
                  message: "No content available for classification",
                });
                errorCount++;
                continue;
              }

              // Validate facets
              const facets = source.study?.facets || [];
              if (facets.length === 0) {
                throw new Error("Classification schema not configured for this study");
              }

              const validFacets = facets.filter(
                (f) => f.type === "OPEN" || (f.categories && f.categories.length > 0),
              );
              if (validFacets.length === 0) {
                throw new Error("No valid facets found for classification");
              }

              // Build payloads
              const content = buildSourceContent(source, chosen, { includePublicationDate: true });
              const classificationSchema = buildClassificationSchema(validFacets);
              const researchQuestions =
                source.study?.researchQuestions?.map((rq) => rq.question) || [];

              // Update status
              await prisma.source.update({
                where: { id: source.id },
                data: { status: SourceStatus.ANALYZING_CLASSIFICATION },
              });

              // Download PDF
              const pdfBuffer = await downloadSourcePdf(source, {
                logPrefix: "[batch-classify]",
              });

              // Call Python service
              const classifyPayload = {
                sourceId: source.id,
                sourceContent: content,
                studyParameters: {
                  research_questions: researchQuestions,
                  classification_schema: classificationSchema,
                },
                classificationThreadId: source.classificationThreadId,
              };

              const endpoint = pdfBuffer ? "/api/classify/file" : "/api/classify/text";
              const classifyRes = await callPythonService(endpoint, classifyPayload, pdfBuffer);

              if (!classifyRes.ok) {
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

              // Process and persist classifications
              await processClassificationResults({
                sourceId: source.id,
                classifications,
                facetsToUse: validFacets,
                existingAnalysis: source.analysis,
                deleteScope: {},
                sourceContent: content,
                pdfBuffer,
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

              sendEvent({
                type: "progress",
                current,
                total,
                sourceId: source.id,
                sourceTitle: source.title,
                status: "success",
                message: "Classification completed",
              });
            } catch (itemError) {
              errorCount++;
              console.error("[batch-classify] error processing source", {
                sourceId: source.id,
                error: itemError instanceof Error ? itemError.message : String(itemError),
              });

              try {
                await prisma.source.update({
                  where: { id: source.id },
                  data: { status: SourceStatus.READY_FOR_ANALYSIS },
                });
              } catch (e) {
                console.error("[batch-classify] failed to reset status", e);
              }

              sendEvent({
                type: "progress",
                current: i + 1,
                total: sources.length,
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
              total: sources.length,
              success: successCount,
              errors: errorCount,
            },
          });

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
