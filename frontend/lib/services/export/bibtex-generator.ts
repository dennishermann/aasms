import type { Source } from "@prisma/client";

/**
 * Escape special characters in BibTeX strings
 */
function escapeBibTeX(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/#/g, "\\#")
    .replace(/\$/g, "\\$");
}

/**
 * Extract last name from author string (handles "First Last" and "First Middle Last" formats)
 */
function extractLastName(author: string): string {
  const parts = author.trim().split(/\s+/);
  return parts[parts.length - 1] || "";
}

/**
 * Generate a cite key from first author and year
 * Format: "lastname2025" (lowercase, no spaces)
 */
function generateCiteKey(source: Source): string {
  let key = "unknown";

  // Try to use first author's last name
  if (source.authors && source.authors.length > 0) {
    const lastName = extractLastName(source.authors[0]);
    if (lastName) {
      key = lastName.toLowerCase().replace(/\s+/g, "");
    }
  }

  // Add publication year if available
  if (source.publicationDate) {
    const year = source.publicationDate.getFullYear();
    key += year;
  }

  return key;
}

/**
 * Map VenueType enum to appropriate BibTeX entry type
 */
function getEntryType(source: Source): string {
  if (!source.venueType) return "article";

  switch (source.venueType) {
    case "JOURNAL":
      return "article";
    case "CONFERENCE":
    case "WORKSHOP":
    case "SYMPOSIUM":
      return "inproceedings";
    case "BOOK_CHAPTER":
      return "inbook";
    case "TECHNICAL_REPORT":
      return "techreport";
    case "PREPRINT_SERVER":
      return "article";
    case "BLOG":
      return "misc";
    default:
      return "misc";
  }
}

/**
 * Format authors for BibTeX (join with " and ")
 */
function formatAuthorsForBibTeX(authors: string[]): string {
  if (!authors || authors.length === 0) return "";
  return authors.map((a) => escapeBibTeX(a)).join(" and ");
}

/**
 * Generate a BibTeX entry for a source
 * If source.bibtex exists and is non-empty, return it directly
 * Otherwise, generate from metadata
 */
export function generateBibTeXEntry(source: Source): string {
  // If source already has a BibTeX entry, return it as-is
  if (source.bibtex && source.bibtex.trim()) {
    return source.bibtex.trim();
  }

  const entryType = getEntryType(source);
  const citeKey = generateCiteKey(source);
  const fields: string[] = [];

  // Title (required)
  if (source.title) {
    fields.push(`  title = {${escapeBibTeX(source.title)}}`);
  }

  // Authors
  const authorsString = formatAuthorsForBibTeX(source.authors || []);
  if (authorsString) {
    fields.push(`  author = {${authorsString}}`);
  }

  // Year
  if (source.publicationDate) {
    const year = source.publicationDate.getFullYear();
    fields.push(`  year = {${year}}`);
  }

  // Journal / Venue
  if (source.venue) {
    const venueFieldName = source.venueType === "CONFERENCE" ? "booktitle" : "journal";
    fields.push(`  ${venueFieldName} = {${escapeBibTeX(source.venue)}}`);
  }

  // DOI
  if (source.doi) {
    fields.push(`  doi = {${source.doi}}`);
  }

  // Abstract
  if (source.abstract) {
    fields.push(`  abstract = {${escapeBibTeX(source.abstract)}}`);
  }

  // Keywords
  if (source.keywords && source.keywords.length > 0) {
    const keywordsStr = source.keywords.map((k) => escapeBibTeX(k)).join(", ");
    fields.push(`  keywords = {${keywordsStr}}`);
  }

  const fieldsStr = fields.join(",\n");

  return `@${entryType}{${citeKey},\n${fieldsStr}\n}`;
}

/**
 * Generate BibTeX entries for multiple sources
 */
export function generateBibTeXFile(sources: Source[]): string {
  if (sources.length === 0) {
    return "";
  }

  return sources.map((source) => generateBibTeXEntry(source)).join("\n\n");
}
