"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, X as XIcon, Edit, Loader2 } from "lucide-react";
import { InclusionExclusionView } from "./inclusion-exclusion-view";
import { InclusionExclusionEditor } from "./inclusion-exclusion-editor";
import { ClassificationsView } from "./classifications-view";
import { ClassificationsEditor } from "./classifications-editor";
import { AnalysisData, Classification, CriterionEval, Facet } from "./types";

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

  const [inclusionRecommendation, setInclusionRecommendation] = useState(
    initialAnalysis.inclusionRecommendation
  );
  const [inclusionReasoning, setInclusionReasoning] = useState(initialAnalysis.inclusionReasoning);
  const [exclusionReasoning, setExclusionReasoning] = useState(initialAnalysis.exclusionReasoning);
  const [confidenceScore, setConfidenceScore] = useState(initialAnalysis.confidenceScore);
  const [inclusionCriteria, setInclusionCriteria] = useState<CriterionEval[]>(
    normalizeCriteria(initialAnalysis.inclusionCriteria)
  );
  const [exclusionCriteria, setExclusionCriteria] = useState<CriterionEval[]>(
    normalizeCriteria(initialAnalysis.exclusionCriteria)
  );
  const [classifications, setClassifications] = useState<Classification[]>(
    initialAnalysis.classifications || []
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

  // Keep classifications in sync unless the user is actively editing that section
  useEffect(() => {
    if (!isEditingClassifications) {
      setClassifications(initialAnalysis.classifications || []);
    }
  }, [initialAnalysis, isEditingClassifications]);

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
        }
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
          body: JSON.stringify({
            classifications,
          }),
        }
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
            {!isEditingClassifications ? (
              <Button
                onClick={() => setIsEditingClassifications(true)}
                variant="outline"
                size="sm"
                disabled={!canEditClassifications || loadingClassifications || !showClassifications}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
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
            <ClassificationsView classifications={classifications} loading={loadingClassifications} />
          )}
        </Card>
      )}

      {(inclusionMutation.error || classificationMutation.error) && (
        <Card>
          <CardContent>
            <p className="text-sm text-destructive">
              {inclusionMutation.error?.message ||
                classificationMutation.error?.message ||
                "Failed to save analysis"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}




