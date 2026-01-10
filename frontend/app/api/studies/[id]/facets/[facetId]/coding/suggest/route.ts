import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

interface SuggestRouteParams {
    params: Promise<{ id: string; facetId: string }>;
}

/**
 * POST /api/studies/[id]/facets/[facetId]/coding/suggest
 * 
 * Call Python LLM service to suggest categories based on existing OPEN facet values.
 */
export async function POST(request: NextRequest, { params }: SuggestRouteParams) {
    try {
        const { id: studyId, facetId } = await params;

        // Verify facet exists and is OPEN type
        const facet = await prisma.facet.findFirst({
            where: { id: facetId, studyId },
            include: { categories: true },
        });

        if (!facet) {
            return NextResponse.json(
                { error: "Facet not found" },
                { status: 404 }
            );
        }

        if (facet.type !== "OPEN" && facet.type !== "OPEN_CODED") {
            return NextResponse.json(
                { error: "Only OPEN and OPEN_CODED facets can be coded" },
                { status: 400 }
            );
        }

        // Get all unique values from classifications for this facet
        // For OPEN_CODED facets, use rawValue (original extracted value) instead of value
        const classifications = await prisma.classification.findMany({
            where: {
                facetId,
            },
            select: {
                value: true,
                rawValue: true,
            },
        });

        // For regeneration of OPEN_CODED, prefer rawValue (original) over value
        const uniqueValues = [...new Set(
            classifications
                .map(c => c.rawValue || c.value)  // Prefer rawValue, fallback to value
                .filter((v): v is string => v !== null && v !== undefined && v.trim() !== "")
        )];

        if (uniqueValues.length === 0) {
            return NextResponse.json(
                { error: "No values found for this facet" },
                { status: 400 }
            );
        }

        // Call Python service
        const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/api/coding/suggest-categories`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                values: uniqueValues,
                facet_name: facet.name,
                facet_description: facet.description,
                min_categories: 3,
                max_categories: 10,
            }),
        });

        if (!pythonResponse.ok) {
            const error = await pythonResponse.text();
            console.error("[coding/suggest] Python service error:", error);
            return NextResponse.json(
                { error: "Failed to generate category suggestions" },
                { status: 500 }
            );
        }

        const suggestions = await pythonResponse.json();

        // Enhance with source counts
        const valueCounts: Record<string, number> = {};
        classifications.forEach(c => {
            if (c.value) {
                valueCounts[c.value] = (valueCounts[c.value] || 0) + 1;
            }
        });

        // Calculate actual source counts for each category
        const categoriesWithCounts = suggestions.categories.map((cat: any) => ({
            ...cat,
            source_count: cat.values.reduce((sum: number, v: string) => sum + (valueCounts[v] || 0), 0),
        }));

        return NextResponse.json({
            ...suggestions,
            categories: categoriesWithCounts,
            total_values: uniqueValues.length,
            total_sources: classifications.length,
        });

    } catch (error) {
        console.error("[coding/suggest] Error:", error);
        return NextResponse.json(
            { error: "Failed to suggest categories" },
            { status: 500 }
        );
    }
}
