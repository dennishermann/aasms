"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { CriteriaEditor, Criterion } from "@/components/parameters/criteria-editor";
import { SaveButton } from "./save-button";

interface CriteriaTabProps {
    inclusionCriteria: Criterion[];
    exclusionCriteria: Criterion[];
    onInclusionChange: (value: Criterion[]) => void;
    onExclusionChange: (value: Criterion[]) => void;
    hasChanges: boolean;
    isSaving: boolean;
    showSuccess: boolean;
    hasError: boolean;
    onSave: () => void;
}

/**
 * Selection Criteria tab content - displays inclusion and exclusion criteria
 */
export function CriteriaTab({
    inclusionCriteria,
    exclusionCriteria,
    onInclusionChange,
    onExclusionChange,
    hasChanges,
    isSaving,
    showSuccess,
    hasError,
    onSave,
}: CriteriaTabProps) {
    return (
        <>
            <div className="flex justify-end mb-4 max-w-6xl">
                <SaveButton
                    tab="criteria"
                    hasChanges={hasChanges}
                    isSaving={isSaving}
                    showSuccess={showSuccess}
                    onSave={onSave}
                />
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
                            onChange={onInclusionChange}
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
                            onChange={onExclusionChange}
                        />
                    </CardContent>
                </Card>
            </div>

            {hasError && (
                <Alert variant="destructive" className="mt-4 max-w-6xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Failed to save criteria. Please try again.</AlertDescription>
                </Alert>
            )}
        </>
    );
}
