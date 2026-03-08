"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RotateCcw, Loader2 } from "lucide-react";
import { Facet } from "../types";

interface FacetConfigurationProps {
  facet: Facet;
  facetKey: string;
  studyId?: string;
  onUpdateFacet: (facetKey: string, updates: Partial<Facet>) => void;
  onOpenCodingWizard?: (facet: Facet) => void;
}

/**
 * Configuration section - facet type selection and required toggle
 */
export function FacetConfiguration({
  facet,
  facetKey,
  studyId,
  onUpdateFacet,
  onOpenCodingWizard,
}: FacetConfigurationProps) {
  const [isResetting, setIsResetting] = useState(false);

  const handleResetFacet = async () => {
    if (!studyId || !facet.id) return;
    setIsResetting(true);
    try {
      const res = await fetch(`/api/studies/${studyId}/facets/${facet.id}/reset`, {
        method: "POST",
      });
      if (res.ok) {
        onUpdateFacet(facetKey, { type: "OPEN", categories: [] } as any);
      }
    } catch (error) {
      console.error("Failed to reset facet:", error);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="p-5 rounded-lg bg-muted/30 border space-y-5">
      <Label className="text-base font-semibold">Configuration</Label>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Type</Label>
          {facet.type === "OPEN_CODED" ? (
            <div className="flex items-center justify-between h-10 px-3 border rounded-md bg-muted/50">
              <span className="text-sm">Coded (from Open)</span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                    disabled={isResetting}
                  >
                    {isResetting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3 mr-1" />
                    )}
                    Reset
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset to Open Facet?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete all {facet.categories.length} categories and their keyword
                      mappings. The facet will return to &quot;Open&quot; type for free-form keyword
                      extraction. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleResetFacet}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Reset Facet
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <Select
              value={facet.type}
              onValueChange={(value) =>
                onUpdateFacet(facetKey, { type: value as "CLOSED" | "OPEN" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CLOSED">Category</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Constraint
          </Label>
          <div className="flex items-center h-10 px-3 border rounded-md bg-background">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`req-${facetKey}`}
                checked={facet.required}
                onCheckedChange={(checked) =>
                  onUpdateFacet(facetKey, { required: checked as boolean })
                }
              />
              <Label htmlFor={`req-${facetKey}`} className="font-normal cursor-pointer">
                Required Field
              </Label>
            </div>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {facet.type === "CLOSED"
          ? "LLM must choose from predefined categories."
          : facet.type === "OPEN_CODED"
            ? "Open facet converted to categories via coding. Categories are managed in Analysis."
            : "LLM extracts keywords from the source content."}
      </p>
      {facet.type === "OPEN" && onOpenCodingWizard && facet.id && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => onOpenCodingWizard(facet)}
        >
          Start Coding
        </Button>
      )}
    </div>
  );
}
