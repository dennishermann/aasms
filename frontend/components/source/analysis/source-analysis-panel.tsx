"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, X as XIcon, Edit, Loader2, Tags } from "lucide-react";
import { InclusionExclusionView } from "./inclusion-exclusion-view";
import { InclusionExclusionEditor } from "./inclusion-exclusion-editor";
import { ClassificationsView } from "./classifications-view";
import { ClassificationsEditor } from "./classifications-editor";
import { AnalysisData, Classification, CriterionEval, Facet, FacetKeyword } from "./types";

interface SourceAnalysisPanelProps {
  studyId: string;
  sourceId: string;
  analysis: AnalysisData;
  facets: Facet[];
  onSuccess?: () => void;
  loadingInclusion?: boolean;
  loadingClassifications?: boolean;
  canEditInclusion?: boolean;
  canEditClassifications?: boolean;
  showClassifications?: boolean;
}

export function SourceAnalysisPanel({
  studyId,
  sourceId,
  analysis: initialAnalysis,
  facets,
  onSuccess,
  loadingInclusion = false,
  loadingClassifications = false,
  canEditInclusion = true,
  canEditClassifications = true,
  showClassifications = true,
}: SourceAnalysisPanelProps) {
  const queryClient = useQueryClient();

  const normalizeCriteria = (criteria?: CriterionEval[]) =>
    (criteria || []).map((c) => ({
      ...c,
      fulfilled: typeof c.fulfilled === "boolean" ? c.fulfilled : Boolean(c.decision),
    }));

  const [isEditingInclusion, setIsEditingInclusion] = useState(false);
  const [isEditingClassifications, setIsEditingClassifications] = useState(false);
  const [isEditingKeywords, setIsEditingKeywords] = useState(false);

  const [inclusionRecommendation, setInclusionRecommendation] = useState(
    initialAnalysis.inclusionRecommendation,
  );
  const [inclusionReasoning, setInclusionReasoning] = useState(initialAnalysis.inclusionReasoning);
  const [exclusionReasoning, setExclusionReasoning] = useState(initialAnalysis.exclusionReasoning);
  const [confidenceScore, setConfidenceScore] = useState(initialAnalysis.confidenceScore);
  const [inclusionCriteria, setInclusionCriteria] = useState<CriterionEval[]>(
    normalizeCriteria(initialAnalysis.inclusionCriteria),
  );
  const [exclusionCriteria, setExclusionCriteria] = useState<CriterionEval[]>(
    normalizeCriteria(initialAnalysis.exclusionCriteria),
  );
  const [classifications, setClassifications] = useState<Classification[]>(
    initialAnalysis.classifications || [],
  );
  const [facetKeywords, setFacetKeywords] = useState<FacetKeyword[]>(
    initialAnalysis.facetKeywords || [],
  );
  const [relevanceScore, setRelevanceScore] = useState(initialAnalysis.relevanceScore || 0.5);
  const [qualityNotes, setQualityNotes] = useState(initialAnalysis.qualityNotes || "");

  // Keep inclusion/exclusion state in sync unless the user is actively editing that section
  useEffect(() => {
    if (!isEditingInclusion) {
      setInclusionRecommendation(initialAnalysis.inclusionRecommendation);
      setInclusionReasoning(initialAnalysis.inclusionReasoning);
      setExclusionReasoning(initialAnalysis.exclusionReasoning);
      setConfidenceScore(initialAnalysis.confidenceScore);
      setInclusionCriteria(normalizeCriteria(initialAnalysis.inclusionCriteria));
      setExclusionCriteria(normalizeCriteria(initialAnalysis.exclusionCriteria));
      setRelevanceScore(initialAnalysis.relevanceScore || 0.5);
      setQualityNotes(initialAnalysis.qualityNotes || "");
    }
  }, [initialAnalysis, isEditingInclusion]);

  // Keep classifications in sync unless editing
  useEffect(() => {
    if (!isEditingClassifications) {
      setClassifications(initialAnalysis.classifications || []);
    }
  }, [initialAnalysis, isEditingClassifications]);

  // Keep keywords in sync unless editing keywords or classifications
  useEffect(() => {
    if (!isEditingClassifications && !isEditingKeywords) {
      setFacetKeywords(initialAnalysis.facetKeywords || []);
    }
  }, [initialAnalysis, isEditingClassifications, isEditingKeywords]);

  const inclusionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/studies/${studyId}/sources/${sourceId}/analysis/inclusion-exclusion`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inclusionRecommendation,
            inclusionReasoning,
            exclusionReasoning,
            confidenceScore,
            relevanceScore,
            qualityNotes,
            inclusionCriteria,
            exclusionCriteria,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to save inclusion/exclusion");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source", studyId, sourceId] });
      queryClient.invalidateQueries({ queryKey: ["analysis", studyId, sourceId] });
      setIsEditingInclusion(false);
      onSuccess?.();
    },
  });

  const classificationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/studies/${studyId}/sources/${sourceId}/analysis/classifications`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classifications }),
        },
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to save classifications");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source", studyId, sourceId] });
      queryClient.invalidateQueries({ queryKey: ["analysis", studyId, sourceId] });
      setIsEditingClassifications(false);
      onSuccess?.();
    },
  });

  const keywordMutation = useMutation({
    mutationFn: async () => {
      const keywordsByFacet = new Map<string, FacetKeyword[]>();
      for (const kw of facetKeywords) {
        const list = keywordsByFacet.get(kw.facetId) || [];
        list.push(kw);
        keywordsByFacet.set(kw.facetId, list);
      }

      // Include facets that had keywords before but now have none (deletions)
      const initialKeywordFacetIds = new Set(
        (initialAnalysis.facetKeywords || []).map((kw) => kw.facetId),
      );
      for (const facetId of initialKeywordFacetIds) {
        if (!keywordsByFacet.has(facetId)) {
          keywordsByFacet.set(facetId, []);
        }
      }

      for (const [facetId, keywords] of keywordsByFacet) {
        const response = await fetch(
          `/api/studies/${studyId}/sources/${sourceId}/analysis/keywords`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              facetId,
              keywords: keywords.map((kw) => ({
                keyword: kw.keyword,
                confidence: kw.confidence,
                evidence: kw.evidence,
              })),
            }),
          },
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || "Failed to save keywords");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source", studyId, sourceId] });
      queryClient.invalidateQueries({ queryKey: ["analysis", studyId, sourceId] });
      setIsEditingKeywords(false);
      onSuccess?.();
    },
  });

  const handleCancelKeywords = () => {
    setFacetKeywords(initialAnalysis.facetKeywords || []);
    setIsEditingKeywords(false);
  };

  const handleCancelInclusion = () => {
    setInclusionRecommendation(initialAnalysis.inclusionRecommendation);
    setInclusionReasoning(initialAnalysis.inclusionReasoning);
    setExclusionReasoning(initialAnalysis.exclusionReasoning);
    setConfidenceScore(initialAnalysis.confidenceScore);
    setInclusionCriteria(normalizeCriteria(initialAnalysis.inclusionCriteria));
    setExclusionCriteria(normalizeCriteria(initialAnalysis.exclusionCriteria));
    setRelevanceScore(initialAnalysis.relevanceScore || 0.5);
    setQualityNotes(initialAnalysis.qualityNotes || "");
    setIsEditingInclusion(false);
  };

  const handleCancelClassifications = () => {
    setClassifications(initialAnalysis.classifications || []);
    setFacetKeywords(initialAnalysis.facetKeywords || []);
    setIsEditingClassifications(false);
  };

  return (
    <div className="space-y-6">
      {/* Inclusion / Exclusion */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Inclusion/Exclusion Evaluation</CardTitle>
            <CardDescription>Assessment against study criteria</CardDescription>
          </div>
          {!isEditingInclusion ? (
            <Button
              onClick={() => setIsEditingInclusion(true)}
              variant="outline"
              size="sm"
              disabled={!canEditInclusion || loadingInclusion}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                onClick={() => inclusionMutation.mutate()}
                size="sm"
                disabled={inclusionMutation.isPending || loadingInclusion}
              >
                <Save className="h-4 w-4 mr-2" />
                {inclusionMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button
                onClick={handleCancelInclusion}
                variant="outline"
                size="sm"
                disabled={inclusionMutation.isPending || loadingInclusion}
              >
                <XIcon className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}
        </CardHeader>
        {isEditingInclusion ? (
          <InclusionExclusionEditor
            inclusionCriteria={inclusionCriteria}
            exclusionCriteria={exclusionCriteria}
            inclusionRecommendation={inclusionRecommendation}
            inclusionReasoning={inclusionReasoning}
            exclusionReasoning={exclusionReasoning}
            confidenceScore={confidenceScore}
            onChangeInclusionCriteria={setInclusionCriteria}
            onChangeExclusionCriteria={setExclusionCriteria}
            onChangeInclusionRecommendation={setInclusionRecommendation}
            onChangeInclusionReasoning={setInclusionReasoning}
            onChangeExclusionReasoning={setExclusionReasoning}
            onChangeConfidenceScore={setConfidenceScore}
            disabled={loadingInclusion}
            loading={loadingInclusion}
          />
        ) : (
          <InclusionExclusionView
            analysis={{
              inclusionCriteria,
              exclusionCriteria,
              inclusionRecommendation,
              inclusionReasoning,
              exclusionReasoning,
              confidenceScore,
              relevanceScore,
              qualityNotes,
              votingEnabled: initialAnalysis.votingEnabled,
              votingSummary: initialAnalysis.votingSummary,
            }}
            loading={loadingInclusion}
          />
        )}
      </Card>

      {/* Classifications */}
      {/* Classifications */}
      {showClassifications && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Classifications</CardTitle>
              <CardDescription>Source categorization by research facets</CardDescription>
            </div>
            {isEditingKeywords ? (
              <div className="flex gap-2">
                <Button
                  onClick={() => keywordMutation.mutate()}
                  size="sm"
                  disabled={keywordMutation.isPending || loadingClassifications}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {keywordMutation.isPending ? "Saving..." : "Save Keywords"}
                </Button>
                <Button
                  onClick={handleCancelKeywords}
                  variant="outline"
                  size="sm"
                  disabled={keywordMutation.isPending || loadingClassifications}
                >
                  <XIcon className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            ) : isEditingClassifications ? (
              <div className="flex gap-2">
                <Button
                  onClick={() => classificationMutation.mutate()}
                  size="sm"
                  disabled={classificationMutation.isPending || loadingClassifications}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {classificationMutation.isPending ? "Saving..." : "Save"}
                </Button>
                <Button
                  onClick={handleCancelClassifications}
                  variant="outline"
                  size="sm"
                  disabled={classificationMutation.isPending || loadingClassifications}
                >
                  <XIcon className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={() => setIsEditingKeywords(true)}
                  variant="outline"
                  size="sm"
                  disabled={!canEditClassifications || loadingClassifications}
                >
                  <Tags className="h-4 w-4 mr-2" />
                  Edit Keywords
                </Button>
                <Button
                  onClick={() => setIsEditingClassifications(true)}
                  variant="outline"
                  size="sm"
                  disabled={!canEditClassifications || loadingClassifications}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            )}
          </CardHeader>
          {isEditingClassifications ? (
            <ClassificationsEditor
              classifications={classifications}
              facets={facets}
              onChangeClassifications={setClassifications}
              disabled={loadingClassifications}
              loading={loadingClassifications}
            />
          ) : (
            <ClassificationsView
              classifications={classifications}
              facetKeywords={isEditingKeywords ? facetKeywords : initialAnalysis.facetKeywords}
              facets={facets}
              classificationBasis={initialAnalysis.classificationBasis}
              loading={loadingClassifications}
              isEditing={isEditingKeywords}
              onChangeFacetKeywords={isEditingKeywords ? setFacetKeywords : undefined}
            />
          )}
        </Card>
      )}

      {(inclusionMutation.error || classificationMutation.error || keywordMutation.error) && (
        <Card>
          <CardContent>
            <p className="text-sm text-destructive">
              {inclusionMutation.error?.message ||
                classificationMutation.error?.message ||
                keywordMutation.error?.message ||
                "Failed to save analysis"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
