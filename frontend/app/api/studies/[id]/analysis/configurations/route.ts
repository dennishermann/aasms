import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ArtifactConfiguration } from "@/types/analysis";

// GET - List all configurations for a study
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;

    const configurations = await prisma.analysisConfiguration.findMany({
      where: { studyId },
      orderBy: { updatedAt: "desc" },
    });

    // Transform artifacts from JSON to typed array
    const transformedConfigs = configurations.map((config) => ({
      id: config.id,
      studyId: config.studyId,
      name: config.name,
      description: config.description,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
      artifacts: config.artifacts as unknown as ArtifactConfiguration[],
    }));

    return NextResponse.json({ data: transformedConfigs });
  } catch (error) {
    console.error("Error getting configurations:", error);
    return NextResponse.json({ error: "Failed to get configurations" }, { status: 500 });
  }
}

// POST - Create a new configuration
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studyId } = await params;
    const body = await request.json();

    const { name, description, artifacts } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (!artifacts || !Array.isArray(artifacts)) {
      return NextResponse.json({ error: "artifacts must be an array" }, { status: 400 });
    }

    // Verify study exists
    const study = await prisma.study.findUnique({
      where: { id: studyId },
    });

    if (!study) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

    const configuration = await prisma.analysisConfiguration.create({
      data: {
        studyId,
        name,
        description,
        artifacts: artifacts as any,
      },
    });

    return NextResponse.json({
      data: {
        id: configuration.id,
        studyId: configuration.studyId,
        name: configuration.name,
        description: configuration.description,
        createdAt: configuration.createdAt.toISOString(),
        updatedAt: configuration.updatedAt.toISOString(),
        artifacts: configuration.artifacts as unknown as ArtifactConfiguration[],
      },
    });
  } catch (error) {
    console.error("Error creating configuration:", error);
    return NextResponse.json({ error: "Failed to create configuration" }, { status: 500 });
  }
}
