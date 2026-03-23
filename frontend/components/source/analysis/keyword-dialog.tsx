"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

interface KeywordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-filled for editing, empty for adding */
  initialKeyword?: string;
  /** Confidence info (read-only, shown for LLM-extracted keywords) */
  confidence?: number | null;
  evidence?: string | null;
  onSave: (keyword: string) => void;
  /** Only shown when editing an existing keyword */
  onDelete?: () => void;
  /** Used for duplicate checking */
  existingKeywords: string[];
}

export function KeywordDialog({
  open,
  onOpenChange,
  initialKeyword,
  confidence,
  evidence,
  onSave,
  onDelete,
  existingKeywords,
}: KeywordDialogProps) {
  const [value, setValue] = useState(initialKeyword ?? "");
  const isEditing = initialKeyword != null;

  useEffect(() => {
    if (open) {
      setValue(initialKeyword ?? "");
    }
  }, [open, initialKeyword]);

  const trimmed = value.trim();
  const isDuplicate =
    trimmed.length > 0 &&
    existingKeywords.some(
      (kw) =>
        kw.toLowerCase() === trimmed.toLowerCase() &&
        kw.toLowerCase() !== (initialKeyword ?? "").toLowerCase(),
    );
  const canSave = trimmed.length > 0 && !isDuplicate && trimmed !== (initialKeyword ?? "");

  const handleSave = () => {
    if (!canSave) return;
    onSave(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Keyword" : "Add Keyword"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modify the keyword text or delete it."
              : "Enter a new keyword for this facet."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="keyword-input">Keyword</Label>
            <Input
              id="keyword-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
              placeholder="Enter keyword..."
              autoFocus
            />
            {isDuplicate && (
              <p className="text-xs text-destructive">This keyword already exists.</p>
            )}
          </div>

          {isEditing && confidence != null && (
            <div className="rounded-md bg-muted/50 p-3 space-y-1">
              <p className="text-xs text-muted-foreground">
                LLM Confidence: <span className="font-mono">{Math.round(confidence * 100)}%</span>
              </p>
              {evidence && (
                <p className="text-xs text-muted-foreground italic">{evidence}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {isEditing && onDelete && (
              <Button variant="destructive" size="sm" onClick={() => {
                onDelete();
                onOpenChange(false);
              }}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!canSave}>
              {isEditing ? "Save" : "Add"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
