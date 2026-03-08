"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Ban,
  Users,
  AlertCircle,
} from "lucide-react";
import { AnalysisData, CriterionEval, VoteDetail, VotingDetails, VotingSummary } from "./types";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ============ Data Normalization ============

interface NormalizedVoteDetail {
  provider: string;
  decision: boolean;
  confidence: number;
  reasoning?: string | null;
  error?: string | null;
}

interface NormalizedVotingDetails {
  votes: NormalizedVoteDetail[];
  agreementRatio: number;
  voteCount: number;
  totalVoters: number;
}

/**
 * Normalize voting details from snake_case (Python) to camelCase
 */
function normalizeVotingDetails(data: any): NormalizedVotingDetails | null {
  if (!data) return null;

  // Handle both snake_case and camelCase field names
  const votes = data.votes || [];
  const agreementRatio = data.agreementRatio ?? data.agreement_ratio ?? 0;
  const voteCount = data.voteCount ?? data.vote_count ?? 0;
  const totalVoters = data.totalVoters ?? data.total_voters ?? 0;

  return {
    votes: votes.map((v: any) => ({
      provider: v.provider,
      decision: v.decision,
      confidence: v.confidence,
      reasoning: v.reasoning,
      error: v.error,
    })),
    agreementRatio,
    voteCount,
    totalVoters,
  };
}

/**
 * Normalize criterion data from API response
 */
function normalizeCriterion(
  criterion: any,
): CriterionEval & { normalizedVotingDetails: NormalizedVotingDetails | null } {
  // Handle both snake_case and camelCase for voting_details
  const votingData = criterion.votingDetails || criterion.voting_details;

  return {
    criterion: criterion.criterion,
    fulfilled: criterion.fulfilled ?? criterion.decision,
    decision: criterion.decision ?? criterion.fulfilled,
    reasoning: criterion.reasoning,
    confidence: criterion.confidence,
    votingDetails: criterion.votingDetails,
    normalizedVotingDetails: normalizeVotingDetails(votingData),
  };
}

// ============ Provider Colors & Icons ============

const PROVIDER_CONFIG: Record<
  string,
  { bg: string; text: string; border: string; name: string; initial: string }
> = {
  openai: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    name: "OpenAI",
    initial: "O",
  },
  claude: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    name: "Claude",
    initial: "C",
  },
  gemini: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    name: "Gemini",
    initial: "G",
  },
};

function getProviderConfig(provider: string) {
  const normalized = provider.toLowerCase();
  if (normalized.includes("openai") || normalized.includes("gpt")) return PROVIDER_CONFIG.openai;
  if (normalized.includes("claude") || normalized.includes("anthropic"))
    return PROVIDER_CONFIG.claude;
  if (normalized.includes("gemini") || normalized.includes("google")) return PROVIDER_CONFIG.gemini;
  return {
    bg: "bg-gray-50",
    text: "text-gray-700",
    border: "border-gray-200",
    name: provider,
    initial: provider[0]?.toUpperCase() ?? "?",
  };
}

// ============ Vote Chip Component ============

interface VoteChipProps {
  vote: NormalizedVoteDetail;
}

