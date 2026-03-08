"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudyLayout } from "@/components/layout/study-layout";
import { Plus, Pencil, Trash2, CheckCircle2, Zap, Download } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useSourcesPage } from "@/hooks/use-sources-page";
import { SourceList } from "@/components/source/source-list";
import {
  DeleteSourceDialog,
  BulkDeleteSourceDialog,
} from "@/components/source/delete-source-dialogs";
import { BatchProgressModal } from "@/components/source/batch-progress-modal";
import { toast } from "sonner";

export default function SourcesPage() {
  const queryClient = useQueryClient();
  const {
    studyId,
    study,
    isLoading,
    error,
    tab,
    filteredSources,
    counts,
    batchIdParam,
    isEditMode,
    setIsEditMode,
    selectedIds,
    toggleSelection,
    toggleSelectAll,
    deleteTarget,
    setDeleteTarget,
    deleteMutation,
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    bulkDeleteMutation,
    handleTabChange,
    handleReparse,
    applySuggestions,
    suggestions,
    loadingMap,
    sourceRefs,
  } = useSourcesPage();

  const [batchModalState, setBatchModalState] = useState<{
    isOpen: boolean;
    type: "analyze" | "classify" | null;
  }>({ isOpen: false, type: null });

  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async (format: "bibtex" | "ris", filter: "included" | "all") => {
    try {
      setIsExporting(true);
      const response = await fetch(
        `/api/studies/${studyId}/sources/export?format=${format}&filter=${filter}`,
      );

      if (!response.ok) {
        const error = await response.json();
        toast.error("Export failed", {
          description: error.error || "Failed to export sources",
        });
        return;
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get("content-disposition");
      let filename = `sources-${filter}.${format === "bibtex" ? "bib" : "ris"}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Export successful", {
        description: `${format.toUpperCase()} file downloaded successfully`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed", {
        description: error instanceof Error ? error.message : "An error occurred during export",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getSourceUrl = (sourceId: string) => {
    const params = new URLSearchParams();
    if (tab !== "all") {
      params.set("filter", tab);
    }
    params.set("sourceId", sourceId);
    return `/studies/${studyId}/sources/${sourceId}?${params.toString()}`;
  };

  if (isLoading) {
    return (
      <StudyLayout studyId={studyId} studyTitle="Loading...">
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading sources...</p>
        </div>
      </StudyLayout>
    );
  }

  if (error || !study) {
    return (
      <StudyLayout>
        <div className="container mx-auto px-4 py-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Study not found</h2>
          <Button asChild>
            <Link href="/studies">Back to Studies</Link>
          </Button>
        </div>
      </StudyLayout>
    );
  }

  const isAllSelected = filteredSources.length > 0 && selectedIds.size === filteredSources.length;

  return (
    <StudyLayout studyId={studyId} studyTitle={study.title} studyStatus={study.status}>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Sources</h1>
          <div className="flex gap-2">
            {isEditMode ? (
              <>
                {selectedIds.size > 0 && (
                  <Button variant="destructive" onClick={() => setShowBulkDeleteConfirm(true)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedIds.size})
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditMode(false);
                    toggleSelectAll(false);
                  }}
                >
                  Done
                </Button>
              </>
            ) : (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Zap className="h-4 w-4 mr-2" />
                      Batch Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        setBatchModalState({
                          isOpen: true,
                          type: "analyze",
                        })
                      }
                      disabled={counts.pending === 0}
                    >
                      <span>Screen All Pending ({counts.pending})</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        setBatchModalState({
                          isOpen: true,
                          type: "classify",
                        })
                      }
                      disabled={counts.included === 0}
                    >
                      <span>Classify All Included ({counts.included})</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Export Bibliography</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleExport("bibtex", "included")}
                      disabled={isExporting || counts.included === 0}
                    >
                      BibTeX (Included Sources)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleExport("bibtex", "all")}
                      disabled={isExporting || counts.all === 0}
                    >
                      BibTeX (All Sources)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleExport("ris", "included")}
                      disabled={isExporting || counts.included === 0}
                    >
                      RIS (Included Sources)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleExport("ris", "all")}
                      disabled={isExporting || counts.all === 0}
                    >
                      RIS (All Sources)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" onClick={() => setIsEditMode(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Sources
                </Button>
                <Button asChild>
                  <Link href={`/studies/${studyId}/sources/add`}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Source
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sources</CardTitle>
            <CardDescription>Research sources for this study</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={handleTabChange}>
              <div className="flex justify-between items-center mb-4">
                <TabsList className="flex flex-wrap h-auto gap-1">
                  <TabsTrigger value="all" className="data-[state=active]:bg-background">
                    All <span className="ml-1 font-semibold">({counts.all})</span>
                  </TabsTrigger>
                  {batchIdParam && counts.new_import > 0 && (
                    <TabsTrigger
                      value="new_import"
                      className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-950 dark:data-[state=active]:text-blue-300"
                    >
                      New Import <span className="ml-1 font-semibold">({counts.new_import})</span>
                    </TabsTrigger>
                  )}
                  <TabsTrigger
                    value="needs_pdf"
                    className={`data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 dark:data-[state=active]:bg-orange-950 dark:data-[state=active]:text-orange-300 ${counts.needs_pdf > 0 ? "text-orange-600 dark:text-orange-400" : ""}`}
                  >
                    Needs PDF <span className="ml-1 font-semibold">({counts.needs_pdf})</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="pending"
                    className={`data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-950 dark:data-[state=active]:text-blue-300 ${counts.pending > 0 ? "text-blue-600 dark:text-blue-400" : ""}`}
                  >
                    Pending <span className="ml-1 font-semibold">({counts.pending})</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="analyzing"
                    className={`data-[state=active]:bg-yellow-50 data-[state=active]:text-yellow-700 dark:data-[state=active]:bg-yellow-950 dark:data-[state=active]:text-yellow-300 ${counts.analyzing > 0 ? "text-yellow-600 dark:text-yellow-400" : ""}`}
                  >
                    Analyzing <span className="ml-1 font-semibold">({counts.analyzing})</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="included"
                    className={`data-[state=active]:bg-green-50 data-[state=active]:text-green-700 dark:data-[state=active]:bg-green-950 dark:data-[state=active]:text-green-300 ${counts.included > 0 ? "text-green-600 dark:text-green-400" : ""}`}
                  >
                    Included <span className="ml-1 font-semibold">({counts.included})</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="excluded"
                    className="data-[state=active]:bg-background text-muted-foreground"
                  >
                    Excluded <span className="ml-1 font-semibold">({counts.excluded})</span>
                  </TabsTrigger>
                </TabsList>

                {isEditMode && filteredSources.length > 0 && (
                  <div className="flex items-center gap-2 px-3 animate-in fade-in duration-300">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                      id="select-all"
                    />
                    <label
                      htmlFor="select-all"
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      Select All
                    </label>
                  </div>
                )}
              </div>

              {/* Import Review Mode Banner */}
              {tab === "new_import" && batchIdParam && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg flex items-center justify-between border border-blue-100 dark:border-blue-900">
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Import Successful
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Reviewing {counts.new_import} new sources from recent import.
                    </p>
                  </div>
                  <Button onClick={() => handleTabChange("all")} variant="default" size="sm">
                    Done Reviewing
                  </Button>
                </div>
              )}

              {[
                `all`,
                `new_import`,
                `needs_pdf`,
                `pending`,
                `analyzing`,
                `included`,
                `excluded`,
              ].map((tabValue) => (
                <TabsContent key={tabValue} value={tabValue}>
                  <SourceList
                    sources={filteredSources}
                    tab={tabValue}
                    isEditMode={isEditMode}
                    selectedIds={selectedIds}
                    onToggleSelection={toggleSelection}
                    onDelete={setDeleteTarget}
                    suggestions={suggestions}
                    loadingMap={loadingMap}
                    onReparse={handleReparse}
                    onApplySuggestions={applySuggestions}
                    sourceRefs={sourceRefs}
                    getSourceUrl={getSourceUrl}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <DeleteSourceDialog
        target={deleteTarget}
        isOpen={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
      />

      <BulkDeleteSourceDialog
        count={selectedIds.size}
        isOpen={showBulkDeleteConfirm}
        onOpenChange={(open) => !open && setShowBulkDeleteConfirm(false)}
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
        isPending={bulkDeleteMutation.isPending}
      />

      <BatchProgressModal
        isOpen={batchModalState.isOpen}
        onOpenChange={(open) =>
          setBatchModalState({
            isOpen: open,
            type: open ? batchModalState.type : null,
          })
        }
        title={
          batchModalState.type === "analyze" ? "Screening Sources..." : "Classifying Sources..."
        }
        apiUrl={
          batchModalState.type === "analyze"
            ? `/api/studies/${studyId}/sources/batch-analyze`
            : `/api/studies/${studyId}/sources/batch-classify`
        }
        onComplete={() => {
          setBatchModalState({ isOpen: false, type: null });
          queryClient.invalidateQueries({ queryKey: ["study", studyId] });
        }}
      />
    </StudyLayout>
  );
}
