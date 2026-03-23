"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { SaveButton } from "./save-button";

const STUDY_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ARCHIVED", label: "Archived" },
];

interface OverviewTabProps {
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  motivation: string;
  onMotivationChange: (value: string) => void;
  hasChanges: boolean;
  isSaving: boolean;
  showSuccess: boolean;
  hasError: boolean;
  onSave: () => void;
}

/**
 * Overview tab content - displays study details and motivation editor with save functionality
 */
export function OverviewTab({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  status,
  onStatusChange,
  motivation,
  onMotivationChange,
  hasChanges,
  isSaving,
  showSuccess,
  hasError,
  onSave,
}: OverviewTabProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Study Details Card */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                Overview
              </span>
              Study Details
            </CardTitle>
            <CardDescription className="mt-2">
              Update the study title, description, and status.
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
        <CardContent className="space-y-4">
          <div className="grid grid-cols-[1fr_180px] gap-4">
            <div className="space-y-2">
              <Label htmlFor="study-title">Title</Label>
              <Input
                id="study-title"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Study title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="study-status">Status</Label>
              <Select value={status} onValueChange={onStatusChange}>
                <SelectTrigger id="study-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STUDY_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="study-description">Description</Label>
            <Textarea
              id="study-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Brief description of this systematic mapping study"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Motivation Card */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
              Overview
            </span>
            Study Motivation
          </CardTitle>
          <CardDescription className="mt-2">
            Explain the motivation and rationale behind this systematic mapping study. Use Markdown
            for formatting.
          </CardDescription>
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
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to save overview. Please try again.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
