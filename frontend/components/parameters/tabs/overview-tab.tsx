"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { SaveButton } from "./save-button";

interface OverviewTabProps {
    motivation: string;
    onMotivationChange: (value: string) => void;
    hasChanges: boolean;
    isSaving: boolean;
    showSuccess: boolean;
    hasError: boolean;
    onSave: () => void;
}

/**
 * Overview tab content - displays motivation editor with save functionality
 */
export function OverviewTab({
    motivation,
    onMotivationChange,
    hasChanges,
    isSaving,
    showSuccess,
    hasError,
    onSave,
}: OverviewTabProps) {
    return (
        <>
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
                    <SaveButton
                        tab="overview"
                        hasChanges={hasChanges}
                        isSaving={isSaving}
                        showSuccess={showSuccess}
                        onSave={onSave}
                    />
                </CardHeader>
                <CardContent>
                    <MarkdownEditor
                        value={motivation}
                        onChange={onMotivationChange}
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

            {hasError && (
                <Alert variant="destructive" className="mt-4 max-w-4xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Failed to save motivation. Please try again.</AlertDescription>
                </Alert>
            )}
        </>
    );
}
