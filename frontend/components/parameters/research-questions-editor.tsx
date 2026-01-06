"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X } from "lucide-react";

export interface ResearchQuestion {
  id?: string;
  question: string;
  order: number;
}

interface ResearchQuestionsEditorProps {
  value: ResearchQuestion[];
  onChange: (questions: ResearchQuestion[]) => void;
}

export function ResearchQuestionsEditor({ value, onChange }: ResearchQuestionsEditorProps) {
  const handleQuestionChange = (index: number, newQuestion: string) => {
    const updated = [...value];
    updated[index] = { ...updated[index], question: newQuestion };
    onChange(updated);
  };

  const handleRemoveQuestion = (index: number) => {
    const updated = value.filter((_, i) => i !== index);
    // Reorder remaining questions
    const reordered = updated.map((q, i) => ({ ...q, order: i }));
    onChange(reordered);
  };

  const handleAddQuestion = () => {
    const newQuestion: ResearchQuestion = {
      question: "",
      order: value.length,
    };
    onChange([...value, newQuestion]);
  };

  return (
    <div className="space-y-4">
      {value.map((question, index) => (
        <div key={question.id || index} className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-8 pt-3 text-sm text-muted-foreground font-medium">
              RQ{index + 1}
            </div>
            <Textarea
              placeholder={`Enter research question ${index + 1}`}
              value={question.question}
              onChange={(e) => handleQuestionChange(index, e.target.value)}
              rows={2}
              className="flex-1 resize-none"
              style={{
                minHeight: '60px',
                height: 'auto',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
            />
            {value.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveQuestion(index)}
                className="flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddQuestion}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Research Question
      </Button>
    </div>
  );
}

