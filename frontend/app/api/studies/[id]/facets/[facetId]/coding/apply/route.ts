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

        // Get all classifications for this facet and assign categories
        const classifications = await prisma.classification.findMany({
            where: {
                facetId,
                value: { not: null },
            },
        });

        let assignedCount = 0;
        let unassignedCount = 0;

        for (const classification of classifications) {
            if (!classification.value) continue;

            const categoryId = valueToCategory[classification.value.toLowerCase()];

            if (categoryId) {
                await prisma.classification.update({
                    where: { id: classification.id },
                    data: {
                        categoryId,
                        rawValue: classification.value, // Preserve original
                        autoAssigned: true,
                        needsReview: false,
                    },
                });
                assignedCount++;
            } else {
                // Mark as needing review (uncategorized)
                await prisma.classification.update({
                    where: { id: classification.id },
                    data: {
                        rawValue: classification.value,
                        needsReview: true,
                    },
                });
                unassignedCount++;
            }
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
                totalClassifications: classifications.length,
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
