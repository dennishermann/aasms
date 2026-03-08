"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import {
  ClassificationSchemaEditor,
  Facet,
} from "@/components/parameters/classification-schema-editor";
import { ResearchQuestion } from "@/components/parameters/research-questions-editor";
import { SaveButton } from "./save-button";

interface ClassificationTabProps {
  facets: Facet[];
  onFacetsChange: (value: Facet[]) => void;
  researchQuestions: ResearchQuestion[];
  studyId: string;
  onOpenCodingWizard: (facet: Facet) => void;
  hasChanges: boolean;
  isSaving: boolean;
  showSuccess: boolean;
  hasError: boolean;
  onSave: () => void;
}

/**
 * Classification Schema tab content
 */
export function ClassificationTab({
  facets,
  onFacetsChange,
  researchQuestions,
  studyId,
  onOpenCodingWizard,
  hasChanges,
  isSaving,
  showSuccess,
  hasError,
  onSave,
}: ClassificationTabProps) {
  return (
    <>
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
          <SaveButton
            tab="classification"
            hasChanges={hasChanges}
            isSaving={isSaving}
            showSuccess={showSuccess}
            onSave={onSave}
          />
        </CardHeader>
        <CardContent>
          <ClassificationSchemaEditor
            value={facets}
            onChange={onFacetsChange}
            researchQuestions={researchQuestions.map((rq) => ({
              id: rq.id || `temp-${rq.order}`,
              question: rq.question,
            }))}
            studyId={studyId}
            onOpenCodingWizard={onOpenCodingWizard}
          />
        </CardContent>
      </Card>

      {hasError && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to save classification schema. Please try again.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
