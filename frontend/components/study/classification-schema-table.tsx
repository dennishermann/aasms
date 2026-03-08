"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FacetCategory {
  id: string;
  name: string;
  description?: string;
}

interface Facet {
  id: string;
  name: string;
  description?: string;
  type?: "CLOSED" | "OPEN" | "OPEN_CODED";
  researchQuestionIds?: string[];
  categories: FacetCategory[];
}

interface FacetCoverage {
  facetId: string;
  facetName: string;
  classified: number;
  unclassified: number;
  coveragePercent: number;
}

interface ClassificationSchemaTableProps {
  classificationSchema: Facet[];
  researchQuestions?: Array<{ id: string; question: string; order: number }>;
  facetCoverage?: FacetCoverage[];
}

export function ClassificationSchemaTable({
  classificationSchema,
  researchQuestions = [],
  facetCoverage = [],
}: ClassificationSchemaTableProps) {
  if (classificationSchema.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Classification Schema</CardTitle>
          <CardDescription>
            Facets and categories for organizing and classifying sources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-8">
            No classification schema defined yet. Go to Parameters to add facets.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getRQLabels = (rqIds?: string[]) => {
    if (!rqIds || rqIds.length === 0) return null;
    return rqIds
      .map((rqId) => {
        const rq = researchQuestions.find((q) => q.id === rqId);
        return rq ? `RQ${rq.order + 1}` : null;
      })
      .filter(Boolean);
  };

  const getCoverage = (facetId: string) => {
    return facetCoverage.find((fc) => fc.facetId === facetId);
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 80) return "bg-green-500";
    if (percent >= 50) return "bg-blue-500";
    if (percent >= 20) return "bg-amber-500";
    return "bg-red-500";
  };

  const getTypeBadgeVariant = (type?: string) => {
    switch (type) {
      case "CLOSED":
        return "default";
      case "OPEN_CODED":
        return "secondary";
      case "OPEN":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Classification Schema</CardTitle>
        <CardDescription>Facets for categorizing research sources</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Facet</TableHead>
              <TableHead className="w-[100px]">Linked RQ</TableHead>
              <TableHead>Categories</TableHead>
              <TableHead className="w-[150px]">Coverage</TableHead>
              <TableHead className="w-[280px]">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classificationSchema.map((facet) => {
              const rqLabels = getRQLabels(facet.researchQuestionIds);
              const coverage = getCoverage(facet.id);
              const percent = coverage?.coveragePercent ?? 0;
              const classified = coverage?.classified ?? 0;
              const total = classified + (coverage?.unclassified ?? 0);

              return (
                <TableRow key={facet.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold">{facet.name}</span>
                      {facet.type && (
                        <Badge variant={getTypeBadgeVariant(facet.type)} className="text-xs w-fit">
                          {facet.type === "OPEN_CODED"
                            ? "Coded"
                            : facet.type.charAt(0) + facet.type.slice(1).toLowerCase()}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {rqLabels && rqLabels.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {rqLabels.map((label, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {facet.categories.length > 0 ? (
                        facet.categories.map((category) => (
                          <Badge key={category.id} variant="outline" className="text-xs">
                            {category.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">No categories</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {coverage ? (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {classified}/{total}
                          </span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${getProgressColor(percent)}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {facet.description || "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
