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
            type: facet.type === "OPEN_CODED" ? "open" : facet.type.toLowerCase(),
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
                allowMetadataOnlyClassification: false,
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
        const finalDecision = isIncluded ? "INCLUDE" : "EXCLUDE";

        // Build a map of facet name -> facet id for looking up
        const facetNameToId = new Map(source.study.facets.map(f => [f.name, f.id]));
        const facetIdToCategoryMap = new Map(
            source.study.facets.map(f => [f.id, new Map(f.categories.map(c => [c.name, c.id]))])
        );
        const facetById = new Map(source.study.facets.map(f => [f.id, f]));
        const facetByName = new Map(source.study.facets.map(f => [f.name, f]));

        const classificationCreates: Array<{
            facetId: string;
            categoryId: string | null;
            value: string | null;
            confidence: number;
            reasoning: string;
            isManualOverride: boolean;
        }> = [];
        const keywordCreates: Array<{
            facetId: string;
            keyword: string;
            confidence: number | null;
        }> = [];
        const keywordDedup = new Set<string>();
        const mappingCache = new Map<
            string,
            Map<string, { categoryId: string | null; status: string }>
        >();

        const getFacetMappings = async (facetId: string) => {
            if (mappingCache.has(facetId)) {
                return mappingCache.get(facetId)!;
            }
            const mappings = await prisma.facetKeywordMapping.findMany({
                where: { facetId },
                select: {
                    keyword: true,
                    categoryId: true,
                    status: true,
                },
            });
            const map = new Map<string, { categoryId: string | null; status: string }>();
            for (const mapping of mappings) {
                map.set(mapping.keyword.toLowerCase(), {
                    categoryId: mapping.categoryId,
                    status: mapping.status,
                });
            }
            mappingCache.set(facetId, map);
            return map;
        };

        const suggestKeywordMapping = async (keyword: string, facet: typeof source.study.facets[number]) => {
            const response = await fetch(`${PYTHON_SERVICE_URL}/api/coding/map-keyword`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    keyword,
                    categories: facet.categories.map((cat) => ({
                        id: cat.id,
                        name: cat.name,
                        description: cat.description,
                    })),
                    facet_name: facet.name,
                    facet_description: facet.description,
                }),
            });

            if (!response.ok) {
                return null;
            }
            return response.json();
        };

        for (const c of analysisResult.classifications || []) {
            const cFacetName = c.facetName || c.facet_name || "unknown";
            const cFacetId = c.facetId || facetNameToId.get(cFacetName);
            const facet = cFacetId ? facetById.get(cFacetId) : facetByName.get(cFacetName);
            if (!facet) {
                continue;
            }

            if (facet.type === "OPEN") {
                const keywords = Array.isArray(c.keywords) ? c.keywords : [];
                for (const keyword of keywords) {
                    if (typeof keyword !== "string" || !keyword.trim()) {
                        continue;
                    }
                    const normalized = `${facet.id}:${keyword.trim().toLowerCase()}`;
                    if (keywordDedup.has(normalized)) {
                        continue;
                    }
                    keywordDedup.add(normalized);
                    keywordCreates.push({
                        facetId: facet.id,
                        keyword: keyword.trim(),
                        confidence: c.confidence !== undefined ? parseFloat(c.confidence) : null,
                    });
                    classificationCreates.push({
                        facetId: facet.id,
                        categoryId: null,
                        value: keyword.trim(),
                        confidence: parseFloat(c.confidence || 0),
                        reasoning: c.reasoning || "",
                        isManualOverride: false,
                    });
                }
                continue;
            }

            if (facet.type === "OPEN_CODED") {
                const keywords = Array.isArray(c.keywords) ? c.keywords : [];
                const mappingMap = await getFacetMappings(facet.id);
                for (const keyword of keywords) {
                    if (typeof keyword !== "string" || !keyword.trim()) {
                        continue;
                    }
                    const trimmed = keyword.trim();
                    const normalized = trimmed.toLowerCase();
                    const dedupKey = `${facet.id}:${normalized}`;
                    if (!keywordDedup.has(dedupKey)) {
                        keywordDedup.add(dedupKey);
                        keywordCreates.push({
                            facetId: facet.id,
                            keyword: trimmed,
                            confidence: c.confidence !== undefined ? parseFloat(c.confidence) : null,
                        });
                    }

                    const existing = mappingMap.get(normalized);
                    if (existing && existing.status === "APPROVED" && existing.categoryId) {
                        classificationCreates.push({
                            facetId: facet.id,
                            categoryId: existing.categoryId,
                            value: null,
                            confidence: parseFloat(c.confidence || 0),
                            reasoning: c.reasoning || "Mapped from approved keyword",
                            isManualOverride: false,
                        });
                        continue;
                    }

                    if (!existing) {
                        const suggestion = await suggestKeywordMapping(trimmed, facet);
                        if (suggestion) {
                            const match = facet.categories.find(
                                (cat) => cat.name.toLowerCase() === (suggestion.category_name || "").toLowerCase()
                            );
                            await prisma.facetKeywordMapping.upsert({
                                where: {
                                    facetId_keyword: {
                                        facetId: facet.id,
                                        keyword: trimmed,
                                    },
                                },
                                create: {
                                    facetId: facet.id,
                                    keyword: trimmed,
                                    categoryId: match?.id || null,
                                    status: "PENDING",
                                    confidence: suggestion.confidence ?? null,
                                    source: "LLM",
                                    proposedCategoryName: suggestion.proposed_category_name || null,
                                    proposedCategoryDescription: suggestion.proposed_category_description || null,
                                },
                                update: {
                                    categoryId: match?.id || null,
                                    status: "PENDING",
                                    confidence: suggestion.confidence ?? null,
                                    source: "LLM",
                                    proposedCategoryName: suggestion.proposed_category_name || null,
                                    proposedCategoryDescription: suggestion.proposed_category_description || null,
                                },
                            });
                            mappingMap.set(normalized, { categoryId: match?.id || null, status: "PENDING" });
                        }
                    }
                }
                continue;
            }

            const categoryMap = facetIdToCategoryMap.get(facet.id) || null;
            const cCategoryId = categoryMap?.get(c.category) || null;

            classificationCreates.push({
                facetId: facet.id,
                categoryId: cCategoryId,
                value: null,
                confidence: c.confidence,
                reasoning: c.reasoning,
                isManualOverride: c.isManualOverride || false,
            });
        }

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
                classificationBasis: "FULL_TEXT",
                inclusionCriteria: inclusionCriteria,
                exclusionCriteria: exclusionCriteria,
                classifications: {
                    create: classificationCreates
                },
                facetKeywords: {
                    create: keywordCreates
                },
            },
            update: {
                inclusionRecommendation: isIncluded,
                inclusionReasoning: inclusionReasoning,
                exclusionReasoning: exclusionReasoning,
                confidenceScore: analysisResult.confidence,
                classificationBasis: "FULL_TEXT",
                inclusionCriteria: inclusionCriteria,
                exclusionCriteria: exclusionCriteria,
                classifications: {
                    deleteMany: {},
                    create: classificationCreates
                },
                facetKeywords: {
                    deleteMany: {},
                    create: keywordCreates
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
