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
import { cn } from "@/lib/utils";
import type { CrossTabResult } from "@/types/analysis";

interface CellClickData {
    rowId: string;
    colId: string;
    rowLabel: string;
    colLabel: string;
    count: number;
    sourceIds: string[];
}

interface CrossTabTableProps {
    title?: string;
    data: CrossTabResult | undefined;
    isLoading?: boolean;
    gapThreshold?: number;
    showPercentages?: boolean;
    onCellClick?: (data: CellClickData) => void;
}

interface RowData {
    rowId: string;
    rowLabel: string;
    total: number;
    cells: Map<string, { count: number; percentage: number; sourceIds: string[] }>;
}

export function CrossTabTable({
    title,
    data,
    isLoading = false,
    gapThreshold = 0,
    showPercentages = false,
    onCellClick,
}: CrossTabTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);

    // Transform data to row format for TanStack Table
    const rowData = useMemo<RowData[]>(() => {
        if (!data) return [];

        return data.rowLabels.map((row) => {
            const cellMap = new Map<
                string,
                { count: number; percentage: number; sourceIds: string[] }
            >();

            data.cells
                .filter((cell) => cell.rowId === row.id)
                .forEach((cell) => {
                    cellMap.set(cell.colId, {
                        count: cell.count,
                        percentage: cell.percentage,
                        sourceIds: cell.sourceIds,
                    });
                });

            const rowTotal =
                data.rowTotals.find((t) => t.id === row.id)?.count ?? 0;

            return {
                rowId: row.id,
                rowLabel: row.label,
                total: rowTotal,
                cells: cellMap,
            };
        });
    }, [data]);

    // Build columns dynamically based on col labels
    const columns = useMemo<ColumnDef<RowData>[]>(() => {
        if (!data) return [];

        const cols: ColumnDef<RowData>[] = [
            {
                accessorKey: "rowLabel",
                header: ({ column }) => (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="-ml-4"
                    >
                        {data.rowDimension.type === "facet" ? "Row" : data.rowDimension.type}
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
                    <div className="font-medium">{row.original.rowLabel}</div>
                ),
            },
        ];

        // Add a column for each col label
        data.colLabels.forEach((col) => {
            cols.push({
                id: `col_${col.id}`,
                header: () => (
                    <div className="text-center font-medium truncate max-w-20" title={col.label}>
                        {col.label}
                    </div>
                ),
                cell: ({ row }) => {
                    const cellData = row.original.cells.get(col.id);
                    const count = cellData?.count ?? 0;
                    const percentage = cellData?.percentage ?? 0;
                    const isGap = count <= gapThreshold;

                    return (
                        <button
                            className={cn(
                                "w-full text-center p-2 rounded transition-colors",
                                isGap && count === 0
                                    ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                                    : isGap
                                        ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                                        : "hover:bg-muted",
                                onCellClick && "cursor-pointer hover:bg-primary/10"
                            )}
                            onClick={() => {
                                if (onCellClick && cellData) {
                                    onCellClick({
                                        rowId: row.original.rowId,
                                        colId: col.id,
                                        rowLabel: row.original.rowLabel,
                                        colLabel: col.label,
                                        count: cellData.count,
                                        sourceIds: cellData.sourceIds,
                                    });
                                }
                            }}
                            disabled={!onCellClick || !cellData}
                        >
                            <span className="font-mono">{count}</span>
                            {showPercentages && (
                                <span className="text-xs text-muted-foreground ml-1">
                                    ({percentage.toFixed(1)}%)
                                </span>
                            )}
                        </button>
                    );
                },
            });
        });

        // Add total column
        cols.push({
            accessorKey: "total",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="font-semibold"
                >
                    Total
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
                <div className="text-center font-semibold font-mono">
                    {row.original.total}
                </div>
            ),
        });

        return cols;
    }, [data, gapThreshold, showPercentages, onCellClick]);

    const table = useReactTable({
        data: rowData,
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

    if (!data || data.cells.length === 0) {
        return (
            <Card>
                {title && (
                    <CardHeader>
                        <CardTitle className="text-base">{title}</CardTitle>
                    </CardHeader>
                )}
                <CardContent className="py-8 text-center text-muted-foreground">
                    No cross-tabulation data available
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
                <div className="rounded-md border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id} className="text-center">
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
                                            <TableCell key={cell.id} className="p-1">
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
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-24 text-center"
                                    >
                                        No results.
                                    </TableCell>
                                </TableRow>
                            )}
                            {/* Column totals row */}
                            <TableRow className="bg-muted/50 font-semibold">
                                <TableCell className="p-2">Total</TableCell>
                                {data.colLabels.map((col) => {
                                    const colTotal =
                                        data.colTotals.find((t) => t.id === col.id)?.count ?? 0;
                                    return (
                                        <TableCell key={col.id} className="text-center p-2">
                                            <span className="font-mono">{colTotal}</span>
                                        </TableCell>
                                    );
                                })}
                                <TableCell className="text-center p-2">
                                    <span className="font-mono">{data.grandTotal}</span>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
