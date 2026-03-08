import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studyId } = await context.params;

    if (!studyId) {
      return NextResponse.json(
        { error: "Study ID is required" },
        { status: 400 }
      );
    }

    // Call Python service export endpoint
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

    const response = await fetch(`${pythonServiceUrl}/api/export/full`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        studyId: studyId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
      return NextResponse.json(
        { error: errorData.detail || "Export failed" },
        { status: response.status }
      );
    }

    // Get the Excel file as a blob
    const excelBuffer = await response.arrayBuffer();

    // Return the file with proper headers
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="study-${studyId}-export.xlsx"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}
