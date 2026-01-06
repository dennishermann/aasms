"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CriterionEval } from "./types";
import { Loader2, AlertCircle, CheckCircle2, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

interface InclusionExclusionEditorProps {
  inclusionCriteria: CriterionEval[];
  exclusionCriteria: CriterionEval[];
  inclusionRecommendation: boolean;
  inclusionReasoning: string;
  exclusionReasoning: string;
  confidenceScore: number;
  onChangeInclusionCriteria: (next: CriterionEval[]) => void;
  onChangeExclusionCriteria: (next: CriterionEval[]) => void;
  onChangeInclusionRecommendation: (value: boolean) => void;
  onChangeInclusionReasoning: (value: string) => void;
  onChangeExclusionReasoning: (value: string) => void;
  onChangeConfidenceScore: (value: number) => void;
  disabled?: boolean;
  loading?: boolean;
}

export function InclusionExclusionEditor({
  inclusionCriteria,
  exclusionCriteria,
  inclusionRecommendation,
  inclusionReasoning,
  exclusionReasoning,
  confidenceScore,
  onChangeInclusionCriteria,
  onChangeExclusionCriteria,
  onChangeInclusionRecommendation,
  onChangeInclusionReasoning,
  onChangeExclusionReasoning,
  onChangeConfidenceScore,
  disabled = false,
  loading = false,
}: InclusionExclusionEditorProps) {
  const updateCriterion = (
    list: CriterionEval[],
    index: number,
    patch: Partial<CriterionEval>,
    setter: (next: CriterionEval[]) => void
  ) => {
    const next = [...list];
    next[index] = { ...next[index], ...patch };
    setter(next);
  };

  return (
    <CardContent className="space-y-8 pt-6">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Running inclusion/exclusion analysis...
        </div>
      )}

      {/* 2-Column Grid for Criteria Edit */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Left Column: Inclusion */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-base flex items-center gap-2">
              Inclusion Criteria
              <Badge variant="outline" className="ml-1 font-normal">
                {inclusionCriteria.length}
              </Badge>
            </h4>
          </div>

          <div className="space-y-4">
            {inclusionCriteria.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No criteria defined.</p>
            )}
            {inclusionCriteria.map((ic, index) => {
              const isIncluded = !!ic.fulfilled;
              return (
                <div
                  key={index}
                  className={cn(
                    "border rounded-lg p-3 space-y-3 transition-colors duration-200",
                    isIncluded ? "border-green-200 bg-green-50/50" : "border-border hover:border-border/80"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`inc-${index}`}
                      checked={isIncluded}
                      onCheckedChange={(checked) =>
                        updateCriterion(
                          inclusionCriteria,
                          index,
                          { fulfilled: !!checked },
                          onChangeInclusionCriteria
                        )
                      }
                      className={cn(
                        "mt-1 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                      )}
                      disabled={disabled}
                    />
                    <div className="flex-1 space-y-2">
                      <Label
                        htmlFor={`inc-${index}`}
                        className={cn(
                          "text-sm font-medium leading-tight cursor-pointer block",
                          isIncluded ? "text-green-900" : "text-foreground"
                        )}
                      >
                        {ic.criterion}
                      </Label>
                      <Textarea
                        value={ic.reasoning || ""}
                        onChange={(e) =>
                          updateCriterion(
                            inclusionCriteria,
                            index,
                            { reasoning: e.target.value },
                            onChangeInclusionCriteria
                          )
                        }
                        placeholder="Reasoning..."
                        rows={2}
                        className="text-xs min-h-[60px] resize-none bg-background/50"
                        disabled={disabled}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Exclusion */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-base flex items-center gap-2">
              Exclusion Criteria
              <Badge variant="outline" className="ml-1 font-normal">
                {exclusionCriteria.length}
              </Badge>
            </h4>
          </div>

          <div className="space-y-4">
            {exclusionCriteria.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No criteria defined.</p>
            )}
            {exclusionCriteria.map((ec, index) => {
              const isExcluded = !!ec.fulfilled;
              return (
                <div
                  key={index}
                  className={cn(
                    "border rounded-lg p-3 space-y-3 transition-colors duration-200",
                    isExcluded
                      ? "border-red-200 bg-red-50/50"  // Crit met = Excluded (Bad)
                      : "border-green-200 bg-green-50/50" // Crit NOT met = Safe (Good)
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`exc-${index}`}
                      checked={isExcluded}
                      onCheckedChange={(checked) =>
                        updateCriterion(
                          exclusionCriteria,
                          index,
                          { fulfilled: !!checked },
                          onChangeExclusionCriteria
                        )
                      }
                      className={cn(
                        "mt-1",
                        isExcluded
                          ? "data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                          : "border-green-600 data-[state=unchecked]:border-green-600" // Green check logic is tricky with checkbox, standard checkbox is empty when unchecked.
                        // Let's keep visualized state simple: Checked = Excluded.
                      )}
                      disabled={disabled}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <Label
                          htmlFor={`exc-${index}`}
                          className={cn(
                            "text-sm font-medium leading-tight cursor-pointer block",
                            isExcluded ? "text-red-900" : "text-green-900"
                          )}
                        >
                          {ec.criterion}
                        </Label>
                        {isExcluded ? (
                          <Ban className="h-4 w-4 text-red-600 flex-shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        )}
                      </div>

                      <Textarea
                        value={ec.reasoning || ""}
                        onChange={(e) =>
                          updateCriterion(
                            exclusionCriteria,
                            index,
                            { reasoning: e.target.value },
                            onChangeExclusionCriteria
                          )
                        }
                        placeholder="Reasoning..."
                        rows={2}
                        className="text-xs min-h-[60px] resize-none bg-background/50"
                        disabled={disabled}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t pt-8 space-y-6">
        <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
          <div className="space-y-4 w-full md:w-1/2">
            <Label className="text-base font-semibold block">Overall Recommendation</Label>
            <RadioGroup
              value={inclusionRecommendation ? "include" : "exclude"}
              onValueChange={(value) => onChangeInclusionRecommendation(value === "include")}
              disabled={disabled}
              className="flex flex-col gap-3"
            >
              <div className={cn(
                "flex items-center space-x-3 border rounded-md p-3 transition-all cursor-pointer",
                inclusionRecommendation ? "border-green-500 bg-green-50 ring-1 ring-green-500" : "hover:bg-accent"
              )}>
                <RadioGroupItem value="include" id="include" className="text-green-600 border-green-600" />
                <Label htmlFor="include" className="cursor-pointer font-medium flex-1">
                  INCLUDE this source
                </Label>
                <CheckCircle2 className={cn("h-4 w-4", inclusionRecommendation ? "text-green-600" : "text-muted-foreground")} />
              </div>

              <div className={cn(
                "flex items-center space-x-3 border rounded-md p-3 transition-all cursor-pointer",
                !inclusionRecommendation ? "border-red-500 bg-red-50 ring-1 ring-red-500" : "hover:bg-accent"
              )}>
                <RadioGroupItem value="exclude" id="exclude" className="text-red-600 border-red-600" />
                <Label htmlFor="exclude" className="cursor-pointer font-medium flex-1">
                  EXCLUDE this source
                </Label>
                <Ban className={cn("h-4 w-4", !inclusionRecommendation ? "text-red-600" : "text-muted-foreground")} />
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-4 w-full md:w-1/2">
            <Label className="text-base font-semibold block">
              Confidence: {(confidenceScore * 100).toFixed(0)}%
            </Label>
            <div className="pt-2 px-1">
              <Slider
                value={[confidenceScore]}
                onValueChange={(value) => onChangeConfidenceScore(value[0])}
                min={0}
                max={1}
                step={0.05}
                className="w-full"
                disabled={disabled}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Slide to adjust confidence level manually.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="mb-2 block font-medium">Inclusion Summary</Label>
            <Textarea
              value={inclusionReasoning}
              onChange={(e) => onChangeInclusionReasoning(e.target.value)}
              placeholder="Summarize reasons for inclusion..."
              rows={4}
              disabled={disabled}
              className="resize-none"
            />
          </div>
          <div>
            <Label className="mb-2 block font-medium">Exclusion Summary</Label>
            <Textarea
              value={exclusionReasoning}
              onChange={(e) => onChangeExclusionReasoning(e.target.value)}
              placeholder="Summarize reasons for exclusion..."
              rows={4}
              disabled={disabled}
              className="resize-none"
            />
          </div>
        </div>
      </div>
    </CardContent>
  );
}




