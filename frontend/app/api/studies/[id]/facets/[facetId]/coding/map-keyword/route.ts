import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

interface RouteParams {
  params: Promise<{ id: string; facetId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: studyId, facetId } = await params;
    const body = await request.json().catch(() => ({}));
    const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";

    if (!keyword) {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
    }

    const facet = await prisma.facet.findFirst({
      where: { id: facetId, studyId },
      include: { categories: true },
    });

    if (!facet) {
      return NextResponse.json({ error: "Facet not found" }, { status: 404 });
    }

    const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/api/coding/map-keyword`, {
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

    if (!pythonResponse.ok) {
      const error = await pythonResponse.text();
      return NextResponse.json({ error: "Failed to map keyword", details: error }, { status: 500 });
    }

    const suggestion = await pythonResponse.json();
    const match = facet.categories.find(
      (cat) => cat.name.toLowerCase() === (suggestion.category_name || "").toLowerCase(),
    );

    const mapping = await prisma.facetKeywordMapping.upsert({
      where: {
        facetId_keyword: {
          facetId,
          keyword,
        },
      },
      create: {
        facetId,
        keyword,
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
      include: {
        category: true,
      },
    });

    return NextResponse.json({ data: mapping });
  } catch (error) {
    console.error("[coding/map-keyword] Error:", error);
    return NextResponse.json({ error: "Failed to map keyword" }, { status: 500 });
  }
}
