import { APIRequestContext } from "@playwright/test";

const BASE_URL = "http://localhost:3001";

/**
 * Create a study via the API for fast test setup.
 */
export async function createStudyViaAPI(
  request: APIRequestContext,
  title: string = "Test Study",
  description: string = "A test study for E2E tests",
) {
  const response = await request.post(`${BASE_URL}/api/studies`, {
    data: {
      title,
      description,
      status: "ACTIVE",
      researchQuestions: [
        { question: "What approaches exist in this area?", order: 0 },
        { question: "How are they evaluated?", order: 1 },
      ],
    },
  });

  if (!response.ok()) {
    throw new Error(
      `Failed to create study: ${response.status()} ${await response.text()}`,
    );
  }

  const body = await response.json();
  return body.data;
}

/**
 * Create a study with inclusion/exclusion criteria.
 */
export async function createStudyWithCriteria(
  request: APIRequestContext,
  title: string = "Test Study with Criteria",
) {
  const study = await createStudyViaAPI(request, title);

  // Add criteria via the parameters endpoint (POST, not PATCH)
  const resp = await request.post(
    `${BASE_URL}/api/studies/${study.id}/parameters`,
    {
      data: {
        inclusionCriteria: [
          { criterion: "Must be a primary research study", order: 0 },
          { criterion: "Must be published in English", order: 1 },
        ],
        exclusionCriteria: [
          { criterion: "Short papers under 4 pages", order: 0 },
          { criterion: "Duplicate or extended version", order: 1 },
        ],
      },
    },
  );

  if (!resp.ok()) {
    console.warn(
      `Warning: Failed to set criteria: ${resp.status()} ${await resp.text()}`,
    );
  }

  return study;
}

/**
 * Create a study with criteria and classification facets.
 */
export async function createStudyWithFacets(
  request: APIRequestContext,
  title: string = "Test Study with Facets",
) {
  const study = await createStudyWithCriteria(request, title);

  // Get research question IDs to link facets
  const rqIds = (study.researchQuestions || []).map(
    (rq: { id: string }) => rq.id,
  );

  // Add a CLOSED facet
  const facetResp = await request.post(
    `${BASE_URL}/api/studies/${study.id}/facets`,
    {
      data: {
        name: "Research Type",
        description: "Type of research contribution",
        type: "CLOSED",
        researchQuestionIds: rqIds,
        categories: [
          { name: "Validation Research", order: 0 },
          { name: "Evaluation Research", order: 1 },
          { name: "Solution Proposal", order: 2 },
          { name: "Experience Report", order: 3 },
        ],
      },
    },
  );

  if (!facetResp.ok()) {
    console.warn(
      `Warning: Failed to create facet: ${facetResp.status()} ${await facetResp.text()}`,
    );
  }

  // Add an OPEN facet
  await request.post(`${BASE_URL}/api/studies/${study.id}/facets`, {
    data: {
      name: "Key Contribution",
      description: "Main contribution of the study",
      type: "OPEN",
      researchQuestionIds: rqIds,
    },
  });

  return study;
}

/**
 * Add a source to a study via the API using multipart form data.
 */
export async function addSourceViaAPI(
  request: APIRequestContext,
  studyId: string,
  source: {
    title: string;
    authors?: string[];
    abstract?: string;
    venue?: string;
    publicationDate?: string;
  },
) {
  const metadata = {
    sourceType: "url" as const,
    title: source.title,
    authors: source.authors || ["Author A", "Author B"],
    abstract: source.abstract || "This is a test abstract.",
    venue: source.venue || "Test Conference",
    publicationDate: source.publicationDate || "2024-01-15",
    sourceCategory: "FORMAL" as const,
    url: "https://example.com/test-paper",
  };

  const response = await request.post(
    `${BASE_URL}/api/studies/${studyId}/sources/add`,
    {
      multipart: {
        metadata: JSON.stringify(metadata),
      },
    },
  );

  if (!response.ok()) {
    throw new Error(
      `Failed to add source: ${response.status()} ${await response.text()}`,
    );
  }

  const body = await response.json();
  return body.data;
}