const VoteChip = ({ vote }: VoteChipProps) => {
  const config = getProviderConfig(vote.provider);
  const isError = !!vote.error;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border cursor-help transition-all hover:scale-105",
              isError ? "bg-gray-100 text-gray-500 border-gray-200" : config.bg,
              !isError && config.text,
              !isError && config.border,
            )}
          >
            {/* Provider initial */}
            <span className="font-bold">{config.initial}</span>

            {/* Decision indicator */}
            {isError ? (
              <AlertCircle className="h-3 w-3" />
            ) : vote.decision ? (
              <CheckCircle2 className="h-3 w-3 text-green-600" />
            ) : (
              <XCircle className="h-3 w-3 text-red-600" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <span>{config.name}</span>
              <Badge
                variant={isError ? "secondary" : vote.decision ? "default" : "destructive"}
                className="text-[10px] px-1.5 py-0"
              >
                {isError ? "Error" : vote.decision ? "Yes" : "No"}
              </Badge>
              {!isError && (
                <span className="text-xs text-muted-foreground">
                  {(vote.confidence * 100).toFixed(0)}%
                </span>
              )}
            </div>
            {vote.error && <p className="text-xs text-red-600">{vote.error}</p>}
            {vote.reasoning && !vote.error && (
              <p className="text-xs text-muted-foreground line-clamp-3">{vote.reasoning}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ============ Voting Summary Row ============

interface VotingSummaryRowProps {
  votingDetails: NormalizedVotingDetails;
  finalDecision: boolean;
}

const VotingSummaryRow = ({ votingDetails, finalDecision }: VotingSummaryRowProps) => {
  const { votes, agreementRatio, voteCount, totalVoters } = votingDetails;
  const isUnanimous = agreementRatio === 1;
  const validVotes = votes.filter((v) => !v.error);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Vote chips for each provider */}
      {votes.map((vote, i) => (
        <VoteChip key={i} vote={vote} />
      ))}

      {/* Agreement indicator */}
      {validVotes.length >= 2 && (
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-2 py-0.5 ml-1",
            isUnanimous
              ? "border-blue-300 bg-blue-50 text-blue-700"
              : "border-amber-300 bg-amber-50 text-amber-700",
          )}
        >
          {isUnanimous ? "Unanimous" : `${voteCount}/${totalVoters}`}
        </Badge>
      )}
    </div>
  );
};

// ============ Provider Reasoning Card ============

interface ProviderReasoningCardProps {
  vote: NormalizedVoteDetail;
}

const ProviderReasoningCard = ({ vote }: ProviderReasoningCardProps) => {
  const config = getProviderConfig(vote.provider);
  const isError = !!vote.error;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border",
        isError
          ? "bg-gray-50 border-gray-200"
          : vote.decision
            ? "bg-green-50/50 border-green-200"
            : "bg-red-50/50 border-red-200",
      )}
    >
      {/* Provider badge */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 border",
          isError
            ? "bg-gray-200 text-gray-500 border-gray-300"
            : cn(config.bg, config.text, config.border),
        )}
      >
        {config.initial}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm">{config.name}</span>
          <Badge
            variant={isError ? "secondary" : vote.decision ? "default" : "destructive"}
            className="text-[10px] px-1.5 py-0"
          >
            {isError ? "Error" : vote.decision ? "Yes" : "No"}
          </Badge>
          {!isError && (
            <span className="text-xs text-muted-foreground">
              {(vote.confidence * 100).toFixed(0)}% confident
            </span>
          )}
        </div>
        {vote.error ? (
          <p className="text-xs text-red-600">{vote.error}</p>
        ) : vote.reasoning ? (
          <p className="text-sm text-muted-foreground leading-relaxed">{vote.reasoning}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No reasoning provided</p>
        )}
      </div>
    </div>
  );
};

// ============ Criterion Card ============

interface NormalizedCriterionEval extends CriterionEval {
  normalizedVotingDetails: NormalizedVotingDetails | null;
}

