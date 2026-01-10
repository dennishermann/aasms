"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
  ColumnDef,
} from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { FrequencyResult, FrequencyItem } from "@/types/analysis";

interface FrequencyTableProps {
  title?: string;
  data: FrequencyResult | undefined;
  isLoading?: boolean;
  showPercentages?: boolean;
  showProgressBar?: boolean;
}

export function FrequencyTable({
  title,
  data,
  isLoading = false,
  showPercentages = true,
  showProgressBar = true,
}: FrequencyTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "count", desc: true },
  ]);

  const columns = useMemo<ColumnDef<FrequencyItem>[]>(
    () => [
      {
        accessorKey: "label",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Category
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="font-medium">{row.getValue("label")}</div>
        ),
      },
      {
        accessorKey: "count",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Count
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => {
          const count = row.getValue("count") as number;
          const percentage = row.original.percentage;
          const maxPercentage = data
            ? Math.max(...data.items.map((i) => i.percentage))
            : 100;

          return (
            <div className="flex items-center gap-3">
              <span className="w-12 text-right font-mono">{count}</span>
              {showPercentages && (
                <span className="w-16 text-right text-muted-foreground">
                  ({percentage.toFixed(1)}%)
                </span>
              )}
              {showProgressBar && (
                <div className="flex-1 max-w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${(percentage / maxPercentage) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
          );
        },
      },
    ],
    [data, showPercentages, showProgressBar]
  );

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading) {
    return (
      <Card>
        {title && (
          <CardHeader>
            <CardTitle className="text-base">{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <Card>
        {title && (
          <CardHeader>
            <CardTitle className="text-base">{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent className="py-8 text-center text-muted-foreground">
          No data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
              {/* Total row */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="w-12 text-right font-mono">{data.total}</span>
                    {showPercentages && (
                      <span className="w-16 text-right text-muted-foreground">
                        (100%)
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
