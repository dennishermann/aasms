"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Facet } from "../types";

interface ResearchQuestion {
  id: string;
  question: string;
}

interface FacetBasicInfoProps {
  facet: Facet;
  facetKey: string;
  researchQuestions: ResearchQuestion[];
  onUpdateFacet: (facetKey: string, updates: Partial<Facet>) => void;
  onToggleResearchQuestion: (facetKey: string, rqId: string, checked: boolean) => void;
}

/**
 * Basic info section of facet editor - name, description, and research question links
 */
export function FacetBasicInfo({
  facet,
  facetKey,
  researchQuestions,
  onUpdateFacet,
  onToggleResearchQuestion,
}: FacetBasicInfoProps) {
  return (
    <div className="space-y-6">
      {/* Facet Name */}
      <div className="space-y-2">
        <Label htmlFor={`name-${facetKey}`}>
          Facet Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id={`name-${facetKey}`}
          placeholder="e.g., Publication Venue, Research Method"
          value={facet.name}
          onChange={(e) => onUpdateFacet(facetKey, { name: e.target.value })}
          className="text-base"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor={`desc-${facetKey}`}>Description</Label>
        <Textarea
          id={`desc-${facetKey}`}
          placeholder="Describe what this facet classifies and how it helps answer your research questions..."
          value={facet.description || ""}
          onChange={(e) => onUpdateFacet(facetKey, { description: e.target.value })}
          className="resize-none"
          rows={4}
        />
      </div>

      {/* Research Questions */}
      <div className="space-y-3">
        <Label>Research Questions</Label>
        <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
          {researchQuestions.map((rq, idx) => (
            <div key={rq.id} className="flex items-start gap-3">
              <Checkbox
                id={`rq-${facetKey}-${rq.id}`}
                checked={facet.researchQuestionIds.includes(rq.id)}
                onCheckedChange={(checked) =>
                  onToggleResearchQuestion(facetKey, rq.id, checked as boolean)
                }
                className="mt-0.5"
              />
              <label
                htmlFor={`rq-${facetKey}-${rq.id}`}
                className="text-sm cursor-pointer leading-relaxed"
              >
                <span className="font-semibold text-muted-foreground">RQ{idx + 1}:</span>{" "}
                <span className="text-foreground">{rq.question}</span>
              </label>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Select which research questions this facet helps answer.
        </p>
      </div>
    </div>
  );
}
