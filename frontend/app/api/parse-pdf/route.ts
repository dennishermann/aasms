import { NextRequest, NextResponse } from "next/server";
import { PYTHON_SERVICE_URL } from "@/lib/python-service";


export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    }

    const forward = new FormData();
    forward.append("file", file);

    const res = await fetch(`${PYTHON_SERVICE_URL}/api/parse-pdf?include_content=false`, {
      method: "POST",
      body: forward,
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      return NextResponse.json({ error: "Parse service failed", detail }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error proxying parse-pdf:", error);
    return NextResponse.json({ error: "Failed to parse PDF" }, { status: 500 });
  }
}
