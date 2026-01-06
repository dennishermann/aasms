import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: studyId } = await params;

        // Parse the body to get IDs
        const body = await request.json();
        const { ids } = body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                { error: "No IDs provided for deletion" },
                { status: 400 }
            );
        }

        // Verify study existence (optional but good context check)
        const study = await prisma.study.findUnique({
            where: { id: studyId },
        });

        if (!study) {
            return NextResponse.json({ error: "Study not found" }, { status: 404 });
        }

        // Perform bulk delete
        // We strictly limit to sources within this study for safety
        const result = await prisma.source.deleteMany({
            where: {
                id: { in: ids },
                studyId: studyId,
            },
        });

        // Also update import batch stats if possible? 
        // It's hard to track which batch they belonged to efficiently in a batch delete without reading them first.
        // For now, we accept that batch stats might be slightly out of sync or we just decrement counts?
        // Let's keep it simple for now.

        return NextResponse.json({
            success: true,
            count: result.count
        });

    } catch (error) {
        console.error("Bulk delete error:", error);
        return NextResponse.json(
            { error: "Failed to delete sources", details: error instanceof Error ? error.message : "Unknown" },
            { status: 500 }
        );
    }
}
