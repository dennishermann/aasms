import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

// Force dynamic needed to stream response?
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;
    const { sourceIds } = await request.json();

    if (!sourceIds || !Array.isArray(sourceIds) || sourceIds.length === 0) {
      return NextResponse.json({ error: "No source IDs provided" }, { status: 400 });
    }

    // 1. Fetch Full Source Data
    const sources = await prisma.source.findMany({
      where: { id: { in: sourceIds }, studyId: studyId },
      include: {
        study: {
          include: {
            parameters: {
              include: {
                inclusionCriteria: { orderBy: { order: "asc" } },
                exclusionCriteria: { orderBy: { order: "asc" } },
              },
            },
            researchQuestions: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    if (sources.length === 0) {
      return NextResponse.json({ error: "Sources not found" }, { status: 404 });
    }

    // Assume all sources belong to same study/params (batch)
    const firstSource = sources[0];
    const research_questions = firstSource.study.researchQuestions.map((rq) => rq.question);
    const inclusion_criteria =
      firstSource.study.parameters?.inclusionCriteria.map((ic) => ic.criterion) || [];
    const exclusion_criteria =
      firstSource.study.parameters?.exclusionCriteria.map((ic) => ic.criterion) || [];

    // Map to Python payload
    // We map existing Ids to the index implicitly by order?
    // Or we pass the ID inside "database_specific" or similar?
    // Python's ImportOrchestrator._check_with_index calls check_relevance.
    // The result event sends back the INDEX and source title.
    // We need to map back to Source ID to update DB.
    // Let's create a map of index -> sourceId.
    const sourceMap: { [key: number]: any } = {};
    const pythonSourcesPayload = sources.map((s, idx) => {
      sourceMap[idx] = s;
      return {
        title: s.title,
        authors: s.authors,
        publication_date: s.publicationDate
          ? s.publicationDate.getFullYear().toString()
          : undefined,
        year: s.publicationDate ? s.publicationDate.getFullYear() : undefined, // legacy compat
        venue: s.venue,
        doi: s.doi,
        abstract: s.abstract,
        url: s.originalUrl,
        // Include existing ID in extra fields via database_specific if needed by Python?
        // Python routes.py uses ParsedSourceResult which has database_specific.
        // But orchestrator logic splits via index.
        // We rely on index.
      };
    });

    // 2. Call Python Streaming Endpoint
    console.log(`[StreamProxy] Calling Python stream for ${sources.length} sources...`);
    const pythonRes = await fetch(`${PYTHON_SERVICE_URL}/api/import/process-batch-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sources: pythonSourcesPayload,
        research_questions,
        inclusion_criteria,
        exclusion_criteria,
      }),
    });

    if (!pythonRes.ok) {
      const txt = await pythonRes.text();
      return NextResponse.json(
        { error: "Python service failed", details: txt },
        { status: pythonRes.status },
      );
    }

    if (!pythonRes.body) {
      return NextResponse.json({ error: "No response body from Python" }, { status: 500 });
    }

    // 3. Create Transform Stream to Intercept and Update DB
    const reader = pythonRes.body.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        console.log("[StreamProxy] Starting stream pipe");
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log("[StreamProxy] Python stream done");
              break;
            }

            // Check if controller is still open before processing
            if (controller.desiredSize === null) {
              console.log("[StreamProxy] Client disconnected, aborting");
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter((line) => line.trim() !== "");
            // console.log(`[StreamProxy] Received chunk with ${lines.length} lines`);

            for (const line of lines) {
              try {
                const event = JSON.parse(line);

                if (event.type === "progress" && event.result) {
                  const idx = event.index;
                  const source = sourceMap[idx];
                  const result = event.result;

                  if (source) {
                    // Update DB
                    const isRelevant = result.is_relevant;
                    await prisma.source.update({
                      where: { id: source.id },
                      data: {
                        status: isRelevant ? "PENDING" : "EXCLUDED",
                        needsPdf: isRelevant,
                        finalDecision: isRelevant ? null : "EXCLUDE",
                        decisionRationale: result.reasoning,
                        analysis: {
                          upsert: {
                            create: {
                              extractedText: "",
                              inclusionRecommendation: isRelevant,
                              inclusionReasoning: result.reasoning,
                              exclusionReasoning: isRelevant ? "" : result.reasoning,
                              confidenceScore: result.confidence,
                              inclusionCriteria: result.inclusion_criteria || [],
                              exclusionCriteria: result.exclusion_criteria || [],
                            },
                            update: {
                              inclusionRecommendation: isRelevant,
                              inclusionReasoning: result.reasoning,
                              exclusionReasoning: isRelevant ? "" : result.reasoning,
                              confidenceScore: result.confidence,
                              inclusionCriteria: result.inclusion_criteria || [],
                              exclusionCriteria: result.exclusion_criteria || [],
                            },
                          },
                        },
                      },
                    });

                    if (source.importBatchId) {
                      await prisma.importBatch.update({
                        where: { id: source.importBatchId },
                        data: {
                          relevant: isRelevant ? { increment: 1 } : undefined,
                          irrelevant: !isRelevant ? { increment: 1 } : undefined,
                        },
                      });
                    }
                  }
                }

                // Pass through to client
                if (controller.desiredSize !== null) {
                  controller.enqueue(encoder.encode(line + "\n"));
                }
              } catch (e) {
                console.error("Error processing stream chunk", e);
              }
            }
          }

          if (controller.desiredSize !== null) {
            controller.close();
          }
        } catch (err) {
          console.error("Stream error", err);
          // Only error if not closed
          if (controller.desiredSize !== null) {
            controller.error(err);
          }
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Stream init error:", error);
    return NextResponse.json(
      { error: "Internal Error", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
