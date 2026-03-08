import { downloadFile } from "@/lib/minio";
import { PYTHON_SERVICE_URL } from "@/lib/python-service";

/**
 * Get the best available metadata for a source, falling back through
 * chosen -> parsed -> extension -> source fields.
 */
export function getChosenMetadata(source: {
  metadataChosen?: any;
  metadataParsed?: any;
  metadataExtension?: any;
}): Record<string, any> {
  return source.metadataChosen || source.metadataParsed || source.metadataExtension || {};
}

/**
 * Build the source content payload for Python service from a source and its chosen metadata.
 */
export function buildSourceContent(
  source: {
    title: string | null;
    authors: string[];
    abstract: string | null;
    venue: string | null;
    doi: string | null;
    publicationDate?: Date | null;
  },
  chosen: Record<string, any>,
  options?: { includePublicationDate?: boolean },
): Record<string, any> {
  const content: Record<string, any> = {
    title: chosen.title || source.title || "",
    authors: chosen.authors || source.authors || [],
    abstract: chosen.abstract || source.abstract || "",
    venue: chosen.venue || source.venue || "",
    doi: chosen.doi || source.doi || "",
    content_excerpt: chosen.content_excerpt || "",
  };

  if (options?.includePublicationDate) {
    content.publication_date =
      source.publicationDate?.toISOString() || chosen.publicationDate || "";
  }

  return content;
}

/**
 * Build classification schema in the format the Python service expects.
 * For OPEN_CODED facets, the type is sent as "open" (keyword extraction mode).
 */
export function buildClassificationSchema(
  facets: Array<{
    id: string;
    name: string;
    description: string | null;
    type: string;
    required: boolean;
    categories: Array<{ id: string; name: string; description: string | null }>;
    researchQuestions: Array<{ researchQuestionId: string }>;
  }>,
): Array<Record<string, any>> {
  return facets.map((facet) => ({
    id: facet.id,
    name: facet.name,
    description: facet.description,
    type: facet.type === "OPEN_CODED" ? "open" : facet.type.toLowerCase(),
    required: facet.required,
    categories: facet.categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
    })),
    researchQuestionIds: facet.researchQuestions.map((frq) => frq.researchQuestionId),
  }));
}

/**
 * Download a source's PDF from MinIO if available.
 * Returns null if no PDF, or if download fails and throwOnError is false.
 */
export async function downloadSourcePdf(
  source: { hasPdf: boolean; storagePath: string | null },
  options?: { throwOnError?: boolean; logPrefix?: string },
): Promise<Buffer | null> {
  if (!source.hasPdf) return null;

  const prefix = options?.logPrefix || "[pdf]";

  if (!source.storagePath) {
    if (options?.throwOnError) {
      throw new Error("Source is marked as PDF but has no storage path");
    }
    console.warn(`${prefix} Source marked as PDF but storagePath missing`);
    return null;
  }

  try {
    const buffer = await downloadFile(source.storagePath);
    console.log(`${prefix} PDF downloaded`, {
      storagePath: source.storagePath,
      size: buffer.length,
    });
    return buffer;
  } catch (error) {
    if (options?.throwOnError) {
      throw new Error("Failed to download PDF file");
    }
    console.error(`${prefix} PDF download failed`, {
      storagePath: source.storagePath,
      error,
    });
    return null;
  }
}

/**
 * Call the Python service with either a file upload or JSON text payload.
 * Handles the FormData/JSON branching pattern shared across all analyze/classify routes.
 */
export async function callPythonService(
  endpoint: string,
  payload: Record<string, any>,
  pdfBuffer: Buffer | null,
): Promise<Response> {
  if (pdfBuffer && pdfBuffer.length > 0) {
    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    const pdfBlob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });
    formData.append("file", pdfBlob, "source.pdf");

    return fetch(`${PYTHON_SERVICE_URL}${endpoint}`, {
      method: "POST",
      body: formData as any,
    });
  }

  return fetch(`${PYTHON_SERVICE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
