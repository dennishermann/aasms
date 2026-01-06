"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudyLayout } from "@/components/layout/study-layout";
import { CriteriaTable } from "@/components/study/criteria-table";
import { ClassificationSchemaTable } from "@/components/study/classification-schema-table";

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
  sources: any[];
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

  if (isLoading) {
    return (
      <StudyLayout studyId={studyId} studyTitle="Loading...">
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading study...</p>
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

  return (
    <StudyLayout
      studyId={studyId}
      studyTitle={study.title}
      studyStatus={study.status}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-4">
            {/* Description and Motivation */}
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {study.description && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Description:</p>
                    <p className="text-sm text-muted-foreground">{study.description}</p>
                  </div>
                )}
                {study.motivation && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Motivation:</p>
                    <p className="text-sm text-muted-foreground">{study.motivation}</p>
                  </div>
                )}
                {!study.description && !study.motivation && (
                  <p className="text-muted-foreground text-sm">No description or motivation provided yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Research Questions</CardTitle>
              </CardHeader>
              <CardContent>
                {study.researchQuestions.length === 0 ? (
                  <p className="text-muted-foreground">No research questions defined</p>
                ) : (
                  <ol className="list-decimal list-inside space-y-2">
                    {study.researchQuestions
                      .sort((a, b) => a.order - b.order)
                      .map((rq) => (
                        <li key={rq.id} className="text-sm">
                          {rq.question}
                        </li>
                      ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Study Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span>{new Date(study.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Sources:</span>
                  <span>{study.sources.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline">{study.status}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Inclusion & Exclusion Criteria */}
            {parameters && (
              <CriteriaTable
                inclusionCriteria={parameters.inclusionCriteria || []}
                exclusionCriteria={parameters.exclusionCriteria || []}
              />
            )}

            {/* Classification Schema */}
            {parameters && (
              <ClassificationSchemaTable
                classificationSchema={parameters.classificationSchema || []}
                researchQuestions={study.researchQuestions}
              />
            )}
        </div>
      </div>
    </StudyLayout>
  );
}

