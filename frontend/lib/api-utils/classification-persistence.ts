import { prisma } from "@/lib/db";
import { PYTHON_SERVICE_URL } from "@/lib/python-service";

type FacetWithCategories = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  required: boolean;
  categories: Array<{ id: string; name: string; description: string | null }>;
  researchQuestions: Array<{ researchQuestionId: string }>;
};

/**
 * Load keyword mappings for a facet, with caching.
 */
async function getFacetMappings(
  facetId: string,
  cache: Map<string, Map<string, { categoryId: string | null; status: string }>>,
) {
  if (cache.has(facetId)) return cache.get(facetId)!;

  const mappings = await prisma.facetKeywordMapping.findMany({
    where: { facetId },
    select: { keyword: true, categoryId: true, status: true },
  });
  const map = new Map<string, { categoryId: string | null; status: string }>();
  for (const m of mappings) {
    map.set(m.keyword.toLowerCase(), { categoryId: m.categoryId, status: m.status });
  }
  cache.set(facetId, map);
  return map;
}

/**
 * Ask the Python service to suggest a keyword-to-category mapping.
 */
async function suggestKeywordMapping(keyword: string, facet: FacetWithCategories) {
  const response = await fetch(`${PYTHON_SERVICE_URL}/api/coding/map-keyword`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keyword,
      categories: facet.categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
      })),
      facet_name: facet.name,
      facet_description: facet.description,
    }),
  });
  if (!response.ok) return null;
  return response.json();
}

/**
 * Process classification results from the Python service and persist them.
 * Handles OPEN, OPEN_CODED, and CLOSED facet types.
 */
export async function processClassificationResults(params: {
  sourceId: string;
  classifications: any[];
  facetsToUse: FacetWithCategories[];
  existingAnalysis: any;
  deleteScope: Record<string, string>;
  sourceContent: Record<string, any>;
  pdfBuffer: Buffer | null;
}) {
  const {
    sourceId,
    classifications,
    facetsToUse,
    existingAnalysis,
    deleteScope,
    sourceContent,
    pdfBuffer,
  } = params;

  // Build lookup maps
  const facetNameToId = new Map(facetsToUse.map((f) => [f.name, f.id]));
  const facetIdToCategoryMap = new Map(
    facetsToUse.map((f) => [f.id, new Map(f.categories.map((c) => [c.name, c.id]))]),
  );
  const facetById = new Map(facetsToUse.map((f) => [f.id, f]));
  const facetByName = new Map(facetsToUse.map((f) => [f.name, f]));

  const createClassifications: Array<{
    facetId: string;
    categoryId: string | null;
    value: string | null;
    confidence: number;
    reasoning: string;
    isManualOverride: boolean;
  }> = [];
  const keywordCreates: Array<{
    facetId: string;
    keyword: string;
    confidence: number | null;
  }> = [];
  const keywordDedup = new Set<string>();
  const mappingCache = new Map<
    string,
    Map<string, { categoryId: string | null; status: string }>
  >();

  for (const c of classifications) {
    const cFacetName = c.facetName || c.facet_name || "unknown";
    const cFacetId = c.facetId || facetNameToId.get(cFacetName);
    const facet = cFacetId ? facetById.get(cFacetId) : facetByName.get(cFacetName);
    if (!facet) continue;

    if (facet.type === "OPEN") {
      processOpenFacet(c, facet, createClassifications, keywordCreates, keywordDedup);
      continue;
    }

    if (facet.type === "OPEN_CODED") {
      await processOpenCodedFacet(
        c,
        facet,
        createClassifications,
        keywordCreates,
        keywordDedup,
        mappingCache,
      );
      continue;
    }

    // CLOSED facet
    const categoryMap = facetIdToCategoryMap.get(facet.id) || null;
    const cCategoryId = categoryMap?.get(c.category) || null;
    createClassifications.push({
      facetId: facet.id,
      categoryId: cCategoryId,
      value: null,
      confidence: parseFloat(c.confidence || 0),
      reasoning: c.reasoning || "",
      isManualOverride: false,
    });
  }

  // Build keyword update operations
  const openFacetIds = facetsToUse.filter((f) => f.type === "OPEN").map((f) => f.id);
  const facetKeywordUpdate =
    openFacetIds.length > 0
      ? { deleteMany: { facetId: { in: openFacetIds } }, create: keywordCreates }
      : keywordCreates.length > 0
        ? { create: keywordCreates }
        : undefined;

  // Compute classification basis
  const hasFullText = !!sourceContent.content_excerpt || (!!pdfBuffer && pdfBuffer.length > 0);
  const classificationBasis = hasFullText ? "FULL_TEXT" : "METADATA_ONLY";

  const avgConfidence =
    classifications.length > 0
      ? classifications.reduce((sum: number, c: any) => sum + (c.confidence || 0), 0) /
        classifications.length
      : existingAnalysis?.confidenceScore || 0.5;

  const analysis = await prisma.sourceAnalysis.upsert({
    where: { sourceId },
    update: {
      classificationBasis,
      classifications: {
        deleteMany: deleteScope,
        create: createClassifications,
      },
      ...(facetKeywordUpdate ? { facetKeywords: facetKeywordUpdate } : {}),
    },
    create: {
      sourceId,
      extractedText: "",
      inclusionRecommendation: existingAnalysis?.inclusionRecommendation ?? false,
      inclusionReasoning: existingAnalysis?.inclusionReasoning || "",
      exclusionReasoning: existingAnalysis?.exclusionReasoning || "",
      confidenceScore: avgConfidence,
      classificationBasis,
      relevanceScore: existingAnalysis?.relevanceScore || null,
      qualityNotes: existingAnalysis?.qualityNotes || null,
      inclusionCriteria: existingAnalysis?.inclusionCriteria || [],
      exclusionCriteria: existingAnalysis?.exclusionCriteria || [],
      classifications: { create: createClassifications },
      facetKeywords: { create: keywordCreates },
    },
    include: {
      classifications: { include: { facet: true, category: true } },
      facetKeywords: true,
    },
  });

  console.log("[classify] analysis saved", {
    sourceId,
    analysisId: analysis.id,
    classifications: analysis.classifications?.length ?? 0,
  });

  return analysis;
}

