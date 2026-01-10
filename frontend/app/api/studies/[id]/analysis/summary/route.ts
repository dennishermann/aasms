import { NextRequest, NextResponse } from "next/server";
import { getSummaryStats } from "@/lib/services/analysis";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studyId } = await params;

    const summary = await getSummaryStats(studyId);

    return NextResponse.json({ data: summary });
  } catch (error) {
    console.error("Error getting summary stats:", error);
    return NextResponse.json(
      { error: "Failed to get summary statistics" },
      { status: 500 }
    );
  }
}
