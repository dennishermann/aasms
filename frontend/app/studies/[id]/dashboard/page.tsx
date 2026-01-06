"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudyLayout } from "@/components/layout/study-layout";
import { BarChart3, FileText, CheckCircle, XCircle, Clock, Upload, Database } from "lucide-react";

interface Study {
  id: string;
  title: string;
  status: string;
  sources: Array<{
    id: string;
    status: string;
    finalDecision?: string | null;
    needsPdf?: boolean;
  }>;
}

async function fetchStudy(id: string): Promise<Study> {
  const response = await fetch(`/api/studies/${id}`);
  if (!response.ok) throw new Error("Failed to fetch study");
  const data = await response.json();
  return data.data;
}

async function fetchStatistics(id: string): Promise<any> {
  const response = await fetch(`/api/studies/${id}/statistics`);
  if (!response.ok) throw new Error("Failed to fetch statistics");
  return response.json();
}

export default function DashboardPage() {
  const params = useParams();
  const studyId = params.id as string;

  const { data: study, isLoading: studyLoading } = useQuery({
    queryKey: ["study", studyId],
    queryFn: () => fetchStudy(studyId),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["source-statistics", studyId],
    queryFn: () => fetchStatistics(studyId),
  });

  const isLoading = studyLoading || statsLoading;

  // Calculate source statistics
  const sourceStats = study ? {
    total: study.sources.length,
    pending: study.sources.filter((s) => s.status === "PENDING" || s.status === "PENDING_METADATA").length,
    needsPdf: study.sources.filter((s) => s.needsPdf).length,
    relevant: study.sources.filter((s) => !s.finalDecision && s.status !== "EXCLUDED").length,
    excluded: study.sources.filter((s) => s.finalDecision === "EXCLUDE" || s.status === "EXCLUDED").length,
  } : null;

  return (
    <StudyLayout studyId={studyId} studyTitle="Study Dashboard">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Study Statistics & Dashboard</h1>
        </div>

        {/* Source Overview Statistics */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-2xl font-bold">{isLoading ? "..." : sourceStats?.total || 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Relevant</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <p className="text-2xl font-bold text-green-600">{isLoading ? "..." : sourceStats?.relevant || 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Excluded</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <p className="text-2xl font-bold text-red-600">{isLoading ? "..." : sourceStats?.excluded || 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <p className="text-2xl font-bold text-orange-600">{isLoading ? "..." : sourceStats?.pending || 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Import History Statistics */}
        {stats && stats.totalImports > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Import History</CardTitle>
                  <CardDescription>
                    {stats.lastImport ? `Last import: ${new Date(stats.lastImport).toLocaleString()}` : 'No imports yet'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Imports</p>
                  <p className="text-2xl font-bold">{stats.totalImports}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Records Processed</p>
                  <p className="text-2xl font-bold">{stats.totalRecords}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Duplicates Found</p>
                  <p className="text-2xl font-bold">{stats.duplicates}</p>
                </div>
                {stats.multipleOrigins > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Multiple Origins</p>
                    <p className="text-2xl font-bold">{stats.multipleOrigins}</p>
                    <p className="text-xs text-muted-foreground">Found in 2+ databases</p>
                  </div>
                )}
              </div>

              {Object.keys(stats.byDatabase).length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Sources by Database</p>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {Object.entries(stats.byDatabase).map(([db, count]) => (
                      <div key={db} className="flex items-center gap-2 px-3 py-2 border rounded-lg">
                        <Badge variant="secondary" className="text-sm">
                          {db}
                        </Badge>
                        <span className="font-semibold">{String(count)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Placeholder for Future Visualizations */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Visualizations & Reporting</CardTitle>
                <CardDescription>
                  Advanced analytics coming soon
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4 bg-muted/50">
                <h4 className="font-semibold mb-2">Export Options</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Export study results in various formats
                </p>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" disabled className="w-full">
                    Export to CSV
                  </Button>
                  <Button variant="outline" size="sm" disabled className="w-full">
                    Export to Excel
                  </Button>
                  <Button variant="outline" size="sm" disabled className="w-full">
                    Generate PDF Report
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-muted/50">
                <h4 className="font-semibold mb-2">Visualizations</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Interactive charts and graphs
                </p>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" disabled className="w-full">
                    Classification Distribution
                  </Button>
                  <Button variant="outline" size="sm" disabled className="w-full">
                    Timeline View
                  </Button>
                  <Button variant="outline" size="sm" disabled className="w-full">
                    Venue Analysis
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </StudyLayout>
  );
}

