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

interface Criterion {
  id?: string;
  criterion: string;
  order: number;
}

interface CriteriaTableProps {
  inclusionCriteria: Criterion[];
  exclusionCriteria: Criterion[];
}

export function CriteriaTable({ inclusionCriteria, exclusionCriteria }: CriteriaTableProps) {
  const maxLength = Math.max(inclusionCriteria.length, exclusionCriteria.length);
  
  // Create rows with both IC and EC
  const rows = Array.from({ length: maxLength }, (_, index) => ({
    inclusion: inclusionCriteria[index] || null,
    exclusion: exclusionCriteria[index] || null,
  }));

  if (inclusionCriteria.length === 0 && exclusionCriteria.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inclusion & Exclusion Criteria</CardTitle>
          <CardDescription>
            Define criteria for including or excluding sources from the study
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-8">
            No criteria defined yet. Go to Parameters to add criteria.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inclusion & Exclusion Criteria</CardTitle>
        <CardDescription>
          Criteria for evaluating sources in this study
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead className="w-[calc(50%-30px)]">Inclusion Criteria</TableHead>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead className="w-[calc(50%-30px)]">Exclusion Criteria</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium text-muted-foreground align-top">
                    {row.inclusion ? `IC${row.inclusion.order + 1}` : ""}
                  </TableCell>
                  <TableCell className="text-sm align-top whitespace-normal break-words">
                    {row.inclusion?.criterion || ""}
                  </TableCell>
                  <TableCell className="font-medium text-muted-foreground align-top">
                    {row.exclusion ? `EC${row.exclusion.order + 1}` : ""}
                  </TableCell>
                  <TableCell className="text-sm align-top whitespace-normal break-words">
                    {row.exclusion?.criterion || ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

