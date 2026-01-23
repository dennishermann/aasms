import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/studies/[id]/reclassify
 * 
 * Triggers reclassification for all INCLUDED sources when facets change.
 * This is called after saving the classification schema to update existing classifications.
 * 
 * Body:
 *   - facetIds?: string[] - Optional specific facets to reclassify. If not provided, reclassifies all.
 *   - mode?: "added" | "modified" | "all" - What kind of reclassification to perform
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: studyId } = await params;
        const body = await request.json().catch(() => ({}));
        const { facetIds, mode = "all" } = body;

        // Find all sources that can be reclassified (INCLUDED, CLASSIFIED, or READY_FOR_CLASSIFICATION)
        const eligibleStatuses = ["INCLUDED", "CLASSIFIED", "READY_FOR_CLASSIFICATION"];

        const sources = await prisma.source.findMany({
            where: {
                studyId,
                status: { in: eligibleStatuses as any },
                finalDecision: "INCLUDE",
            },
            select: {
                id: true,
                title: true,
                status: true,
            },
        });

        if (sources.length === 0) {
            return NextResponse.json({
                message: "No sources eligible for reclassification",
                processed: 0,
                total: 0,
            });
        }

        console.log(`[reclassify] Starting reclassification for ${sources.length} sources`, {
            studyId,
            mode,
            facetIds,
            eligibleStatuses,
        });

        // Process each source - call the classify endpoint
        const results = {
            total: sources.length,
            processed: 0,
            failed: 0,
            errors: [] as Array<{ sourceId: string; title: string; error: string }>,
        };

        // Process in batches to avoid overwhelming the system
        const BATCH_SIZE = 5;
        for (let i = 0; i < sources.length; i += BATCH_SIZE) {
            const batch = sources.slice(i, i + BATCH_SIZE);

            await Promise.all(
                batch.map(async (source) => {
                    try {
                        // Build the classify request URL with optional facet filter
                        const classifyUrl = new URL(
                            `/api/studies/${studyId}/sources/${source.id}/classify`,
                            request.nextUrl.origin
                        );

                        // If specific facets are provided, we could add them as query params
                        // For now, we reclassify all facets

                        const response = await fetch(classifyUrl.toString(), {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                // If mode is "added", we might want to only classify new facets
                                // For now, we do full reclassification
                                forceReclassify: true,
                            }),
                        });

                        if (!response.ok) {
                            const error = await response.json().catch(() => ({ error: "Unknown error" }));
                            throw new Error(error.error || `HTTP ${response.status}`);
                        }

                        results.processed++;
                    } catch (error: any) {
                        results.failed++;
                        results.errors.push({
                            sourceId: source.id,
                            title: source.title,
                            error: error.message || "Classification failed",
                        });
                        console.error(`[reclassify] Failed for source ${source.id}:`, error.message);
                    }
                })
            );
        }

        console.log(`[reclassify] Completed`, {
            studyId,
            processed: results.processed,
            failed: results.failed,
            total: results.total,
        });

        return NextResponse.json({
            message: `Reclassification complete: ${results.processed}/${results.total} sources processed`,
            ...results,
        });
    } catch (error: any) {
        console.error("[reclassify] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to trigger reclassification" },
            { status: 500 }
        );
    }
}
