"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    ChevronDown,
    ChevronRight,
    Pencil,
    Plus,
    Trash2,
    Loader2,
    AlertCircle,
    CheckCircle,
    Sparkles,
    Tag,
    FileText,
    Hash,
} from "lucide-react";

interface SuggestedCategory {
    name: string;
    description: string;
    values: string[];
    source_count: number;
}

interface CodingWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    studyId: string;
    facetId: string;
    facetName: string;
    onSuccess?: () => void;
}

export function CodingWizard({
    open,
    onOpenChange,
    studyId,
    facetId,
    facetName,
    onSuccess,
}: CodingWizardProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<SuggestedCategory[]>([]);
    const [uncategorized, setUncategorized] = useState<string[]>([]);
    const [reasoning, setReasoning] = useState("");
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [totalValues, setTotalValues] = useState(0);
    const [totalSources, setTotalSources] = useState(0);

    // Fetch category suggestions when dialog opens
    useEffect(() => {
        if (open && categories.length === 0) {
            fetchSuggestions();
        }
    }, [open]);

    const fetchSuggestions = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/studies/${studyId}/facets/${facetId}/coding/suggest`,
                { method: "POST" }
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to generate suggestions");
            }

            const data = await response.json();
            setCategories(data.categories || []);
            setUncategorized(data.uncategorized || []);
            setReasoning(data.reasoning || "");
            setTotalValues(data.total_values || 0);
            setTotalSources(data.total_sources || 0);

            // Expand all categories by default for better visibility
            if (data.categories?.length > 0) {
                setExpandedCategories(new Set(data.categories.map((c: SuggestedCategory) => c.name)));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsLoading(false);
        }
    }, [studyId, facetId]);

    const toggleCategory = (name: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
    };

    const toggleAllCategories = () => {
        if (expandedCategories.size === categories.length) {
            setExpandedCategories(new Set());
        } else {
            setExpandedCategories(new Set(categories.map(c => c.name)));
        }
    };

    const updateCategoryName = (oldName: string, newName: string) => {
        setCategories(prev =>
            prev.map(cat => (cat.name === oldName ? { ...cat, name: newName } : cat))
        );
        // Update expanded set if name changed
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(oldName)) {
                next.delete(oldName);
                next.add(newName);
            }
            return next;
        });
        setEditingCategory(null);
    };

    const deleteCategory = (name: string) => {
        const cat = categories.find(c => c.name === name);
        if (cat) {
            setUncategorized(prev => [...prev, ...cat.values]);
            setCategories(prev => prev.filter(c => c.name !== name));
            setExpandedCategories(prev => {
                const next = new Set(prev);
                next.delete(name);
                return next;
            });
        }
    };

    const addCategory = () => {
        const newName = `New Category ${categories.length + 1}`;
        setCategories(prev => [
            ...prev,
            { name: newName, description: "", values: [], source_count: 0 },
        ]);
        setEditingCategory(newName);
        setExpandedCategories(prev => new Set([...prev, newName]));
    };

    const applyCategories = async () => {
        setIsApplying(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/studies/${studyId}/facets/${facetId}/coding/apply`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        categories: categories.map(cat => ({
                            name: cat.name,
                            description: cat.description,
                            values: cat.values,
                        })),
                    }),
                }
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to apply categories");
            }

            onSuccess?.();
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsApplying(false);
        }
    };

    const handleClose = () => {
        setCategories([]);
        setUncategorized([]);
        setError(null);
        setExpandedCategories(new Set());
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="!max-w-[95vw] !w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
                {/* Header */}
                <DialogHeader className="px-8 py-6 border-b bg-muted/30">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1.5">
                            <DialogTitle className="text-2xl font-semibold flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <Tag className="h-5 w-5 text-primary" />
                                </div>
                                Create Categories for &quot;{facetName}&quot;
                            </DialogTitle>
                            <DialogDescription className="text-base">
                                Review the AI-suggested categories below. You can rename, delete, or add new categories before applying.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Main Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {isLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
                            <div className="relative">
                                <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                                <div className="relative p-4 rounded-full bg-primary/10">
                                    <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                                </div>
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-lg font-medium">Analyzing your data...</p>
                                <p className="text-muted-foreground">
                                    AI is clustering similar values and suggesting categories
                                </p>
                            </div>
                            <div className="w-full max-w-md space-y-3">
                                <Skeleton className="h-16 w-full rounded-xl" />
                                <Skeleton className="h-16 w-full rounded-xl" />
                                <Skeleton className="h-16 w-full rounded-xl" />
                            </div>
                        </div>
                    ) : error ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                            <div className="p-4 rounded-full bg-destructive/10">
                                <AlertCircle className="h-8 w-8 text-destructive" />
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-lg font-medium text-destructive">Failed to generate suggestions</p>
                                <p className="text-muted-foreground max-w-md">{error}</p>
                            </div>
                            <Button onClick={fetchSuggestions} variant="outline" size="lg">
                                <Loader2 className="h-4 w-4 mr-2" />
                                Try Again
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Stats Bar */}
                            <div className="px-8 py-4 border-b bg-background flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <Hash className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm">
                                            <span className="font-semibold">{totalValues}</span>
                                            <span className="text-muted-foreground"> unique values</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm">
                                            <span className="font-semibold">{totalSources}</span>
                                            <span className="text-muted-foreground"> sources</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Tag className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm">
                                            <span className="font-semibold">{categories.length}</span>
                                            <span className="text-muted-foreground"> categories</span>
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={toggleAllCategories}
                                    >
                                        {expandedCategories.size === categories.length ? "Collapse All" : "Expand All"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={addCategory}
                                    >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add Category
                                    </Button>
                                </div>
                            </div>

                            {/* AI Reasoning */}
                            {reasoning && (
                                <div className="px-8 py-3 border-b bg-primary/5">
                                    <p className="text-sm text-muted-foreground flex items-start gap-2">
                                        <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                                        <span className="italic">{reasoning}</span>
                                    </p>
                                </div>
                            )}

                            {/* Categories List */}
                            <ScrollArea className="flex-1">
                                <div className="p-8 space-y-4">
                                    <TooltipProvider>
                                        {categories.map((category, index) => (
                                            <div
                                                key={category.name}
                                                className="group rounded-xl border bg-card transition-all hover:shadow-md"
                                            >
                                                {/* Category Header */}
                                                <div
                                                    className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                                                    onClick={() => toggleCategory(category.name)}
                                                >
                                                    {/* Expand/Collapse Icon */}
                                                    <button className="shrink-0 p-1 rounded hover:bg-muted transition-colors">
                                                        {expandedCategories.has(category.name) ? (
                                                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                                        )}
                                                    </button>

                                                    {/* Category Number */}
                                                    <span className="shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm flex items-center justify-center">
                                                        {index + 1}
                                                    </span>

                                                    {/* Category Name */}
                                                    {editingCategory === category.name ? (
                                                        <Input
                                                            autoFocus
                                                            defaultValue={category.name}
                                                            className="flex-1 text-lg font-medium h-10"
                                                            onClick={(e) => e.stopPropagation()}
                                                            onBlur={(e) => updateCategoryName(category.name, e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    updateCategoryName(category.name, e.currentTarget.value);
                                                                }
                                                                if (e.key === "Escape") {
                                                                    setEditingCategory(null);
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        <h3 className="flex-1 text-lg font-medium truncate">
                                                            {category.name}
                                                        </h3>
                                                    )}

                                                    {/* Value Count Badge */}
                                                    <Badge
                                                        variant="secondary"
                                                        className="shrink-0 px-3 py-1 text-sm font-medium"
                                                    >
                                                        {category.values.length} values
                                                    </Badge>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-9 w-9"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingCategory(category.name);
                                                                    }}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Rename</TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-9 w-9 text-destructive hover:text-destructive"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        deleteCategory(category.name);
                                                                    }}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Delete</TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                </div>

                                                {/* Expanded Content */}
                                                {expandedCategories.has(category.name) && (
                                                    <div className="px-5 pb-5 pt-0 space-y-3">
                                                        {/* Description */}
                                                        {category.description && (
                                                            <p className="text-sm text-muted-foreground pl-14">
                                                                {category.description}
                                                            </p>
                                                        )}

                                                        {/* Values Grid */}
                                                        <div className="pl-14">
                                                            <div className="flex flex-wrap gap-2">
                                                                {category.values.map((value) => (
                                                                    <Badge
                                                                        key={value}
                                                                        variant="outline"
                                                                        className="px-3 py-1.5 text-sm font-normal bg-muted/50"
                                                                    >
                                                                        {value}
                                                                    </Badge>
                                                                ))}
                                                                {category.values.length === 0 && (
                                                                    <span className="text-sm text-muted-foreground italic">
                                                                        No values assigned yet
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </TooltipProvider>

                                    {/* Uncategorized Values */}
                                    {uncategorized.length > 0 && (
                                        <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
                                            <div className="flex items-center gap-3 px-5 py-4">
                                                <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/50">
                                                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-medium text-amber-800 dark:text-amber-200">
                                                        Uncategorized Values
                                                    </h3>
                                                    <p className="text-sm text-amber-600 dark:text-amber-400">
                                                        {uncategorized.length} values couldn&apos;t be automatically categorized
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="px-5 pb-5">
                                                <div className="flex flex-wrap gap-2">
                                                    {uncategorized.map((value) => (
                                                        <Badge
                                                            key={value}
                                                            variant="outline"
                                                            className="px-3 py-1.5 text-sm font-normal bg-background cursor-pointer hover:bg-muted transition-colors"
                                                        >
                                                            {value}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </>
                    )}
                </div>

                {/* Footer */}
                <DialogFooter className="px-8 py-5 border-t bg-muted/30">
                    <div className="flex items-center justify-between w-full">
                        <p className="text-sm text-muted-foreground">
                            Categories will be used to analyze your sources
                        </p>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" size="lg" onClick={handleClose}>
                                Cancel
                            </Button>
                            <Button
                                size="lg"
                                onClick={applyCategories}
                                disabled={isLoading || isApplying || categories.length === 0}
                                className="min-w-[160px]"
                            >
                                {isApplying ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Applying...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Apply {categories.length} Categories
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