const CriterionCard = ({
  criterion,
  type,
}: {
  criterion: NormalizedCriterionEval;
  type: "inclusion" | "exclusion";
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasVoting =
    criterion.normalizedVotingDetails && criterion.normalizedVotingDetails.votes.length > 0;

  // Determine outcome
  const fulfilled = criterion.fulfilled ?? criterion.decision ?? false;
  const isGood = type === "inclusion" ? fulfilled : !fulfilled;

  const styles = isGood
    ? {
        border: "border-green-200",
        bg: "bg-gradient-to-br from-green-50 to-emerald-50/30",
        icon: <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />,
        text: "text-green-900",
        muted: "text-green-700/80",
      }
    : {
        border: "border-red-200",
        bg: "bg-gradient-to-br from-red-50 to-rose-50/30",
        icon:
          type === "exclusion" ? (
            <Ban className="h-5 w-5 text-red-600 flex-shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          ),
        text: "text-red-900",
        muted: "text-red-700/80",
      };

  return (
    <div
      className={cn(
        "border rounded-xl transition-all duration-200 overflow-hidden shadow-sm",
        styles.border,
        styles.bg,
      )}
    >
      {/* Header - always visible */}
      <div
        className="p-4 flex items-start gap-3 cursor-pointer hover:opacity-90 active:scale-[0.995] transition-transform select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="mt-0.5">{styles.icon}</div>

        <div className="flex-1 min-w-0">
          {/* Criterion text */}
          <p className={cn("text-sm font-semibold leading-tight", styles.text)}>
            {criterion.criterion}
          </p>

          {/* Voting chips row */}
          {hasVoting && (
            <div className="mt-2">
              <VotingSummaryRow
                votingDetails={criterion.normalizedVotingDetails!}
                finalDecision={fulfilled}
              />
            </div>
          )}

          {/* Collapsed reasoning preview (only show if no voting details) */}
          {!hasVoting && !expanded && criterion.reasoning && (
            <p className={cn("text-xs mt-2 line-clamp-1", styles.muted)}>{criterion.reasoning}</p>
          )}
        </div>

        {/* Expand indicator */}
        <div className={cn("flex-shrink-0 mt-0.5", styles.muted)}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {/* Expanded Content */}
      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className={cn("px-4 pb-4 text-sm border-t", styles.border)}>
            {/* Per-provider reasoning (when voting enabled) */}
            {hasVoting ? (
              <div className="mt-3 space-y-2">
                <span
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider opacity-70 block mb-2",
                    styles.text,
                  )}
                >
                  LLM Assessments
                </span>
                {criterion.normalizedVotingDetails!.votes.map((vote, i) => (
                  <ProviderReasoningCard key={i} vote={vote} />
                ))}
              </div>
            ) : (
              /* Single reasoning (no voting) */
              <div className="mt-3">
                <span
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider opacity-70 block mb-1",
                    styles.text,
                  )}
                >
                  Reasoning
                </span>
                <p className={cn("leading-relaxed", styles.text)}>
                  {criterion.reasoning || "No reasoning provided."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ Voting Summary Banner ============

const VotingSummaryBanner = ({ summary }: { summary: VotingSummary }) => {
  const agreementPercent = (summary.overallAgreementRatio * 100).toFixed(0);
  const isHighAgreement = summary.overallAgreementRatio >= 0.9;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 p-4 rounded-xl border",
        isHighAgreement
          ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200"
          : "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200",
      )}
    >
      {/* Provider avatars */}
      <div className="flex items-center">
        <Users
          className={cn("h-5 w-5 mr-2", isHighAgreement ? "text-blue-600" : "text-amber-600")}
        />
        <div className="flex -space-x-2">
          {summary.providersUsed.map((provider) => {
            const config = getProviderConfig(provider);
            return (
              <div
                key={provider}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 border-white",
                  config.bg,
                  config.text,
                )}
                title={config.name}
              >
                {config.initial}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className={cn("font-semibold", isHighAgreement ? "text-blue-800" : "text-amber-800")}>
          Multi-LLM Voting
        </span>
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-xs font-medium",
            isHighAgreement ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700",
          )}
        >
          {agreementPercent}% agreement
        </span>
        <span className="text-muted-foreground text-xs">
          {summary.unanimousDecisions} unanimous · {summary.splitDecisions} split
        </span>
      </div>
    </div>
  );
};

// ============ Main Component ============

interface InclusionExclusionViewProps {
  analysis: Pick<
    AnalysisData,
    | "inclusionRecommendation"
    | "inclusionReasoning"
    | "exclusionReasoning"
    | "confidenceScore"
    | "relevanceScore"
    | "qualityNotes"
    | "inclusionCriteria"
    | "exclusionCriteria"
    | "votingEnabled"
    | "votingSummary"
  >;
  loading?: boolean;
}

