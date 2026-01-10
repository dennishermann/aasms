import { NextRequest, NextResponse } from "next/server";
import { getFrequencyData, getCrossTabData, generateMappingTableCsv } from "@/lib/services/analysis";
import type { ExportRequest, DimensionConfig, Filter } from "@/types/analysis";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studyId } = await params;
    const body: ExportRequest = await request.json();

    const { type, format, config, filters } = body;

    if (!type || !format) {
      return NextResponse.json(
        { error: "type and format are required" },
        { status: 400 }
      );
    }

    if (format !== "csv") {
      return NextResponse.json(
        { error: "Only CSV format is currently supported for data export" },
        { status: 400 }
      );
    }

    let csvContent: string;
    let filename: string;

    switch (type) {
      case "frequency": {
        if (!config || !("dimension" in config) || !config.dimension) {
          return NextResponse.json(
            { error: "config.dimension is required for frequency export" },
            { status: 400 }
          );
        }

        const result = await getFrequencyData(
          studyId,
          config.dimension as DimensionConfig,
          filters
        );

        // Generate CSV
        const headers = ["Category", "Count", "Percentage"];
        const rows = result.items.map((item) => [
          item.label,
          item.count.toString(),
          `${item.percentage}%`,
        ]);

        // Add total row
        rows.push(["Total", result.total.toString(), "100%"]);

        csvContent = [
          headers.map((h) => `"${h}"`).join(","),
          ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
        ].join("\n");

        filename = `frequency-${Date.now()}.csv`;
        break;
      }

      case "crosstab": {
        if (
          !config ||
          !("rowDimension" in config) ||
          !config.rowDimension ||
          !("colDimension" in config) ||
          !config.colDimension
        ) {
          return NextResponse.json(
            { error: "config.rowDimension and config.colDimension are required for crosstab export" },
            { status: 400 }
          );
        }

        const result = await getCrossTabData(
          studyId,
          config.rowDimension as DimensionConfig,
          config.colDimension as DimensionConfig,
          filters
        );

        // Generate CSV matrix
        const headers = ["", ...result.colLabels.map((c) => c.label), "Total"];
        const rows: string[][] = [];

        for (const row of result.rowLabels) {
          const rowData = [row.label];
          for (const col of result.colLabels) {
            const cell = result.cells.find(
              (c) => c.rowId === row.id && c.colId === col.id
            );
            rowData.push(cell ? cell.count.toString() : "0");
          }
          // Add row total
          const rowTotal = result.rowTotals.find((t) => t.id === row.id);
          rowData.push(rowTotal ? rowTotal.count.toString() : "0");
          rows.push(rowData);
        }

        // Add column totals row
        const totalRow = ["Total"];
        for (const col of result.colLabels) {
          const colTotal = result.colTotals.find((t) => t.id === col.id);
          totalRow.push(colTotal ? colTotal.count.toString() : "0");
        }
        totalRow.push(result.grandTotal.toString());
        rows.push(totalRow);

        csvContent = [
          headers.map((h) => `"${h}"`).join(","),
          ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
        ].join("\n");

        filename = `crosstab-${Date.now()}.csv`;
        break;
      }

      case "mapping-table": {
        csvContent = await generateMappingTableCsv(studyId);
        filename = `mapping-table-${Date.now()}.csv`;
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown export type: ${type}` },
          { status: 400 }
        );
    }

    // Return CSV as downloadable file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting data:", error);
    return NextResponse.json(
      {
        error: "Failed to export data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
