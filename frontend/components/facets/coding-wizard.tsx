"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
} from "@dnd-kit/core";
import {
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
  X,
  Save,
  FolderOpen,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DraggableValue,
  StaticValue,
  DroppableCategory,
} from "@/components/parameters/classification-schema-editor/keyword-mapping";

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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [totalValues, setTotalValues] = useState(0);
  const [totalSources, setTotalSources] = useState(0);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (open && categories.length === 0) fetchSuggestions();
  }, [open]);

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/studies/${studyId}/facets/${facetId}/coding/suggest`, {
        method: "POST",
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const data = await res.json();
      setCategories(data.categories || []);
      setUncategorized(data.uncategorized || []);
      setReasoning(data.reasoning || "");
      setTotalValues(data.total_values || 0);
      setTotalSources(data.total_sources || 0);
      if (data.categories?.length > 0) setSelectedCategoryId(data.categories[0].name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setIsLoading(false);
    }
  }, [studyId, facetId]);

  const selectedCategory = useMemo(() => {
    if (selectedCategoryId === "__uncategorized__") return null;
    return categories.find((c) => c.name === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  const filteredValues = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    const results: { value: string; category: string }[] = [];
    categories.forEach((cat) => {
      cat.values.forEach((v) => {
        if (v.toLowerCase().includes(query)) results.push({ value: v, category: cat.name });
      });
    });
    uncategorized.forEach((v) => {
      if (v.toLowerCase().includes(query))
        results.push({ value: v, category: "__uncategorized__" });
    });
    return results;
  }, [categories, uncategorized, searchQuery]);

  const startEdit = (name: string) => {
    const cat = categories.find((c) => c.name === name);
    if (cat) {
      setEditingCategory(name);
      setEditName(cat.name);
      setEditDescription(cat.description || "");
    }
  };

  const saveEdit = () => {
    if (!editingCategory || !editName.trim()) return;
    const newName = editName.trim();
    setCategories((prev) =>
      prev.map((c) =>
        c.name === editingCategory
          ? { ...c, name: newName, description: editDescription.trim() }
          : c,
      ),
    );
    if (selectedCategoryId === editingCategory) setSelectedCategoryId(newName);
    setEditingCategory(null);
  };

  const cancelEdit = () => setEditingCategory(null);

  const deleteCategory = (name: string) => {
    const cat = categories.find((c) => c.name === name);
    if (cat) {
      setUncategorized((prev) => [...prev, ...cat.values]);
      setCategories((prev) => prev.filter((c) => c.name !== name));
      if (selectedCategoryId === name) {
        setSelectedCategoryId(
          categories.length > 1 ? categories.find((c) => c.name !== name)?.name || null : null,
        );
      }
    }
  };

  const addCategory = () => {
    const name = `New Category ${categories.length + 1}`;
    setCategories((prev) => [...prev, { name, description: "", values: [], source_count: 0 }]);
    setSelectedCategoryId(name);
    startEdit(name);
  };

  const handleDragStart = (e: DragStartEvent) => {
    const id = e.active.id as string;
    setActiveValue(id.includes("::") ? id.split("::")[1] : id);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveValue(null);
    if (!over) return;

    const [src, value] = (active.id as string).includes("::")
      ? (active.id as string).split("::")
      : [null, active.id as string];
    let target = over.id as string;
    if (target.startsWith("sidebar::")) {
      target = target.replace("sidebar::", "");
    }
    if (!value || src === target) return;

    // Remove from source
    if (src === "__uncategorized__") setUncategorized((prev) => prev.filter((v) => v !== value));
    else if (src)
      setCategories((prev) =>
        prev.map((c) =>
          c.name === src ? { ...c, values: c.values.filter((v) => v !== value) } : c,
        ),
      );

    // Add to target
    if (target === "__uncategorized__") setUncategorized((prev) => [...prev, value]);
    else
      setCategories((prev) =>
        prev.map((c) => (c.name === target ? { ...c, values: [...c.values, value] } : c)),
      );
  };

  const applyCategories = async () => {
    setIsApplying(true);
    try {
      const res = await fetch(`/api/studies/${studyId}/facets/${facetId}/coding/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories: categories.map((c) => ({
            name: c.name,
            description: c.description,
            values: c.values,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setIsApplying(false);
    }
  };

  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const handleCloseWrapper = (open: boolean) => {
    if (!open) {
      // If we have categories (draft work), confirm before closing
      if (categories.length > 0) {
        setShowCloseConfirm(true);
        return;
      }
    }
    handleClose();
  };

  const handleClose = () => {
    setCategories([]);
    setUncategorized([]);
    setError(null);
    setSelectedCategoryId(null);
    setSearchQuery("");
    setShowCloseConfirm(false);
    onOpenChange(false);
  };

  const assignedCount = categories.reduce((acc, c) => acc + c.values.length, 0);
  const unmappedCount = uncategorized.length;

  return (
    <>
      <Dialog open={open} onOpenChange={handleCloseWrapper}>
        <DialogContent className="sm:max-w-none max-w-[95vw] w-[1200px] h-[85vh] flex flex-col p-0 gap-0 [&>button]:hidden">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Create Categories for &quot;{facetName}&quot;
            </DialogTitle>
            <DialogDescription>
              Drag values between categories, edit names and descriptions, then apply.
            </DialogDescription>
          </DialogHeader>

          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex-1 flex flex-col min-h-0">
              {isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                  <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                  <p className="text-lg">Analyzing your data...</p>
                  <div className="w-full max-w-md space-y-3">
                    <Skeleton className="h-14 rounded-lg" />
                    <Skeleton className="h-14 rounded-lg" />
                  </div>
                </div>
              ) : error ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                  <AlertCircle className="h-10 w-10 text-destructive" />
                  <p className="text-destructive">{error}</p>
                  <Button variant="outline" onClick={fetchSuggestions}>
                    <Loader2 className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              ) : (
                <>
                  {/* Stats Bar */}
                  <div className="px-6 py-3 border-b flex items-center gap-6 shrink-0">
                    <div className="flex items-center gap-1 text-sm">
                      <Hash className="h-4 w-4" />
                      <strong>{totalValues}</strong> values
                    </div>
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <strong>{assignedCount}</strong> assigned
                    </div>
                    {unmappedCount > 0 && (
                      <div className="flex items-center gap-1 text-sm text-amber-600">
                        <AlertCircle className="h-4 w-4" />
                        <strong>{unmappedCount}</strong> unassigned
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-sm">
                      <FileText className="h-4 w-4" />
                      <strong>{totalSources}</strong> sources
                    </div>
                  </div>

                  {/* AI Reasoning */}
                  {reasoning && (
                    <div className="px-6 py-2 border-b bg-primary/5 shrink-0">
                      <p className="text-sm text-muted-foreground flex items-start gap-2">
                        <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                        <span className="italic line-clamp-2">{reasoning}</span>
                      </p>
                    </div>
                  )}

                  {/* Two-Panel Layout */}
                  <div className="flex-1 flex min-h-0">
                    {/* Left Sidebar: Categories */}
                    <div className="w-[380px] border-r flex flex-col shrink-0">
                      <div className="px-4 py-2 bg-muted/20 border-b flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                          Categories ({categories.length})
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={addCategory}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                      {/* Search */}
                      <div className="p-2 border-b">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search values..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 h-8 text-sm"
                          />
                        </div>
                      </div>
                      <ScrollArea className="flex-1">
                        <div className="p-2 space-y-1 relative z-50">
                          {categories.map((cat) => {
                            const isSelected = selectedCategoryId === cat.name;
                            return (
                              <DroppableCategory key={cat.name} id={`sidebar::${cat.name}`}>
                                <button
                                  onClick={() => {
                                    setSelectedCategoryId(cat.name);
                                    setSearchQuery("");
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm relative z-50",
                                    isSelected
                                      ? "bg-primary text-primary-foreground"
                                      : "hover:bg-muted",
                                  )}
                                >
                                  <FolderOpen className="h-4 w-4 shrink-0 opacity-70" />
                                  <span className="flex-1 text-left break-words">{cat.name}</span>
                                  <Badge
                                    variant={isSelected ? "secondary" : "outline"}
                                    className="text-xs"
                                  >
                                    {cat.values.length}
                                  </Badge>
                                </button>
                              </DroppableCategory>
                            );
                          })}
                          {uncategorized.length > 0 && (
                            <>
                              <div className="h-px bg-border my-2" />
                              <DroppableCategory id="sidebar::__uncategorized__">
                                <button
                                  onClick={() => {
                                    setSelectedCategoryId("__uncategorized__");
                                    setSearchQuery("");
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm relative z-50",
                                    selectedCategoryId === "__uncategorized__"
                                      ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30"
                                      : "hover:bg-amber-50 text-amber-700 dark:hover:bg-amber-900/20",
                                  )}
                                >
                                  <AlertCircle className="h-4 w-4 shrink-0" />
                                  <span className="flex-1">Unassigned</span>
                                  <Badge variant="outline" className="text-xs border-amber-300">
                                    {uncategorized.length}
                                  </Badge>
                                </button>
                              </DroppableCategory>
                            </>
                          )}
                        </div>
                      </ScrollArea>
                    </div>

                    {/* Right Panel: Category Details */}
                    <div className="flex-1 flex flex-col min-w-0">
                      {searchQuery && filteredValues ? (
                        // Search Results
                        <div className="flex-1 flex flex-col min-h-0">
                          <div className="px-4 py-2 bg-muted/20 border-b flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">
                              Search Results ({filteredValues.length})
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => setSearchQuery("")}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Clear
                            </Button>
                          </div>
                          <ScrollArea className="flex-1 p-4">
                            {filteredValues.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                No values found matching &quot;{searchQuery}&quot;
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {filteredValues.map(({ value, category }, i) => (
                                  <div
                                    key={`${category}::${value}::${i}`}
                                    className="flex items-center gap-2"
                                  >
                                    <DraggableValue value={value} categoryId={category} index={i} />
                                    <span className="text-xs text-muted-foreground">
                                      in{" "}
                                      {category === "__uncategorized__" ? "Unassigned" : category}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </div>
                      ) : selectedCategoryId === "__uncategorized__" ? (
                        // Uncategorized Values
                        <div className="flex-1 flex flex-col min-h-0">
                          <div className="px-4 py-3 border-b flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-600" />
                            <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200">
                              Unassigned Values
                            </h2>
                          </div>
                          <p className="px-4 py-2 text-sm text-muted-foreground border-b">
                            Drag these values to categories in the sidebar to assign them.
                          </p>
                          <ScrollArea className="flex-1">
                            <DroppableCategory id="__uncategorized__" className="p-4 min-h-[200px]">
                              <div className="flex flex-wrap gap-2">
                                {uncategorized.map((v, i) => (
                                  <DraggableValue
                                    key={`${v}-${i}`}
                                    value={v}
                                    categoryId="__uncategorized__"
                                    index={i}
                                  />
                                ))}
                              </div>
                            </DroppableCategory>
                          </ScrollArea>
                        </div>
                      ) : selectedCategory ? (
                        // Category Detail View
                        <div className="flex-1 flex flex-col min-h-0">
                          <div className="px-4 py-3 border-b flex items-center justify-between gap-4">
                            {editingCategory === selectedCategory.name ? (
                              <div className="flex-1 space-y-2">
                                <Input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  placeholder="Category name"
                                  className="text-lg font-semibold"
                                />
                                <Textarea
                                  value={editDescription}
                                  onChange={(e) => setEditDescription(e.target.value)}
                                  placeholder="Description (helps AI understand what belongs here)"
                                  rows={2}
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={saveEdit}>
                                    <Save className="h-4 w-4 mr-1" />
                                    Save
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                    <X className="h-4 w-4 mr-1" />
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex-1 min-w-0">
                                  <h2 className="text-lg font-semibold truncate">
                                    {selectedCategory.name}
                                  </h2>
                                  {selectedCategory.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                      {selectedCategory.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => startEdit(selectedCategory.name)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => deleteCategory(selectedCategory.name)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                          <div className="px-4 py-2 border-b bg-muted/20 text-sm text-muted-foreground">
                            Values ({selectedCategory.values.length})
                          </div>
                          <ScrollArea className="flex-1">
                            <DroppableCategory
                              id={selectedCategory.name}
                              className="p-4 min-h-[200px]"
                            >
                              {selectedCategory.values.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                  <p>No values assigned yet</p>
                                  <p className="text-sm mt-1">
                                    Drag values here from other categories or Unassigned
                                  </p>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {selectedCategory.values.map((v, i) => (
                                    <DraggableValue
                                      key={`${v}-${i}`}
                                      value={v}
                                      categoryId={selectedCategory.name}
                                      index={i}
                                    />
                                  ))}
                                </div>
                              )}
                            </DroppableCategory>
                          </ScrollArea>
                        </div>
                      ) : (
                        // No Selection
                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>Select a category from the sidebar</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Portal DragOverlay to body */}
            {typeof window !== "undefined" &&
              createPortal(
                <DragOverlay>{activeValue && <StaticValue value={activeValue} />}</DragOverlay>,
                document.body,
              )}
          </DndContext>

          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-muted-foreground">
                Categories will be used to classify your sources
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleCloseWrapper(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={applyCategories}
                  disabled={isLoading || isApplying || categories.length === 0}
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

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Unsaved Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have started coding categories. If you close now, your progress will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClose}
              className="bg-destructive hover:bg-destructive/90"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
