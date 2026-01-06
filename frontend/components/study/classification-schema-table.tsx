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

interface Facet {
  id: string;
  name: string;
  description?: string;
  researchQuestionId?: string;
  categories: string[];
}

interface ClassificationSchemaTableProps {
  classificationSchema: Facet[];
  researchQuestions?: Array<{ id: string; question: string; order: number }>;
}

export function ClassificationSchemaTable({ 
  classificationSchema, 
  researchQuestions = [] 
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

  const getRQLabel = (rqId?: string) => {
    if (!rqId) return null;
    const rq = researchQuestions.find(q => q.id === rqId);
    return rq ? `RQ${rq.order + 1}` : null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Classification Schema</CardTitle>
        <CardDescription>
          Facets for categorizing research sources
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Facet ID</TableHead>
              <TableHead className="w-[200px]">Name</TableHead>
              <TableHead className="w-[100px]">Linked RQ</TableHead>
              <TableHead>Categories</TableHead>
              <TableHead className="w-[300px]">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classificationSchema.map((facet) => {
              const rqLabel = getRQLabel(facet.researchQuestionId);
              return (
                <TableRow key={facet.id}>
                  <TableCell className="font-medium">{facet.id}</TableCell>
                  <TableCell className="font-semibold">{facet.name}</TableCell>
                  <TableCell>
                    {rqLabel ? (
                      <Badge variant="secondary" className="text-xs">
                        {rqLabel}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {facet.categories.length > 0 ? (
                        facet.categories.map((category, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {category}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">No categories</span>
                      )}
                    </div>
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

