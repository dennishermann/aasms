import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/studies/[id]/sources/[sourceId]/analysis/votes
 *
 * Retrieve voting details for a source's analysis.
 * Returns individual LLM votes and voting summary if voting was enabled.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  try {
    const { id: studyId, sourceId } = await params;

    // First verify the source exists and belongs to this study
    const source = await prisma.source.findFirst({
      where: { id: sourceId, studyId },
      include: {
        analysis: {
          include: {
            votes: {
              orderBy: [{ criterionType: "asc" }, { criterionIndex: "asc" }, { provider: "asc" }],
            },
          },
        },
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    if (!source.analysis) {
      return NextResponse.json({ error: "No analysis found for this source" }, { status: 404 });
    }

    const analysis = source.analysis;

    // Return voting data
    return NextResponse.json({
      data: {
        votingEnabled: analysis.votingEnabled,
        votingSummary: analysis.votingSummary,
        votes: analysis.votes.map((vote) => ({
          id: vote.id,
          criterionType: vote.criterionType,
          criterionIndex: vote.criterionIndex,
          criterionText: vote.criterionText,
          provider: vote.provider,
          decision: vote.decision,
          confidence: vote.confidence,
          reasoning: vote.reasoning,
          error: vote.error,
          createdAt: vote.createdAt,
        })),
        // Group votes by criterion for easier frontend consumption
        votesByCriterion: groupVotesByCriterion(analysis.votes),
      },
    });
  } catch (error) {
    console.error("Error fetching voting data:", error);
    return NextResponse.json({ error: "Failed to fetch voting data" }, { status: 500 });
  }
}

/**
 * Helper function to group votes by criterion type and index
 */
function groupVotesByCriterion(votes: any[]) {
  const grouped: Record<string, any> = {
    inclusion: {},
    exclusion: {},
  };

  votes.forEach((vote) => {
    const type = vote.criterionType.toLowerCase();
    const key = `${vote.criterionIndex}`;

    if (!grouped[type][key]) {
      grouped[type][key] = {
        criterionText: vote.criterionText,
        votes: [],
        // Calculate aggregated values
        finalDecision: false,
        agreementRatio: 0,
        totalVoters: 0,
      };
    }

    grouped[type][key].votes.push({
      provider: vote.provider,
      decision: vote.decision,
      confidence: vote.confidence,
      reasoning: vote.reasoning,
      error: vote.error,
    });
  });

  // Calculate aggregated values for each criterion
  Object.values(grouped).forEach((typeGroup: any) => {
    Object.values(typeGroup).forEach((criterion: any) => {
      const validVotes = criterion.votes.filter((v: any) => !v.error);
      const positiveVotes = validVotes.filter((v: any) => v.decision).length;
      const totalVoters = validVotes.length;

      criterion.totalVoters = totalVoters;
      criterion.finalDecision = positiveVotes > totalVoters / 2;
      criterion.agreementRatio =
        totalVoters > 0 ? Math.max(positiveVotes, totalVoters - positiveVotes) / totalVoters : 0;
    });
  });

  return grouped;
}
