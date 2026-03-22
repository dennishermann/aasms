import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = vi.hoisted(() => ({
  studyParameters: {
    upsert: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  formalSource: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { GET, PATCH } from "./route";

function makeRequest(body?: object): NextRequest {
  if (body) {
    return new NextRequest("http://localhost:3000/api/studies/study-1/parameters/search-strategy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  return new NextRequest("http://localhost:3000/api/studies/study-1/parameters/search-strategy");
}

const routeParams = { params: Promise.resolve({ id: "study-1" }) };

describe("GET /api/studies/[id]/parameters/search-strategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns PICO fields and formalSources", async () => {
    mockPrisma.studyParameters.upsert.mockResolvedValue({
      id: "params-1",
      studyId: "study-1",
      picoPopulation: "Software engineers",
      picoIntervention: "AI tools",
      picoComparison: null,
      picoOutcome: "Productivity",
      formalSources: [
        {
          id: "fs-1",
          parametersId: "params-1",
          name: "IEEE Xplore",
          type: "ACADEMIC_DATABASE",
          searchString: "AI AND productivity",
          dateRange: null,
        },
      ],
    });

    const response = await GET(makeRequest(), routeParams);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.picoPopulation).toBe("Software engineers");
    expect(json.data.picoIntervention).toBe("AI tools");
    expect(json.data.picoComparison).toBeNull();
    expect(json.data.picoOutcome).toBe("Productivity");
    expect(json.data.formalSources).toHaveLength(1);
    expect(json.data.formalSources[0].name).toBe("IEEE Xplore");
  });

  it("creates parameters if none exist (upsert)", async () => {
    mockPrisma.studyParameters.upsert.mockResolvedValue({
      id: "params-new",
      studyId: "study-1",
      picoPopulation: null,
      picoIntervention: null,
      picoComparison: null,
      picoOutcome: null,
      formalSources: [],
    });

    const response = await GET(makeRequest(), routeParams);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.picoPopulation).toBeNull();
    expect(json.data.formalSources).toHaveLength(0);
    expect(mockPrisma.studyParameters.upsert).toHaveBeenCalledWith({
      where: { studyId: "study-1" },
      create: { studyId: "study-1" },
      update: {},
      include: { formalSources: true },
    });
  });

  it("returns 500 on database error", async () => {
    mockPrisma.studyParameters.upsert.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest(), routeParams);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to fetch search strategy");
  });
});

describe("PATCH /api/studies/[id]/parameters/search-strategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates PICO fields", async () => {
    mockPrisma.studyParameters.upsert.mockResolvedValue({ id: "params-1", studyId: "study-1" });
    mockPrisma.studyParameters.update.mockResolvedValue({});
    mockPrisma.studyParameters.findUnique.mockResolvedValue({
      id: "params-1",
      picoPopulation: "Developers",
      picoIntervention: "Code review",
      picoComparison: "No review",
      picoOutcome: "Bug rate",
      formalSources: [],
    });

    const response = await PATCH(
      makeRequest({
        picoPopulation: "Developers",
        picoIntervention: "Code review",
        picoComparison: "No review",
        picoOutcome: "Bug rate",
      }),
      routeParams,
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.picoPopulation).toBe("Developers");
    expect(json.data.picoOutcome).toBe("Bug rate");
    expect(mockPrisma.studyParameters.update).toHaveBeenCalledWith({
      where: { id: "params-1" },
      data: {
        picoPopulation: "Developers",
        picoIntervention: "Code review",
        picoComparison: "No review",
        picoOutcome: "Bug rate",
      },
    });
  });

  it("replaces formalSources when provided", async () => {
    mockPrisma.studyParameters.upsert.mockResolvedValue({ id: "params-1", studyId: "study-1" });
    mockPrisma.studyParameters.update.mockResolvedValue({});
    mockPrisma.formalSource.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.formalSource.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.studyParameters.findUnique.mockResolvedValue({
      id: "params-1",
      picoPopulation: null,
      picoIntervention: null,
      picoComparison: null,
      picoOutcome: null,
      formalSources: [
        { id: "fs-1", name: "ACM DL", type: "ACADEMIC_DATABASE", searchString: null, dateRange: null },
        { id: "fs-2", name: "IEEE Xplore", type: "ACADEMIC_DATABASE", searchString: "test", dateRange: null },
      ],
    });

    const response = await PATCH(
      makeRequest({
        formalSources: [
          { name: "ACM DL", type: "ACADEMIC_DATABASE" },
          { name: "IEEE Xplore", type: "ACADEMIC_DATABASE", searchString: "test" },
        ],
      }),
      routeParams,
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.formalSources).toHaveLength(2);
    expect(mockPrisma.formalSource.deleteMany).toHaveBeenCalledWith({
      where: { parametersId: "params-1" },
    });
    expect(mockPrisma.formalSource.createMany).toHaveBeenCalledWith({
      data: [
        { parametersId: "params-1", name: "ACM DL", type: "ACADEMIC_DATABASE", searchString: null, dateRange: null },
        { parametersId: "params-1", name: "IEEE Xplore", type: "ACADEMIC_DATABASE", searchString: "test", dateRange: null },
      ],
    });
  });

  it("does not touch formalSources when not provided", async () => {
    mockPrisma.studyParameters.upsert.mockResolvedValue({ id: "params-1", studyId: "study-1" });
    mockPrisma.studyParameters.update.mockResolvedValue({});
    mockPrisma.studyParameters.findUnique.mockResolvedValue({
      id: "params-1",
      picoPopulation: "Pop",
      picoIntervention: null,
      picoComparison: null,
      picoOutcome: null,
      formalSources: [],
    });

    await PATCH(makeRequest({ picoPopulation: "Pop" }), routeParams);

    expect(mockPrisma.formalSource.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.formalSource.createMany).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid formalSource type", async () => {
    const response = await PATCH(
      makeRequest({
        formalSources: [{ name: "Test", type: "INVALID_TYPE" }],
      }),
      routeParams,
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Validation failed");
  });

  it("returns 400 for empty formalSource name", async () => {
    const response = await PATCH(
      makeRequest({
        formalSources: [{ name: "", type: "ACADEMIC_DATABASE" }],
      }),
      routeParams,
    );

    expect(response.status).toBe(400);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.studyParameters.upsert.mockRejectedValue(new Error("DB error"));

    const response = await PATCH(
      makeRequest({ picoPopulation: "Test" }),
      routeParams,
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to save search strategy");
  });

  it("handles empty formalSources array (clears all)", async () => {
    mockPrisma.studyParameters.upsert.mockResolvedValue({ id: "params-1", studyId: "study-1" });
    mockPrisma.studyParameters.update.mockResolvedValue({});
    mockPrisma.formalSource.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.studyParameters.findUnique.mockResolvedValue({
      id: "params-1",
      picoPopulation: null,
      picoIntervention: null,
      picoComparison: null,
      picoOutcome: null,
      formalSources: [],
    });

    const response = await PATCH(makeRequest({ formalSources: [] }), routeParams);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.formalSource.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.formalSource.createMany).not.toHaveBeenCalled();
    expect(json.data.formalSources).toHaveLength(0);
  });
});
