"use client";

import { useState } from "react";
import { Facet, FacetCategory } from "../types";
import { FacetHeader } from "./facet-header";
import { FacetBasicInfo } from "./facet-basic-info";
import { FacetConfiguration } from "./facet-configuration";
import { MetadataBinding } from "./metadata-binding";
import { CategoriesSection } from "./categories-section";
import { KeywordMappingReview } from "../keyword-mapping/review";
import { KeywordMappingOverview } from "../keyword-mapping/overview";

interface ResearchQuestion {
    id: string;
    question: string;
}

interface FacetEditorProps {
    facet: Facet;
    facetKey: string;
    facetIndex: number;
    researchQuestions: ResearchQuestion[];
    studyId?: string;
    onUpdateFacet: (facetKey: string, updates: Partial<Facet>) => void;
    onRemoveFacet: (facetKey: string) => void;
    onAddCategory: (facetKey: string) => void;
    onUpdateCategory: (facetKey: string, categoryIndex: number, updates: Partial<FacetCategory>) => void;
    onRemoveCategory: (facetKey: string, categoryIndex: number) => void;
    onToggleResearchQuestion: (facetKey: string, rqId: string, checked: boolean) => void;
    onOpenCodingWizard?: (facet: Facet) => void;
}

/**
 * Main FacetEditor component - composes all sub-components for editing a facet
 */
export function FacetEditor({
    facet,
    facetKey,
    facetIndex,
    researchQuestions,
    studyId,
    onUpdateFacet,
    onRemoveFacet,
    onAddCategory,
    onUpdateCategory,
    onRemoveCategory,
    onToggleResearchQuestion,
    onOpenCodingWizard,
}: FacetEditorProps) {
    const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
    const [overviewDialogOpen, setOverviewDialogOpen] = useState(false);

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
                {/* Header */}
                <FacetHeader
                    facetIndex={facetIndex}
                    facetName={facet.name}
                    facetKey={facetKey}
                    onRemove={onRemoveFacet}
                />

                {/* Main Form */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Basic Info */}
                    <FacetBasicInfo
                        facet={facet}
                        facetKey={facetKey}
                        researchQuestions={researchQuestions}
                        onUpdateFacet={onUpdateFacet}
                        onToggleResearchQuestion={onToggleResearchQuestion}
                    />

                    {/* Right Column - Configuration */}
                    <div className="space-y-6">
                        <FacetConfiguration
                            facet={facet}
                            facetKey={facetKey}
                            studyId={studyId}
                            onUpdateFacet={onUpdateFacet}
                            onOpenCodingWizard={onOpenCodingWizard}
                        />

                        <MetadataBinding
                            facet={facet}
                            facetKey={facetKey}
                            onUpdateFacet={onUpdateFacet}
                        />

                        {/* Categories Section (for CLOSED and OPEN_CODED) */}
                        {(facet.type === "CLOSED" || facet.type === "OPEN_CODED") && (
                            <CategoriesSection
                                facet={facet}
                                facetKey={facetKey}
                                studyId={studyId}
                                onAddCategory={onAddCategory}
                                onUpdateCategory={onUpdateCategory}
                                onRemoveCategory={onRemoveCategory}
                                onOpenCodingWizard={onOpenCodingWizard}
                                onOpenMappingReview={() => setMappingDialogOpen(true)}
                                onOpenMappingOverview={() => setOverviewDialogOpen(true)}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Keyword Mapping Dialogs */}
            {facet.type === "OPEN_CODED" && facet.id && studyId && (
                <>
                    <KeywordMappingReview
                        open={mappingDialogOpen}
                        onOpenChange={setMappingDialogOpen}
                        studyId={studyId}
                        facetId={facet.id}
                        facetName={facet.name || "Untitled Facet"}
                        categories={facet.categories
                            .filter((c): c is FacetCategory & { id: string } => !!c.id)
                            .map(c => ({ id: c.id, name: c.name, description: c.description ?? null }))}
                    />
                    <KeywordMappingOverview
                        open={overviewDialogOpen}
                        onOpenChange={setOverviewDialogOpen}
                        studyId={studyId}
                        facetId={facet.id}
                        facetName={facet.name || "Untitled Facet"}
                        categories={facet.categories
                            .filter((c): c is FacetCategory & { id: string } => !!c.id)
                            .map(c => ({ id: c.id, name: c.name, description: c.description ?? null }))}
                    />
                </>
            )}
        </div>
    );
}
