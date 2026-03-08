import { describe, it, expect } from "vitest";
import {
  createStudySchema,
  updateStudySchema,
  studyParametersSchema,
  uploadSourceSchema,
} from "./validations";

describe("createStudySchema", () => {
  it("validates a minimal study", () => {
    const result = createStudySchema.parse({ title: "My Study" });
    expect(result.title).toBe("My Study");
    expect(result.status).toBe("DRAFT");
  });

  it("rejects empty title", () => {
    expect(() => createStudySchema.parse({ title: "" })).toThrow();
  });

  it("rejects missing title", () => {
    expect(() => createStudySchema.parse({})).toThrow();
  });

  it("accepts optional fields", () => {
    const result = createStudySchema.parse({
      title: "Study",
      description: "A description",
      motivation: "Why this study",
      status: "ACTIVE",
    });
    expect(result.description).toBe("A description");
    expect(result.status).toBe("ACTIVE");
  });

  it("rejects invalid status", () => {
    expect(() => createStudySchema.parse({ title: "Study", status: "INVALID" })).toThrow();
  });

  it("rejects title over 500 chars", () => {
    expect(() => createStudySchema.parse({ title: "x".repeat(501) })).toThrow();
  });

  it("validates research questions", () => {
    const result = createStudySchema.parse({
      title: "Study",
      researchQuestions: [{ question: "RQ1?", order: 0 }],
    });
    expect(result.researchQuestions).toHaveLength(1);
  });

  it("rejects empty research question", () => {
    expect(() =>
      createStudySchema.parse({
        title: "Study",
        researchQuestions: [{ question: "", order: 0 }],
      }),
    ).toThrow();
  });
});

describe("updateStudySchema", () => {
  it("allows all fields to be optional", () => {
    const result = updateStudySchema.parse({});
    expect(result).toEqual({});
  });

  it("validates partial updates", () => {
    const result = updateStudySchema.parse({ title: "New Title" });
    expect(result.title).toBe("New Title");
  });
});

describe("studyParametersSchema", () => {
  it("validates empty parameters", () => {
    const result = studyParametersSchema.parse({});
    expect(result).toBeDefined();
  });

  it("validates inclusion criteria", () => {
    const result = studyParametersSchema.parse({
      inclusionCriteria: [{ criterion: "Must be about AI", order: 0 }],
    });
    expect(result.inclusionCriteria).toHaveLength(1);
  });

  it("rejects empty criterion text", () => {
    expect(() =>
      studyParametersSchema.parse({
        inclusionCriteria: [{ criterion: "", order: 0 }],
      }),
    ).toThrow();
  });

  it("validates formal sources", () => {
    const result = studyParametersSchema.parse({
      formalSources: [{ name: "IEEE", type: "ACADEMIC_DATABASE" }],
    });
    expect(result.formalSources).toHaveLength(1);
  });

  it("rejects invalid formal source type", () => {
    expect(() =>
      studyParametersSchema.parse({
        formalSources: [{ name: "IEEE", type: "INVALID" }],
      }),
    ).toThrow();
  });
});

describe("uploadSourceSchema", () => {
  it("accepts minimal source", () => {
    const result = uploadSourceSchema.parse({});
    expect(result).toBeDefined();
  });

  it("accepts full source", () => {
    const result = uploadSourceSchema.parse({
      title: "Paper Title",
      authors: ["Author One"],
      publicationDate: "2024-01-15",
      venue: "Some Journal",
      doi: "10.1234/test",
      abstract: "Abstract text",
      keywords: ["kw1", "kw2"],
      sourceCategory: "FORMAL",
    });
    expect(result.title).toBe("Paper Title");
    expect(result.sourceCategory).toBe("FORMAL");
  });

  it("accepts nullable fields", () => {
    const result = uploadSourceSchema.parse({
      publicationDate: null,
      venue: null,
      doi: null,
    });
    expect(result.publicationDate).toBeNull();
  });

  it("rejects invalid source category", () => {
    expect(() => uploadSourceSchema.parse({ sourceCategory: "INVALID" })).toThrow();
  });
});
