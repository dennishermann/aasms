"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { StudyLayout } from "@/components/layout/study-layout";
import { ResearchQuestionsEditor, ResearchQuestion } from "@/components/parameters/research-questions-editor";
import { CriteriaEditor, Criterion } from "@/components/parameters/criteria-editor";
import { ClassificationSchemaEditor, Facet, FacetCategory } from "@/components/parameters/classification-schema-editor";
import { CodingWizard } from "@/components/facets";
import { UnsavedChangesDialog } from "@/components/parameters/unsaved-changes-dialog";
import { AlertCircle, Save, FileText, HelpCircle, Filter, Tags, CheckCircle2 } from "lucide-react";
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
  type: "CLOSED" | "OPEN" | "OPEN_CODED";
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

// Tab configuration with colors
const TAB_CONFIG = {
  overview: {
    icon: FileText,
    label: "Overview",
    color: "bg-blue-500",
    lightColor: "bg-blue-100 text-blue-700",
  },
  "research-questions": {
    icon: HelpCircle,
    label: "Research Questions",
    color: "bg-purple-500",
    lightColor: "bg-purple-100 text-purple-700",
  },
  criteria: {
    icon: Filter,
    label: "Criteria",
    color: "bg-amber-500",
    lightColor: "bg-amber-100 text-amber-700",
  },
  classification: {
    icon: Tags,
    label: "Classification",
    color: "bg-emerald-500",
    lightColor: "bg-emerald-100 text-emerald-700",
  },
} as const;

