"use client";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { StudyLayout } from "@/components/layout/study-layout";
import { SourceAnalysisPanel } from "@/components/source/analysis/source-analysis-panel";
import { AnalysisData } from "@/components/source/analysis/types";
import { SourceMetadataView } from "@/components/source/common/source-metadata-display";
import { SourceWebsiteViewer } from "@/components/source/website/website-viewer";
import { SourceMetadataEditor } from "@/components/source/common/source-metadata-editor";
import { WebsiteMetadataEditor } from "@/components/source/website/website-metadata-editor";
import { useSourceDetails } from "@/hooks/use-source-details";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PdfUploadCard } from "@/components/source/pdf/pdf-upload-card";
import { SourceHeader } from "@/components/source/detail/source-header";
import { SourceMetadataReviewSection } from "@/components/source/detail/source-metadata-review-section";
import { useMetadataReview } from "@/hooks/use-metadata-review";

export default function SourceDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const studyId = params.id as string;
  const sourceId = params.sourceId as string;
  const tabParam = searchParams.get("filter") || "all";

  // Prev/next navigation from sessionStorage
  const navKey = `sources-nav-${studyId}-${tabParam}`;
  const [navIds, setNavIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(navKey);
      if (stored) setNavIds(JSON.parse(stored));
    } catch {
      // sessionStorage unavailable
    }
  }, [navKey]);

  const currentIndex = navIds.indexOf(sourceId);
  const prevId = currentIndex > 0 ? navIds[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < navIds.length - 1 ? navIds[currentIndex + 1] : null;

  const makeNavUrl = useCallback((id: string) => {
    const p = new URLSearchParams();
    if (tabParam !== "all") p.set("filter", tabParam);
    return `/studies/${studyId}/sources/${id}?${p.toString()}`;
  }, [tabParam, studyId]);

  // Keyboard shortcuts for prev/next
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft" && prevId) {
        e.preventDefault();
        router.push(makeNavUrl(prevId));
      } else if (e.key === "ArrowRight" && nextId) {
        e.preventDefault();
        router.push(makeNavUrl(nextId));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prevId, nextId, router, makeNavUrl]);

  const [isMetadataEditing, setIsMetadataEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    source,
    sourceLoading,
    sourceError,
    analysisData,
    analysisLoading,
    analysisIsError,
    analysisError,
    deleteMutation,
    reparseMutation,
    patchMutation,
    classifyMutation,
    reparseLoading,
    autoAnalyzeError,
    loadingInclusionAnalysis,
    loadingClassificationAnalysis,
  } = useSourceDetails(studyId, sourceId);

  const metadataReviewState = useMetadataReview({
    source,
    patchMutation,
    onApplySuccess: () => {
      // any additional logic if needed
    },
  });

  if (sourceLoading || analysisLoading) {
    return (
      <StudyLayout studyId={studyId} studyTitle="Loading...">
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading source...</p>
        </div>
      </StudyLayout>
    );
  }

  if (sourceError || !source) {
    return (
      <StudyLayout>
        <div className="container mx-auto px-4 py-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Source not found</h2>
          <Button asChild>
            <Link href={`/studies/${studyId}/sources`}>Back to Sources</Link>
          </Button>
        </div>
      </StudyLayout>
    );
  }

  // Parse classification schema from study parameters
  let facets: any[] = [];
  const studyParams = source.study?.parameters as Record<string, unknown> | undefined;
  if (studyParams?.classificationSchema) {
    if (Array.isArray(studyParams.classificationSchema)) {
      facets = studyParams.classificationSchema;
    }
  }

  const loadingInclusion =
    !!source && (source.status === "ANALYZING_INCLUSION" || loadingInclusionAnalysis);
  const loadingClassifications =
    !!source && (source.status === "ANALYZING_CLASSIFICATION" || loadingClassificationAnalysis);

  const derivedAnalysis: AnalysisData | null = (() => {
    if (analysisData?.data) return analysisData.data;
    if (!source) return null;
    // Show placeholder panel while analysis is running
    if (
      source.status === "ANALYZING_INCLUSION" ||
      source.status === "ANALYZING_CLASSIFICATION" ||
      loadingInclusionAnalysis ||
      loadingClassificationAnalysis
    ) {
      return {
        inclusionRecommendation: false,
        inclusionReasoning: "",
        exclusionReasoning: "",
        confidenceScore: 0.0,
        classifications: [],
        inclusionCriteria: [],
        exclusionCriteria: [],
      };
    }
    return null;
  })();

  const inclusionRecommendation = analysisData?.data?.inclusionRecommendation ?? false;
  const showClassifications = !!analysisData?.data && inclusionRecommendation && !loadingInclusion;
  const canEditInclusion = !loadingInclusion;
  const canEditClassifications = showClassifications && !loadingClassifications;

  const batchId = searchParams.get("batchId");

  // Construct back URL
  const backUrl =
    `/studies/${studyId}/sources?` +
    new URLSearchParams({
      ...(tabParam !== "all" && { filter: tabParam }),
      ...(batchId && { batchId }),
    }).toString();

  return (
    <StudyLayout
      studyId={studyId}
      studyTitle={source.study?.title || "Source Details"}
      studyStatus={source.study?.status}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {source.status === "NEEDS_REVIEW" && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Analysis failed. Please review metadata or try again.
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button asChild variant="ghost" size="sm">
              <Link href={backUrl}>← Back to Sources</Link>
            </Button>
            {navIds.length > 1 && currentIndex >= 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!prevId}
                  onClick={() => prevId && router.push(makeNavUrl(prevId))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Prev
                </Button>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {currentIndex + 1} of {navIds.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!nextId}
                  onClick={() => nextId && router.push(makeNavUrl(nextId))}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
          <Card>
            {isMetadataEditing ? (
              source.type === "WEBPAGE" || source.type === "BLOG_POST" ? (
                <WebsiteMetadataEditor
                  source={source}
                  onCancel={() => setIsMetadataEditing(false)}
                  onSaveSuccess={() => setIsMetadataEditing(false)}
                />
              ) : (
                <SourceMetadataEditor
                  source={source}
                  onCancel={() => setIsMetadataEditing(false)}
                  onSaveSuccess={() => setIsMetadataEditing(false)}
                />
              )
            ) : (
              <>
                <SourceHeader
                  source={source}
                  studyId={studyId}
                  sourceId={sourceId}
                  onEdit={() => setIsMetadataEditing(true)}
                  onDeleteRequest={() => setShowDeleteDialog(true)}
                  reparseMutation={reparseMutation}
                  onReparseSuccess={(data) => {
                    metadataReviewState.setParsedSuggestion(data);
                    metadataReviewState.setSelectedFields({});
                    metadataReviewState.setApplyAll(false);
                  }}
                  classifyMutation={classifyMutation}
                  loadingInclusionAnalysis={loadingInclusionAnalysis}
                  loadingClassificationAnalysis={loadingClassificationAnalysis}
                />

                {/* Separator for cleaner UI */}
                <div className="border-b" />

                {/* Content - Uses new Metadata component */}
                <SourceMetadataView source={source} />

                {/* Content Viewer for Websites */}
                {(source.type === "WEBPAGE" || source.type === "BLOG_POST") &&
                  source.storagePath &&
                  (source.storagePath.endsWith(".html") || source.storagePath.endsWith(".txt")) && (
                    <div className="mt-8">
                      <SourceWebsiteViewer
                        contentUrl={`/api/studies/${studyId}/sources/${sourceId}/content`}
                        originalUrl={source.originalUrl}
                      />
                    </div>
                  )}
              </>
            )}
          </Card>

          <SourceMetadataReviewSection
            source={source}
            patchMutation={patchMutation}
            reparseLoading={reparseLoading}
            reviewState={metadataReviewState}
          />

          {source.needsPdf && (
            <PdfUploadCard
              studyId={studyId}
              sourceId={sourceId}
              onUploadSuccess={() => {
                window.location.reload();
              }}
            />
          )}

          {/* Analysis Results */}
          {analysisIsError && (
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Failed to load analysis:{" "}
              {analysisError instanceof Error ? analysisError.message : "Unknown error"}
            </div>
          )}
          {derivedAnalysis && (
            <SourceAnalysisPanel
              studyId={studyId}
              sourceId={sourceId}
              analysis={derivedAnalysis}
              facets={facets}
              loadingInclusion={loadingInclusion}
              loadingClassifications={loadingClassifications}
              canEditInclusion={canEditInclusion}
              canEditClassifications={canEditClassifications}
              showClassifications={showClassifications}
            />
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Source?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{source.title}&quot;? This action cannot be
                undone and will also delete all associated analysis data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="bg-destructive hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </StudyLayout>
  );
}
