"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  Check,
  Trash2,
} from "lucide-react";
import type { Source } from "@/types/source";

interface SourceTableProps {
  sources: Source[];
  tab: string;
  isEditMode: boolean;
  selectedIds: Set<string>;
  onToggleSelection: (id: string, checked: boolean) => void;
  onDelete: (source: Source) => void;
  suggestions: Record<string, any>;
  loadingMap: Record<string, boolean>;
  onReparse: (id: string) => void;
  onApplySuggestions: (id: string) => void;
  getSourceUrl: (id: string) => string;
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
}

function SortableHeader({
  column,
  children,
}: {
  column: any;
  children: React.ReactNode;
}) {
  const sorted = column.getIsSorted();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {children}
      {sorted === "asc" ? (
        <ArrowUp className="ml-1 h-3 w-3" />
      ) : sorted === "desc" ? (
        <ArrowDown className="ml-1 h-3 w-3" />
      ) : (
        <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
      )}
    </Button>
  );
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  INCLUDED: "bg-green-100 text-green-700",
  EXCLUDED: "bg-red-100 text-red-700",
  CLASSIFIED: "bg-blue-100 text-blue-700",
  ANALYZING_INCLUSION: "bg-yellow-100 text-yellow-700",
  ANALYZING_CLASSIFICATION: "bg-yellow-100 text-yellow-700",
  NEEDS_REVIEW: "bg-orange-100 text-orange-700",
};

function getDisplayStatus(source: Source): string {
  if (source.finalDecision === "INCLUDE" && source.status === "CLASSIFIED") return "CLASSIFIED";
  if (source.finalDecision === "INCLUDE") return "INCLUDED";
  if (source.finalDecision === "EXCLUDE") return "EXCLUDED";
  return source.status;
}

export function SourceTable({
  sources,
  tab,
  isEditMode,
  selectedIds,
  onToggleSelection,
  onDelete,
  suggestions,
  loadingMap,
  onReparse,
  onApplySuggestions,
  getSourceUrl,
  sorting,
  onSortingChange,
}: SourceTableProps) {
  const columns = useMemo<ColumnDef<Source>[]>(() => {
    const cols: ColumnDef<Source>[] = [];

    if (isEditMode) {
      cols.push({
        id: "select",
        header: () => null,
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={(checked) => onToggleSelection(row.original.id, !!checked)}
          />
        ),
        size: 40,
        enableSorting: false,
      });
    }

    cols.push(
      {
        accessorKey: "title",
        header: ({ column }) => <SortableHeader column={column}>Title</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href={getSourceUrl(row.original.id)}
              className="font-medium hover:underline truncate max-w-md"
              title={row.original.title}
            >
              {row.original.title}
            </Link>
            {row.original.sourceOrigins?.map((origin) => (
              <Badge key={origin} variant="secondary" className="text-xs shrink-0">
                {origin}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: "authors",
        accessorFn: (row) => row.authors?.join(", ") || "",
        header: ({ column }) => <SortableHeader column={column}>Authors</SortableHeader>,
        cell: ({ getValue }) => (
          <span className="truncate max-w-48 block text-sm text-muted-foreground" title={getValue() as string}>
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        id: "year",
        accessorFn: (row) =>
          row.publicationDate ? new Date(row.publicationDate).getFullYear() : null,
        header: ({ column }) => <SortableHeader column={column}>Year</SortableHeader>,
        cell: ({ getValue }) => (
          <span className="text-sm">{(getValue() as number | null) ?? "—"}</span>
        ),
        sortingFn: "basic",
      },
      {
        accessorKey: "venue",
        header: ({ column }) => <SortableHeader column={column}>Venue</SortableHeader>,
        cell: ({ getValue }) => (
          <span className="truncate max-w-32 block text-sm text-muted-foreground" title={(getValue() as string) || ""}>
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => getDisplayStatus(row),
        header: ({ column }) => <SortableHeader column={column}>Status</SortableHeader>,
        cell: ({ row }) => {
          const status = getDisplayStatus(row.original);
          return (
            <Badge className={STATUS_COLORS[status] || "bg-gray-100 text-gray-700"} variant="secondary">
              {status}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => {
          const source = row.original;
          const isLoading = loadingMap[source.id];
          return (
            <div className="flex items-center gap-1 justify-end">
              {tab === "pending" && !isEditMode && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReparse(source.id)}
                    disabled={isLoading}
                    className="h-7 text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {isLoading ? "..." : "Re-parse"}
                  </Button>
                  {suggestions[source.id] && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onApplySuggestions(source.id)}
                      disabled={isLoading}
                      className="h-7 text-xs"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Apply
                    </Button>
                  )}
                </>
              )}
              {tab === "needs_pdf" && !isEditMode && (
                <Button asChild size="sm" className="h-7 text-xs">
                  <Link href={getSourceUrl(source.id)}>Upload PDF</Link>
                </Button>
              )}
              {!isEditMode && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(source)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        },
        enableSorting: false,
      },
    );

    return cols;
  }, [isEditMode, selectedIds, onToggleSelection, tab, getSourceUrl, suggestions, loadingMap, onReparse, onApplySuggestions, onDelete]);

  const table = useReactTable({
    data: sources,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 50 },
    },
  });

  if (sources.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No sources found in this category.
      </div>
    );
  }

  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const total = sources.length;
  const pageCount = table.getPageCount();

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="py-2 px-3 whitespace-nowrap">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/50">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-2 px-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {total > 25 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {pageIndex * pageSize + 1} to {Math.min((pageIndex + 1) * pageSize, total)} of{" "}
            {total} sources
          </span>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page:</span>
              <Select
                value={pageSize.toString()}
                onValueChange={(v) => {
                  table.setPageSize(parseInt(v, 10));
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
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm px-2">
                Page {pageIndex + 1} of {pageCount}
              </span>
              <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
