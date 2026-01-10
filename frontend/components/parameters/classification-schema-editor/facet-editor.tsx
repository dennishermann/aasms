"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, X, Trash2, RefreshCw, Info } from "lucide-react";
import { Facet, FacetCategory, ResearchQuestion } from "./types";

interface FacetEditorProps {
    facet: Facet;
    facetKey: string;
    facetIndex: number;
    researchQuestions: ResearchQuestion[];
    onUpdateFacet: (facetKey: string, updates: Partial<Facet>) => void;
    onRemoveFacet: (facetKey: string) => void;
    onAddCategory: (facetKey: string) => void;
    onUpdateCategory: (facetKey: string, categoryIndex: number, updates: Partial<FacetCategory>) => void;
    onRemoveCategory: (facetKey: string, categoryIndex: number) => void;
    onToggleResearchQuestion: (facetKey: string, rqId: string, checked: boolean) => void;
    onOpenCodingWizard?: (facet: Facet) => void;
}

export function FacetEditor({
    facet,
    facetKey,
    facetIndex,
    researchQuestions,
    onUpdateFacet,
    onRemoveFacet,
    onAddCategory,
    onUpdateCategory,
    onRemoveCategory,
    onToggleResearchQuestion,
    onOpenCodingWizard,
}: FacetEditorProps) {
    return (
        <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            F{facetIndex + 1}
                        </span>
                        <h2 className="text-xl font-semibold">
                            {facet.name || "Untitled Facet"}
                        </h2>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => onRemoveFacet(facetKey)}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Facet
                    </Button>
                </div>

                {/* Main Form */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column */}
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

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Configuration */}
                        <div className="p-5 rounded-lg bg-muted/30 border space-y-5">
                            <Label className="text-base font-semibold">Configuration</Label>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                                        Type
                                    </Label>
                                    {facet.type === "OPEN_CODED" ? (
                                        <div className="flex items-center h-10 px-3 border rounded-md bg-muted/50">
                                            <span className="text-sm">Coded (from Open)</span>
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
                                                <SelectItem value="OPEN">Free Text</SelectItem>
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
                                        : "LLM extracts text or generates a value based on content."}
                            </p>
                        </div>

                        {/* Categories Section (for CLOSED and OPEN_CODED) */}
                        {(facet.type === "CLOSED" || facet.type === "OPEN_CODED") && (
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
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
