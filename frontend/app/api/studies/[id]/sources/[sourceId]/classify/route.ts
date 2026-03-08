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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  try {
    const { id: studyId, sourceId } = await params;
    const requestBody = await request.json().catch(() => ({}));
    const facetId: string | undefined = requestBody?.facetId;
    const facetName: string | undefined = requestBody?.facetName;

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

    const chosen = getChosenMetadata(source);
    const hasTextContent = !!chosen.content_excerpt;
    const hasAbstract = !!(chosen.abstract || source.abstract);
    const allowMetadataOnly = source.allowMetadataOnlyClassification && hasAbstract;

    if (!source.storagePath && !hasTextContent && !allowMetadataOnly) {
      return NextResponse.json(
        { error: "Content is required for classification. Please upload a PDF or enable metadata-only classification." },
        { status: 400 },
      );
    }

    // Gate by status
    const allowedStatuses: SourceStatus[] = [
      SourceStatus.ANALYZING_CLASSIFICATION,
      SourceStatus.READY_FOR_ANALYSIS,
      SourceStatus.CLASSIFIED,
    ];
    if (allowMetadataOnly) allowedStatuses.push(SourceStatus.PENDING);

    if (!allowedStatuses.includes(source.status)) {
      return NextResponse.json(
        { error: `Classification not allowed for status ${source.status}` },
        { status: 400 },
      );
    }

    // Filter facets
    const facets = source.study?.facets || [];
    if (facets.length === 0) {
      return NextResponse.json(
        { error: "Classification schema not configured. Please add facets in study parameters." },
        { status: 400 },
      );
    }

    const validFacets = facets.filter((f) => f.type === "OPEN" || (f.categories && f.categories.length > 0));
    let facetsToUse = validFacets;
    if (facetId) facetsToUse = validFacets.filter((f) => f.id === facetId);
    else if (facetName) facetsToUse = validFacets.filter((f) => f.name === facetName);

    if (facetsToUse.length === 0) {
      return NextResponse.json(
        { error: facetId || facetName ? `Facet '${facetId || facetName}' not found or invalid` : "No valid facets found" },
        { status: 400 },
      );
    }

    // Build payloads
    const content = buildSourceContent(source, chosen, { includePublicationDate: true });
    const classificationSchema = buildClassificationSchema(facetsToUse);
    const researchQuestions = source.study?.researchQuestions?.map((rq) => rq.question) || [];

    // Download PDF
    const pdfBuffer = await downloadSourcePdf(source, { logPrefix: "[classify]" });

    // Mark as classifying
    await prisma.source.update({
      where: { id: sourceId },
      data: { status: SourceStatus.ANALYZING_CLASSIFICATION },
    });

    // Call Python service
    const classifyPayload = {
      sourceId,
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
      const detail = await classifyRes.json().catch(() => ({}));
      console.error("[classify] python-service failed", { sourceId, status: classifyRes.status });
      return NextResponse.json(
        { error: detail?.detail || detail?.error || "Classification failed" },
        { status: classifyRes.status },
      );
    }

    const classifyJson = await classifyRes.json();
    const classifications = Array.isArray(classifyJson.classifications)
      ? classifyJson.classifications
      : [];

    // Determine delete scope for re-classification
    const facetNameToId = new Map(facetsToUse.map((f) => [f.name, f.id]));
    const deleteScope: Record<string, string> = facetId
      ? { facetId }
      : facetName
        ? { facetId: facetNameToId.get(facetName)! }
        : {};

    // Process and persist classifications
    const analysis = await processClassificationResults({
      sourceId,
      classifications,
      facetsToUse,
      existingAnalysis: source.analysis,
      deleteScope,
      sourceContent: content,
      pdfBuffer,
    });

    // Mark source as classified
    await prisma.source.update({
      where: { id: sourceId },
      data: { status: SourceStatus.CLASSIFIED, finalDecision: "INCLUDE" },
    });

    return NextResponse.json({ data: analysis });
  } catch (error) {
    console.error("Error classifying source:", error);
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
