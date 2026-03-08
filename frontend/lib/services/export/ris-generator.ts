import type { Source } from "@prisma/client";

/**
 * Map VenueType enum to appropriate RIS publication type
 */
function getRisPublicationType(source: Source): string {
  if (!source.venueType) return "JOUR";

  switch (source.venueType) {
    case "JOURNAL":
      return "JOUR"; // Journal article
    case "CONFERENCE":
    case "WORKSHOP":
    case "SYMPOSIUM":
      return "CONF"; // Conference paper
    case "BOOK_CHAPTER":
      return "CHAP"; // Book chapter
    case "TECHNICAL_REPORT":
      return "RPRT"; // Report
    case "PREPRINT_SERVER":
      return "JOUR"; // Treat as journal
    case "BLOG":
      return "ELEC"; // Electronic source
    default:
      return "GEN"; // Generic/Unknown
  }
}

/**
 * Generate a RIS entry for a source
 */
export function generateRISEntry(source: Source): string {
  const lines: string[] = [];

  // Publication type (required)
  const pubType = getRisPublicationType(source);
  lines.push(`TY  - ${pubType}`);

  // Title (required)
  if (source.title) {
    lines.push(`TI  - ${source.title}`);
  }

  // Authors (multiple AU lines)
  if (source.authors && source.authors.length > 0) {
    source.authors.forEach((author) => {
      lines.push(`AU  - ${author}`);
    });
  }

  // Publication year
  if (source.publicationDate) {
    const year = source.publicationDate.getFullYear();
    lines.push(`PY  - ${year}`);
  }

  // Journal/Venue name
  if (source.venue) {
    // JO for journal name, but RIS is flexible
    lines.push(`JO  - ${source.venue}`);
  }

  // DOI
  if (source.doi) {
    lines.push(`DO  - ${source.doi}`);
  }

  // Abstract
  if (source.abstract) {
    lines.push(`AB  - ${source.abstract}`);
  }

  // Keywords (one keyword per KW line)
  if (source.keywords && source.keywords.length > 0) {
    source.keywords.forEach((keyword) => {
      lines.push(`KW  - ${keyword}`);
    });
  }

  // URL if available
  if (source.originalUrl) {
    lines.push(`UR  - ${source.originalUrl}`);
  }

  // End of record
  lines.push("ER  - ");

  return lines.join("\n");
}

/**
 * Generate RIS entries for multiple sources
 */
export function generateRISFile(sources: Source[]): string {
  if (sources.length === 0) {
    return "";
  }

  return sources.map((source) => generateRISEntry(source)).join("\n");
}
