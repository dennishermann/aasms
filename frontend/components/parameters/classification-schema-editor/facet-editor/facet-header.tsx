"use client";

import { Button } from "@/components/ui/button";
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
import { Trash2 } from "lucide-react";

interface FacetHeaderProps {
  facetIndex: number;
  facetName: string;
  facetKey: string;
  onRemove: (facetKey: string) => void;
}

/**
 * Header section of the facet editor with badge, title, and delete button
 */
export function FacetHeader({ facetIndex, facetName, facetKey, onRemove }: FacetHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
          F{facetIndex + 1}
        </span>
        <h2 className="text-xl font-semibold">{facetName || "Untitled Facet"}</h2>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Facet
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Facet?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{facetName || "Untitled Facet"}&quot;? This will remove the facet and all
              its categories.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onRemove(facetKey)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
