"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudyLayout } from "@/components/layout/study-layout";
import { Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useSourcesPage } from "@/hooks/use-sources-page";
import { SourceList } from "@/components/source/source-list";
import { DeleteSourceDialog, BulkDeleteSourceDialog } from "@/components/source/delete-source-dialogs";

export default function SourcesPage() {
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
    <StudyLayout
      studyId={studyId}
      studyTitle={study.title}
      studyStatus={study.status}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Sources</h1>
          <div className="flex gap-2">
            {isEditMode ? (
              <>
                {selectedIds.size > 0 && (
                  <Button
                    variant="destructive"
                    onClick={() => setShowBulkDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedIds.size})
                  </Button>
                )}
                <Button variant="outline" onClick={() => {
                  setIsEditMode(false);
                  toggleSelectAll(false);
                }}>
                  Done
                </Button>
              </>
            ) : (
              <>
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
                    <TabsTrigger value="new_import" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-950 dark:data-[state=active]:text-blue-300">
                      New Import <span className="ml-1 font-semibold">({counts.new_import})</span>
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="needs_pdf" className={`data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 dark:data-[state=active]:bg-orange-950 dark:data-[state=active]:text-orange-300 ${counts.needs_pdf > 0 ? 'text-orange-600 dark:text-orange-400' : ''}`}>
                    Needs PDF <span className="ml-1 font-semibold">({counts.needs_pdf})</span>
                  </TabsTrigger>
                  <TabsTrigger value="pending" className={`data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-950 dark:data-[state=active]:text-blue-300 ${counts.pending > 0 ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                    Pending <span className="ml-1 font-semibold">({counts.pending})</span>
                  </TabsTrigger>
                  <TabsTrigger value="analyzing" className={`data-[state=active]:bg-yellow-50 data-[state=active]:text-yellow-700 dark:data-[state=active]:bg-yellow-950 dark:data-[state=active]:text-yellow-300 ${counts.analyzing > 0 ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
                    Analyzing <span className="ml-1 font-semibold">({counts.analyzing})</span>
                  </TabsTrigger>
                  <TabsTrigger value="included" className={`data-[state=active]:bg-green-50 data-[state=active]:text-green-700 dark:data-[state=active]:bg-green-950 dark:data-[state=active]:text-green-300 ${counts.included > 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                    Included <span className="ml-1 font-semibold">({counts.included})</span>
                  </TabsTrigger>
                  <TabsTrigger value="excluded" className="data-[state=active]:bg-background text-muted-foreground">
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
                    <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
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
                  <Button
                    onClick={() => handleTabChange("all")}
                    variant="default"
                    size="sm"
                  >
                    Done Reviewing
                  </Button>
                </div>
              )}

              {[`all`, `new_import`, `needs_pdf`, `pending`, `analyzing`, `included`, `excluded`].map(tabValue => (
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
    </StudyLayout>
  );
}
