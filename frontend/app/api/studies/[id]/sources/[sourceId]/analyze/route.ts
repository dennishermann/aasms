import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { downloadFile } from "@/lib/minio";

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { id: studyId, sourceId } = await params;

    console.log("[analyze] start", { studyId, sourceId });

    const source = await prisma.source.findFirst({
      where: { id: sourceId, studyId },
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

    if (source.status !== "READY_FOR_ANALYSIS") {
      return NextResponse.json(
        { error: `Analysis allowed only when status is READY_FOR_ANALYSIS. Current status: ${source.status}` },
        { status: 400 }
      );
    }

    // Gather study parameters
    const studyInclusionCriteria =
      source.study?.parameters?.inclusionCriteria?.map((c) => c.criterion) || [];
    const studyExclusionCriteria =
      source.study?.parameters?.exclusionCriteria?.map((c) => c.criterion) || [];
    const researchQuestions = source.study?.researchQuestions?.map((rq) => rq.question) || [];

    // Build classification schema from new Facet model
    // Format matches what Python service expects
    const classificationSchema = (source.study?.facets || []).map((facet) => ({
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

    // Build source content from chosen metadata (or fallback)
    const chosen: any = source.metadataChosen || source.metadataParsed || source.metadataExtension || {};
    const sourceContent = {
      title: chosen.title || source.title || "",
      authors: chosen.authors || source.authors || [],
      abstract: chosen.abstract || source.abstract || "",
      venue: chosen.venue || source.venue || "",
      doi: chosen.doi || source.doi || "",
      content_excerpt: chosen.content_excerpt || "",
    };

    // Move status to analyzing inclusion
    await prisma.source.update({
      where: { id: sourceId },
      data: { status: "ANALYZING_INCLUSION" },
    });
    console.log("[analyze] status -> ANALYZING_INCLUSION", { sourceId });

    // Download PDF from MinIO for full-text analysis if hasPdf is true
    let pdfBuffer: Buffer | null = null;
    if (source.hasPdf) {
      if (!source.storagePath) {
        throw new Error("Source is marked as PDF but has no storage path");
      }
      try {
        pdfBuffer = await downloadFile(source.storagePath);
        console.log("[analyze] PDF downloaded from MinIO", {
          sourceId,
          storagePath: source.storagePath,
          size: pdfBuffer.length,
        });
      } catch (error) {
        console.error("[analyze] Failed to download PDF from MinIO", {
          sourceId,
          storagePath: source.storagePath,
          error,
        });
        throw new Error("Failed to download PDF file for analysis");
      }
    }

    // Prepare payload for Python service
    const analyzePayload = {
      source_id: sourceId,
      study_parameters: {
        research_questions: researchQuestions,
        inclusion_criteria: studyInclusionCriteria,
        exclusion_criteria: studyExclusionCriteria,
        classification_schema: classificationSchema,
      },
      source_content: sourceContent,
      previous_response_id: source.classificationThreadId,
    };

    let analyzeRes;

    if (source.hasPdf && pdfBuffer && pdfBuffer.length > 0) {
      // STRICT: Call /file endpoint
      const formData = new FormData();
      formData.append("payload", JSON.stringify(analyzePayload));
      const pdfBlob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });
      formData.append("file", pdfBlob, "source.pdf");

      analyzeRes = await fetch(`${PYTHON_SERVICE_URL}/api/analyze-inclusion/file`, {
        method: "POST",
        body: formData as any,
      });
    } else {
      // STRICT: Call /text endpoint
      analyzeRes = await fetch(`${PYTHON_SERVICE_URL}/api/analyze-inclusion/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analyzePayload),
      });
    }


    if (!analyzeRes.ok) {
      const detail = await analyzeRes.json().catch(() => ({}));
      console.error("[analyze] python-service failed", { sourceId, status: analyzeRes.status, detail });
      await prisma.source.update({
        where: { id: sourceId },
        data: { status: "NEEDS_REVIEW" },
      });
      return NextResponse.json(
        { error: "Inclusion/exclusion analysis failed", detail },
        { status: analyzeRes.status }
      );
    }

    const analysisResult = await analyzeRes.json();
    console.log("[analyze] python-service response received", {
      sourceId,
      recommendation: analysisResult.recommendation,
      confidence: analysisResult.confidence,
      hasInclusionCriteria: !!analysisResult.inclusionCriteria || !!analysisResult.inclusion_criteria,
      hasExclusionCriteria: !!analysisResult.exclusionCriteria || !!analysisResult.exclusion_criteria,
      inclusionCriteriaCount: (analysisResult.inclusionCriteria || analysisResult.inclusion_criteria || []).length,
      exclusionCriteriaCount: (analysisResult.exclusionCriteria || analysisResult.exclusion_criteria || []).length,
      inclSample: (analysisResult.inclusionCriteria || analysisResult.inclusion_criteria || []).slice(0, 2),
      exclSample: (analysisResult.exclusionCriteria || analysisResult.exclusion_criteria || []).slice(0, 2),
    });

    // Normalize field names: handle both camelCase (expected) and snake_case (fallback)
    const inclusionCriteria = (analysisResult.inclusionCriteria || analysisResult.inclusion_criteria || []).map((c: any) => ({
      criterion: c.criterion,
      fulfilled: c.decision ?? c.fulfilled ?? false,
      reasoning: c.reasoning || "",
      confidence: c.confidence ?? 0.5,
    }));

    const exclusionCriteria = (analysisResult.exclusionCriteria || analysisResult.exclusion_criteria || []).map((c: any) => ({
      criterion: c.criterion,
      fulfilled: c.decision ?? c.fulfilled ?? false,
      reasoning: c.reasoning || "",
      confidence: c.confidence ?? 0.5,
    }));

    console.log("[analyze] normalized criteria", {
      sourceId,
      inclusionCriteria: inclusionCriteria.length,
      exclusionCriteria: exclusionCriteria.length,
      inclSampleNormalized: inclusionCriteria.slice(0, 2),
      exclSampleNormalized: exclusionCriteria.slice(0, 2),
    });

    // Persist inclusion/exclusion with normalized field names
    const inclusionReasoning = analysisResult.inclusionReasoning || analysisResult.inclusion_reasoning || "";
    const exclusionReasoning = analysisResult.exclusionReasoning || analysisResult.exclusion_reasoning || "";
    const relevanceScore = analysisResult.relevanceScore ?? analysisResult.relevance_score ?? null;
    const qualityNotes = analysisResult.qualityNotes || analysisResult.quality_notes || null;

    const analysis = await prisma.sourceAnalysis.upsert({
      where: { sourceId },
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
      },
      create: {
        sourceId,
        extractedText: sourceContent.content_excerpt || "",
        inclusionRecommendation: analysisResult.recommendation === "include",
        inclusionReasoning,
        exclusionReasoning,
        confidenceScore: parseFloat(analysisResult.confidence || 0),
        relevanceScore,
        qualityNotes,
        inclusionCriteria,
        exclusionCriteria,
      },
    });
    console.log("[analyze] analysis persisted to database", {
      sourceId,
      analysisId: analysis.id,
      inclusionCriteriaStored: inclusionCriteria.length,
      exclusionCriteriaStored: exclusionCriteria.length,
      recommendation: analysis.inclusionRecommendation,
    });

    // Set status based on inclusion recommendation
    const newStatus = analysis.inclusionRecommendation ? "ANALYZING_CLASSIFICATION" : "EXCLUDED";
    await prisma.source.update({
      where: { id: sourceId },
      data: {
        status: newStatus,
        classificationThreadId: analysisResult.contextResponseId || analysisResult.context_response_id || undefined
      },
    });
    console.log(`[analyze] status -> ${newStatus}`, {
      sourceId,
      inclusionRecommendation: analysis.inclusionRecommendation
    });

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
      { error: "Failed to run analysis", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
