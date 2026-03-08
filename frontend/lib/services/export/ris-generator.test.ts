import { describe, it, expect } from "vitest";
import { generateRISEntry, generateRISFile } from "./ris-generator";

function makeSource(overrides: Record<string, unknown> = {}) {
  return {
    id: "1",
    title: "A Test Paper",
    authors: ["John Smith", "Jane Doe"],
    publicationDate: new Date("2024-06-15"),
    venue: "Journal of Testing",
    venueType: "JOURNAL",
    doi: "10.1234/test.2024",
    abstract: "This is a test abstract.",
    keywords: ["testing", "vitest"],
    originalUrl: "https://example.com/paper",
    ...overrides,
  } as any;
}

describe("generateRISEntry", () => {
  it("generates a journal entry", () => {
    const source = makeSource();
    const result = generateRISEntry(source);

    expect(result).toContain("TY  - JOUR");
    expect(result).toContain("TI  - A Test Paper");
    expect(result).toContain("AU  - John Smith");
    expect(result).toContain("AU  - Jane Doe");
    expect(result).toContain("PY  - 2024");
    expect(result).toContain("JO  - Journal of Testing");
    expect(result).toContain("DO  - 10.1234/test.2024");
    expect(result).toContain("AB  - This is a test abstract.");
    expect(result).toContain("KW  - testing");
    expect(result).toContain("KW  - vitest");
    expect(result).toContain("UR  - https://example.com/paper");
    expect(result).toContain("ER  - ");
  });

  it("uses CONF for conference papers", () => {
    const source = makeSource({ venueType: "CONFERENCE" });
    const result = generateRISEntry(source);
    expect(result).toContain("TY  - CONF");
  });

  it("uses CHAP for book chapters", () => {
    const source = makeSource({ venueType: "BOOK_CHAPTER" });
    const result = generateRISEntry(source);
    expect(result).toContain("TY  - CHAP");
  });

  it("uses ELEC for blog posts", () => {
    const source = makeSource({ venueType: "BLOG" });
    const result = generateRISEntry(source);
    expect(result).toContain("TY  - ELEC");
  });

  it("defaults to JOUR when no venueType", () => {
    const source = makeSource({ venueType: null });
    const result = generateRISEntry(source);
    expect(result).toContain("TY  - JOUR");
  });

  it("omits optional fields when not present", () => {
    const source = makeSource({
      authors: [],
      publicationDate: null,
      venue: null,
      doi: null,
      abstract: null,
      keywords: [],
      originalUrl: null,
    });
    const result = generateRISEntry(source);

    expect(result).toContain("TY  - JOUR");
    expect(result).toContain("TI  - A Test Paper");
    expect(result).toContain("ER  - ");
    expect(result).not.toContain("AU  -");
    expect(result).not.toContain("PY  -");
    expect(result).not.toContain("JO  -");
    expect(result).not.toContain("DO  -");
  });

  it("always ends with ER tag", () => {
    const source = makeSource();
    const result = generateRISEntry(source);
    const lines = result.split("\n");
    expect(lines[lines.length - 1]).toBe("ER  - ");
  });
});

describe("generateRISFile", () => {
  it("returns empty string for no sources", () => {
    expect(generateRISFile([])).toBe("");
  });

  it("joins entries with newlines", () => {
    const sources = [makeSource(), makeSource({ title: "Second Paper" })];
    const result = generateRISFile(sources);
    // Each entry ends with ER, entries are joined with \n
    const entries = result.split("ER  - ");
    expect(entries.length).toBe(3); // 2 entries + trailing empty
  });
});
