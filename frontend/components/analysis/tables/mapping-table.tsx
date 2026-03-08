"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useReactTable, getCoreRowModel, flexRender, ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Download,
} from "lucide-react";
import type { MappingTableResult, MappingTableSource } from "@/types/analysis";

interface MappingTableProps {
  title?: string;
  data: MappingTableResult | undefined;
  isLoading?: boolean;
  studyId: string;
  facets: Array<{ id: string; name: string }>;
  selectedFacetIds: string[];
  onFacetsChange: (facetIds: string[]) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onExport?: () => void;
  isExporting?: boolean;
}

export function MappingTable({
  title,
  data,
  isLoading,
  studyId,
  facets,
  selectedFacetIds,
  onFacetsChange,
  onPageChange,
  onPageSizeChange,
  onExport,
  isExporting = false,
}: MappingTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleFacet = (facetId: string) => {
    if (selectedFacetIds.includes(facetId)) {
      onFacetsChange(selectedFacetIds.filter((id) => id !== facetId));
    } else {
      onFacetsChange([...selectedFacetIds, facetId]);
    }
  };

  const toggleRowExpand = (sourceId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(sourceId)) {
      newExpanded.delete(sourceId);
    } else {
      newExpanded.add(sourceId);
    }
    setExpandedRows(newExpanded);
  };

  const columns = useMemo<ColumnDef<MappingTableSource>[]>(() => {
    const cols: ColumnDef<MappingTableSource>[] = [
      {
        id: "title",
        accessorKey: "title",
        header: "Source",
        cell: ({ row }) => {
          const source = row.original;
          const isExpanded = expandedRows.has(source.id);

          return (
            <div className="space-y-1 max-w-md">
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => toggleRowExpand(source.id)}
                  className="text-left hover:underline"
                >
                  <span className="font-medium line-clamp-2">{source.title}</span>
                </button>
                <Link href={`/studies/${studyId}/sources/${source.id}`} target="_blank">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
              {isExpanded && (
                <div className="text-xs text-muted-foreground space-y-1 pt-1">
                  {source.authors && source.authors.length > 0 && (
                    <div>
                      <span className="font-semibold">Authors:</span> {source.authors.join(", ")}
                    </div>
                  )}
                  {source.year && (
                    <div>
                      <span className="font-semibold">Year:</span> {source.year}
                    </div>
                  )}
                  {source.venue && (
                    <div>
                      <span className="font-semibold">Venue:</span> {source.venue}
                    </div>
                  )}
                  {source.sourceCategory && (
                    <div>
                      <span className="font-semibold">Category:</span> {source.sourceCategory}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        },
      },
    ];

    // Add a column for each selected facet
    selectedFacetIds.forEach((facetId) => {
      const facet = facets.find((f) => f.id === facetId);
      if (!facet) return;

      cols.push({
        id: `facet_${facetId}`,
        header: () => (
          <div className="text-center">
            <div className="font-medium truncate max-w-24" title={facet.name}>
              {facet.name}
            </div>
          </div>
        ),
        cell: ({ row }) => {
          const classifications = row.original.classifications[facetId];
          if (!classifications || classifications.length === 0) {
            return <div className="text-center text-muted-foreground text-xs">—</div>;
          }

          return (
            <div className="flex flex-wrap gap-1 justify-center">
              {classifications.map((value, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {value}
                </Badge>
              ))}
            </div>
          );
        },
      });
    });

    return cols;
  }, [facets, selectedFacetIds, expandedRows, studyId]);

  const table = useReactTable({
    data: data?.sources ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: data ? Math.ceil(data.total / data.pageSize) : 0,
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
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentPage = data?.page ?? 1;
  const pageSize = data?.pageSize ?? 50;
  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / pageSize);

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          {onExport && (
            <CardAction>
              <Button variant="outline" size="sm" onClick={onExport} disabled={isExporting}>
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? "Exporting..." : "Export CSV"}
              </Button>
            </CardAction>
          )}
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {/* Facet Selection */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium">Columns:</span>
          {facets.map((facet) => (
            <Badge
              key={facet.id}
              variant={selectedFacetIds.includes(facet.id) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleFacet(facet.id)}
            >
              {facet.name}
            </Badge>
          ))}
        </div>

        {/* Table */}
        {!data || data.sources.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No sources found. Make sure sources are classified and included in the study.
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto max-h-[600px] relative">
              <Table className="text-sm">
                <TableHeader className="sticky top-0 bg-muted/95 backdrop-blur-sm z-10 shadow-sm">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="hover:bg-transparent">
                      {headerGroup.headers.map((header, index) => (
                        <TableHead
                          key={header.id}
                          className={`text-center whitespace-nowrap font-semibold py-2 px-3 ${
                            index === 0 ? "text-left sticky left-0 bg-muted/95 z-20" : ""
                          }`}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row, rowIndex) => (
                    <TableRow
                      key={row.id}
                      className={`hover:bg-muted/50 transition-colors ${rowIndex % 2 === 0 ? "bg-background" : "bg-muted/30"}`}
                    >
                      {row.getVisibleCells().map((cell, cellIndex) => (
                        <TableCell
                          key={cell.id}
                          className={`align-top py-2 px-3 ${
                            cellIndex === 0 ? "font-medium sticky left-0 bg-inherit" : ""
                          }`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * pageSize + 1} to{" "}
                  {Math.min(currentPage * pageSize, total)} of {total} sources
                </span>
              </div>

              <div className="flex items-center gap-6">
                {/* Page Size Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rows per page:</span>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(v) => {
                      onPageSizeChange(parseInt(v, 10));
                      onPageChange(1); // Reset to first page when changing page size
                    }}
                  >
                    <SelectTrigger className="w-[70px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Page Navigation */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-2">
                    Page {currentPage} of {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= pageCount}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(pageCount)}
                    disabled={currentPage >= pageCount}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
