import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const databaseSource = formData.get("databaseSource") as string;

    if (!file || !databaseSource) {
      return NextResponse.json({ error: "File and database source are required" }, { status: 400 });
    }

    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

    // Forward to Python service for parsing ONLY
    const pythonFormData = new FormData();
    pythonFormData.append("file", file);
    pythonFormData.append("database_source", databaseSource);

    const response = await fetch(`${pythonServiceUrl}/api/import/parse`, {
      method: "POST",
      body: pythonFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Python service error:", errorText);
      throw new Error(`Python service failed: ${response.statusText}`);
    }

    const parsedData = await response.json();

    return NextResponse.json({
      success: true,
      sources: parsedData,
    });
  } catch (error) {
    console.error("Import preview error:", error);
    return NextResponse.json(
      {
        error: "Failed to parse import file",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 },
    );
  }
}
