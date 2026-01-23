import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface ApplyRouteParams {
    params: Promise<{ id: string; facetId: string }>;
}

interface CategoryInput {
    name: string;
    description: string;
    values: string[];
}

interface ApplyRequestBody {
    categories: CategoryInput[];
    autoAssignThreshold?: number;
}

/**
 * POST /api/studies/[id]/facets/[facetId]/coding/apply
 * 
 * Apply coding categories to an OPEN facet, converting it to OPEN_CODED.
 * Creates categories and assigns classifications to them.
 */
export async function POST(request: NextRequest, { params }: ApplyRouteParams) {
    try {
        const { id: studyId, facetId } = await params;
        const body: ApplyRequestBody = await request.json();
        const { categories, autoAssignThreshold = 0.8 } = body;

        if (!categories || categories.length === 0) {
            return NextResponse.json(
                { error: "At least one category is required" },
                { status: 400 }
            );
        }

        // Verify facet exists and is OPEN type
        const facet = await prisma.facet.findFirst({
            where: { id: facetId, studyId },
        });

        if (!facet) {
            return NextResponse.json(
                { error: "Facet not found" },
                { status: 404 }
            );
        }

        if (facet.type !== "OPEN" && facet.type !== "OPEN_CODED") {
            return NextResponse.json(
                { error: "Only OPEN or OPEN_CODED facets can be coded" },
                { status: 400 }
            );
        }

        // Delete all existing categories for this facet to prevent duplicates
        // This is a "replace all" operation - new categories fully replace old ones
        await prisma.facetCategory.deleteMany({
            where: { facetId },
        });

        // Create all categories and build a value-to-category map
        const valueToCategory: Record<string, string> = {};
        const createdCategories = [];

        for (let i = 0; i < categories.length; i++) {
            const cat = categories[i];

            // Create or update category
            const dbCategory = await prisma.facetCategory.upsert({
                where: {
                    facetId_name: { facetId, name: cat.name },
                },
                create: {
                    facetId,
                    name: cat.name,
                    description: cat.description,
                    order: i,
                },
                update: {
                    description: cat.description,
                    order: i,
                },
            });

            createdCategories.push(dbCategory);

            // Map values to this category
            for (const value of cat.values) {
                valueToCategory[value.toLowerCase()] = dbCategory.id;
            }
        }

        // Upsert keyword mappings for reuse on new sources
        for (const cat of categories) {
            const categoryId = createdCategories.find(c => c.name === cat.name)?.id;
            if (!categoryId) continue;
            for (const value of cat.values) {
                if (!value || !value.trim()) continue;
                await prisma.facetKeywordMapping.upsert({
                    where: {
                        facetId_keyword: {
                            facetId,
                            keyword: value.trim(),
                        },
                    },
                    create: {
                        facetId,
                        keyword: value.trim(),
                        categoryId,
                        status: "APPROVED",
                        source: "USER",
                    },
                    update: {
                        categoryId,
                        status: "APPROVED",
                        source: "USER",
                    },
                });
            }
        }

        // Update facet to OPEN_CODED
        await prisma.facet.update({
            where: { id: facetId },
            data: {
                type: "OPEN_CODED",
                codingEnabled: true,
                autoAssignThreshold,
                codingCreatedAt: new Date(),
            },
        });

        // Rebuild classifications for this facet from extracted keywords
        const facetKeywords = await prisma.facetKeyword.findMany({
            where: { facetId },
            select: {
                analysisId: true,
                keyword: true,
            },
        });

        const analysisCategoryMap = new Map<string, Set<string>>();
        let assignedCount = 0;
        let unassignedCount = 0;

        for (const keyword of facetKeywords) {
            const categoryId = valueToCategory[keyword.keyword.toLowerCase()];
            if (!categoryId) {
                unassignedCount++;
                continue;
            }
            assignedCount++;
            const entry = analysisCategoryMap.get(keyword.analysisId) || new Set<string>();
            entry.add(categoryId);
            analysisCategoryMap.set(keyword.analysisId, entry);
        }

        const classificationCreates: Array<{
            analysisId: string;
            facetId: string;
            categoryId: string;
            confidence: number;
            reasoning: string;
            autoAssigned: boolean;
            needsReview: boolean;
        }> = [];

        for (const [analysisId, categoryIds] of analysisCategoryMap.entries()) {
            for (const categoryId of categoryIds) {
                classificationCreates.push({
                    analysisId,
                    facetId,
                    categoryId,
                    confidence: 1.0,
                    reasoning: "Mapped from extracted keywords",
                    autoAssigned: true,
                    needsReview: false,
                });
            }
        }

        // Replace all classifications for this facet
        await prisma.classification.deleteMany({
            where: { facetId },
        });

        if (classificationCreates.length > 0) {
            await prisma.classification.createMany({
                data: classificationCreates,
            });
        }

        return NextResponse.json({
            success: true,
            facetType: "OPEN_CODED",
            categories: createdCategories.map(c => ({
                id: c.id,
                name: c.name,
                description: c.description,
            })),
            stats: {
                categoriesCreated: createdCategories.length,
                assignedCount,
                unassignedCount,
                totalClassifications: facetKeywords.length,
            },
        });

    } catch (error) {
        console.error("[coding/apply] Error:", error);
        return NextResponse.json(
            { error: "Failed to apply categories" },
            { status: 500 }
        );
    }
}
