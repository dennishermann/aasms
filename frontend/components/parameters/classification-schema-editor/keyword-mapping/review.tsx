"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Sparkles,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KeywordMapping {
  id: string;
  keyword: string;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  status: string;
  confidence?: number | null;
  proposedCategoryName?: string | null;
  proposedCategoryDescription?: string | null;
}

interface CategoryData {
  id: string;
  name: string;
  description?: string | null;
}

interface KeywordMappingReviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studyId: string;
  facetId: string;
  facetName: string;
  categories: CategoryData[];
  onApproved?: () => void;
}

export function KeywordMappingReview({
  open,
  onOpenChange,
  studyId,
  facetId,
  facetName,
  categories,
  onApproved,
}: KeywordMappingReviewProps) {
  const [mappings, setMappings] = useState<KeywordMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({});
  const [batchAction, setBatchAction] = useState<"approve" | "reject" | null>(null);
  const [showAddCategory, setShowAddCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    const fetchMappings = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/studies/${studyId}/facets/${facetId}/coding/mappings?status=PENDING`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          setMappings(data.data || []);
          setSelectedIds(new Set());
          setCategoryOverrides({});
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchMappings();
    return () => {
      active = false;
    };
  }, [open, studyId, facetId]);

  const highConfidenceMappings = useMemo(() => {
    return mappings.filter((m) => (m.confidence ?? 0) >= 0.7 && (m.categoryId || m.proposedCategoryName));
  }, [mappings]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === mappings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(mappings.map((m) => m.id)));
    }
  };

  const getCategoryForMapping = (mapping: KeywordMapping): string | null => {
    // Check if user overrode the category
    const override = categoryOverrides[mapping.id];
    if (override) {
      // Custom category - will be created on approval
      if (override.startsWith("__custom__:")) {
        return null;
      }
      return override;
    }
    // Use existing category or find by proposed name
    if (mapping.categoryId) {
      return mapping.categoryId;
    }
    if (mapping.proposedCategoryName) {
      const existing = categories.find(
        (c) => c.name.toLowerCase() === mapping.proposedCategoryName?.toLowerCase()
      );
      return existing?.id || null;
    }
    return null;
  };

  const getCustomCategoryName = (mappingId: string): string | null => {
    const override = categoryOverrides[mappingId];
    if (override?.startsWith("__custom__:")) {
      return override.slice("__custom__:".length);
    }
    return null;
  };

  const handleApprove = async (mapping: KeywordMapping) => {
    setSubmitting((prev) => new Set([...prev, mapping.id]));
    try {
      const categoryId = getCategoryForMapping(mapping);
      const customCategoryName = getCustomCategoryName(mapping.id);
      const body: Record<string, unknown> = { mappingId: mapping.id, action: "approve" };

      if (categoryId) {
        body.categoryId = categoryId;
      } else if (customCategoryName) {
        // User created a custom category
        body.createCategory = true;
        body.categoryName = customCategoryName;
      } else if (mapping.proposedCategoryName) {
        body.createCategory = true;
        body.categoryName = mapping.proposedCategoryName;
        body.categoryDescription = mapping.proposedCategoryDescription;
      }

      const res = await fetch(
        `/api/studies/${studyId}/facets/${facetId}/coding/mappings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (res.ok) {
        setMappings((prev) => prev.filter((m) => m.id !== mapping.id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(mapping.id);
          return next;
        });
        onApproved?.();
      }
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete(mapping.id);
        return next;
      });
    }
  };

  const handleReject = async (mapping: KeywordMapping) => {
    setSubmitting((prev) => new Set([...prev, mapping.id]));
    try {
      const res = await fetch(
        `/api/studies/${studyId}/facets/${facetId}/coding/mappings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mappingId: mapping.id, action: "reject" }),
        }
      );
      if (res.ok) {
        setMappings((prev) => prev.filter((m) => m.id !== mapping.id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(mapping.id);
          return next;
        });
      }
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete(mapping.id);
        return next;
      });
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) return;
    setBatchAction("approve");

    const idsToApprove = Array.from(selectedIds);

    try {
      const res = await fetch(
        `/api/studies/${studyId}/facets/${facetId}/coding/mappings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "batch-approve",
            mappingIds: idsToApprove,
          }),
        }
      );

      if (res.ok) {
        setMappings((prev) => prev.filter((m) => !selectedIds.has(m.id)));
        setSelectedIds(new Set());
        onApproved?.();
      }
    } finally {
      setBatchAction(null);
    }
  };

  const handleBatchReject = async () => {
    if (selectedIds.size === 0) return;
    setBatchAction("reject");

    try {
      const res = await fetch(
        `/api/studies/${studyId}/facets/${facetId}/coding/mappings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "batch-reject",
            mappingIds: Array.from(selectedIds),
          }),
        }
      );

      if (res.ok) {
        setMappings((prev) => prev.filter((m) => !selectedIds.has(m.id)));
        setSelectedIds(new Set());
      }
    } finally {
      setBatchAction(null);
    }
  };

  const handleApproveAllHighConfidence = async () => {
    if (highConfidenceMappings.length === 0) return;
    setBatchAction("approve");

    try {
      // For high confidence, we need to approve individually to handle category creation
      for (const mapping of highConfidenceMappings) {
        await handleApprove(mapping);
      }
    } finally {
      setBatchAction(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-none max-w-[95vw] w-[1000px] h-[80vh] flex flex-col p-0 gap-0 [&>button]:hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            Review Pending Mappings
            <Badge variant="secondary">{mappings.length}</Badge>
          </DialogTitle>
          <DialogDescription>
            Review AI-suggested keyword mappings for "{facetName}". Approve, reject, or reassign to different categories.
          </DialogDescription>
        </DialogHeader>

        {/* Action Bar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b bg-muted/30">
          {highConfidenceMappings.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleApproveAllHighConfidence}
              disabled={!!batchAction || loading}
              className="border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              Approve All High-Confidence ({highConfidenceMappings.length})
            </Button>
          )}
          <div className="flex-1" />
          {selectedIds.size > 0 && (
            <>
              <Button
                size="sm"
                onClick={handleBatchApprove}
                disabled={!!batchAction}
              >
                {batchAction === "approve" ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                )}
                Approve ({selectedIds.size})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBatchReject}
                disabled={!!batchAction}
              >
                {batchAction === "reject" ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-1.5" />
                )}
                Reject ({selectedIds.size})
              </Button>
            </>
          )}
        </div>

        {/* Table Content */}
        <ScrollArea className="flex-1">
          <div className="min-w-full">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : mappings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mb-4 text-green-500" />
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-sm">No pending mappings to review.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="border-b bg-muted/50 sticky top-0">
                  <tr>
                    <th className="w-10 px-6 py-3">
                      <Checkbox
                        checked={selectedIds.size === mappings.length && mappings.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                    <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                      Keyword
                    </th>
                    <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3 w-64">
                      Suggested Category
                    </th>
                    <th className="text-center text-sm font-medium text-muted-foreground px-4 py-3 w-20">
                      Conf.
                    </th>
                    <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3 w-32">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((mapping) => {
                    const isSelected = selectedIds.has(mapping.id);
                    const isSubmitting = submitting.has(mapping.id);
                    const suggestedCategory = mapping.category?.name || mapping.proposedCategoryName;
                    const isNewCategory = !mapping.categoryId && !!mapping.proposedCategoryName;
                    const overriddenCategoryId = categoryOverrides[mapping.id];
                    const customCategoryName = overriddenCategoryId?.startsWith("__custom__:")
                      ? overriddenCategoryId.slice("__custom__:".length)
                      : null;
                    const overriddenCategory = overriddenCategoryId && !customCategoryName
                      ? categories.find((c) => c.id === overriddenCategoryId)
                      : null;

                    return (
                      <tr
                        key={mapping.id}
                        className={cn(
                          "border-b transition-colors",
                          isSelected && "bg-primary/5",
                          "hover:bg-muted/50"
                        )}
                      >
                        <td className="px-6 py-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelection(mapping.id)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium">{mapping.keyword}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={customCategoryName ? "__create__" : (overriddenCategoryId || mapping.categoryId || "__new__")}
                            onValueChange={(value) => {
                              if (value === "__new__") {
                                setCategoryOverrides((prev) => {
                                  const next = { ...prev };
                                  delete next[mapping.id];
                                  return next;
                                });
                                setShowAddCategory(null);
                              } else if (value === "__create__") {
                                setShowAddCategory(mapping.id);
                              } else {
                                setCategoryOverrides((prev) => ({
                                  ...prev,
                                  [mapping.id]: value,
                                }));
                                setShowAddCategory(null);
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue>
                                {customCategoryName ? (
                                  <span className="flex items-center gap-1.5">
                                    {customCategoryName}
                                    <Badge variant="secondary" className="text-[10px] px-1.5">
                                      New
                                    </Badge>
                                  </span>
                                ) : overriddenCategory ? (
                                  <span>{overriddenCategory.name}</span>
                                ) : suggestedCategory ? (
                                  <span className="flex items-center gap-1.5">
                                    {suggestedCategory}
                                    {isNewCategory && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5">
                                        New
                                      </Badge>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Select category</span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {suggestedCategory && isNewCategory && (
                                <SelectItem value="__new__">
                                  <span className="flex items-center gap-1.5">
                                    {suggestedCategory}
                                    <Badge variant="secondary" className="text-[10px] px-1.5">
                                      New
                                    </Badge>
                                  </span>
                                </SelectItem>
                              )}
                              {categories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                              <SelectItem value="__create__">
                                <span className="flex items-center gap-1.5 text-primary">
                                  <Plus className="h-3.5 w-3.5" />
                                  Create new category
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {/* Create new category inline form */}
                          {showAddCategory === mapping.id && (
                            <div className="flex gap-2 mt-2">
                              <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="New category name"
                                className="flex-1 h-8 px-2 text-sm border rounded"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && newCategoryName.trim()) {
                                    setCategoryOverrides((prev) => ({
                                      ...prev,
                                      [mapping.id]: `__custom__:${newCategoryName.trim()}`,
                                    }));
                                    setShowAddCategory(null);
                                    setNewCategoryName("");
                                  } else if (e.key === "Escape") {
                                    setShowAddCategory(null);
                                    setNewCategoryName("");
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                className="h-8"
                                disabled={!newCategoryName.trim()}
                                onClick={() => {
                                  if (newCategoryName.trim()) {
                                    setCategoryOverrides((prev) => ({
                                      ...prev,
                                      [mapping.id]: `__custom__:${newCategoryName.trim()}`,
                                    }));
                                    setShowAddCategory(null);
                                    setNewCategoryName("");
                                  }
                                }}
                              >
                                Create
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8"
                                onClick={() => {
                                  setShowAddCategory(null);
                                  setNewCategoryName("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {mapping.confidence != null ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs font-mono",
                                mapping.confidence >= 0.7
                                  ? "border-green-200 bg-green-50 text-green-700"
                                  : mapping.confidence >= 0.4
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : "border-red-200 bg-red-50 text-red-700"
                              )}
                            >
                              {Math.round(mapping.confidence * 100)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleApprove(mapping)}
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Approve
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => handleReject(mapping)}
                              disabled={isSubmitting}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
