"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { Plus, X, RefreshCw, Info, Eye } from "lucide-react";
import { Facet, FacetCategory } from "../types";

interface CategoriesSectionProps {
    facet: Facet;
    facetKey: string;
    studyId?: string;
    onAddCategory: (facetKey: string) => void;
    onUpdateCategory: (facetKey: string, categoryIndex: number, updates: Partial<FacetCategory>) => void;
    onRemoveCategory: (facetKey: string, categoryIndex: number) => void;
    onOpenCodingWizard?: (facet: Facet) => void;
    onOpenMappingReview: () => void;
    onOpenMappingOverview: () => void;
}

/**
 * Categories section - list of categories with add/edit/remove for CLOSED and OPEN_CODED facets
 */
export function CategoriesSection({
    facet,
    facetKey,
    studyId,
    onAddCategory,
    onUpdateCategory,
    onRemoveCategory,
    onOpenCodingWizard,
    onOpenMappingReview,
    onOpenMappingOverview,
}: CategoriesSectionProps) {
    const canReviewMappings = facet.type === "OPEN_CODED" && !!facet.id && !!studyId;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                    Categories ({facet.categories.length})
                </Label>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onAddCategory(facetKey)}
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                    </Button>
                    {facet.type === "OPEN_CODED" && (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!canReviewMappings}
                                onClick={onOpenMappingOverview}
                            >
                                <Eye className="h-4 w-4 mr-1" />
                                View All
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!canReviewMappings}
                                onClick={onOpenMappingReview}
                            >
                                Review Pending
                            </Button>
                        </>
                    )}
                    {facet.type === "OPEN_CODED" && onOpenCodingWizard && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button type="button" variant="outline" size="sm">
                                    <RefreshCw className="h-4 w-4 mr-1" />
                                    Regenerate
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Regenerate Categories?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will use AI to analyze all values and suggest new categories.
                                        Your current {facet.categories.length} categories will be replaced
                                        with the new suggestions when you click &quot;Apply&quot; in the wizard.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onOpenCodingWizard(facet)}>
                                        Continue
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </div>

            <TooltipProvider>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {facet.categories.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                            <p className="text-sm text-muted-foreground">
                                No categories defined yet.
                            </p>
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="mt-2"
                                onClick={() => onAddCategory(facetKey)}
                            >
                                Add your first category
                            </Button>
                        </div>
                    ) : (
                        facet.categories.map((category, idx) => (
                            <div
                                key={category.id || idx}
                                className="group flex items-center gap-2 px-3 py-2 border rounded-md bg-background hover:bg-muted/50 transition-colors"
                            >
                                <Input
                                    className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-0"
                                    value={category.name}
                                    placeholder={`Category ${idx + 1}`}
                                    onChange={(e) =>
                                        onUpdateCategory(facetKey, idx, { name: e.target.value })
                                    }
                                />
                                {category.description && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground cursor-help shrink-0" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                            <p className="text-xs">{category.description}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                    onClick={() => onRemoveCategory(facetKey, idx)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </TooltipProvider>

            {facet.type === "OPEN_CODED" && (
                <p className="text-xs text-muted-foreground">
                    Categories are used by the LLM to classify new sources. Descriptions help with
                    semantic matching.
                </p>
            )}
        </div>
    );
}
