import { prisma } from "@/lib/db";

/**
 * Normalize a single criterion from the Python service response,
 * handling both camelCase and snake_case field names.
 */
function normalizeCriterion(c: any) {
  return {
    criterion: c.criterion,
    fulfilled: c.decision ?? c.fulfilled ?? false,
    reasoning: c.reasoning || "",
    confidence: c.confidence ?? 0.5,
    // Preserve voting details if present
    ...(c.votingDetails || c.voting_details
      ? { votingDetails: c.votingDetails || c.voting_details }
      : {}),
  };
}

/**
 * Normalize inclusion analysis results from the Python service response.
 * Handles both camelCase and snake_case field names.
 */
export function normalizeInclusionResult(analysisResult: any) {
  const inclusionCriteria = (
    analysisResult.inclusionCriteria ||
    analysisResult.inclusion_criteria ||
    []
  ).map(normalizeCriterion);

  const exclusionCriteria = (
    analysisResult.exclusionCriteria ||
    analysisResult.exclusion_criteria ||
    []
  ).map(normalizeCriterion);

  return {
    inclusionCriteria,
    exclusionCriteria,
    inclusionReasoning:
      analysisResult.inclusionReasoning || analysisResult.inclusion_reasoning || "",
    exclusionReasoning:
      analysisResult.exclusionReasoning || analysisResult.exclusion_reasoning || "",
    relevanceScore: analysisResult.relevanceScore ?? analysisResult.relevance_score ?? null,
    qualityNotes: analysisResult.qualityNotes || analysisResult.quality_notes || null,
    votingEnabled: analysisResult.votingEnabled || analysisResult.voting_enabled || false,
    votingSummary: analysisResult.votingSummary || analysisResult.voting_summary || null,
    contextResponseId:
      analysisResult.contextResponseId || analysisResult.context_response_id || null,
  };
}

/**
 * Persist inclusion analysis results to the database via upsert.
 */
export async function persistInclusionAnalysis(
  sourceId: string,
  contentExcerpt: string,
  analysisResult: any,
  normalized: ReturnType<typeof normalizeInclusionResult>,
) {
  const analysisData = {
    extractedText: contentExcerpt || "",
    inclusionRecommendation: analysisResult.recommendation === "include",
    inclusionReasoning: normalized.inclusionReasoning,
    exclusionReasoning: normalized.exclusionReasoning,
    confidenceScore: parseFloat(analysisResult.confidence || 0),
    relevanceScore: normalized.relevanceScore,
    qualityNotes: normalized.qualityNotes,
    inclusionCriteria: normalized.inclusionCriteria,
    exclusionCriteria: normalized.exclusionCriteria,
    votingEnabled: normalized.votingEnabled,
    votingSummary: normalized.votingSummary,
  };

  return prisma.sourceAnalysis.upsert({
    where: { sourceId },
    update: analysisData,
    create: { sourceId, ...analysisData },
  });
}

/**
 * Extract and persist individual voting data from inclusion/exclusion criteria.
 */
export async function persistVotingData(
  analysisId: string,
  inclusionCriteria: any[],
  exclusionCriteria: any[],
) {
  // Delete existing votes
  await prisma.analysisVote.deleteMany({
    where: { analysisId },
  });

  const votesToCreate: any[] = [];

  const extractVotes = (criteria: any[], criterionType: string) => {
    criteria.forEach((criterion: any, index: number) => {
      const votingDetails = criterion.votingDetails || criterion.voting_details;
      if (votingDetails?.votes) {
        votingDetails.votes.forEach((vote: any) => {
          votesToCreate.push({
            analysisId,
            criterionType,
            criterionIndex: index,
            criterionText: criterion.criterion,
            provider: vote.provider,
            decision: vote.decision,
            confidence: vote.confidence,
            reasoning: vote.reasoning || null,
            error: vote.error || null,
          });
        });
      }
    });
  };

  extractVotes(inclusionCriteria, "INCLUSION");
  extractVotes(exclusionCriteria, "EXCLUSION");

  if (votesToCreate.length > 0) {
    await prisma.analysisVote.createMany({ data: votesToCreate });
    console.log("[voting] data persisted", {
      analysisId,
      votesCount: votesToCreate.length,
      providers: [...new Set(votesToCreate.map((v) => v.provider))],
    });
  }
}

/**
 * Update source status after inclusion analysis.
 * If included -> ANALYZING_CLASSIFICATION, if excluded -> EXCLUDED.
 */
export async function updateSourceStatusAfterAnalysis(
  sourceId: string,
  analysis: { inclusionRecommendation: boolean },
  contextResponseId: string | null,
) {
  const newStatus = analysis.inclusionRecommendation ? "ANALYZING_CLASSIFICATION" : "EXCLUDED";
  await prisma.source.update({
    where: { id: sourceId },
    data: {
      status: newStatus,
      ...(contextResponseId ? { classificationThreadId: contextResponseId } : {}),
    },
  });
  console.log(`[analysis] status -> ${newStatus}`, { sourceId });
  return newStatus;
}
