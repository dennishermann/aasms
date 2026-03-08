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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  try {
    const { id: studyId, sourceId } = await params;

    const source = await prisma.source.findFirst({
      where: { id: sourceId, studyId },
      include: {
        study: { include: STUDY_WITH_CRITERIA_AND_FACETS_INCLUDE },
        analysis: true,
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    const chosen = getChosenMetadata(source);
    const hasTextContent = !!chosen.content_excerpt;
    const hasAbstract = !!(chosen.abstract || source.abstract);

    if (!source.storagePath && !hasTextContent && !hasAbstract) {
      return NextResponse.json(
        { error: "Metadata and abstract are required for analysis." },
        { status: 400 },
      );
    }

    if (source.status !== "READY_FOR_ANALYSIS") {
      return NextResponse.json(
        { error: `Analysis allowed only when status is READY_FOR_ANALYSIS. Current: ${source.status}` },
        { status: 400 },
      );
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
      where: { id: sourceId },
      data: { status: "ANALYZING_INCLUSION" },
    });

    // Download PDF if available
    const pdfBuffer = await downloadSourcePdf(source, {
      throwOnError: true,
      logPrefix: "[analyze]",
    });

    // Call Python service
    const analyzePayload = {
      source_id: sourceId,
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
      const detail = await analyzeRes.json().catch(() => ({}));
      console.error("[analyze] python-service failed", { sourceId, status: analyzeRes.status });
      await prisma.source.update({ where: { id: sourceId }, data: { status: "NEEDS_REVIEW" } });
      return NextResponse.json(
        { error: "Inclusion/exclusion analysis failed", detail },
        { status: analyzeRes.status },
      );
    }

    const analysisResult = await analyzeRes.json();

    // Normalize, persist, and update status
    const normalized = normalizeInclusionResult(analysisResult);
    const analysis = await persistInclusionAnalysis(
      sourceId,
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

    await updateSourceStatusAfterAnalysis(sourceId, analysis, normalized.contextResponseId);

    return NextResponse.json({ data: analysis });
  } catch (error) {
    console.error("Error running analysis:", error);
    try {
      await prisma.source.update({
        where: { id: (await params).sourceId },
        data: { status: "NEEDS_REVIEW" },
      });
    } catch (e) {
      console.error("Failed to set status after analysis error", e);
    }
    return NextResponse.json(
      {
        error: "Failed to run analysis",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
