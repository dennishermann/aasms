"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import {
  ResearchQuestionsEditor,
  ResearchQuestion,
} from "@/components/parameters/research-questions-editor";
import { SaveButton } from "./save-button";

interface ResearchQuestionsTabProps {
  researchQuestions: ResearchQuestion[];
  onResearchQuestionsChange: (value: ResearchQuestion[]) => void;
  hasChanges: boolean;
  isSaving: boolean;
  showSuccess: boolean;
  hasError: boolean;
  onSave: () => void;
}

/**
 * Research Questions tab content
 */
export function ResearchQuestionsTab({
  researchQuestions,
  onResearchQuestionsChange,
  hasChanges,
  isSaving,
  showSuccess,
  hasError,
  onSave,
}: ResearchQuestionsTabProps) {
  return (
    <>
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
          <SaveButton
            tab="research-questions"
            hasChanges={hasChanges}
            isSaving={isSaving}
            showSuccess={showSuccess}
            onSave={onSave}
          />
        </CardHeader>
        <CardContent>
          <ResearchQuestionsEditor value={researchQuestions} onChange={onResearchQuestionsChange} />
        </CardContent>
      </Card>

      {hasError && (
        <Alert variant="destructive" className="mt-4 max-w-4xl">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to save research questions. Please try again.</AlertDescription>
        </Alert>
      )}
    </>
  );
}
