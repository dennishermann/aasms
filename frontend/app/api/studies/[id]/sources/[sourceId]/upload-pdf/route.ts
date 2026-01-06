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

        // 1. Verify source exists and get facets
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

        // Build classification schema from new Facet model
        const classificationSchema = (source.study.facets || []).map((facet) => ({
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
                classificationSchema: classificationSchema,
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

        // Build a map of facet name -> facet id for looking up
        const facetNameToId = new Map(source.study.facets.map(f => [f.name, f.id]));
        const facetIdToCategoryMap = new Map(
            source.study.facets.map(f => [f.id, new Map(f.categories.map(c => [c.name, c.id]))])
        );

        // Convert classifications to use facetId and categoryId
        const classificationCreates = (analysisResult.classifications || []).map((c: any) => {
            const cFacetName = c.facetName || c.facet_name || "unknown";
            const cFacetId = c.facetId || facetNameToId.get(cFacetName);
            const categoryMap = cFacetId ? facetIdToCategoryMap.get(cFacetId) : null;
            const cCategoryId = categoryMap?.get(c.category) || null;

            return {
                facetId: cFacetId || source.study.facets[0]?.id,
                categoryId: cCategoryId,
                value: cCategoryId ? null : (c.category || c.value || null),
                confidence: c.confidence,
                reasoning: c.reasoning,
                isManualOverride: c.isManualOverride || false,
            };
        });

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
