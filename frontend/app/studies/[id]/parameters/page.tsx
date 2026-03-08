"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudyLayout } from "@/components/layout/study-layout";
import { ResearchQuestion } from "@/components/parameters/research-questions-editor";
import { Criterion } from "@/components/parameters/criteria-editor";
import { Facet } from "@/components/parameters/classification-schema-editor";
import { CodingWizard } from "@/components/facets";
import { UnsavedChangesDialog } from "@/components/parameters/unsaved-changes-dialog";
import { useParametersData } from "@/hooks/use-parameters-data";
import { useParametersMutations } from "@/hooks/use-parameters-mutations";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import {
  TAB_CONFIG,
  TabKey,
  OverviewTab,
  ResearchQuestionsTab,
  CriteriaTab,
  SearchProtocolTab,
  ClassificationTab,
  RecipesTab,
} from "@/components/parameters/tabs";

export default function ParametersPage() {
  const params = useParams();
  const studyId = params.id as string;
  const queryClient = useQueryClient();

  // Form state
  const [researchQuestions, setResearchQuestions] = useState<ResearchQuestion[]>([]);
  const [inclusionCriteria, setInclusionCriteria] = useState<Criterion[]>([]);
  const [exclusionCriteria, setExclusionCriteria] = useState<Criterion[]>([]);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [motivation, setMotivation] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [initialState, setInitialState] = useState<{
    motivation: string;
    researchQuestions: ResearchQuestion[];
    inclusionCriteria: Criterion[];
    exclusionCriteria: Criterion[];
    facets: Facet[];
  } | null>(null);

  // UI state
  const [codingWizardOpen, setCodingWizardOpen] = useState(false);
  const [codingFacet, setCodingFacet] = useState<Facet | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [saveSuccess, setSaveSuccess] = useState<TabKey | null>(null);

  // Data fetching
  const { study, apiFacets, apiRecipes, isLoading, studyError, initialFormData, facetsFetching } =
    useParametersData(studyId);

  // Initialize form state when data is loaded
  useEffect(() => {
    if (initialFormData && !isInitialized && !facetsFetching) {
      setMotivation(initialFormData.motivation);
      setResearchQuestions(initialFormData.researchQuestions);
      setInclusionCriteria(initialFormData.inclusionCriteria);
      setExclusionCriteria(initialFormData.exclusionCriteria);
      setFacets(initialFormData.facets);
      setInitialState(initialFormData);
      setIsInitialized(true);
    }
  }, [initialFormData, isInitialized, facetsFetching]);

  // Unsaved changes tracking
  const { tabChanges, showUnsavedDialog, handleConfirmLeave, handleCancelLeave } =
    useUnsavedChanges({
      currentData: {
        motivation,
        researchQuestions,
        inclusionCriteria,
        exclusionCriteria,
        facets,
      },
      initialData: initialState,
    });

  // Save mutations
  const { handleSaveTab, isSaving, hasError } = useParametersMutations({
    studyId,
    motivation,
    researchQuestions,
    inclusionCriteria,
    exclusionCriteria,
    facets,
    onMotivationSaved: (mot) => {
      if (initialState) {
        setInitialState({ ...initialState, motivation: mot });
      }
    },
    onResearchQuestionsSaved: (rqs) => {
      setResearchQuestions(rqs);
      if (initialState) {
        setInitialState({ ...initialState, researchQuestions: rqs });
      }
    },
    onCriteriaSaved: (inc, exc) => {
      if (initialState) {
        setInitialState({ ...initialState, inclusionCriteria: inc, exclusionCriteria: exc });
      }
    },
    onFacetsSaved: () => {
      setIsInitialized(false); // Refetch to get updated facet IDs
    },
    onSaveSuccess: (tab) => {
      setSaveSuccess(tab);
      setTimeout(() => setSaveSuccess(null), 2000);
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <StudyLayout studyId={studyId} studyTitle="Loading...">
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading study parameters...</p>
        </div>
      </StudyLayout>
    );
  }

  // Error state
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
    "research-questions": researchQuestions.some((rq) => rq.question.trim().length > 0),
    criteria:
      inclusionCriteria.some((c) => c.criterion.trim().length > 0) ||
      exclusionCriteria.some((c) => c.criterion.trim().length > 0),
    "search-protocol": true, // Content is fetched dynamically by component
    classification: facets.some((f) => f.name.trim().length > 0),
    recipes: (apiRecipes?.length ?? 0) > 0,
  };

  return (
    <StudyLayout studyId={studyId} studyTitle={study.title} studyStatus={study.status}>
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
            {(Object.entries(TAB_CONFIG) as [TabKey, (typeof TAB_CONFIG)[TabKey]][]).map(
              ([key, config]) => {
                const Icon = config.icon;
                const hasContent = tabHasContent[key];
                const hasChanges = tabChanges[key];

                return (
                  <TabsTrigger key={key} value={key} className="gap-2 px-4 relative">
                    <span
                      className={`absolute left-1 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full ${config.color} opacity-50`}
                    />
                    <Icon className="h-4 w-4 ml-1" />
                    {config.label}
                    {hasChanges ? (
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                    ) : hasContent ? (
                      <span className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
                    ) : null}
                  </TabsTrigger>
                );
              },
            )}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-0">
            <OverviewTab
              motivation={motivation}
              onMotivationChange={setMotivation}
              hasChanges={tabChanges.overview}
              isSaving={isSaving("overview")}
              showSuccess={saveSuccess === "overview"}
              hasError={hasError("overview")}
              onSave={() => handleSaveTab("overview")}
            />
          </TabsContent>

          {/* Research Questions Tab */}
          <TabsContent value="research-questions" className="mt-0">
            <ResearchQuestionsTab
              researchQuestions={researchQuestions}
              onResearchQuestionsChange={setResearchQuestions}
              hasChanges={tabChanges["research-questions"]}
              isSaving={isSaving("research-questions")}
              showSuccess={saveSuccess === "research-questions"}
              hasError={hasError("research-questions")}
              onSave={() => handleSaveTab("research-questions")}
            />
          </TabsContent>

          {/* Criteria Tab */}
          <TabsContent value="criteria" className="mt-0">
            <CriteriaTab
              inclusionCriteria={inclusionCriteria}
              exclusionCriteria={exclusionCriteria}
              onInclusionChange={setInclusionCriteria}
              onExclusionChange={setExclusionCriteria}
              hasChanges={tabChanges.criteria}
              isSaving={isSaving("criteria")}
              showSuccess={saveSuccess === "criteria"}
              hasError={hasError("criteria")}
              onSave={() => handleSaveTab("criteria")}
            />
          </TabsContent>

          {/* Search Protocol Tab */}
          <TabsContent value="search-protocol" className="mt-0">
            <SearchProtocolTab studyId={studyId} />
          </TabsContent>

          {/* Classification Tab */}
          <TabsContent value="classification" className="mt-0">
            <ClassificationTab
              facets={facets}
              onFacetsChange={setFacets}
              researchQuestions={researchQuestions}
              studyId={studyId}
              onOpenCodingWizard={(facet) => {
                setCodingFacet(facet);
                setCodingWizardOpen(true);
              }}
              hasChanges={tabChanges.classification}
              isSaving={isSaving("classification")}
              showSuccess={saveSuccess === "classification"}
              hasError={hasError("classification")}
              onSave={() => handleSaveTab("classification")}
            />
          </TabsContent>

          {/* RQ Recipes Tab */}
          <TabsContent value="recipes" className="mt-0">
            <RecipesTab
              studyId={studyId}
              apiRecipes={apiRecipes || []}
              apiFacets={apiFacets || []}
              researchQuestions={researchQuestions}
            />
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
