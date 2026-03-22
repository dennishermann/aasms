import { test, expect } from "@playwright/test";
import { createStudyViaAPI } from "./helpers";

test.describe("Search Strategy Editor", () => {
  let studyId: string;

  test.beforeEach(async ({ request }) => {
    const study = await createStudyViaAPI(request, "Search Strategy Test Study");
    studyId = study.id;
  });

  test("GET endpoint returns empty strategy for new study", async ({ request }) => {
    const response = await request.get(
      `http://localhost:3001/api/studies/${studyId}/parameters/search-strategy`,
    );
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data).toMatchObject({
      picoPopulation: null,
      picoIntervention: null,
      picoComparison: null,
      picoOutcome: null,
      formalSources: [],
    });
  });

  test("PATCH saves and returns PICO fields", async ({ request }) => {
    const payload = {
      picoPopulation: "Autonomous AI agents",
      picoIntervention: "Context management",
      picoComparison: "Manual vs automated",
      picoOutcome: "Task completion rate",
    };

    const patchResp = await request.patch(
      `http://localhost:3001/api/studies/${studyId}/parameters/search-strategy`,
      { data: payload },
    );
    expect(patchResp.ok()).toBeTruthy();
    const patchBody = await patchResp.json();
    expect(patchBody.data.picoPopulation).toBe("Autonomous AI agents");
    expect(patchBody.data.picoIntervention).toBe("Context management");
    expect(patchBody.data.picoComparison).toBe("Manual vs automated");
    expect(patchBody.data.picoOutcome).toBe("Task completion rate");

    // Verify persistence via GET
    const getResp = await request.get(
      `http://localhost:3001/api/studies/${studyId}/parameters/search-strategy`,
    );
    const getBody = await getResp.json();
    expect(getBody.data.picoPopulation).toBe("Autonomous AI agents");
  });

  test("PATCH saves formal sources", async ({ request }) => {
    const payload = {
      picoPopulation: "AI agents",
      formalSources: [
        {
          name: "IEEE Xplore",
          type: "ACADEMIC_DATABASE",
          searchString: '("AI agent" OR "LLM agent") AND "context"',
          dateRange: { start: "2020-01", end: "2025-12" },
        },
        {
          name: "ACM Digital Library",
          type: "ACADEMIC_DATABASE",
          searchString: "autonomous agents context management",
          dateRange: null,
        },
      ],
    };

    const patchResp = await request.patch(
      `http://localhost:3001/api/studies/${studyId}/parameters/search-strategy`,
      { data: payload },
    );
    expect(patchResp.ok()).toBeTruthy();
    const body = await patchResp.json();
    expect(body.data.formalSources).toHaveLength(2);
    expect(body.data.formalSources[0].name).toBe("IEEE Xplore");
    expect(body.data.formalSources[0].searchString).toBe(
      '("AI agent" OR "LLM agent") AND "context"',
    );
    expect(body.data.formalSources[1].name).toBe("ACM Digital Library");
  });

  test("PATCH does not affect existing criteria", async ({ request }) => {
    // Set up criteria via the parameters endpoint
    await request.post(
      `http://localhost:3001/api/studies/${studyId}/parameters`,
      {
        data: {
          inclusionCriteria: [
            { criterion: "Must be primary research", order: 0 },
          ],
          exclusionCriteria: [
            { criterion: "Short papers under 4 pages", order: 0 },
          ],
        },
      },
    );

    // Now save search strategy
    await request.patch(
      `http://localhost:3001/api/studies/${studyId}/parameters/search-strategy`,
      {
        data: {
          picoPopulation: "Test population",
          formalSources: [
            {
              name: "Scopus",
              type: "ACADEMIC_DATABASE",
              searchString: "test query",
            },
          ],
        },
      },
    );

    // Verify criteria are still intact
    const paramResp = await request.get(
      `http://localhost:3001/api/studies/${studyId}/parameters`,
    );
    expect(paramResp.ok()).toBeTruthy();
    const paramBody = await paramResp.json();
    const params = paramBody.data;
    expect(params.inclusionCriteria.length).toBeGreaterThanOrEqual(1);
    expect(params.inclusionCriteria[0].criterion).toBe("Must be primary research");
  });

  test("search strategy editor renders on Search Protocol tab", async ({ page }) => {
    await page.goto(`/studies/${studyId}/parameters`);

    // Click the Search Protocol tab
    await page.getByRole("tab", { name: /search protocol/i }).click();

    // Verify the Search Strategy card is visible
    await expect(page.getByText("Search Strategy", { exact: true })).toBeVisible();
    await expect(page.getByText("PICO Terms")).toBeVisible();

    // Verify PICO inputs are present
    await expect(page.getByLabel(/population/i)).toBeVisible();
    await expect(page.getByLabel(/intervention/i)).toBeVisible();

    // Verify the Search Execution Log section is also visible
    await expect(page.getByText("Search Execution Log")).toBeVisible();
  });

  test("can fill PICO fields and save strategy", async ({ page }) => {
    await page.goto(`/studies/${studyId}/parameters`);
    await page.getByRole("tab", { name: /search protocol/i }).click();

    // Fill PICO fields
    await page.getByLabel(/population/i).first().fill("Autonomous AI agents");
    await page.getByLabel(/intervention/i).first().fill("Context management");

    // Click Save Strategy
    await page.getByRole("button", { name: /save strategy/i }).click();

    // Wait for success message
    await expect(page.getByText("Strategy saved.")).toBeVisible();

    // Reload and verify persistence
    await page.reload();
    await page.getByRole("tab", { name: /search protocol/i }).click();
    await expect(page.getByLabel(/population/i).first()).toHaveValue("Autonomous AI agents");
    await expect(page.getByLabel(/intervention/i).first()).toHaveValue("Context management");
  });

  test("can add a database search definition", async ({ page }) => {
    await page.goto(`/studies/${studyId}/parameters`);
    await page.getByRole("tab", { name: /search protocol/i }).click();

    // Click Add Database button
    await page.getByRole("button", { name: /add database/i }).click();

    // Fill the dialog
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "IEEE Xplore" }).click();

    await page
      .getByPlaceholder(/context management/)
      .fill('("AI agent") AND "context management"');

    // Submit
    await page.getByRole("button", { name: /^add database$/i }).click();

    // Verify it appears in the table
    await expect(page.getByText("IEEE Xplore")).toBeVisible();
    await expect(
      page.getByText('("AI agent") AND "context management"'),
    ).toBeVisible();

    // Save and verify persistence
    await page.getByRole("button", { name: /save strategy/i }).click();
    await expect(page.getByText("Strategy saved.")).toBeVisible();
  });
});
