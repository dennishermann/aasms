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
      return NextResponse.json({ error: "Facet not found" }, { status: 404 });
    }

    if (facet.type !== "OPEN" && facet.type !== "OPEN_CODED") {
      return NextResponse.json(
        { error: "Only OPEN and OPEN_CODED facets can be coded" },
        { status: 400 },
      );
    }

    const keywords = await prisma.facetKeyword.findMany({
      where: { facetId },
      select: {
        keyword: true,
      },
    });

    const uniqueValues = [
      ...new Set(
        keywords
          .map((k) => k.keyword)
          .filter((v): v is string => v !== null && v !== undefined && v.trim() !== ""),
      ),
    ];

    if (uniqueValues.length === 0) {
      return NextResponse.json({ error: "No values found for this facet" }, { status: 400 });
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
        { status: 500 },
      );
    }

    const suggestions = await pythonResponse.json();

    // Enhance with source counts
    const valueCounts: Record<string, number> = {};
    keywords.forEach((k) => {
      if (k.keyword) {
        valueCounts[k.keyword] = (valueCounts[k.keyword] || 0) + 1;
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
      total_sources: keywords.length,
    });
  } catch (error) {
    console.error("[coding/suggest] Error:", error);
    return NextResponse.json({ error: "Failed to suggest categories" }, { status: 500 });
  }
}
