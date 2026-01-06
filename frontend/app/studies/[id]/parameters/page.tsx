"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { StudyLayout } from "@/components/layout/study-layout";
import { ResearchQuestionsEditor, ResearchQuestion } from "@/components/parameters/research-questions-editor";
import { CriteriaEditor, Criterion } from "@/components/parameters/criteria-editor";
import { ClassificationSchemaEditor, Facet } from "@/components/parameters/classification-schema-editor";
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
  classificationSchema: any;
}

interface ParametersFormData {
  motivation: string;
  researchQuestions: ResearchQuestion[];
  inclusionCriteria: Criterion[];
  exclusionCriteria: Criterion[];
  classificationSchema: Facet[];
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
    return null; // No parameters yet
  }
  if (!response.ok) throw new Error("Failed to fetch parameters");
  const data = await response.json();
  return data.data;
}

async function saveResearchQuestions(studyId: string, questions: ResearchQuestion[]) {
  const response = await fetch(`/api/studies/${studyId}/research-questions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ researchQuestions: questions }),
  });
  if (!response.ok) throw new Error("Failed to save research questions");
  return response.json();
}

async function saveParameters(studyId: string, data: Omit<ParametersFormData, "researchQuestions">) {
  console.log("[saveParameters] sending to API", {
    studyId,
    schemaType: Array.isArray(data.classificationSchema) ? 'array' : typeof data.classificationSchema,
    schemaCount: Array.isArray(data.classificationSchema) ? data.classificationSchema.length : 0,
    schemaSample: Array.isArray(data.classificationSchema) && data.classificationSchema.length > 0
      ? {
        name: data.classificationSchema[0].name,
        hasCategories: !!data.classificationSchema[0].categories,
        categoriesCount: data.classificationSchema[0].categories?.length || 0,
        categoriesSample: data.classificationSchema[0].categories?.slice(0, 2),
      }
      : null,
  });

  const response = await fetch(`/api/studies/${studyId}/parameters`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inclusionCriteria: data.inclusionCriteria,
      exclusionCriteria: data.exclusionCriteria,
      classificationSchema: data.classificationSchema,
    }),
  });
  if (!response.ok) throw new Error("Failed to save parameters");
  return response.json();
}

export default function ParametersPage() {
  const params = useParams();
  const studyId = params.id as string;
  const queryClient = useQueryClient();
  const router = useRouter();

  const [researchQuestions, setResearchQuestions] = useState<ResearchQuestion[]>([]);
  const [inclusionCriteria, setInclusionCriteria] = useState<Criterion[]>([]);
  const [exclusionCriteria, setExclusionCriteria] = useState<Criterion[]>([]);
  const [classificationSchema, setClassificationSchema] = useState<Facet[]>([]);
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

  // Initialize form state when data is loaded
  if (study && !isInitialized && !parametersLoading) {
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

    let schema: Facet[] = [];
    if (parameters) {
      // Parse classification schema and migrate legacy facets
      if (Array.isArray(parameters.classificationSchema)) {
        schema = parameters.classificationSchema.map((facet: any) => ({
          ...facet,
          type: facet.type || "closed", // Default to closed for backward compatibility
        }));
      } else if (parameters.classificationSchema && typeof parameters.classificationSchema === 'object') {
        // Convert old format to new if needed
        schema = [];
      }
    }

    setMotivation(mot);
    setResearchQuestions(rqs);
    setInclusionCriteria(inc);
    setExclusionCriteria(exc);
    setClassificationSchema(schema);

    // Store initial state for comparison
    setInitialState({
      motivation: mot,
      researchQuestions: rqs,
      inclusionCriteria: inc,
      exclusionCriteria: exc,
      classificationSchema: schema,
    });

    setIsInitialized(true);
  }

  // Check for unsaved changes
  useEffect(() => {
    if (!initialState) return;

    const currentState = {
      motivation,
      researchQuestions,
      inclusionCriteria,
      exclusionCriteria,
      classificationSchema,
    };

    const hasChanges = JSON.stringify(currentState) !== JSON.stringify(initialState);
    setHasUnsavedChanges(hasChanges);
  }, [motivation, researchQuestions, inclusionCriteria, exclusionCriteria, classificationSchema, initialState]);

  // Warn before leaving page with unsaved changes (browser-level)
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

  // Intercept navigation attempts (client-side)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!hasUnsavedChanges) return;

      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (link && link.href && !link.href.includes('#')) {
        // Check if it's an internal navigation
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
      // Save motivation to study
      const motivationResponse = await fetch(`/api/studies/${studyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivation: data.motivation }),
      });
      if (!motivationResponse.ok) {
        throw new Error("Failed to save motivation");
      }

      // Save research questions and get the saved questions with real IDs
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

      // Fetch the updated study to get the new RQ IDs
      const studyResponse = await fetch(`/api/studies/${studyId}`);
      const studyData = await studyResponse.json();
      const savedResearchQuestions = studyData.data.researchQuestions;

      // Create a mapping from old temp IDs to new real IDs
      const idMapping: Record<string, string> = {};
      data.researchQuestions.forEach((oldRQ, index) => {
        const oldId = oldRQ.id || `temp-${oldRQ.order}`;
        const newRQ = savedResearchQuestions.find((rq: any) => rq.order === index);
        if (newRQ) {
          idMapping[oldId] = newRQ.id;
        }
      });

      // Update classification schema with real RQ IDs
      const updatedSchema = data.classificationSchema.map((facet: any) => {
        if (facet.researchQuestionId && idMapping[facet.researchQuestionId]) {
          return {
            ...facet,
            researchQuestionId: idMapping[facet.researchQuestionId],
          };
        }
        return facet;
      });

      // Save parameters with updated classification schema
      await saveParameters(studyId, {
        motivation: data.motivation,
        inclusionCriteria: data.inclusionCriteria,
        exclusionCriteria: data.exclusionCriteria,
        classificationSchema: updatedSchema,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["study", studyId] });
      queryClient.invalidateQueries({ queryKey: ["parameters", studyId] });

      // Update initial state after successful save
      setInitialState(variables);
      setHasUnsavedChanges(false);
    },
  });

  const handleSave = () => {
    // Filter out empty questions and criteria
    const validQuestions = researchQuestions.filter(rq => rq.question.trim() !== "");
    const validInclusion = inclusionCriteria.filter(ic => ic.criterion.trim() !== "");
    const validExclusion = exclusionCriteria.filter(ec => ec.criterion.trim() !== "");

    saveMutation.mutate({
      motivation,
      researchQuestions: validQuestions,
      inclusionCriteria: validInclusion,
      exclusionCriteria: validExclusion,
      classificationSchema: classificationSchema,
    });
  };

  if (studyLoading || parametersLoading) {
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
                value={classificationSchema}
                onChange={setClassificationSchema}
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
