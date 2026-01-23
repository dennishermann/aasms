import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string; facetId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: studyId, facetId } = await params;
    const status = request.nextUrl.searchParams.get("status");

    const facet = await prisma.facet.findFirst({
      where: { id: facetId, studyId },
    });
    if (!facet) {
      return NextResponse.json({ error: "Facet not found" }, { status: 404 });
    }

    const mappings = await prisma.facetKeywordMapping.findMany({
      where: {
        facetId,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        category: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ data: mappings });
  } catch (error) {
    console.error("[coding/mappings] Error:", error);
    return NextResponse.json({ error: "Failed to fetch mappings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: studyId, facetId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action as string | undefined;

    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }

    // Batch operations
    if (action === "batch-approve" || action === "batch-reject") {
      const mappingIds = body.mappingIds as string[] | undefined;
      if (!mappingIds || !Array.isArray(mappingIds) || mappingIds.length === 0) {
        return NextResponse.json({ error: "mappingIds array is required for batch operations" }, { status: 400 });
      }

      const newStatus = action === "batch-approve" ? "APPROVED" : "REJECTED";
      const categoryId = body.categoryId as string | undefined;

      const updated = await prisma.facetKeywordMapping.updateMany({
        where: {
          id: { in: mappingIds },
          facetId,
        },
        data: {
          status: newStatus,
          source: "USER",
          ...(newStatus === "APPROVED" && categoryId ? { categoryId } : {}),
        },
      });

      return NextResponse.json({ data: { count: updated.count } });
    }

    // Single mapping operations
    const mappingId = body.mappingId as string | undefined;
    if (!mappingId) {
      return NextResponse.json({ error: "mappingId is required" }, { status: 400 });
    }

    const mapping = await prisma.facetKeywordMapping.findFirst({
      where: { id: mappingId, facetId },
    });
    if (!mapping) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
    }

    // Reassign action - move keyword to different category
    if (action === "reassign") {
      const categoryId = body.categoryId as string | null;

      const updated = await prisma.facetKeywordMapping.update({
        where: { id: mappingId },
        data: {
          categoryId: categoryId,
          source: "USER",
        },
        include: { category: true },
      });
      return NextResponse.json({ data: updated });
    }

    if (action === "reject") {
      const updated = await prisma.facetKeywordMapping.update({
        where: { id: mappingId },
        data: {
          status: "REJECTED",
          source: "USER",
        },
        include: { category: true },
      });
      return NextResponse.json({ data: updated });
    }

    if (action !== "approve") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    let categoryId = body.categoryId as string | undefined;
    const createCategory = Boolean(body.createCategory);
    const categoryName = body.categoryName as string | undefined;
    const categoryDescription = body.categoryDescription as string | undefined;

    if (createCategory) {
      if (!categoryName) {
        return NextResponse.json({ error: "categoryName is required to create a category" }, { status: 400 });
      }
      const category = await prisma.facetCategory.upsert({
        where: {
          facetId_name: { facetId, name: categoryName },
        },
        create: {
          facetId,
          name: categoryName,
          description: categoryDescription || null,
          order: 0,
        },
        update: {
          description: categoryDescription || undefined,
        },
      });
      categoryId = category.id;
    }

    const updated = await prisma.facetKeywordMapping.update({
      where: { id: mappingId },
      data: {
        categoryId: categoryId || null,
        status: "APPROVED",
        source: "USER",
      },
      include: { category: true },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[coding/mappings] Error:", error);
    return NextResponse.json({ error: "Failed to update mapping" }, { status: 500 });
  }
}

