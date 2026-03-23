import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = vi.hoisted(() => ({
  source: {
    findFirst: vi.fn(),
  },
  sourceAnalysis: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  facetKeyword: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { PUT } from "./route";

function makeRequest(body: object): NextRequest {
  return new NextRequest(
    "http://localhost:3000/api/studies/study-1/sources/source-1/analysis/keywords",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

const routeParams = { params: Promise.resolve({ id: "study-1", sourceId: "source-1" }) };

describe("PUT /api/studies/[id]/sources/[sourceId]/analysis/keywords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when source not found", async () => {
    mockPrisma.source.findFirst.mockResolvedValue(null);

    const response = await PUT(
      makeRequest({ facetId: "facet-1", keywords: [{ keyword: "test" }] }),
      routeParams,
    );
    expect(response.status).toBe(404);
  });

  it("returns 400 for invalid payload", async () => {
    const response = await PUT(makeRequest({ invalid: true }), routeParams);
    expect(response.status).toBe(400);
  });

  it("returns 400 for empty keyword string", async () => {
    const response = await PUT(
      makeRequest({ facetId: "facet-1", keywords: [{ keyword: "" }] }),
      routeParams,
    );
    expect(response.status).toBe(400);
  });

  it("creates analysis if none exists, then saves keywords", async () => {
    mockPrisma.source.findFirst.mockResolvedValue({
      id: "source-1",
      studyId: "study-1",
      analysis: null,
    });
    mockPrisma.sourceAnalysis.create.mockResolvedValue({ id: "analysis-1" });
    mockPrisma.$transaction.mockResolvedValue([]);
    mockPrisma.sourceAnalysis.update.mockResolvedValue({});
    mockPrisma.sourceAnalysis.findUnique.mockResolvedValue({
      id: "analysis-1",
      classifications: [],
      facetKeywords: [{ id: "kw-1", facetId: "facet-1", keyword: "machine learning" }],
    });

    const response = await PUT(
      makeRequest({
        facetId: "facet-1",
        keywords: [{ keyword: "machine learning" }],
      }),
      routeParams,
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sourceAnalysis.create).toHaveBeenCalled();
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("deletes and recreates keywords for existing analysis", async () => {
    mockPrisma.source.findFirst.mockResolvedValue({
      id: "source-1",
      studyId: "study-1",
      analysis: { id: "analysis-1" },
    });
    mockPrisma.$transaction.mockResolvedValue([]);
    mockPrisma.sourceAnalysis.update.mockResolvedValue({});
    mockPrisma.sourceAnalysis.findUnique.mockResolvedValue({
      id: "analysis-1",
      classifications: [],
      facetKeywords: [
        { id: "kw-1", facetId: "facet-1", keyword: "deep learning", confidence: 0.9 },
      ],
    });

    const response = await PUT(
      makeRequest({
        facetId: "facet-1",
        keywords: [{ keyword: "deep learning", confidence: 0.9 }],
      }),
      routeParams,
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.facetKeywords).toHaveLength(1);
    expect(data.data.facetKeywords[0].keyword).toBe("deep learning");
  });

  it("handles empty keywords array (deletion)", async () => {
    mockPrisma.source.findFirst.mockResolvedValue({
      id: "source-1",
      studyId: "study-1",
      analysis: { id: "analysis-1" },
    });
    mockPrisma.$transaction.mockResolvedValue([]);
    mockPrisma.sourceAnalysis.update.mockResolvedValue({});
    mockPrisma.sourceAnalysis.findUnique.mockResolvedValue({
      id: "analysis-1",
      classifications: [],
      facetKeywords: [],
    });

    const response = await PUT(
      makeRequest({ facetId: "facet-1", keywords: [] }),
      routeParams,
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.facetKeywords).toHaveLength(0);
  });
});
