"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
} from "@dnd-kit/core";
import {
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Pencil,
  FolderOpen,
  AlertCircle,
  Save,
  X,
  AlertTriangle,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { DraggableKeyword, StaticKeyword, KeywordMapping } from "./draggable-keyword";

interface CategoryData {
  id: string;
  name: string;
  description?: string | null;
}

interface KeywordMappingOverviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studyId: string;
  facetId: string;
  facetName: string;
  categories: CategoryData[];
  onCategoriesChange?: () => void;
}

function CategoryDropZone({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "transition-all duration-150",
        isOver && "ring-2 ring-primary bg-primary/5 rounded-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}

// Portal wrapper for DragOverlay to avoid coordinate issues with transformed parents
function PortaledDragOverlay({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

export function KeywordMappingOverview({
  open,
  onOpenChange,
  studyId,
  facetId,
  facetName,
  categories: initialCategories,
  onCategoriesChange,
}: KeywordMappingOverviewProps) {
  const [mappings, setMappings] = useState<KeywordMapping[]>([]);
  const [initialMappings, setInitialMappings] = useState<KeywordMapping[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>(initialCategories);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<string, string | null>>(new Map());

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/studies/${studyId}/facets/${facetId}/coding/mappings`);
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          const fetchedMappings = data.data || [];
          setMappings(fetchedMappings);
          setInitialMappings(fetchedMappings);
          setPendingChanges(new Map());
          if (!selectedCategoryId && initialCategories.length > 0) {
            setSelectedCategoryId(initialCategories[0]?.id || null);
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, studyId, facetId, initialCategories, selectedCategoryId]);

  const filteredMappings = useMemo(() => {
    if (!searchQuery) return mappings;
    return mappings.filter((m) => m.keyword.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [mappings, searchQuery]);

  const categoryMappings = useMemo(() => {
    const map = new Map<string, KeywordMapping[]>();
    categories.forEach((c) => map.set(c.id, []));
    map.set("__unmapped__", []);
    filteredMappings.forEach((m) => {
      if (m.categoryId && map.has(m.categoryId)) map.get(m.categoryId)!.push(m);
      else if (!m.categoryId) map.get("__unmapped__")!.push(m);
    });
    return map;
  }, [filteredMappings, categories]);

  const stats = useMemo(
    () => ({
      total: mappings.length,
      approved: mappings.filter((m) => m.status === "APPROVED").length,
      pending: mappings.filter((m) => m.status === "PENDING").length,
      rejected: mappings.filter((m) => m.status === "REJECTED").length,
      mapped: mappings.filter((m) => m.categoryId).length,
    }),
    [mappings],
  );

  const selectedCategory = useMemo(() => {
    if (selectedCategoryId === "__unmapped__")
      return { id: "__unmapped__", name: "Unmapped Keywords", description: null };
    return categories.find((c) => c.id === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  const selectedMappings = useMemo(
    () => categoryMappings.get(selectedCategoryId || "") || [],
    [categoryMappings, selectedCategoryId],
  );

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => pendingChanges.size > 0, [pendingChanges]);

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const mappingId = active.id as string;
    let targetCategoryId = over.id as string;
    if (targetCategoryId.startsWith("sidebar::")) {
      targetCategoryId = targetCategoryId.replace("sidebar::", "");
    }
    const mapping = mappings.find((m) => m.id === mappingId);
    if (!mapping) return;

    const currentCat = mapping.categoryId || "__unmapped__";
    if (currentCat === targetCategoryId) return;

    const newCategoryId = targetCategoryId === "__unmapped__" ? null : targetCategoryId;

    // Update local state
    setMappings((prev) =>
      prev.map((m) => (m.id === mappingId ? { ...m, categoryId: newCategoryId } : m)),
    );

    // Track pending change (don't save immediately)
    setPendingChanges((prev) => {
      const next = new Map(prev);
      // Compare with initial state to see if this is actually a change
      const initialMapping = initialMappings.find((m) => m.id === mappingId);
      const initialCategoryId = initialMapping?.categoryId || null;
      if (newCategoryId === initialCategoryId) {
        // Reverted to original - remove from pending
        next.delete(mappingId);
      } else {
        next.set(mappingId, newCategoryId);
      }
      return next;
    });
  };

  // Save all pending changes
  const handleSaveChanges = async () => {
    if (pendingChanges.size === 0) return;
    setSaving(true);
    try {
      const changes = Array.from(pendingChanges.entries());
      for (const [mappingId, categoryId] of changes) {
        await fetch(`/api/studies/${studyId}/facets/${facetId}/coding/mappings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reassign", mappingId, categoryId }),
        });
      }
      // Clear pending changes and update initial state
      setPendingChanges(new Map());
      setInitialMappings([...mappings]);
      onCategoriesChange?.();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  // Handle close with unsaved changes check
  const handleCloseRequest = (shouldClose: boolean) => {
    if (!shouldClose) {
      onOpenChange(false);
      return;
    }
    if (hasUnsavedChanges) {
      setShowCloseConfirm(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleDiscardChanges = () => {
    // Revert to initial state
    setMappings([...initialMappings]);
    setPendingChanges(new Map());
    setShowCloseConfirm(false);
    onOpenChange(false);
  };

  const startEdit = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (cat) {
      setEditingCategory(id);
      setEditName(cat.name);
      setEditDescription(cat.description || "");
    }
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setEditName("");
    setEditDescription("");
  };

  const saveCategory = async () => {
    if (!editingCategory || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/studies/${studyId}/facets/${facetId}/category/${editingCategory}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName.trim(),
            description: editDescription.trim() || null,
          }),
        },
      );
      if (res.ok) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === editingCategory
              ? { ...c, name: editName.trim(), description: editDescription.trim() || null }
              : c,
          ),
        );
        cancelEdit();
        onCategoriesChange?.();
      }
    } finally {
      setSaving(false);
    }
  };

  const activeMapping = activeId ? mappings.find((m) => m.id === activeId) : null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleCloseRequest}>
        <DialogContent
          className="sm:max-w-none w-[90vw] max-w-[1200px] h-[85vh] flex flex-col p-0 gap-0"
          showCloseButton={false}
          onEscapeKeyDown={(e) => {
            if (hasUnsavedChanges) {
              e.preventDefault();
              setShowCloseConfirm(true);
            }
          }}
          onPointerDownOutside={(e) => {
            if (hasUnsavedChanges) {
              e.preventDefault();
              setShowCloseConfirm(true);
            }
          }}
        >
          {" "}
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  Keyword Mapping Overview
                  {hasUnsavedChanges && (
                    <span className="inline-flex items-center gap-1 text-amber-600 text-sm font-normal">
                      <AlertTriangle className="h-4 w-4" />
                      Unsaved changes ({pendingChanges.size})
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription>
                  Manage keyword-to-category mappings for &quot;{facetName}&quot;. Drag keywords
                  between categories.
                </DialogDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleCloseRequest(true)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          {/* Stats */}
          <div className="flex items-center gap-6 px-6 py-3 border-b bg-muted/30 text-sm shrink-0">
            <span>
              Total: <Badge variant="secondary">{stats.total}</Badge>
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {stats.approved}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-amber-500" />
              {stats.pending}
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-red-500" />
              {stats.rejected}
            </span>
            <span className="ml-auto text-muted-foreground">
              {stats.mapped} mapped / {stats.total - stats.mapped} unmapped
            </span>
          </div>
          {/* Search */}
          <div className="px-6 py-3 border-b shrink-0">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex-1 flex min-h-0">
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Left: Categories */}
                  <div className="w-[380px] border-r flex flex-col shrink-0">
                    <div className="px-4 py-2 bg-muted/20 border-b text-sm font-medium text-muted-foreground">
                      Categories ({categories.length})
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="p-2 space-y-1">
                        {categories.map((cat) => {
                          const count = categoryMappings.get(cat.id)?.length || 0;
                          const isSelected = selectedCategoryId === cat.id;
                          return (
                            <CategoryDropZone key={cat.id} id={`sidebar::${cat.id}`}>
                              <button
                                onClick={() => setSelectedCategoryId(cat.id)}
                                className={cn(
                                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm",
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
                                  {count}
                                </Badge>
                              </button>
                            </CategoryDropZone>
                          );
                        })}
                        {(categoryMappings.get("__unmapped__")?.length || 0) > 0 && (
                          <>
                            <div className="h-px bg-border my-2" />
                            <CategoryDropZone id="sidebar::__unmapped__">
                              <button
                                onClick={() => setSelectedCategoryId("__unmapped__")}
                                className={cn(
                                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm",
                                  selectedCategoryId === "__unmapped__"
                                    ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30"
                                    : "hover:bg-amber-50 text-amber-700 dark:hover:bg-amber-900/20",
                                )}
                              >
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span className="flex-1">Unmapped</span>
                                <Badge variant="outline" className="text-xs border-amber-300">
                                  {categoryMappings.get("__unmapped__")?.length}
                                </Badge>
                              </button>
                            </CategoryDropZone>
                          </>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Right: Category Details */}
                  <div className="flex-1 flex flex-col min-w-0">
                    {selectedCategory ? (
                      <>
                        <div className="px-6 py-4 border-b bg-muted/20 shrink-0">
                          {editingCategory === selectedCategoryId &&
                          selectedCategoryId !== "__unmapped__" ? (
                            <div className="space-y-3">
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="Category name"
                              />
                              <Textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                placeholder="Description (optional)"
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={saveCategory} disabled={saving}>
                                  {saving ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                  ) : (
                                    <Save className="h-4 w-4 mr-1" />
                                  )}
                                  Save
                                </Button>
                                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                  <X className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h3 className="font-semibold">{selectedCategory.name}</h3>
                                {selectedCategory.description && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {selectedCategory.description}
                                  </p>
                                )}
                              </div>
                              {selectedCategoryId !== "__unmapped__" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startEdit(selectedCategoryId!)}
                                >
                                  <Pencil className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                              )}
                            </div>
                          )}
                        </div>

                        <CategoryDropZone
                          id={selectedCategoryId!}
                          className="flex-1 overflow-hidden"
                        >
                          <ScrollArea className="h-full">
                            <div className="p-6">
                              <div className="text-sm font-medium text-muted-foreground mb-4">
                                Keywords ({selectedMappings.length})
                              </div>
                              {selectedMappings.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                  <p>No keywords in this category</p>
                                  <p className="text-sm mt-1">
                                    Drag keywords here from other categories
                                  </p>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {selectedMappings.map((m) => (
                                    <DraggableKeyword key={m.id} mapping={m} />
                                  ))}
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </CategoryDropZone>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        Select a category
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Portal DragOverlay to body to avoid transform offset issues */}
            <PortaledDragOverlay>
              <DragOverlay>
                {activeMapping && (
                  <StaticKeyword
                    keyword={activeMapping.keyword}
                    status={activeMapping.status}
                    confidence={activeMapping.confidence}
                  />
                )}
              </DragOverlay>
            </PortaledDragOverlay>
          </DndContext>
          <div className="px-6 py-4 border-t flex items-center justify-between shrink-0">
            <div className="text-sm text-muted-foreground">
              {hasUnsavedChanges && (
                <span className="text-amber-600 font-medium">
                  {pendingChanges.size} unsaved change{pendingChanges.size !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleCloseRequest(true)}>
                {hasUnsavedChanges ? "Discard & Close" : "Close"}
              </Button>
              {hasUnsavedChanges && (
                <Button onClick={handleSaveChanges} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Confirmation Dialog */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have {pendingChanges.size} unsaved change{pendingChanges.size !== 1 ? "s" : ""}.
              Do you want to save your changes before closing?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardChanges}>Discard Changes</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await handleSaveChanges();
                onOpenChange(false);
              }}
            >
              Save & Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
