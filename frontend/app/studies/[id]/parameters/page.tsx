"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { StudyLayout } from "@/components/layout/study-layout";
import { ResearchQuestionsEditor, ResearchQuestion } from "@/components/parameters/research-questions-editor";
import { CriteriaEditor, Criterion } from "@/components/parameters/criteria-editor";
import { ClassificationSchemaEditor, Facet, FacetCategory } from "@/components/parameters/classification-schema-editor";
import { UnsavedChangesDialog } from "@/components/parameters/unsaved-changes-dialog";
import { AlertCircle, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Study {
  id: string;
  title: string;
  status: string;
  motivation: string | null;
  researchQuestions: Array<{
    id: string;
    question: string;
    order: number;
  }>;
}

interface Parameters {
  inclusionCriteria: Array<{
    criterion: string;
    order: number;
  }>;
  exclusionCriteria: Array<{
    criterion: string;
    order: number;
  }>;
}

interface ApiFacet {
  id: string;
  name: string;
  description: string | null;
  type: "CLOSED" | "OPEN";
  required: boolean;
  order: number;
  categories: Array<{
    id: string;
    name: string;
    description: string | null;
    order: number;
  }>;
  researchQuestionIds: string[];
}

interface ParametersFormData {
  motivation: string;
  researchQuestions: ResearchQuestion[];
  inclusionCriteria: Criterion[];
  exclusionCriteria: Criterion[];
  facets: Facet[];
}

async function fetchStudy(id: string): Promise<Study> {
  const response = await fetch(`/api/studies/${id}`);
  if (!response.ok) throw new Error("Failed to fetch study");
  const data = await response.json();
  return data.data;
}

async function fetchParameters(studyId: string): Promise<Parameters | null> {
  const response = await fetch(`/api/studies/${studyId}/parameters`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) throw new Error("Failed to fetch parameters");
  const data = await response.json();
  return data.data;
}

async function fetchFacets(studyId: string): Promise<ApiFacet[]> {
  const response = await fetch(`/api/studies/${studyId}/facets`);
  if (!response.ok) throw new Error("Failed to fetch facets");
  const data = await response.json();
  return data.data || [];
}

export default function ParametersPage() {
  const params = useParams();
  const studyId = params.id as string;
  const queryClient = useQueryClient();
  const router = useRouter();

  const [researchQuestions, setResearchQuestions] = useState<ResearchQuestion[]>([]);
  const [inclusionCriteria, setInclusionCriteria] = useState<Criterion[]>([]);
  const [exclusionCriteria, setExclusionCriteria] = useState<Criterion[]>([]);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [motivation, setMotivation] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialState, setInitialState] = useState<ParametersFormData | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  const { data: study, isLoading: studyLoading, error: studyError } = useQuery({
    queryKey: ["study", studyId],
    queryFn: () => fetchStudy(studyId),
  });

  const { data: parameters, isLoading: parametersLoading } = useQuery({
    queryKey: ["parameters", studyId],
    queryFn: () => fetchParameters(studyId),
    enabled: !!study,
  });

  const { data: apiFacets, isLoading: facetsLoading } = useQuery({
    queryKey: ["facets", studyId],
    queryFn: () => fetchFacets(studyId),
    enabled: !!study,
  });

  // Convert API facets to editor format
  const convertApiFacetToEditorFacet = (apiFacet: ApiFacet): Facet => ({
    id: apiFacet.id,
    name: apiFacet.name,
    description: apiFacet.description || undefined,
    type: apiFacet.type,
    required: apiFacet.required,
    categories: apiFacet.categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description || undefined,
    })),
    researchQuestionIds: apiFacet.researchQuestionIds,
  });

  // Initialize form state when data is loaded
  useEffect(() => {
    if (study && !isInitialized && !parametersLoading && !facetsLoading) {
      const mot = study.motivation || "";

      const rqs = study.researchQuestions.map(rq => ({
        id: rq.id,
        question: rq.question,
        order: rq.order,
      }));

      const inc = parameters ? parameters.inclusionCriteria.map(ic => ({
        criterion: ic.criterion,
        order: ic.order,
      })) : [];

      const exc = parameters ? parameters.exclusionCriteria.map(ec => ({
        criterion: ec.criterion,
        order: ec.order,
      })) : [];

      const editorFacets = (apiFacets || []).map(convertApiFacetToEditorFacet);

      setMotivation(mot);
      setResearchQuestions(rqs);
      setInclusionCriteria(inc);
      setExclusionCriteria(exc);
      setFacets(editorFacets);

      setInitialState({
        motivation: mot,
        researchQuestions: rqs,
        inclusionCriteria: inc,
        exclusionCriteria: exc,
        facets: editorFacets,
      });

      setIsInitialized(true);
    }
  }, [study, parameters, apiFacets, isInitialized, parametersLoading, facetsLoading]);

  // Check for unsaved changes
  useEffect(() => {
    if (!initialState) return;

    const currentState = {
      motivation,
      researchQuestions,
      inclusionCriteria,
      exclusionCriteria,
      facets,
    };

    const hasChanges = JSON.stringify(currentState) !== JSON.stringify(initialState);
    setHasUnsavedChanges(hasChanges);
  }, [motivation, researchQuestions, inclusionCriteria, exclusionCriteria, facets, initialState]);

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Intercept navigation attempts
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!hasUnsavedChanges) return;

      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (link && link.href && !link.href.includes('#')) {
        const currentOrigin = window.location.origin;
        const linkUrl = new URL(link.href, currentOrigin);

        if (linkUrl.origin === currentOrigin && linkUrl.pathname !== window.location.pathname) {
          e.preventDefault();
          e.stopPropagation();
          setPendingNavigation(link.href);
          setShowUnsavedDialog(true);
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [hasUnsavedChanges]);

  const handleConfirmLeave = () => {
    setShowUnsavedDialog(false);
    setHasUnsavedChanges(false);

    if (pendingNavigation) {
      window.location.href = pendingNavigation;
    }
  };

  const handleCancelLeave = () => {
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: ParametersFormData) => {
      // 1. Save motivation to study
      const motivationResponse = await fetch(`/api/studies/${studyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivation: data.motivation }),
      });
      if (!motivationResponse.ok) {
        throw new Error("Failed to save motivation");
      }

      // 2. Save research questions and get real IDs
      const savedRQsResponse = await fetch(`/api/studies/${studyId}/research-questions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          researchQuestions: data.researchQuestions.map((rq, index) => ({
            question: rq.question,
            order: index,
          }))
        }),
      });

      if (!savedRQsResponse.ok) {
        throw new Error("Failed to save research questions");
      }

      // Fetch updated study to get new RQ IDs
      const studyResponse = await fetch(`/api/studies/${studyId}`);
      const studyData = await studyResponse.json();
      const savedResearchQuestions = studyData.data.researchQuestions;

      // Create ID mapping for RQs
      const rqIdMapping: Record<string, string> = {};
      data.researchQuestions.forEach((oldRQ, index) => {
        const oldId = oldRQ.id || `temp-${oldRQ.order}`;
        const newRQ = savedResearchQuestions.find((rq: any) => rq.order === index);
        if (newRQ) {
          rqIdMapping[oldId] = newRQ.id;
        }
      });

      // 3. Save parameters (criteria only, no more classificationSchema)
      const parametersResponse = await fetch(`/api/studies/${studyId}/parameters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inclusionCriteria: data.inclusionCriteria,
          exclusionCriteria: data.exclusionCriteria,
        }),
      });
      if (!parametersResponse.ok) {
        throw new Error("Failed to save parameters");
      }

      // 4. Save facets via new API
      // First, get existing facets to determine what to create/update/delete
      const existingFacetsResponse = await fetch(`/api/studies/${studyId}/facets`);
      const existingFacetsData = await existingFacetsResponse.json();
      const existingFacets: ApiFacet[] = existingFacetsData.data || [];
      const existingFacetIds = new Set(existingFacets.map(f => f.id));

      // Process each facet
      for (let i = 0; i < data.facets.length; i++) {
        const facet = data.facets[i];

        // Map RQ IDs to real IDs
        const mappedRqIds = facet.researchQuestionIds.map(id => rqIdMapping[id] || id);

        // Prepare categories
        const categories = facet.categories.map((cat, idx) => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          order: idx,
        }));

        if (facet.id && existingFacetIds.has(facet.id)) {
          // Update existing facet
          await fetch(`/api/studies/${studyId}/facets/${facet.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: facet.name,
              description: facet.description,
              type: facet.type,
              required: facet.required,
              order: i,
              researchQuestionIds: mappedRqIds,
              categories: categories,
            }),
          });
        } else {
          // Create new facet
          await fetch(`/api/studies/${studyId}/facets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: facet.name,
              description: facet.description,
              type: facet.type,
              required: facet.required,
              researchQuestionIds: mappedRqIds,
              categories: categories.map(c => ({ name: c.name, description: c.description })),
            }),
          });
        }
      }

      // Delete removed facets
      const currentFacetIds = new Set(data.facets.filter(f => f.id).map(f => f.id));
      for (const existingFacet of existingFacets) {
        if (!currentFacetIds.has(existingFacet.id)) {
          await fetch(`/api/studies/${studyId}/facets/${existingFacet.id}`, {
            method: "DELETE",
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study", studyId] });
      queryClient.invalidateQueries({ queryKey: ["parameters", studyId] });
      queryClient.invalidateQueries({ queryKey: ["facets", studyId] });

      // Reset initialization to refetch clean data
      setIsInitialized(false);
      setHasUnsavedChanges(false);
    },
  });

  const handleSave = () => {
    const validQuestions = researchQuestions.filter(rq => rq.question.trim() !== "");
    const validInclusion = inclusionCriteria.filter(ic => ic.criterion.trim() !== "");
    const validExclusion = exclusionCriteria.filter(ec => ec.criterion.trim() !== "");
    const validFacets = facets.filter(f => f.name.trim() !== "");

    saveMutation.mutate({
      motivation,
      researchQuestions: validQuestions,
      inclusionCriteria: validInclusion,
      exclusionCriteria: validExclusion,
      facets: validFacets,
    });
  };

  if (studyLoading || parametersLoading || facetsLoading) {
    return (
      <StudyLayout studyId={studyId} studyTitle="Loading...">
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading study parameters...</p>
        </div>
      </StudyLayout>
    );
  }

  if (studyError || !study) {
    return (
      <StudyLayout>
        <div className="container mx-auto px-4 py-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Study not found</h2>
          <Button asChild>
            <Link href="/studies">Back to Studies</Link>
          </Button>
        </div>
      </StudyLayout>
    );
  }

  return (
    <StudyLayout
      studyId={studyId}
      studyTitle={study.title}
      studyStatus={study.status}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Motivation */}
          <Card>
            <CardHeader>
              <CardTitle>Study Motivation</CardTitle>
              <CardDescription>
                Explain the motivation and rationale behind this systematic mapping study
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                placeholder="Why is this study important? What problem does it address? What is the expected impact?"
                rows={6}
                className="resize-none"
              />
            </CardContent>
          </Card>

          {/* Research Questions */}
          <Card>
            <CardHeader>
              <CardTitle>Research Questions</CardTitle>
              <CardDescription>
                Define the research questions that guide your systematic mapping study
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResearchQuestionsEditor
                value={researchQuestions}
                onChange={setResearchQuestions}
              />
            </CardContent>
          </Card>

          {/* Inclusion Criteria */}
          <Card>
            <CardHeader>
              <CardTitle>Inclusion Criteria</CardTitle>
              <CardDescription>
                Define criteria for including sources in the study
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CriteriaEditor
                type="inclusion"
                value={inclusionCriteria}
                onChange={setInclusionCriteria}
              />
            </CardContent>
          </Card>

          {/* Exclusion Criteria */}
          <Card>
            <CardHeader>
              <CardTitle>Exclusion Criteria</CardTitle>
              <CardDescription>
                Define criteria for excluding sources from the study
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CriteriaEditor
                type="exclusion"
                value={exclusionCriteria}
                onChange={setExclusionCriteria}
              />
            </CardContent>
          </Card>

          {/* Classification Schema */}
          <Card>
            <CardHeader>
              <CardTitle>Classification Schema</CardTitle>
              <CardDescription>
                Define facets and categories for organizing and classifying sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClassificationSchemaEditor
                value={facets}
                onChange={setFacets}
                researchQuestions={researchQuestions.map(rq => ({
                  id: rq.id || `temp-${rq.order}`,
                  question: rq.question,
                }))}
              />
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                size="lg"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? "Saving..." : "Save All Parameters"}
              </Button>
              {hasUnsavedChanges && !saveMutation.isPending && (
                <span className="text-sm text-amber-600 font-medium">
                  You have unsaved changes
                </span>
              )}
            </div>
          </div>

          {/* Success/Error Messages */}
          {saveMutation.isSuccess && (
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">
                Parameters saved successfully!
              </AlertDescription>
            </Alert>
          )}

          {saveMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to save parameters. Please try again.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Unsaved Changes Dialog */}
        <UnsavedChangesDialog
          open={showUnsavedDialog}
          onCancel={handleCancelLeave}
          onConfirm={handleConfirmLeave}
        />
      </div>
    </StudyLayout>
  );
}
