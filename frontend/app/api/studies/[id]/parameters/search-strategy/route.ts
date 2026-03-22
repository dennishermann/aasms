import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const searchStrategySchema = z.object({
  picoPopulation: z.string().optional().nullable(),
  picoIntervention: z.string().optional().nullable(),
  picoComparison: z.string().optional().nullable(),
  picoOutcome: z.string().optional().nullable(),
  formalSources: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.enum(["ACADEMIC_DATABASE", "JOURNAL", "CONFERENCE_PROCEEDINGS"]),
        searchString: z.string().optional().nullable(),
        dateRange: z.any().optional().nullable(),
      }),
    )
    .optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: studyId } = await params;
    const parameters = await prisma.studyParameters.upsert({
      where: { studyId },
      create: { studyId },
      update: {},
      include: { formalSources: true },
    });
    return NextResponse.json({
      data: {
        picoPopulation: parameters.picoPopulation,
        picoIntervention: parameters.picoIntervention,
        picoComparison: parameters.picoComparison,
        picoOutcome: parameters.picoOutcome,
        formalSources: parameters.formalSources,
      },
    });
  } catch (error) {
    console.error("Error fetching search strategy:", error);
    return NextResponse.json({ error: "Failed to fetch search strategy" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: studyId } = await params;
    const body = await request.json();
    const validation = searchStrategySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 },
      );
    }
    const { picoPopulation, picoIntervention, picoComparison, picoOutcome, formalSources } = validation.data;

    const existing = await prisma.studyParameters.upsert({
      where: { studyId },
      create: { studyId },
      update: {},
    });

    await prisma.studyParameters.update({
      where: { id: existing.id },
      data: {
        picoPopulation: picoPopulation ?? undefined,
        picoIntervention: picoIntervention ?? undefined,
        picoComparison: picoComparison ?? undefined,
        picoOutcome: picoOutcome ?? undefined,
      },
    });

    if (formalSources !== undefined) {
      await prisma.formalSource.deleteMany({ where: { parametersId: existing.id } });
      if (formalSources.length > 0) {
        await prisma.formalSource.createMany({
          data: formalSources.map((fs) => ({
            parametersId: existing.id,
            name: fs.name,
            type: fs.type,
            searchString: fs.searchString ?? null,
            dateRange: fs.dateRange ?? null,
          })),
        });
      }
    }

    const updated = await prisma.studyParameters.findUnique({
      where: { id: existing.id },
      include: { formalSources: true },
    });

    return NextResponse.json({
      data: {
        picoPopulation: updated!.picoPopulation,
        picoIntervention: updated!.picoIntervention,
        picoComparison: updated!.picoComparison,
        picoOutcome: updated!.picoOutcome,
        formalSources: updated!.formalSources,
      },
    });
  } catch (error) {
    console.error("Error saving search strategy:", error);
    return NextResponse.json({ error: "Failed to save search strategy" }, { status: 500 });
  }
}