export function InclusionExclusionView({ analysis, loading = false }: InclusionExclusionViewProps) {
  const {
    inclusionCriteria: rawInclusionCriteria,
    exclusionCriteria: rawExclusionCriteria,
    inclusionRecommendation,
    confidenceScore,
    votingEnabled,
    votingSummary,
  } = analysis;

  // Normalize criteria to handle snake_case from Python backend
  const inclusionCriteria = useMemo(
    () => (rawInclusionCriteria || []).map(normalizeCriterion),
    [rawInclusionCriteria],
  );

  const exclusionCriteria = useMemo(
    () => (rawExclusionCriteria || []).map(normalizeCriterion),
    [rawExclusionCriteria],
  );

  const [showDetails, setShowDetails] = useState(false);

  // Normalize voting summary (handle snake_case)
  const normalizedVotingSummary = useMemo(() => {
    if (!votingSummary) return null;
    return {
      totalProviders: votingSummary.totalProviders ?? (votingSummary as any).total_providers ?? 0,
      providersUsed: votingSummary.providersUsed ?? (votingSummary as any).providers_used ?? [],
      overallAgreementRatio:
        votingSummary.overallAgreementRatio ?? (votingSummary as any).overall_agreement_ratio ?? 0,
      totalCriteriaEvaluated:
        votingSummary.totalCriteriaEvaluated ??
        (votingSummary as any).total_criteria_evaluated ??
        0,
      unanimousDecisions:
        votingSummary.unanimousDecisions ?? (votingSummary as any).unanimous_decisions ?? 0,
      splitDecisions: votingSummary.splitDecisions ?? (votingSummary as any).split_decisions ?? 0,
    };
  }, [votingSummary]);

  return (
    <CardContent className="space-y-6 pt-6">
      {/* Voting Summary Banner */}
      {votingEnabled && normalizedVotingSummary && (
        <VotingSummaryBanner summary={normalizedVotingSummary} />
      )}

      {/* Header Evaluation Status */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b pb-6">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            Evaluation Result
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h3>
          <div className="flex items-center gap-2">
            <Badge
              variant={inclusionRecommendation ? "default" : "destructive"}
              className="text-sm px-3 py-1"
            >
              {inclusionRecommendation ? "INCLUDE" : "EXCLUDE"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Confidence: {(confidenceScore * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Confidence Bar (Visual) */}
        <div className="w-full md:w-48 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Confidence</span>
            <span>{(confidenceScore * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500 rounded-full",
                confidenceScore > 0.8
                  ? "bg-green-500"
                  : confidenceScore > 0.5
                    ? "bg-yellow-500"
                    : "bg-red-500",
              )}
              style={{ width: `${confidenceScore * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Toggle Details */}
      <div className="flex justify-center -mt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="text-muted-foreground text-xs flex items-center gap-1 h-7"
        >
          {showDetails ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Hide Criteria Details
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Show Criteria Details
            </>
          )}
        </Button>
      </div>

      {/* 2-Column Grid */}
      {showDetails && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-200">
          {/* Left Column: Inclusion */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                Inclusion Criteria
                <Badge variant="outline" className="ml-1 text-xs font-normal">
                  {inclusionCriteria?.length || 0}
                </Badge>
              </h4>
            </div>

            <div className="space-y-3">
              {inclusionCriteria?.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No criteria defined.</p>
              )}
              {inclusionCriteria?.map((c, i) => (
                <CriterionCard key={i} criterion={c} type="inclusion" />
              ))}
            </div>
          </div>

          {/* Right Column: Exclusion */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                Exclusion Criteria
                <Badge variant="outline" className="ml-1 text-xs font-normal">
                  {exclusionCriteria?.length || 0}
                </Badge>
              </h4>
            </div>

            <div className="space-y-3">
              {exclusionCriteria?.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No criteria defined.</p>
              )}
              {exclusionCriteria?.map((c, i) => (
                <CriterionCard key={i} criterion={c} type="exclusion" />
              ))}
            </div>
          </div>
        </div>
      )}
    </CardContent>
  );
}
