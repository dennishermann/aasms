import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadFile, generateStoragePath, initializeBucket } from "@/lib/minio";
import { SourceStatus } from "@prisma/client";

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
    try {
        const { id: studyId, sourceId } = await params;

        // 1. Verify source exists
        const source = await prisma.source.findFirst({
            where: { id: sourceId, studyId },
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

        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "File is required" }, { status: 400 });
        }

        // 2. Save file to MinIO
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Ensure MinIO bucket exists
        await initializeBucket();

        const objectPath = generateStoragePath(studyId, source.id, ".pdf");

        await uploadFile(objectPath, buffer, {
            "Content-Type": "application/pdf",
            "Original-Filename": file.name || "source.pdf",
        });

        // 3a. Check existing analysis
        const existingAnalysis = await prisma.sourceAnalysis.findUnique({
            where: { sourceId }
        });

        // Optimization: If already included, skip re-evaluating inclusion
        const skipInclusion = existingAnalysis?.inclusionRecommendation === true;

        // 3b. Prepare payload for Python service
        const pythonFormData = new FormData();
        pythonFormData.append("file", file); // file is Blob/File, ok for fetch

        pythonFormData.append("payload", JSON.stringify({
            sourceId: source.id,
            skipInclusion: skipInclusion,
            studyParameters: {
                researchQuestions: source.study.researchQuestions.map(rq => rq.question),
                inclusionCriteria: source.study.parameters?.inclusionCriteria.map(ic => ic.criterion) || [],
                exclusionCriteria: source.study.parameters?.exclusionCriteria.map(ic => ic.criterion) || [],
                classificationSchema: source.study.parameters?.classificationSchema || {},
            },
            sourceContent: {
                title: source.title,
                authors: source.authors,
                abstract: source.abstract,
                venue: source.venue,
                doi: source.doi,
                publication_date: source.publicationDate ? source.publicationDate.toISOString() : "",
            }
        }));

        // 4. Update source and Call Python service
        await prisma.source.update({
            where: { id: sourceId },
            data: {
                status: "ANALYZING_INCLUSION",
                storagePath: objectPath, // Save MinIO path
                hasPdf: true,
                needsPdf: false,
            }
        });

        const pyResponse = await fetch(`${PYTHON_SERVICE_URL}/api/analyze-existing-source-pdf`, {
            method: "POST",
            body: pythonFormData as any,
        });

        if (!pyResponse.ok) {
            const errText = await pyResponse.text();
            throw new Error(`Analysis service failed: ${errText}`);
        }

        const analysisResult = await pyResponse.json();

        // 5. Update Source with Analysis Results
        const isIncluded = analysisResult.recommendation === "include";
        const newStatus = isIncluded ? SourceStatus.CLASSIFIED : SourceStatus.EXCLUDED;
        const finalDecision = isIncluded ? null : "EXCLUDE";

        // Prepare classifications
        const classificationCreates = (analysisResult.classifications || []).map((c: any) => ({
            facetName: c.facetName,
            category: c.category,
            confidence: c.confidence,
            reasoning: c.reasoning,
            isManualOverride: c.isManualOverride || false,
        }));

        // If skipped, use existing reasoning/criteria
        const inclusionReasoning = skipInclusion ? existingAnalysis?.inclusionReasoning : analysisResult.inclusionReasoning;
        const exclusionReasoning = skipInclusion ? existingAnalysis?.exclusionReasoning : analysisResult.exclusionReasoning;
        const inclusionCriteria = skipInclusion ? (existingAnalysis?.inclusionCriteria || []) : analysisResult.inclusionCriteria;
        const exclusionCriteria = skipInclusion ? (existingAnalysis?.exclusionCriteria || []) : analysisResult.exclusionCriteria;

        await prisma.sourceAnalysis.upsert({
            where: { sourceId },
            create: {
                sourceId,
                extractedText: "",
                inclusionRecommendation: isIncluded,
                inclusionReasoning: inclusionReasoning,
                exclusionReasoning: exclusionReasoning,
                confidenceScore: analysisResult.confidence,
                inclusionCriteria: inclusionCriteria,
                exclusionCriteria: exclusionCriteria,
                classifications: {
                    create: classificationCreates
                },
            },
            update: {
                inclusionRecommendation: isIncluded,
                inclusionReasoning: inclusionReasoning,
                exclusionReasoning: exclusionReasoning,
                confidenceScore: analysisResult.confidence,
                inclusionCriteria: inclusionCriteria,
                exclusionCriteria: exclusionCriteria,
                classifications: {
                    deleteMany: {},
                    create: classificationCreates
                },
            }
        });

        // Update Source status
        await prisma.source.update({
            where: { id: sourceId },
            data: {
                status: newStatus,
                finalDecision: finalDecision,
                decisionRationale: isIncluded ? null : (analysisResult.exclusionReasoning || "Excluded by AI"),
            }
        });

        return NextResponse.json({ success: true, analysis: analysisResult });

    } catch (error) {
        console.error("PDF Upload & Analysis Error:", error);
        return NextResponse.json(
            { error: "Failed to upload and analyze PDF", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