function processOpenFacet(
  c: any,
  facet: FacetWithCategories,
  createClassifications: any[],
  keywordCreates: any[],
  keywordDedup: Set<string>,
) {
  const keywords = Array.isArray(c.keywords) ? c.keywords : [];
  if (keywords.length === 0) {
    createClassifications.push({
      facetId: facet.id,
      categoryId: null,
      value: null,
      confidence: parseFloat(c.confidence || "0"),
      reasoning: c.reasoning || "No matching values found",
      isManualOverride: false,
    });
  }
  for (const keyword of keywords) {
    if (typeof keyword !== "string" || !keyword.trim()) continue;
    const normalized = `${facet.id}:${keyword.trim().toLowerCase()}`;
    if (keywordDedup.has(normalized)) continue;
    keywordDedup.add(normalized);
    keywordCreates.push({
      facetId: facet.id,
      keyword: keyword.trim(),
      confidence: c.confidence !== undefined ? parseFloat(c.confidence) : null,
    });
    createClassifications.push({
      facetId: facet.id,
      categoryId: null,
      value: keyword.trim(),
      confidence: parseFloat(c.confidence || 0),
      reasoning: c.reasoning || "",
      isManualOverride: false,
    });
  }
}

async function processOpenCodedFacet(
  c: any,
  facet: FacetWithCategories,
  createClassifications: any[],
  keywordCreates: any[],
  keywordDedup: Set<string>,
  mappingCache: Map<string, Map<string, { categoryId: string | null; status: string }>>,
) {
  const keywords = Array.isArray(c.keywords) ? c.keywords : [];
  if (keywords.length === 0) {
    createClassifications.push({
      facetId: facet.id,
      categoryId: null,
      value: null,
      confidence: parseFloat(c.confidence || "0"),
      reasoning: c.reasoning || "No matching values found",
      isManualOverride: false,
    });
  }
  const mappingMap = await getFacetMappings(facet.id, mappingCache);

  for (const keyword of keywords) {
    if (typeof keyword !== "string" || !keyword.trim()) continue;
    const trimmed = keyword.trim();
    const normalizedKey = trimmed.toLowerCase();
    const dedupKey = `${facet.id}:${normalizedKey}`;

    if (!keywordDedup.has(dedupKey)) {
      keywordDedup.add(dedupKey);
      keywordCreates.push({
        facetId: facet.id,
        keyword: trimmed,
        confidence: c.confidence !== undefined ? parseFloat(c.confidence) : null,
      });
    }

    const existing = mappingMap.get(normalizedKey);
    if (existing && existing.status === "APPROVED" && existing.categoryId) {
      createClassifications.push({
        facetId: facet.id,
        categoryId: existing.categoryId,
        value: null,
        confidence: parseFloat(c.confidence || 0),
        reasoning: c.reasoning || "Mapped from approved keyword",
        isManualOverride: false,
      });
      continue;
    }

    if (!existing) {
      const suggestion = await suggestKeywordMapping(trimmed, facet);
      if (suggestion) {
        const match = facet.categories.find(
          (cat) => cat.name.toLowerCase() === (suggestion.category_name || "").toLowerCase(),
        );
        await prisma.facetKeywordMapping.upsert({
          where: { facetId_keyword: { facetId: facet.id, keyword: trimmed } },
          create: {
            facetId: facet.id,
            keyword: trimmed,
            categoryId: match?.id || null,
            status: "PENDING",
            confidence: suggestion.confidence ?? null,
            source: "LLM",
            proposedCategoryName: suggestion.proposed_category_name || null,
            proposedCategoryDescription: suggestion.proposed_category_description || null,
          },
          update: {
            categoryId: match?.id || null,
            status: "PENDING",
            confidence: suggestion.confidence ?? null,
            source: "LLM",
            proposedCategoryName: suggestion.proposed_category_name || null,
            proposedCategoryDescription: suggestion.proposed_category_description || null,
          },
        });
        mappingMap.set(normalizedKey, { categoryId: match?.id || null, status: "PENDING" });
      }
    }
  }
}
