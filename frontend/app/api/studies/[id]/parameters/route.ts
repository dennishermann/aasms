import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

// Simplified schema without classificationSchema (now handled via /facets API)
const studyParametersSchema = z.object({
  formalSources: z.array(z.object({
    name: z.string(),
    type: z.enum(["ACADEMIC_DATABASE", "JOURNAL", "CONFERENCE_PROCEEDINGS"]),
    searchString: z.string().optional(),
    dateRange: z.any().optional(),
  })).optional(),
  greySources: z.array(z.object({
    name: z.string(),
    type: z.enum(["BLOG", "WHITE_PAPER", "TECHNICAL_REPORT", "PREPRINT_SERVER", "COMPANY_WEBSITE", "RESEARCH_LAB_SITE", "GOVERNMENT_REPORT"]),
    url: z.string().optional(),
    searchStrategy: z.string().optional(),
  })).optional(),
  inclusionCriteria: z.array(z.object({
    criterion: z.string(),
    order: z.number(),
  })).optional(),
  exclusionCriteria: z.array(z.object({
    criterion: z.string(),
    order: z.number(),
  })).optional(),
});

// POST /api/studies/[id]/parameters - Create or update study parameters
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;
    const body = await request.json();
    const validation = studyParametersSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { formalSources, greySources, inclusionCriteria, exclusionCriteria } = validation.data;

    // Check if study exists
    const study = await prisma.study.findUnique({
      where: { id: studyId },
      include: { parameters: true },
    });

    if (!study) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

    // Delete existing parameters if they exist
    if (study.parameters) {
      await prisma.studyParameters.delete({
        where: { id: study.parameters.id },
      });
    }

    // Create new parameters (without classificationSchema - that's now in Facet model)
    const parameters = await prisma.studyParameters.create({
      data: {
        studyId,
        formalSources: formalSources
          ? {
            create: formalSources.map((fs) => ({
              name: fs.name,
              type: fs.type,
              searchString: fs.searchString,
              dateRange: fs.dateRange,
            })),
          }
          : undefined,
        greySources: greySources
          ? {
            create: greySources.map((gs) => ({
              name: gs.name,
              type: gs.type,
              url: gs.url,
              searchStrategy: gs.searchStrategy,
            })),
          }
          : undefined,
        inclusionCriteria: inclusionCriteria
          ? {
            create: inclusionCriteria.map((ic) => ({
              criterion: ic.criterion,
              order: ic.order,
            })),
          }
          : undefined,
        exclusionCriteria: exclusionCriteria
          ? {
            create: exclusionCriteria.map((ec) => ({
              criterion: ec.criterion,
              order: ec.order,
            })),
          }
          : undefined,
      },
      include: {
        formalSources: true,
        greySources: true,
        inclusionCriteria: { orderBy: { order: "asc" } },
        exclusionCriteria: { orderBy: { order: "asc" } },
      },
    });

    return NextResponse.json({ data: parameters }, { status: 201 });
  } catch (error) {
    console.error("Error creating/updating parameters:", error);
    return NextResponse.json({ error: "Failed to save parameters" }, { status: 500 });
  }
}

// GET /api/studies/[id]/parameters - Get study parameters
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;
    const parameters = await prisma.studyParameters.findUnique({
      where: { studyId },
      include: {
        formalSources: true,
        greySources: true,
        inclusionCriteria: { orderBy: { order: "asc" } },
        exclusionCriteria: { orderBy: { order: "asc" } },
      },
    });

    if (!parameters) {
      return NextResponse.json({ error: "Parameters not found" }, { status: 404 });
    }

    return NextResponse.json({ data: parameters });
  } catch (error) {
    console.error("Error fetching parameters:", error);
    return NextResponse.json({ error: "Failed to fetch parameters" }, { status: 500 });
  }
}