type TabKey = keyof typeof TAB_CONFIG;

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
  const [initialState, setInitialState] = useState<ParametersFormData | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [codingWizardOpen, setCodingWizardOpen] = useState(false);
  const [codingFacet, setCodingFacet] = useState<Facet | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [saveSuccess, setSaveSuccess] = useState<TabKey | null>(null);

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

  // Check for unsaved changes per tab
  const tabChanges = useMemo(() => {
    if (!initialState) return { overview: false, "research-questions": false, criteria: false, classification: false };

    return {
      overview: motivation !== initialState.motivation,
      "research-questions": JSON.stringify(researchQuestions) !== JSON.stringify(initialState.researchQuestions),
      criteria: JSON.stringify(inclusionCriteria) !== JSON.stringify(initialState.inclusionCriteria) ||
        JSON.stringify(exclusionCriteria) !== JSON.stringify(initialState.exclusionCriteria),
      classification: JSON.stringify(facets) !== JSON.stringify(initialState.facets),
    };
  }, [motivation, researchQuestions, inclusionCriteria, exclusionCriteria, facets, initialState]);

  const hasUnsavedChanges = Object.values(tabChanges).some(Boolean);

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

    if (pendingNavigation) {
      window.location.href = pendingNavigation;
    }
  };

  const handleCancelLeave = () => {
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
  };

  // Save mutations for each tab
  const saveOverviewMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/studies/${studyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivation }),
      });
      if (!response.ok) throw new Error("Failed to save motivation");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study", studyId] });
      if (initialState) {
        setInitialState({ ...initialState, motivation });
      }
      setSaveSuccess("overview");
      setTimeout(() => setSaveSuccess(null), 2000);
    },
  });

  const saveResearchQuestionsMutation = useMutation({
    mutationFn: async () => {
      const validQuestions = researchQuestions.filter(rq => rq.question.trim() !== "");
      const response = await fetch(`/api/studies/${studyId}/research-questions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          researchQuestions: validQuestions.map((rq, index) => ({
            question: rq.question,
            order: index,
          }))
        }),
      });
      if (!response.ok) throw new Error("Failed to save research questions");

      // Fetch updated study to get new RQ IDs
      const studyResponse = await fetch(`/api/studies/${studyId}`);
      const studyData = await studyResponse.json();
      return studyData.data.researchQuestions;
    },
    onSuccess: (savedRQs) => {
      queryClient.invalidateQueries({ queryKey: ["study", studyId] });
      const updatedRQs = savedRQs.map((rq: any) => ({
        id: rq.id,
        question: rq.question,
        order: rq.order,
      }));
      setResearchQuestions(updatedRQs);
      if (initialState) {
        setInitialState({ ...initialState, researchQuestions: updatedRQs });
      }
      setSaveSuccess("research-questions");
      setTimeout(() => setSaveSuccess(null), 2000);
    },
  });

  const saveCriteriaMutation = useMutation({
    mutationFn: async () => {
      const validInclusion = inclusionCriteria.filter(ic => ic.criterion.trim() !== "");
      const validExclusion = exclusionCriteria.filter(ec => ec.criterion.trim() !== "");

      const response = await fetch(`/api/studies/${studyId}/parameters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inclusionCriteria: validInclusion,
          exclusionCriteria: validExclusion,
        }),
      });
      if (!response.ok) throw new Error("Failed to save criteria");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parameters", studyId] });
      if (initialState) {
        setInitialState({ ...initialState, inclusionCriteria, exclusionCriteria });
      }
      setSaveSuccess("criteria");
      setTimeout(() => setSaveSuccess(null), 2000);
    },
  });

  const saveClassificationMutation = useMutation({
    mutationFn: async () => {
      const validFacets = facets.filter(f => f.name.trim() !== "");

      // Get RQ ID mapping
      const rqIdMapping: Record<string, string> = {};
      researchQuestions.forEach((rq) => {
        if (rq.id) {
          rqIdMapping[rq.id] = rq.id;
          rqIdMapping[`temp-${rq.order}`] = rq.id;
        }
      });

      // Get existing facets
      const existingFacetsResponse = await fetch(`/api/studies/${studyId}/facets`);
      const existingFacetsData = await existingFacetsResponse.json();
      const existingFacets: ApiFacet[] = existingFacetsData.data || [];
      const existingFacetIds = new Set(existingFacets.map(f => f.id));

      // Process each facet
      for (let i = 0; i < validFacets.length; i++) {
        const facet = validFacets[i];
        const mappedRqIds = facet.researchQuestionIds.map(id => rqIdMapping[id] || id);
        const categories = facet.categories.map((cat, idx) => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          order: idx,
        }));

        if (facet.id && existingFacetIds.has(facet.id)) {
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
      const currentFacetIds = new Set(validFacets.filter(f => f.id).map(f => f.id));
      for (const existingFacet of existingFacets) {
        if (!currentFacetIds.has(existingFacet.id)) {
          await fetch(`/api/studies/${studyId}/facets/${existingFacet.id}`, {
            method: "DELETE",
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facets", studyId] });
      setIsInitialized(false); // Refetch to get updated facet IDs
      setSaveSuccess("classification");
      setTimeout(() => setSaveSuccess(null), 2000);
    },
  });

  const handleSaveTab = (tab: TabKey) => {
    switch (tab) {
      case "overview":
        saveOverviewMutation.mutate();
        break;
      case "research-questions":
        saveResearchQuestionsMutation.mutate();
        break;
      case "criteria":
        saveCriteriaMutation.mutate();
        break;
      case "classification":
        saveClassificationMutation.mutate();
        break;
    }
  };

  const isSaving = (tab: TabKey) => {
    switch (tab) {
      case "overview":
        return saveOverviewMutation.isPending;
      case "research-questions":
        return saveResearchQuestionsMutation.isPending;
      case "criteria":
        return saveCriteriaMutation.isPending;
      case "classification":
        return saveClassificationMutation.isPending;
    }
  };

  const hasError = (tab: TabKey) => {
    switch (tab) {
      case "overview":
        return saveOverviewMutation.isError;
      case "research-questions":
        return saveResearchQuestionsMutation.isError;
      case "criteria":
        return saveCriteriaMutation.isError;
      case "classification":
        return saveClassificationMutation.isError;
    }
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

  // Tab content indicators
  const tabHasContent = {
    overview: motivation.trim().length > 0,
    "research-questions": researchQuestions.some(rq => rq.question.trim().length > 0),
    criteria: inclusionCriteria.some(c => c.criterion.trim().length > 0) ||
      exclusionCriteria.some(c => c.criterion.trim().length > 0),
    classification: facets.some(f => f.name.trim().length > 0),
  };

  // Save button component for each tab
  const SaveButton = ({ tab }: { tab: TabKey }) => {
    const config = TAB_CONFIG[tab];
    const hasChanges = tabChanges[tab];
    const saving = isSaving(tab);
    const success = saveSuccess === tab;

    return (
      <div className="flex items-center gap-3">
        {hasChanges && !saving && !success && (
          <span className="text-sm text-amber-600 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Unsaved changes
          </span>
        )}
        {success && (
          <span className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Saved!
          </span>
        )}
        <Button
          onClick={() => handleSaveTab(tab)}
          disabled={saving || !hasChanges}
          size="default"
          className={hasChanges ? config.color : ""}
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : `Save ${config.label}`}
        </Button>
      </div>
    );
  };

  return (
    <StudyLayout
      studyId={studyId}
      studyTitle={study.title}
      studyStatus={study.status}
    >
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Study Parameters</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure your systematic mapping study settings
          </p>
        </div>

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="w-full">
          <TabsList className="mb-6 h-11">
            {(Object.entries(TAB_CONFIG) as [TabKey, typeof TAB_CONFIG[TabKey]][]).map(([key, config]) => {
              const Icon = config.icon;
              const hasContent = tabHasContent[key];
              const hasChanges = tabChanges[key];

              return (
                <TabsTrigger key={key} value={key} className="gap-2 px-4 relative">
                  <span className={`absolute left-1 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full ${config.color} opacity-50`} />
                  <Icon className="h-4 w-4 ml-1" />
                  {config.label}
                  {hasChanges ? (
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  ) : hasContent ? (
                    <span className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-0">
            <Card className="max-w-4xl border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                      Overview
                    </span>
                    Study Motivation
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Explain the motivation and rationale behind this systematic mapping study.
                    Use Markdown for formatting.
                  </CardDescription>
                </div>
                <SaveButton tab="overview" />
              </CardHeader>
              <CardContent>
                <MarkdownEditor
                  value={motivation}
                  onChange={setMotivation}
                  placeholder="## Why is this study important?

Describe the problem being addressed, the expected impact, and why a systematic mapping study is the right approach.

### Background
- What gap in knowledge does this address?
- Who will benefit from this study?

### Expected Outcomes
- What types of insights do you expect to uncover?"
                  rows={12}
                />
              </CardContent>
            </Card>

            {hasError("overview") && (
              <Alert variant="destructive" className="mt-4 max-w-4xl">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Failed to save motivation. Please try again.</AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Research Questions Tab */}
          <TabsContent value="research-questions" className="mt-0">
            <Card className="max-w-4xl border-l-4 border-l-purple-500">
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                      Research
                    </span>
                    Research Questions
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Define the research questions that guide your systematic mapping study
                  </CardDescription>
                </div>
                <SaveButton tab="research-questions" />
              </CardHeader>
              <CardContent>
                <ResearchQuestionsEditor
                  value={researchQuestions}
                  onChange={setResearchQuestions}
                />
              </CardContent>
            </Card>

            {hasError("research-questions") && (
              <Alert variant="destructive" className="mt-4 max-w-4xl">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Failed to save research questions. Please try again.</AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Criteria Tab */}
          <TabsContent value="criteria" className="mt-0">
            <div className="flex justify-end mb-4 max-w-6xl">
              <SaveButton tab="criteria" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">
              <Card className="border-l-4 border-l-green-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                      Include
                    </span>
                    Inclusion Criteria
                  </CardTitle>
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

              <Card className="border-l-4 border-l-red-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                      Exclude
                    </span>
                    Exclusion Criteria
                  </CardTitle>
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
            </div>

            {hasError("criteria") && (
              <Alert variant="destructive" className="mt-4 max-w-6xl">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Failed to save criteria. Please try again.</AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Classification Tab */}
          <TabsContent value="classification" className="mt-0">
            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                      Schema
                    </span>
                    Classification Schema
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Define facets and categories for organizing and classifying sources
                  </CardDescription>
                </div>
                <SaveButton tab="classification" />
              </CardHeader>
              <CardContent>
                <ClassificationSchemaEditor
                  value={facets}
                  onChange={setFacets}
                  researchQuestions={researchQuestions.map(rq => ({
                    id: rq.id || `temp-${rq.order}`,
                    question: rq.question,
                  }))}
                  studyId={studyId}
                  onOpenCodingWizard={(facet) => {
                    setCodingFacet(facet);
                    setCodingWizardOpen(true);
                  }}
                />
              </CardContent>
            </Card>

            {hasError("classification") && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Failed to save classification schema. Please try again.</AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>

        {/* Unsaved Changes Dialog */}
        <UnsavedChangesDialog
          open={showUnsavedDialog}
          onCancel={handleCancelLeave}
          onConfirm={handleConfirmLeave}
        />

        {/* Coding Wizard Modal */}
        {codingFacet && codingFacet.id && (
          <CodingWizard
            open={codingWizardOpen}
            onOpenChange={setCodingWizardOpen}
            studyId={studyId}
            facetId={codingFacet.id}
            facetName={codingFacet.name}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["facets", studyId] });
              setIsInitialized(false);
              setCodingFacet(null);
            }}
          />
        )}
      </div>
    </StudyLayout>
  );
}
