"use client";

import { useState, useEffect } from "react";
import { FacetList } from "./facet-list";
import { FacetEditor } from "./facet-editor";
import { EmptyState } from "./empty-state";
import { useFacets } from "./use-facets";
import { Facet, FacetCategory, ResearchQuestion, ClassificationSchemaEditorProps } from "./types";

// Re-export types for backwards compatibility
export type { Facet, FacetCategory };

export function ClassificationSchemaEditor({
    value,
    onChange,
    researchQuestions,
    studyId,
    onOpenCodingWizard,
}: ClassificationSchemaEditorProps) {
    const [selectedFacetKey, setSelectedFacetKey] = useState<string | null>(null);

    const {
        getFacetKey,
        handleAddFacet,
        handleRemoveFacet,
        handleUpdateFacet,
        handleAddCategory,
        handleUpdateCategory,
        handleRemoveCategory,
        handleToggleResearchQuestion,
    } = useFacets(value, onChange, researchQuestions);

    // Auto-select first facet when list changes
    useEffect(() => {
        if (value.length > 0 && !selectedFacetKey) {
            setSelectedFacetKey(getFacetKey(value[0]));
        } else if (value.length === 0) {
            setSelectedFacetKey(null);
        } else if (selectedFacetKey && !value.find(f => getFacetKey(f) === selectedFacetKey)) {
            // Selected facet was deleted, select first one
            setSelectedFacetKey(value.length > 0 ? getFacetKey(value[0]) : null);
        }
    }, [value, selectedFacetKey, getFacetKey]);

    // Handle adding a new facet and selecting it
    const handleAddAndSelectFacet = () => {
        handleAddFacet();
        // The new facet will be added at the end, so we'll select it after the state updates
        setTimeout(() => {
            const newFacets = value;
            if (newFacets.length > 0) {
                const lastFacet = newFacets[newFacets.length - 1];
                setSelectedFacetKey(getFacetKey(lastFacet));
            }
        }, 0);
    };

    // No research questions - cannot create facets
    if (researchQuestions.length === 0) {
        return <EmptyState type="no-research-questions" />;
    }

    // No facets yet
    if (value.length === 0) {
        return (
            <EmptyState
                type="no-facets"
                onAddFacet={() => {
                    handleAddFacet();
                }}
            />
        );
    }

    const selectedFacet = value.find(f => getFacetKey(f) === selectedFacetKey);
    const selectedFacetIndex = value.findIndex(f => getFacetKey(f) === selectedFacetKey);

    return (
        <div className="flex border rounded-lg overflow-hidden bg-background min-h-[500px]">
            {/* Sidebar */}
            <FacetList
                facets={value}
                selectedFacetKey={selectedFacetKey}
                onSelectFacet={setSelectedFacetKey}
                onAddFacet={handleAddAndSelectFacet}
                getFacetKey={getFacetKey}
            />

            {/* Main Editor Panel */}
            {selectedFacet ? (
                <FacetEditor
                    facet={selectedFacet}
                    facetKey={selectedFacetKey!}
                    facetIndex={selectedFacetIndex}
                    researchQuestions={researchQuestions}
                    onUpdateFacet={handleUpdateFacet}
                    onRemoveFacet={(key) => {
                        handleRemoveFacet(key);
                        // Select next facet after deletion
                        const remainingFacets = value.filter(f => getFacetKey(f) !== key);
                        if (remainingFacets.length > 0) {
                            setSelectedFacetKey(getFacetKey(remainingFacets[0]));
                        }
                    }}
                    onAddCategory={handleAddCategory}
                    onUpdateCategory={handleUpdateCategory}
                    onRemoveCategory={handleRemoveCategory}
                    onToggleResearchQuestion={handleToggleResearchQuestion}
                    onOpenCodingWizard={onOpenCodingWizard}
                />
            ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <p>Select a facet to edit</p>
                </div>
            )}
        </div>
    );
}
