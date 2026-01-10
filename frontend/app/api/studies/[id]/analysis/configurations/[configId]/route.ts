import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ArtifactConfiguration } from "@/types/analysis";

// GET - Get a specific configuration
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; configId: string }> }
) {
  try {
    const { id: studyId, configId } = await params;

    const configuration = await prisma.analysisConfiguration.findFirst({
      where: {
        id: configId,
        studyId,
      },
    });

    if (!configuration) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

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
    console.error("Error getting configuration:", error);
    return NextResponse.json(
      { error: "Failed to get configuration" },
      { status: 500 }
    );
  }
}

// PUT - Update a configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; configId: string }> }
) {
  try {
    const { id: studyId, configId } = await params;
    const body = await request.json();

    const { name, description, artifacts } = body;

    // Verify configuration exists
    const existing = await prisma.analysisConfiguration.findFirst({
      where: {
        id: configId,
        studyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (artifacts !== undefined) updateData.artifacts = artifacts;

    const configuration = await prisma.analysisConfiguration.update({
      where: { id: configId },
      data: updateData,
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
    console.error("Error updating configuration:", error);
    return NextResponse.json(
      { error: "Failed to update configuration" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; configId: string }> }
) {
  try {
    const { id: studyId, configId } = await params;

    // Verify configuration exists
    const existing = await prisma.analysisConfiguration.findFirst({
      where: {
        id: configId,
        studyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

    await prisma.analysisConfiguration.delete({
      where: { id: configId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting configuration:", error);
    return NextResponse.json(
      { error: "Failed to delete configuration" },
      { status: 500 }
    );
  }
}
