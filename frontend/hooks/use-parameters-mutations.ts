"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ResearchQuestion } from "@/components/parameters/research-questions-editor";
import { Criterion } from "@/components/parameters/criteria-editor";
import { Facet } from "@/components/parameters/classification-schema-editor";
import { TabKey } from "@/components/parameters/tabs/tab-config";

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
    metadataField?: string | null;
    metadataTransform?: string | null;
}

interface UseParametersMutationsProps {
    studyId: string;
    motivation: string;
    researchQuestions: ResearchQuestion[];
    inclusionCriteria: Criterion[];
    exclusionCriteria: Criterion[];
    facets: Facet[];
    onMotivationSaved: (motivation: string) => void;
    onResearchQuestionsSaved: (rqs: ResearchQuestion[]) => void;
    onCriteriaSaved: (inclusion: Criterion[], exclusion: Criterion[]) => void;
    onFacetsSaved: () => void;
    onSaveSuccess: (tab: TabKey) => void;
}

export function useParametersMutations({
    studyId,
    motivation,
    researchQuestions,
    inclusionCriteria,
    exclusionCriteria,
    facets,
    onMotivationSaved,
    onResearchQuestionsSaved,
    onCriteriaSaved,
    onFacetsSaved,
    onSaveSuccess,
}: UseParametersMutationsProps) {
    const queryClient = useQueryClient();

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
            onMotivationSaved(motivation);
            onSaveSuccess("overview");
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
            onResearchQuestionsSaved(updatedRQs);
            onSaveSuccess("research-questions");
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
            onCriteriaSaved(inclusionCriteria, exclusionCriteria);
            onSaveSuccess("criteria");
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
                            metadataField: facet.metadataField,
                            metadataTransform: facet.metadataTransform,
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
                            metadataField: facet.metadataField,
                            metadataTransform: facet.metadataTransform,
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
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ["facets", studyId] });
            onFacetsSaved();
            onSaveSuccess("classification");

            // Trigger reclassification of existing sources in the background
            try {
                const reclassifyResponse = await fetch(`/api/studies/${studyId}/reclassify`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode: "all" }),
                });

                if (reclassifyResponse.ok) {
                    const result = await reclassifyResponse.json();
                    console.log("[parameters] Reclassification triggered:", result);
                    queryClient.invalidateQueries({ queryKey: ["sources", studyId] });
                }
            } catch (error) {
                console.error("[parameters] Reclassification failed:", error);
            }
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

    const isSaving = (tab: TabKey): boolean => {
        switch (tab) {
            case "overview":
                return saveOverviewMutation.isPending;
            case "research-questions":
                return saveResearchQuestionsMutation.isPending;
            case "criteria":
                return saveCriteriaMutation.isPending;
            case "classification":
                return saveClassificationMutation.isPending;
            default:
                return false;
        }
    };

    const hasError = (tab: TabKey): boolean => {
        switch (tab) {
            case "overview":
                return saveOverviewMutation.isError;
            case "research-questions":
                return saveResearchQuestionsMutation.isError;
            case "criteria":
                return saveCriteriaMutation.isError;
            case "classification":
                return saveClassificationMutation.isError;
            default:
                return false;
        }
    };

    return {
        handleSaveTab,
        isSaving,
        hasError,
    };
}
