"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StudyLayout } from "@/components/layout/study-layout";
import { CriteriaTable } from "@/components/study/criteria-table";
import { ClassificationSchemaTable } from "@/components/study/classification-schema-table";
import { StudySummaryStats } from "@/components/shared/study-summary-stats";
import type { SummaryStats } from "@/types/analysis";

interface Source {
  id: string;
  status: string;
  finalDecision?: string | null;
  hasPdf?: boolean;
  needsPdf?: boolean;
  publicationDate?: string | null;
  venue?: string | null;
}

interface StudyDetail {
  id: string;
  title: string;
  description: string | null;
  motivation: string | null;
  status: string;
  createdAt: string;
  researchQuestions: Array<{ id: string; question: string; order: number }>;
  parameters: {
    inclusionCriteria: Array<{ id: string; criterion: string; order: number }>;
    exclusionCriteria: Array<{ id: string; criterion: string; order: number }>;
    classificationSchema: any;
  } | null;
  sources: Source[];
}

interface FacetCategory {
  id: string;
  name: string;
  description?: string;
}

interface Facet {
  id: string;
  name: string;
  description?: string;
  type: "CLOSED" | "OPEN" | "OPEN_CODED";
  categories: FacetCategory[];
  researchQuestionIds?: string[];
}

async function fetchStudy(id: string): Promise<StudyDetail> {
  const response = await fetch(`/api/studies/${id}`);
  if (!response.ok) throw new Error("Failed to fetch study");
  const data = await response.json();
  return data.data;
}

async function fetchParameters(studyId: string) {
  try {
    const response = await fetch(`/api/studies/${studyId}/parameters`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error("Failed to fetch parameters");
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error fetching parameters:", error);
    return null;
  }
}

async function fetchFacets(studyId: string): Promise<Facet[]> {
  try {
    const response = await fetch(`/api/studies/${studyId}/facets`);
    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error("Failed to fetch facets");
    }
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("Error fetching facets:", error);
    return [];
  }
}

async function fetchSummaryStats(studyId: string): Promise<SummaryStats | null> {
  try {
    const response = await fetch(`/api/studies/${studyId}/analysis/summary`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error fetching summary stats:", error);
    return null;
  }
}

export default function StudyDetailPage() {
  const params = useParams();
  const studyId = params.id as string;

  const { data: study, isLoading, error } = useQuery({
    queryKey: ["study", studyId],
    queryFn: () => fetchStudy(studyId),
  });

  const { data: parameters } = useQuery({
    queryKey: ["parameters", studyId],
    queryFn: () => fetchParameters(studyId),
    enabled: !!study,
  });

  const { data: facets, isLoading: facetsLoading } = useQuery({
    queryKey: ["facets", studyId],
    queryFn: () => fetchFacets(studyId),
    enabled: !!study,
  });

  const { data: summaryStats, isLoading: statsLoading } = useQuery({
    queryKey: ["summary-stats", studyId],
    queryFn: () => fetchSummaryStats(studyId),
    enabled: !!study,
  });

  if (isLoading) {
    return (
      <StudyLayout studyId={studyId} studyTitle="Loading...">
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
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

  // Compute stats from sources
  const sources = study.sources;
  const included = sources.filter(
    (s) =>
      s.finalDecision === "INCLUDE" ||
      (["ANALYZED", "INCLUDED", "CLASSIFIED", "NEEDS_REVIEW"].includes(s.status) &&
        !s.finalDecision)
  ).length;

  const excluded = sources.filter(
    (s) => s.finalDecision === "EXCLUDE" || s.status === "EXCLUDED"
  ).length;

  const pending = sources.length - included - excluded;

  // Compute year range from included sources
  const includedSources = sources.filter(
    (s) =>
      s.finalDecision === "INCLUDE" ||
      (["ANALYZED", "INCLUDED", "CLASSIFIED", "NEEDS_REVIEW"].includes(s.status) &&
        !s.finalDecision)
  );

  const years = includedSources
    .map((s) => (s.publicationDate ? new Date(s.publicationDate).getFullYear() : null))
    .filter((y): y is number => y !== null);

  const yearRange =
    years.length > 0
      ? { min: Math.min(...years), max: Math.max(...years) }
      : { min: null, max: null };

  // Get unique venues
  const uniqueVenues = new Set(
    includedSources.map((s) => s.venue).filter(Boolean)
  ).size;

  const stats = {
    total: sources.length,
    included,
    excluded,
    pending,
    yearRange,
    uniqueVenues,
  };

  return (
    <StudyLayout
      studyId={studyId}
      studyTitle={study.title}
      studyStatus={study.status}
    >
      <div className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Source Statistics */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Study Progress</h2>
            <StudySummaryStats stats={stats} isLoading={isLoading} variant="full" />
          </section>

          {/* Description and Motivation */}
          {(study.description || study.motivation) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {study.motivation && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-2">
                      Motivation
                    </p>
                    <p className="text-sm leading-relaxed">{study.motivation}</p>
                  </div>
                )}
                {study.description && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-2">
                      Description
                    </p>
                    <p className="text-sm leading-relaxed">{study.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Research Questions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Research Questions</CardTitle>
            </CardHeader>
            <CardContent>
              {study.researchQuestions.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  No research questions defined yet.{" "}
                  <Link
                    href={`/studies/${studyId}/parameters`}
                    className="text-primary hover:underline"
                  >
                    Add them in Parameters
                  </Link>
                </p>
              ) : (
                <ol className="space-y-3">
                  {study.researchQuestions
                    .sort((a, b) => a.order - b.order)
                    .map((rq, index) => (
                      <li key={rq.id} className="flex gap-3 text-sm">
                        <Badge
                          variant="secondary"
                          className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center text-xs font-bold"
                        >
                          {index + 1}
                        </Badge>
                        <span className="leading-relaxed">{rq.question}</span>
                      </li>
                    ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Inclusion & Exclusion Criteria */}
          {parameters && (
            <CriteriaTable
              inclusionCriteria={parameters.inclusionCriteria || []}
              exclusionCriteria={parameters.exclusionCriteria || []}
            />
          )}

          {/* Classification Schema with Coverage */}
          <ClassificationSchemaTable
            classificationSchema={facets || []}
            researchQuestions={study.researchQuestions}
            facetCoverage={summaryStats?.facetCoverage}
          />
        </div>
      </div>
    </StudyLayout>
  );
}
