import { test, expect } from "@playwright/test";

test.describe("Study Lifecycle", () => {
  test("home page renders landing content", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText("AI-Powered Systematic Mapping Studies"),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "View Studies" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create New Study" }),
    ).toBeVisible();
  });

  test("create a new study and verify it appears", async ({ page }) => {
    // Navigate to create study page
    await page.goto("/studies/new");
    await expect(page.getByText("Create New Study")).toBeVisible();

    // Fill in the study form
    await page.getByPlaceholder("e.g., Microservices Architecture").fill(
      "E2E Test Study",
    );
    await page
      .getByPlaceholder("Describe the purpose and scope")
      .fill("A study created by E2E tests");
    await page
      .getByPlaceholder("Why is this study important")
      .fill("Testing the full workflow");

    // Add a research question
    await page.getByPlaceholder("Research question 1").fill(
      "What testing patterns exist for web applications?",
    );

    // Submit the form
    await page.getByRole("button", { name: "Create Study" }).click();

    // Should redirect to the study detail page
    await expect(page).toHaveURL(/\/studies\/[a-f0-9-]+$/);
    await expect(page.getByText("E2E Test Study")).toBeVisible();

    // Navigate to studies list and verify the study appears
    await page.goto("/studies");
    await expect(page.getByText("E2E Test Study")).toBeVisible();
    await expect(
      page.getByText("A study created by E2E tests"),
    ).toBeVisible();
  });

  test("study detail page shows overview information", async ({
    page,
    request,
  }) => {
    // Create study via API for fast setup
    const response = await request.post("http://localhost:3001/api/studies", {
      data: {
        title: "Overview Test Study",
        description: "Testing overview display",
        status: "ACTIVE",
        motivation: "E2E test motivation",
        researchQuestions: [
          { question: "RQ1: What patterns are used?", order: 0 },
          { question: "RQ2: How are they evaluated?", order: 1 },
        ],
      },
    });
    const { data: study } = await response.json();

    // Navigate to study detail
    await page.goto(`/studies/${study.id}`);

    // Verify key content is displayed
    await expect(page.getByText("Overview Test Study")).toBeVisible();
    await expect(page.getByText("RQ1: What patterns are used?")).toBeVisible();
    await expect(
      page.getByText("RQ2: How are they evaluated?"),
    ).toBeVisible();
  });
});
