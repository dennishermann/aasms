import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PYTHON_SERVICE_URL } from "@/lib/python-service";


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  try {
    const { id: studyId, sourceId } = await params;

    // 1. Fetch Source & Study Parameters
    const source = await prisma.source.findUnique({
      where: { id: sourceId },
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

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // 2. Prepare Payload for Python
    const payload = {
      source: {
        title: source.title,
        authors: source.authors,
        year: source.publicationDate ? source.publicationDate.getFullYear() : null,
        venue: source.venue,
        doi: source.doi,
        abstract: source.abstract,
        url: source.originalUrl,
        // Optional extras
        bibtex: source.bibtex,
      },
      research_questions: source.study.researchQuestions.map((rq) => rq.question),
      inclusion_criteria:
        source.study.parameters?.inclusionCriteria.map((ic) => ic.criterion) || [],
      exclusion_criteria:
        source.study.parameters?.exclusionCriteria.map((ic) => ic.criterion) || [],
    };

    // 3. Call Python analysis
    const response = await fetch(`${PYTHON_SERVICE_URL}/api/import/check-relevance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const txt = await response.text();
      // If fail, update source to error state? or just return error
      // Let's mark import batch as having error?
      if (source.importBatchId) {
        await prisma.importBatch.update({
          where: { id: source.importBatchId },
          data: { errors: { increment: 1 } },
        });
      }
      throw new Error(`Python analysis failed: ${txt}`);
    }

    const result = await response.json();

    // 4. Update Source Result
    const isRelevant = result.is_relevant;

    // Needs PDF?
    const needsPdf = isRelevant && !source.originalUrl && !source.hasPdf;
    const metaExt = (source.metadataExtension as any) || {};
    const hasPdfLink = !!metaExt.pdf_link;
    const finalNeedsPdf = isRelevant && !hasPdfLink && !source.hasPdf;

    const inclusionCriteria = result.inclusion_criteria || [];
    const exclusionCriteria = result.exclusion_criteria || [];

    await prisma.source.update({
      where: { id: sourceId },
      data: {
        status: isRelevant ? "PENDING" : "EXCLUDED",
        finalDecision: isRelevant ? null : "EXCLUDE",
        decisionRationale: result.reasoning,
        needsPdf: finalNeedsPdf,
        analysis: {
          upsert: {
            create: {
              extractedText: "",
              inclusionRecommendation: isRelevant,
              inclusionReasoning: result.reasoning,
              exclusionReasoning: isRelevant ? "" : result.reasoning,
              confidenceScore: result.confidence,
              inclusionCriteria: inclusionCriteria,
              exclusionCriteria: exclusionCriteria,
            },
            update: {
              inclusionRecommendation: isRelevant,
              inclusionReasoning: result.reasoning,
              exclusionReasoning: isRelevant ? "" : result.reasoning,
              confidenceScore: result.confidence,
              inclusionCriteria: inclusionCriteria,
              exclusionCriteria: exclusionCriteria,
            },
          },
        },
      },
    });

    // 5. Update Batch Stats
    if (source.importBatchId) {
      await prisma.importBatch.update({
        where: { id: source.importBatchId },
        data: {
          relevant: isRelevant ? { increment: 1 } : undefined,
          irrelevant: !isRelevant ? { increment: 1 } : undefined,
          needsPdf: finalNeedsPdf ? { increment: 1 } : undefined,
        },
      });
    }

    return NextResponse.json({ success: true, isRelevant });
  } catch (error) {
    console.error("Check Relevance Error:", error);
    return NextResponse.json(
      {
        error: "Failed to check relevance",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 },
    );
  }
}
