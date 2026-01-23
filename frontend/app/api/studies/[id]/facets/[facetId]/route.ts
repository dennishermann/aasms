import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET - Get a single facet with categories and research questions
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; facetId: string }> }
) {
    try {
        const { id: studyId, facetId } = await params;

        const facet = await prisma.facet.findFirst({
            where: { id: facetId, studyId },
            include: {
                categories: {
                    orderBy: { order: "asc" },
                },
                researchQuestions: {
                    include: {
                        researchQuestion: true,
                    },
                },
            },
        });

        if (!facet) {
            return NextResponse.json(
                { error: "Facet not found" },
                { status: 404 }
            );
        }

        const transformedFacet = {
            ...facet,
            researchQuestionIds: facet.researchQuestions.map(
                (frq) => frq.researchQuestionId
            ),
            researchQuestions: facet.researchQuestions.map((frq) => ({
                id: frq.researchQuestion.id,
                question: frq.researchQuestion.question,
                order: frq.researchQuestion.order,
            })),
        };

        return NextResponse.json({ data: transformedFacet });
    } catch (error) {
        console.error("Error fetching facet:", error);
        return NextResponse.json(
            { error: "Failed to fetch facet" },
            { status: 500 }
        );
    }
}

// PUT - Update a facet
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; facetId: string }> }
) {
    try {
        const { id: studyId, facetId } = await params;
        const body = await request.json();

        const {
            name,
            description,
            type,
            required,
            order,
            researchQuestionIds,
            categories,
            metadataField,
            metadataTransform,
        } = body;

        // Build update data
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (type !== undefined) updateData.type = type;
        if (required !== undefined) updateData.required = required;
        if (order !== undefined) updateData.order = order;
        if (metadataField !== undefined) updateData.metadataField = metadataField;
        if (metadataTransform !== undefined) updateData.metadataTransform = metadataTransform;

        // Update facet basic fields
        await prisma.facet.update({
            where: { id: facetId, studyId },
            data: updateData,
        });

        // Update research question links if provided
        if (researchQuestionIds !== undefined) {
            // Delete existing links
            await prisma.facetResearchQuestion.deleteMany({
                where: { facetId },
            });

            // Create new links
            if (researchQuestionIds.length > 0) {
                await prisma.facetResearchQuestion.createMany({
                    data: researchQuestionIds.map((rqId: string) => ({
                        facetId,
                        researchQuestionId: rqId,
                    })),
                });
            }
        }

        // Update categories if provided
        if (categories !== undefined) {
            // Get existing categories
            const existingCategories = await prisma.facetCategory.findMany({
                where: { facetId },
            });
            const existingIds = new Set(existingCategories.map((c) => c.id));

            // Process incoming categories
            const incomingIds = new Set<string>();
            for (let i = 0; i < categories.length; i++) {
                const cat = categories[i];
                if (cat.id && existingIds.has(cat.id)) {
                    // Update existing
                    incomingIds.add(cat.id);
                    await prisma.facetCategory.update({
                        where: { id: cat.id },
                        data: {
                            name: cat.name,
                            description: cat.description,
                            order: i,
                        },
                    });
                } else {
                    // Create new
                    await prisma.facetCategory.create({
                        data: {
                            facetId,
                            name: cat.name,
                            description: cat.description,
                            order: i,
                        },
                    });
                }
            }

            // Delete removed categories
            const toDelete = existingCategories
                .filter((c) => !incomingIds.has(c.id))
                .map((c) => c.id);
            if (toDelete.length > 0) {
                await prisma.facetCategory.deleteMany({
                    where: { id: { in: toDelete } },
                });
            }
        }

        // Fetch and return updated facet
        const updatedFacet = await prisma.facet.findUnique({
            where: { id: facetId },
            include: {
                categories: {
                    orderBy: { order: "asc" },
                },
                researchQuestions: {
                    include: {
                        researchQuestion: true,
                    },
                },
            },
        });

        if (!updatedFacet) {
            return NextResponse.json(
                { error: "Facet not found" },
                { status: 404 }
            );
        }

        const transformedFacet = {
            ...updatedFacet,
            researchQuestionIds: updatedFacet.researchQuestions.map(
                (frq) => frq.researchQuestionId
            ),
            researchQuestions: updatedFacet.researchQuestions.map((frq) => ({
                id: frq.researchQuestion.id,
                question: frq.researchQuestion.question,
                order: frq.researchQuestion.order,
            })),
        };

        return NextResponse.json({ data: transformedFacet });
    } catch (error) {
        console.error("Error updating facet:", error);
        return NextResponse.json(
            { error: "Failed to update facet" },
            { status: 500 }
        );
    }
}

// DELETE - Delete a facet
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; facetId: string }> }
) {
    try {
        const { id: studyId, facetId } = await params;

        // Verify facet belongs to study
        const facet = await prisma.facet.findFirst({
            where: { id: facetId, studyId },
        });

        if (!facet) {
            return NextResponse.json(
                { error: "Facet not found" },
                { status: 404 }
            );
        }

        // Delete facet (cascades to categories and RQ links)
        await prisma.facet.delete({
            where: { id: facetId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting facet:", error);
        return NextResponse.json(
            { error: "Failed to delete facet" },
            { status: 500 }
        );
    }
}
