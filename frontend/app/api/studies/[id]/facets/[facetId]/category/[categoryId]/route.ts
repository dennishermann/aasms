import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string; facetId: string; categoryId: string }>;
}

// PATCH: Update category name or description
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: studyId, facetId, categoryId } = await params;
    const body = await request.json().catch(() => ({}));

    // Verify the facet belongs to the study
    const facet = await prisma.facet.findFirst({
      where: { id: facetId, studyId },
    });
    if (!facet) {
      return NextResponse.json({ error: "Facet not found" }, { status: 404 });
    }

    // Verify the category belongs to the facet
    const existingCategory = await prisma.facetCategory.findFirst({
      where: { id: categoryId, facetId },
    });
    if (!existingCategory) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const updateData: { name?: string; description?: string | null } = {};

    if (typeof body.name === "string" && body.name.trim()) {
      // Check for duplicate name
      const duplicate = await prisma.facetCategory.findFirst({
        where: {
          facetId,
          name: body.name.trim(),
          NOT: { id: categoryId },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "A category with this name already exists" },
          { status: 400 },
        );
      }
      updateData.name = body.name.trim();
    }

    if (body.description !== undefined) {
      updateData.description = body.description || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.facetCategory.update({
      where: { id: categoryId },
      data: updateData,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[category] PATCH Error:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

// DELETE: Delete category and optionally reassign keywords
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: studyId, facetId, categoryId } = await params;
    const targetCategoryId = request.nextUrl.searchParams.get("targetCategoryId");

    // Verify the facet belongs to the study
    const facet = await prisma.facet.findFirst({
      where: { id: facetId, studyId },
    });
    if (!facet) {
      return NextResponse.json({ error: "Facet not found" }, { status: 404 });
    }

    // Verify the category exists
    const existingCategory = await prisma.facetCategory.findFirst({
      where: { id: categoryId, facetId },
    });
    if (!existingCategory) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // First, handle keyword mappings
    if (targetCategoryId) {
      // Move mappings to target category
      await prisma.facetKeywordMapping.updateMany({
        where: { categoryId },
        data: { categoryId: targetCategoryId },
      });
    } else {
      // Set mappings to uncategorized (null categoryId)
      await prisma.facetKeywordMapping.updateMany({
        where: { categoryId },
        data: { categoryId: null },
      });
    }

    // Delete the category
    await prisma.facetCategory.delete({
      where: { id: categoryId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[category] DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
