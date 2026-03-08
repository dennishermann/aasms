"""Pydantic request/response models for the analysis API router."""

from typing import Any

from pydantic import BaseModel, Field
from pydantic.config import ConfigDict


class ClassificationResult(BaseModel):
    """Classification result for a single facet."""

    model_config = ConfigDict(populate_by_name=True)

    facet_name: str = Field(alias="facetName")
    category: str | None = None
    keywords: list[str] | None = None
    confidence: float
    reasoning: str | None = None
    is_manual_override: bool | None = Field(default=False, alias="isManualOverride")


class VoteDetail(BaseModel):
    """Single LLM's vote on a criterion."""

    model_config = ConfigDict(populate_by_name=True)

    provider: str
    decision: bool
    confidence: float
    reasoning: str | None = None
    error: str | None = None


class VotingDetails(BaseModel):
    """Voting details for a single criterion."""

    model_config = ConfigDict(populate_by_name=True)

    votes: list[VoteDetail]
    agreement_ratio: float = Field(alias="agreementRatio")
    vote_count: int = Field(alias="voteCount")
    total_voters: int = Field(alias="totalVoters")


class VotingSummary(BaseModel):
    """Summary of voting across all criteria."""

    model_config = ConfigDict(populate_by_name=True)

    total_providers: int = Field(alias="totalProviders")
    providers_used: list[str] = Field(alias="providersUsed")
    overall_agreement_ratio: float = Field(alias="overallAgreementRatio")
    total_criteria_evaluated: int = Field(alias="totalCriteriaEvaluated")
    unanimous_decisions: int = Field(alias="unanimousDecisions")
    split_decisions: int = Field(alias="splitDecisions")


class CriterionEvaluation(BaseModel):
    """Evaluation result for a single criterion."""

    model_config = ConfigDict(populate_by_name=True)

    criterion: str
    decision: bool
    reasoning: str
    confidence: float
    voting_details: VotingDetails | None = Field(default=None, alias="votingDetails")


class ClassificationResponse(BaseModel):
    """Response model for classification-only invocation."""

    model_config = ConfigDict(populate_by_name=True)
    classifications: list[ClassificationResult]


class ClassificationTextRequest(BaseModel):
    """Request model for text-based classification."""

    model_config = ConfigDict(populate_by_name=True)

    source_id: str | None = Field(default=None, alias="sourceId")
    study_parameters: dict[str, Any] = Field(alias="studyParameters")
    source_content: dict[str, Any] = Field(alias="sourceContent")
    previous_response_id: str | None = Field(default=None, alias="classificationThreadId")


class InclusionAnalysisResponse(BaseModel):
    """Response model for inclusion/exclusion-only analysis."""

    model_config = ConfigDict(populate_by_name=True)

    analysis_id: str
    recommendation: str  # "include" or "exclude"
    inclusion_reasoning: str = Field(alias="inclusionReasoning")
    exclusion_reasoning: str = Field(alias="exclusionReasoning")
    confidence: float
    inclusion_criteria: list[CriterionEvaluation] = Field(alias="inclusionCriteria")
    exclusion_criteria: list[CriterionEvaluation] = Field(alias="exclusionCriteria")
    relevance_score: float | None = Field(default=None, alias="relevanceScore")
    quality_notes: str | None = Field(default=None, alias="qualityNotes")
    context_response_id: str | None = Field(default=None, alias="contextResponseId")
    # Voting-specific fields
    voting_enabled: bool = Field(default=False, alias="votingEnabled")
    voting_summary: VotingSummary | None = Field(default=None, alias="votingSummary")


class InclusionAnalysisTextRequest(BaseModel):
    """Request model for text-based inclusion analysis."""

    model_config = ConfigDict(populate_by_name=True)

    source_id: str | None = Field(default=None, alias="sourceId")
    study_parameters: dict[str, Any] = Field(alias="studyParameters")
    source_content: dict[str, Any] = Field(alias="sourceContent")
    previous_response_id: str | None = Field(default=None, alias="classificationThreadId")


class FullAnalysisResponse(BaseModel):
    """Response model for combined analysis."""

    model_config = ConfigDict(populate_by_name=True)

    recommendation: str
    inclusion_reasoning: str = Field(alias="inclusionReasoning")
    exclusion_reasoning: str = Field(alias="exclusionReasoning")
    confidence: float
    inclusion_criteria: list[CriterionEvaluation] = Field(alias="inclusionCriteria")
    exclusion_criteria: list[CriterionEvaluation] = Field(alias="exclusionCriteria")
    classifications: list[ClassificationResult] | None = None
    # Voting-specific fields
    voting_enabled: bool = Field(default=False, alias="votingEnabled")
    voting_summary: VotingSummary | None = Field(default=None, alias="votingSummary")


# ============ RQ Summary Models ============


class CategoryCount(BaseModel):
    """Category distribution count."""

    name: str
    count: int
    percentage: float


class FacetSummaryData(BaseModel):
    """Facet data with classification distributions for RQ summary generation."""

    id: str
    name: str
    type: str
    research_question_ids: list[str]
    categories: list[CategoryCount]


class SourceEvidence(BaseModel):
    """Source evidence for RQ summary generation."""

    title: str
    abstract: str = ""
    classifications: dict[str, str] = {}


class RQData(BaseModel):
    """Research question data."""

    id: str
    question: str


class RQSummaryRequest(BaseModel):
    """Request model for generating RQ summaries."""

    research_questions: list[RQData]
    facet_data: list[FacetSummaryData]
    source_evidence: list[SourceEvidence]


class RQSummaryItem(BaseModel):
    """Summary for a single research question."""

    rq_id: str
    question: str
    summary: str
    key_findings: list[str]
    evidence_quality: str
    gaps: list[str]


class RQSummaryResponse(BaseModel):
    """Response model for RQ summaries."""

    summaries: list[RQSummaryItem]
