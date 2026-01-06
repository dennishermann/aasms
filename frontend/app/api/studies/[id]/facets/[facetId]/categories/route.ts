import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET - List all categories for a facet
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; facetId: string }> }
) {
    try {
        const { id: studyId, facetId } = await params;

        // Verify facet belongs to study
        const facet = await prisma.facet.findFirst({
            where: { id: facetId, studyId },
        });

        if (!facet) {
            return NextResponse.json(
                { error: "Facet not found" },
                { status: 404 }
            );
        }

        const categories = await prisma.facetCategory.findMany({
            where: { facetId },
            orderBy: { order: "asc" },
        });

        return NextResponse.json({ data: categories });
    } catch (error) {
        console.error("Error fetching categories:", error);
        return NextResponse.json(
            { error: "Failed to fetch categories" },
            { status: 500 }
        );
    }
}

// POST - Add a new category to a facet
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; facetId: string }> }
) {
    try {
        const { id: studyId, facetId } = await params;
        const body = await request.json();

        const { name, description } = body;

        if (!name) {
            return NextResponse.json(
                { error: "Category name is required" },
                { status: 400 }
            );
        }

        // Verify facet belongs to study
        const facet = await prisma.facet.findFirst({
            where: { id: facetId, studyId },
        });

        if (!facet) {
            return NextResponse.json(
                { error: "Facet not found" },
                { status: 404 }
            );
        }

        // Get next order value
        const lastCategory = await prisma.facetCategory.findFirst({
            where: { facetId },
            orderBy: { order: "desc" },
        });
        const nextOrder = (lastCategory?.order ?? -1) + 1;

        const category = await prisma.facetCategory.create({
            data: {
                facetId,
                name,
                description,
                order: nextOrder,
            },
        });

        return NextResponse.json({ data: category }, { status: 201 });
    } catch (error: any) {
        // Handle unique constraint violation
        if (error?.code === "P2002") {
            return NextResponse.json(
                { error: "Category with this name already exists in this facet" },
                { status: 409 }
            );
        }
        console.error("Error creating category:", error);
        return NextResponse.json(
            { error: "Failed to create category" },
            { status: 500 }
        );
    }
}

// PUT - Bulk update categories (for reordering)
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; facetId: string }> }
) {
    try {
        const { id: studyId, facetId } = await params;
        const body = await request.json();
        const { categories } = body;

        if (!Array.isArray(categories)) {
            return NextResponse.json(
                { error: "categories array is required" },
                { status: 400 }
            );
        }

        // Verify facet belongs to study
        const facet = await prisma.facet.findFirst({
            where: { id: facetId, studyId },
        });

        if (!facet) {
            return NextResponse.json(
                { error: "Facet not found" },
                { status: 404 }
            );
        }

        // Update each category's order
        await Promise.all(
            categories.map((cat: { id: string; order: number }) =>
                prisma.facetCategory.update({
                    where: { id: cat.id },
                    data: { order: cat.order },
                })
            )
        );

        // Fetch updated categories
        const updatedCategories = await prisma.facetCategory.findMany({
            where: { facetId },
            orderBy: { order: "asc" },
        });

        return NextResponse.json({ data: updatedCategories });
    } catch (error) {
        console.error("Error updating categories:", error);
        return NextResponse.json(
            { error: "Failed to update categories" },
            { status: 500 }
        );
    }
}

// DELETE - Delete a category by ID (via query param)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; facetId: string }> }
) {
    try {
        const { id: studyId, facetId } = await params;
        const { searchParams } = new URL(request.url);
        const categoryId = searchParams.get("categoryId");

        if (!categoryId) {
            return NextResponse.json(
                { error: "categoryId query parameter is required" },
                { status: 400 }
            );
        }

        // Verify facet belongs to study
        const facet = await prisma.facet.findFirst({
            where: { id: facetId, studyId },
        });

        if (!facet) {
            return NextResponse.json(
                { error: "Facet not found" },
                { status: 404 }
            );
        }

        // Verify category belongs to facet
        const category = await prisma.facetCategory.findFirst({
            where: { id: categoryId, facetId },
        });

        if (!category) {
            return NextResponse.json(
                { error: "Category not found" },
                { status: 404 }
            );
        }

        await prisma.facetCategory.delete({
            where: { id: categoryId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting category:", error);
        return NextResponse.json(
            { error: "Failed to delete category" },
            { status: 500 }
        );
    }
}
