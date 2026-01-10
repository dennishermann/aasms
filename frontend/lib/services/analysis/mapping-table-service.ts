import { prisma } from "@/lib/db";
import type { MappingTableResult, MappingTableSource } from "@/types/analysis";
import { SourceStatus, Decision, Prisma } from "@prisma/client";

interface MappingTableOptions {
  facetIds?: string[];
  includeMetadata?: ("title" | "authors" | "year" | "venue" | "sourceType")[];
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Get mapping table data (sources × facets matrix)
 */
export async function getMappingTableData(
  studyId: string,
  options: MappingTableOptions = {}
): Promise<MappingTableResult> {
  const {
    facetIds,
    includeMetadata = ["title", "authors", "year", "venue", "sourceType"],
    page = 1,
    pageSize = 50,
    sortBy = "title",
    sortOrder = "asc",
  } = options;

  // Build sort order
  const orderBy: Prisma.SourceOrderByWithRelationInput = {};
  if (sortBy === "year") {
    orderBy.publicationDate = sortOrder;
  } else if (sortBy === "venue") {
    orderBy.venue = sortOrder;
  } else {
    orderBy.title = sortOrder;
  }

  // Get total count
  const total = await prisma.source.count({
    where: {
      studyId,
      status: SourceStatus.CLASSIFIED,
      finalDecision: Decision.INCLUDE,
    },
  });

  // Get sources with classifications
  const sources = await prisma.source.findMany({
    where: {
      studyId,
      status: SourceStatus.CLASSIFIED,
      finalDecision: Decision.INCLUDE,
    },
    include: {
      analysis: {
        include: {
          classifications: {
            where: facetIds && facetIds.length > 0 ? { facetId: { in: facetIds } } : {},
            include: {
              facet: true,
              category: true,
            },
          },
        },
      },
    },
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  // Transform to mapping table format
  const mappedSources: MappingTableSource[] = sources.map((source) => {
    // Group classifications by facet
    const classifications: { [facetId: string]: string[] } = {};

    if (source.analysis?.classifications) {
      for (const c of source.analysis.classifications) {
        if (!classifications[c.facetId]) {
          classifications[c.facetId] = [];
        }

        // Get the display value (category name or raw value)
        const displayValue = c.category?.name || c.value || "Unknown";
        classifications[c.facetId].push(displayValue);
      }
    }

    // Build result object
    const result: MappingTableSource = {
      id: source.id,
      classifications,
    };

    // Add requested metadata
    if (includeMetadata.includes("title")) {
      result.title = source.title;
    }
    if (includeMetadata.includes("authors")) {
      result.authors = source.authors;
    }
    if (includeMetadata.includes("year")) {
      result.year = source.publicationDate
        ? source.publicationDate.getFullYear()
        : null;
    }
    if (includeMetadata.includes("venue")) {
      result.venue = source.venue;
    }
    if (includeMetadata.includes("sourceType")) {
      result.sourceCategory = source.sourceCategory;
    }

    return result;
  });

  return {
    sources: mappedSources,
    total,
    page,
    pageSize,
  };
}

/**
 * Get all mapping table data for CSV export (no pagination)
 */
export async function getMappingTableForExport(
  studyId: string,
  facetIds?: string[]
): Promise<MappingTableSource[]> {
  // Get all facets for the study
  const facets = await prisma.facet.findMany({
    where: {
      studyId,
      ...(facetIds && facetIds.length > 0 ? { id: { in: facetIds } } : {}),
    },
    orderBy: { order: "asc" },
  });

  // Get all sources with classifications
  const sources = await prisma.source.findMany({
    where: {
      studyId,
      status: SourceStatus.CLASSIFIED,
      finalDecision: Decision.INCLUDE,
    },
    include: {
      analysis: {
        include: {
          classifications: {
            where: facetIds && facetIds.length > 0 ? { facetId: { in: facetIds } } : {},
            include: {
              facet: true,
              category: true,
            },
          },
        },
      },
    },
    orderBy: { title: "asc" },
  });

  return sources.map((source) => {
    const classifications: { [facetId: string]: string[] } = {};

    // Initialize all facets with empty arrays
    for (const facet of facets) {
      classifications[facet.id] = [];
    }

    // Populate with actual values
    if (source.analysis?.classifications) {
      for (const c of source.analysis.classifications) {
        const displayValue = c.category?.name || c.value || "Unknown";
        classifications[c.facetId].push(displayValue);
      }
    }

    return {
      id: source.id,
      title: source.title,
      authors: source.authors,
      year: source.publicationDate ? source.publicationDate.getFullYear() : null,
      venue: source.venue,
      sourceCategory: source.sourceCategory,
      classifications,
    };
  });
}

/**
 * Generate CSV content for mapping table
 */
export async function generateMappingTableCsv(
  studyId: string,
  facetIds?: string[]
): Promise<string> {
  // Get facets for headers
  const facets = await prisma.facet.findMany({
    where: {
      studyId,
      ...(facetIds && facetIds.length > 0 ? { id: { in: facetIds } } : {}),
    },
    orderBy: { order: "asc" },
  });

  // Get data
  const sources = await getMappingTableForExport(studyId, facetIds);

  // Build CSV header
  const headers = [
    "ID",
    "Title",
    "Authors",
    "Year",
    "Venue",
    "Source Category",
    ...facets.map((f) => f.name),
  ];

  // Build CSV rows
  const rows = sources.map((source) => {
    const facetValues = facets.map((f) => {
      const values = source.classifications[f.id] || [];
      // Escape and join multiple values with semicolon
      return values.map((v) => v.replace(/"/g, '""')).join("; ");
    });

    return [
      source.id,
      source.title || "",
      (source.authors || []).join("; "),
      source.year?.toString() || "",
      source.venue || "",
      source.sourceCategory || "",
      ...facetValues,
    ];
  });

  // Generate CSV content
  const csvContent = [
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  return csvContent;
}
