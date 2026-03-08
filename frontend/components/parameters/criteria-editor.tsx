"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X } from "lucide-react";

export interface Criterion {
  criterion: string;
  order: number;
}

interface CriteriaEditorProps {
  type: "inclusion" | "exclusion";
  value: Criterion[];
  onChange: (criteria: Criterion[]) => void;
}

export function CriteriaEditor({ type, value, onChange }: CriteriaEditorProps) {
  const label = type === "inclusion" ? "Inclusion" : "Exclusion";
  const prefix = type === "inclusion" ? "IC" : "EC";

  const handleCriterionChange = (index: number, newCriterion: string) => {
    const updated = [...value];
    updated[index] = { ...updated[index], criterion: newCriterion };
    onChange(updated);
  };

  const handleRemoveCriterion = (index: number) => {
    const updated = value.filter((_, i) => i !== index);
    // Reorder remaining criteria
    const reordered = updated.map((c, i) => ({ ...c, order: i }));
    onChange(reordered);
  };

  const handleAddCriterion = () => {
    const newCriterion: Criterion = {
      criterion: "",
      order: value.length,
    };
    onChange([...value, newCriterion]);
  };

  return (
    <div className="space-y-4">
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No {label.toLowerCase()} criteria defined yet.
        </p>
      ) : (
        value.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 w-10 pt-3 text-sm text-muted-foreground font-medium">
                {prefix}
                {index + 1}
              </div>
              <Textarea
                placeholder={`Enter ${label.toLowerCase()} criterion ${index + 1}`}
                value={item.criterion}
                onChange={(e) => handleCriterionChange(index, e.target.value)}
                rows={2}
                className="flex-1 resize-none"
                style={{
                  minHeight: "60px",
                  height: "auto",
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = target.scrollHeight + "px";
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveCriterion(index)}
                className="flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))
      )}
      <Button type="button" variant="outline" size="sm" onClick={handleAddCriterion}>
        <Plus className="h-4 w-4 mr-2" />
        Add {label} Criterion
      </Button>
    </div>
  );
}
