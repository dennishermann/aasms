import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PYTHON_SERVICE_URL } from "@/lib/python-service";
import { Decision, SourceStatus } from "@prisma/client";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;

    // Fetch study with RQs and facets
    const study = await prisma.study.findUnique({
      where: { id: studyId },
      include: {
        researchQuestions: { orderBy: { order: "asc" } },
        facets: {
          include: {
            categories: { orderBy: { order: "asc" } },
            researchQuestions: true,
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!study) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

    if (study.researchQuestions.length === 0) {
      return NextResponse.json({
        data: { summaries: [] },
      });
    }

    // Build facet data with classification counts
    const facetData = await Promise.all(
      study.facets.map(async (facet) => {
        const classifications = await prisma.classification.findMany({
          where: {
            facetId: facet.id,
            analysis: {
              source: {
                studyId,
                status: SourceStatus.CLASSIFIED,
                finalDecision: Decision.INCLUDE,
              },
            },
          },
          include: {
            category: true,
            analysis: { select: { sourceId: true } },
          },
        });

        // Count unique sources per category
        const categoryMap = new Map<string, { name: string; sourceIds: Set<string> }>();

        if (facet.type === "CLOSED" || facet.type === "OPEN_CODED") {
          for (const cat of facet.categories) {
            categoryMap.set(cat.id, { name: cat.name, sourceIds: new Set() });
          }
          for (const c of classifications) {
            if (c.categoryId) {
              const entry = categoryMap.get(c.categoryId);
              if (entry) entry.sourceIds.add(c.analysis.sourceId);
            }
          }
        } else {
          // OPEN facets: group by value
          for (const c of classifications) {
            const val = c.value || "Unknown";
            if (!categoryMap.has(val)) {
              categoryMap.set(val, { name: val, sourceIds: new Set() });
            }
            categoryMap.get(val)!.sourceIds.add(c.analysis.sourceId);
          }
        }

        const totalSources = new Set(classifications.map((c) => c.analysis.sourceId)).size;
        const categories = Array.from(categoryMap.entries()).map(([, { name, sourceIds }]) => ({
          name,
          count: sourceIds.size,
          percentage: totalSources > 0 ? (sourceIds.size / totalSources) * 100 : 0,
        }));

        return {
          id: facet.id,
          name: facet.name,
          type: facet.type,
          research_question_ids: facet.researchQuestions.map((frq) => frq.researchQuestionId),
          categories,
        };
      }),
    );

    // Fetch included sources with classifications for evidence
    const sources = await prisma.source.findMany({
      where: {
        studyId,
        status: SourceStatus.CLASSIFIED,
        finalDecision: Decision.INCLUDE,
      },
      include: {
        analysis: {
          include: {
            classifications: {
              include: {
                facet: true,
                category: true,
              },
            },
          },
        },
      },
      take: 20,
      orderBy: { updatedAt: "desc" },
    });

    const sourceEvidence = sources.map((source) => {
      const classifications: Record<string, string> = {};
      if (source.analysis) {
        for (const c of source.analysis.classifications) {
          const facetName = c.facet.name;
          classifications[facetName] = c.category?.name || c.value || "Unknown";
        }
      }
      return {
        title: source.title,
        abstract: source.abstract || "",
        classifications,
      };
    });

    // Call Python service
    const researchQuestions = study.researchQuestions.map((rq) => ({
      id: rq.id,
      question: rq.question,
    }));

    const pythonRes = await fetch(`${PYTHON_SERVICE_URL}/api/rq-summaries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        research_questions: researchQuestions,
        facet_data: facetData,
        source_evidence: sourceEvidence,
      }),
    });

    if (!pythonRes.ok) {
      const errorText = await pythonRes.text();
      console.error("Python service rq-summaries error:", errorText);
      return NextResponse.json(
        { error: "Failed to generate RQ summaries" },
        { status: pythonRes.status },
      );
    }

    const result = await pythonRes.json();
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Error generating RQ summaries:", error);
    return NextResponse.json({ error: "Failed to generate RQ summaries" }, { status: 500 });
  }
}
