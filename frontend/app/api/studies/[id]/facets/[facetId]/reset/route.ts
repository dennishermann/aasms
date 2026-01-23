import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST - Reset an OPEN_CODED facet back to OPEN
// This deletes all categories and keyword mappings, reverting to open extraction
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; facetId: string }> }
) {
    try {
        const { id: studyId, facetId } = await params;

        // Verify facet exists and is OPEN_CODED
        const facet = await prisma.facet.findFirst({
            where: { id: facetId, studyId },
        });

        if (!facet) {
            return NextResponse.json(
                { error: "Facet not found" },
                { status: 404 }
            );
        }

        if (facet.type !== "OPEN_CODED") {
            return NextResponse.json(
                { error: "Only OPEN_CODED facets can be reset" },
                { status: 400 }
            );
        }

        // Use transaction to ensure all operations complete together
        await prisma.$transaction(async (tx) => {
            // 1. Delete all keyword mappings for this facet
            await tx.facetKeywordMapping.deleteMany({
                where: { facetId },
            });

            // 2. Delete all categories for this facet
            await tx.facetCategory.deleteMany({
                where: { facetId },
            });

            // 3. Change facet type back to OPEN
            await tx.facet.update({
                where: { id: facetId },
                data: { type: "OPEN" },
            });
        });

        return NextResponse.json({
            success: true,
            message: "Facet reset to OPEN type successfully",
        });
    } catch (error) {
        console.error("Error resetting facet:", error);
        return NextResponse.json(
            { error: "Failed to reset facet" },
            { status: 500 }
        );
    }
}
