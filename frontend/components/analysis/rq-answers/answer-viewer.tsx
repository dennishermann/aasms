"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Download,
  Lightbulb,
  BarChart3,
  Grid3X3,
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  FileText,
  Loader2,
  TableIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AnalysisBarChart,
  AnalysisLineChart,
  BubblePlot,
} from "@/components/analysis/charts";
import type { RqAnswerBundle, RecipeType, FigureSpec } from "@/types/recipe";
import type { FrequencyResult, CrossTabResult, TimeSeriesResult, GapAnalysis } from "@/types/analysis";

interface AnswerViewerProps {
  bundle: RqAnswerBundle;
  studyId: string;
  onExport?: () => Promise<void>;
  isExporting?: boolean;
}

// Key findings component
function KeyFindings({ findings }: { findings: string[] | null | undefined }) {
  if (!findings || findings.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Key Findings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {findings.map((finding, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span className="text-muted-foreground shrink-0">{index + 1}.</span>
              <span>{finding}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// Distribution result view
function DistributionResult({ data }: { data: FrequencyResult }) {
  const total = data.items.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Distribution Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="chart" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="chart" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Chart
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-2">
              <TableIcon className="h-4 w-4" />
              Table
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chart" className="mt-0">
            <AnalysisBarChart
              data={data}
              height={350}
              orientation="horizontal"
              showPercentages={false}
            />
          </TabsContent>

          <TabsContent value="table" className="mt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.label}</TableCell>
                    <TableCell className="text-right">{item.count}</TableCell>
                    <TableCell className="text-right">
                      {total > 0 ? ((item.count / total) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 text-sm text-muted-foreground">
              Total: {total} sources
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Helper to get dimension label
function getDimensionLabel(dim: { type: string; facetId?: string }): string {
  switch (dim.type) {
    case "publication-year":
      return "Publication Year";
    case "venue-type":
      return "Venue Type";
    case "source-category":
      return "Source Category";
    case "grey-tier":
      return "Grey Literature Tier";
    case "facet":
      return "Facet";
    default:
      return dim.type;
  }
}

// Cross-tab result view
function CrossTabResultView({ data }: { data: CrossTabResult }) {
  const rowLabel = getDimensionLabel(data.rowDimension);
  const colLabel = getDimensionLabel(data.colDimension);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Grid3X3 className="h-4 w-4" />
          Cross-Tabulation Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="chart" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="chart" className="gap-2">
              <Grid3X3 className="h-4 w-4" />
              Bubble Plot
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-2">
              <TableIcon className="h-4 w-4" />
              Table
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chart" className="mt-0">
            <BubblePlot data={data} height={400} />
          </TabsContent>

          <TabsContent value="table" className="mt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">
                      {rowLabel} / {colLabel}
                    </TableHead>
                    {data.colLabels.map((col) => (
                      <TableHead key={col.id} className="text-center">
                        {col.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rowLabels.map((row) => {
                    const rowTotal = data.rowTotals.find((t) => t.id === row.id);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        {data.colLabels.map((col) => {
                          const cell = data.cells.find(
                            (c) => c.rowId === row.id && c.colId === col.id
                          );
                          return (
                            <TableCell key={col.id} className="text-center">
                              {cell?.count ?? 0}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold">
                          {rowTotal?.count ?? 0}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Total: {data.grandTotal} sources
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Time series result view
function TimeSeriesResultView({ data }: { data: TimeSeriesResult }) {
  // Calculate total from all series
  const total = data.series.reduce(
    (sum, s) => sum + s.data.reduce((a, b) => a + b, 0),
    0
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Publication Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="chart" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="chart" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Chart
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-2">
              <TableIcon className="h-4 w-4" />
              Table
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chart" className="mt-0">
            <AnalysisLineChart data={data} height={350} showArea />
          </TabsContent>

          <TabsContent value="table" className="mt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  {data.series.map((s) => (
                    <TableHead key={s.id} className="text-right">
                      {s.label}
                    </TableHead>
                  ))}
                  {data.series.length > 1 && (
                    <TableHead className="text-right font-bold">Total</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.years.map((year, yearIdx) => {
                  const yearTotal = data.series.reduce(
                    (sum, s) => sum + (s.data[yearIdx] ?? 0),
                    0
                  );
                  return (
                    <TableRow key={year}>
                      <TableCell className="font-medium">{year}</TableCell>
                      {data.series.map((s) => (
                        <TableCell key={s.id} className="text-right">
                          {s.data[yearIdx] ?? 0}
                        </TableCell>
                      ))}
                      {data.series.length > 1 && (
                        <TableCell className="text-right font-bold">
                          {yearTotal}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="mt-4 text-sm text-muted-foreground">
              Total: {total} sources
              {data.years.length > 0 &&
                ` (${data.years[0]} - ${data.years[data.years.length - 1]})`}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Gap analysis result view
function GapAnalysisResult({ data }: { data: GapAnalysis }) {
  // Count total gaps and empty categories
  const totalGaps = data.singleDimensionGaps.reduce(
    (sum, facet) => sum + facet.gaps.length + facet.empty.length,
    0
  );

  const totalEmpty = data.singleDimensionGaps.reduce(
    (sum, facet) => sum + facet.empty.length,
    0
  );

  const hasGaps = totalGaps > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Research Gap Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{data.singleDimensionGaps.length}</p>
              <p className="text-sm text-muted-foreground">Facets Analyzed</p>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-lg">
              <p className="text-2xl font-bold text-amber-700">{totalGaps}</p>
              <p className="text-sm text-amber-700">Total Gaps</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-700">{totalEmpty}</p>
              <p className="text-sm text-red-700">Empty Categories</p>
            </div>
          </div>

          {/* Gaps by facet */}
          {data.singleDimensionGaps.map((facetGaps) => {
            const allGaps = [
              ...facetGaps.empty.map((e) => ({
                categoryId: e.categoryId,
                categoryName: e.categoryName,
                count: 0,
              })),
              ...facetGaps.gaps,
            ];

            if (allGaps.length === 0) return null;

            return (
              <div key={facetGaps.facetId}>
                <h4 className="font-medium mb-2">
                  {facetGaps.facetName} (threshold: {data.threshold} or fewer)
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allGaps.map((gap) => (
                      <TableRow key={gap.categoryId}>
                        <TableCell className="font-medium">
                          {gap.categoryName}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={gap.count === 0 ? "destructive" : "outline"}
                          >
                            {gap.count}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}

          {!hasGaps && (
            <Alert>
              <AlertDescription>
                No significant gaps found with the current threshold of{" "}
                {data.threshold} sources.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AnswerViewer({ bundle, studyId, onExport, isExporting }: AnswerViewerProps) {
  const { recipe, run } = bundle;

  // If no run or error, show appropriate state
  if (!run) {
    return null;
  }

  if (run.status === "ERROR") {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {run.errorMessage ?? "An error occurred while running the recipe."}
        </AlertDescription>
      </Alert>
    );
  }

  if (run.status === "RUNNING") {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Running recipe...</p>
        </CardContent>
      </Card>
    );
  }

  const resultData = run.resultData;
  const keyFindings = run.keyFindings as string[] | null;

  return (
    <div className="space-y-6">
      {/* Key findings */}
      <KeyFindings findings={keyFindings} />

      {/* Result data by type */}
      {recipe.type === "DISTRIBUTION" && resultData && (
        <DistributionResult data={resultData as FrequencyResult} />
      )}

      {recipe.type === "MAP" && resultData && (
        <CrossTabResultView data={resultData as CrossTabResult} />
      )}

      {recipe.type === "TREND" && resultData && (
        <TimeSeriesResultView data={resultData as TimeSeriesResult} />
      )}

      {recipe.type === "GAP" && resultData && (
        <GapAnalysisResult data={resultData as GapAnalysis} />
      )}

      {/* Run metadata */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Recipe v{run.recipeVersion}</span>
              <span>{run.includedSourceCount} sources</span>
              <span>
                Last run:{" "}
                {run.completedAt
                  ? new Date(run.completedAt).toLocaleString()
                  : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onExport}
                disabled={isExporting || !run}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export Bundle
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
