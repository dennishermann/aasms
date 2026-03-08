import { describe, it, expect } from "vitest";
import { generateBibTeXEntry, generateBibTeXFile } from "./bibtex-generator";

// Minimal Source-like object for testing
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
    bibtex: null,
    originalUrl: null,
    ...overrides,
  } as any;
}

describe("generateBibTeXEntry", () => {
  it("generates a basic article entry", () => {
    const source = makeSource();
    const result = generateBibTeXEntry(source);

    expect(result).toContain("@article{smith2024,");
    expect(result).toContain("title = {A Test Paper}");
    expect(result).toContain("author = {John Smith and Jane Doe}");
    expect(result).toContain("year = {2024}");
    expect(result).toContain("journal = {Journal of Testing}");
    expect(result).toContain("doi = {10.1234/test.2024}");
    expect(result).toContain("abstract = {This is a test abstract.}");
    expect(result).toContain("keywords = {testing, vitest}");
  });

  it("returns existing bibtex if present", () => {
    const source = makeSource({ bibtex: "@article{existing, title={Existing}}" });
    const result = generateBibTeXEntry(source);
    expect(result).toBe("@article{existing, title={Existing}}");
  });

  it("uses inproceedings for conference papers", () => {
    const source = makeSource({ venueType: "CONFERENCE" });
    const result = generateBibTeXEntry(source);
    expect(result).toContain("@inproceedings{");
    expect(result).toContain("booktitle = {Journal of Testing}");
  });

  it("uses misc for blog posts", () => {
    const source = makeSource({ venueType: "BLOG" });
    const result = generateBibTeXEntry(source);
    expect(result).toContain("@misc{");
  });

  it("defaults to article when no venueType", () => {
    const source = makeSource({ venueType: null });
    const result = generateBibTeXEntry(source);
    expect(result).toContain("@article{");
  });

  it("escapes special characters", () => {
    const source = makeSource({ title: "Testing & Analysis: 100% Success with $" });
    const result = generateBibTeXEntry(source);
    expect(result).toContain("Testing \\& Analysis: 100\\% Success with \\$");
  });

  it("handles source with no authors", () => {
    const source = makeSource({ authors: [] });
    const result = generateBibTeXEntry(source);
    expect(result).not.toContain("author =");
    expect(result).toContain("@article{unknown2024,");
  });

  it("handles source with no date", () => {
    const source = makeSource({ publicationDate: null });
    const result = generateBibTeXEntry(source);
    expect(result).not.toContain("year =");
    expect(result).toContain("@article{smith,");
  });

  it("handles source with no venue", () => {
    const source = makeSource({ venue: null });
    const result = generateBibTeXEntry(source);
    expect(result).not.toContain("journal =");
  });

  it("handles completely minimal source", () => {
    const source = makeSource({
      title: null,
      authors: [],
      publicationDate: null,
      venue: null,
      doi: null,
      abstract: null,
      keywords: [],
    });
    const result = generateBibTeXEntry(source);
    expect(result).toContain("@article{unknown,");
    expect(result).toContain("}");
  });
});

describe("generateBibTeXFile", () => {
  it("returns empty string for no sources", () => {
    expect(generateBibTeXFile([])).toBe("");
  });

  it("joins entries with double newlines", () => {
    const sources = [makeSource(), makeSource({ title: "Second Paper" })];
    const result = generateBibTeXFile(sources);
    expect(result).toContain("\n\n");
    expect(result.split("@article{").length).toBe(3); // 2 entries + 1 from split
  });
});
