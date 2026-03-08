import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";
import { isDifferent } from "../../../lib/metadata-utils";
import { MetadataBox } from "@/components/ui/metadata-box";

type MetadataField = {
  key: string;
  label: string;
};

type Metadata = Record<string, any>;

interface MetadataReviewProps {
  metadataFields: MetadataField[];
  originalMeta: Metadata;
  parsedMeta: Metadata | null;
  applyAll: boolean;
  selectedFields: Record<string, boolean>;
  onToggleApplyAll: () => void;
  onResetSelection: () => void;
  onToggleField: (key: string, next: boolean) => void;
  onApply: () => void;
  isSaving: boolean;
  loading: boolean;
}

export function MetadataReview({
  metadataFields,
  originalMeta,
  parsedMeta,
  applyAll,
  selectedFields,
  onToggleApplyAll,
  onResetSelection,
  onToggleField,
  onApply,
  isSaving,
  loading,
}: MetadataReviewProps) {
  const parsedAvailable = !!parsedMeta;
  const disableControls = loading || isSaving || !parsedAvailable;

  return (
    <Card className="border-l-4 border-l-blue-500/40 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">PDF Analysis</CardTitle>
            <CardDescription>Review extracted metadata provided by AI analysis.</CardDescription>
          </div>
          {parsedAvailable && (
            <Badge
              variant="secondary"
              className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 px-3 py-1"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              AI Summary
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {loading && (
          <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground bg-muted/30 rounded-lg animate-pulse">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="font-medium">Extracting metadata from PDF...</span>
          </div>
        )}

        {/* Loaded Content */}
        {!loading && (
          <>
            {/* Global Controls */}
            <div className="flex items-center justify-between pb-4 border-b">
              <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  <span>Original</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>AI Enhanced</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onResetSelection}
                  disabled={disableControls}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Reset
                </Button>
                <Button
                  variant={applyAll ? "default" : "outline"}
                  size="sm"
                  onClick={onToggleApplyAll}
                  disabled={disableControls}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-2" />
                  {applyAll ? "All Selected" : "Select All AI"}
                </Button>
              </div>
            </div>

            {!parsedAvailable ? (
              <div className="text-center py-12 text-muted-foreground">
                Parsed metadata not available yet.
              </div>
            ) : (
              <div className="space-y-6">
                {metadataFields.map(({ key, label }) => {
                  const diff = isDifferent(originalMeta, parsedMeta, key);
                  const useParsed = applyAll || selectedFields[key];
                  const originalVal = originalMeta[key];
                  const parsedVal = parsedMeta?.[key];

                  // Determine Layout
                  const isLongContent = key === "abstract" || key === "authors" || key === "title";

                  return (
                    <div key={key} className="group">
                      {/* Field Header */}
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
                          {label}
                          {diff && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </h4>

                        {/* Toggle Action (Only if different) */}
                        {diff && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] uppercase font-semibold text-muted-foreground hover:text-primary"
                            onClick={() => onToggleField(key, !useParsed)}
                            disabled={disableControls}
                          >
                            {useParsed ? "Using AI" : "Using Original"}
                          </Button>
                        )}
                      </div>

                      {/* Content Area */}
                      {!diff ? (
                        <MetadataBox
                          label="Matches Original"
                          value={originalVal}
                          fieldKey={key}
                          variant="match"
                          icon={null}
                        />
                      ) : isLongContent ? (
                        <div className="space-y-3">
                          <MetadataBox
                            label="Original"
                            value={originalVal}
                            fieldKey={key}
                            isActive={!useParsed}
                            onSelect={() => onToggleField(key, false)}
                          />
                          <MetadataBox
                            label="AI Extracted"
                            value={parsedVal}
                            fieldKey={key}
                            isActive={useParsed}
                            variant="ai"
                            icon={Sparkles}
                            onSelect={() => onToggleField(key, true)}
                          />
                        </div>
                      ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                          <MetadataBox
                            label="Original"
                            value={originalVal}
                            fieldKey={key}
                            isActive={!useParsed}
                            onSelect={() => onToggleField(key, false)}
                            className="h-full"
                          />
                          <MetadataBox
                            label="AI Extracted"
                            value={parsedVal}
                            fieldKey={key}
                            isActive={useParsed}
                            variant="ai"
                            icon={Sparkles}
                            onSelect={() => onToggleField(key, true)}
                            className="h-full"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-6 border-t mt-8">
              <Button
                size="lg"
                onClick={onApply}
                disabled={isSaving || loading || !parsedAvailable}
                className="min-w-[150px]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Accept & Finalize"
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
