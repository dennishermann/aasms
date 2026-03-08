import { test, expect } from "@playwright/test";
import { createStudyWithFacets, addSourceViaAPI } from "./helpers";

test.describe("Analysis Dashboard", () => {
  test("analysis page renders with overview tab", async ({
    page,
    request,
  }) => {
    const study = await createStudyWithFacets(request, "Analysis Dashboard Test");

    // Add some sources for data
    await addSourceViaAPI(request, study.id, {
      title: "Paper on Architecture",
      abstract: "Software architecture evaluation study.",
      publicationDate: "2023-01-15",
    });
    await addSourceViaAPI(request, study.id, {
      title: "Paper on Testing",
      abstract: "Testing methodology evaluation.",
      publicationDate: "2024-03-20",
    });

    // Navigate to analysis dashboard
    await page.goto(`/studies/${study.id}/analysis`);

    // Verify heading is visible
    await expect(page.getByText("Analysis Dashboard")).toBeVisible();

    // Verify tabs are present
    await expect(page.getByRole("tab", { name: /Overview/ })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Distributions/ }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: /Trends/ })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Systematic Maps/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Research Gaps/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Data Table/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /RQ Answers/ }),
    ).toBeVisible();
  });

  test("can switch between analysis tabs", async ({ page, request }) => {
    const study = await createStudyWithFacets(request, "Tab Switch Test");

    await page.goto(`/studies/${study.id}/analysis`);

    // Switch to Distributions tab
    await page.getByRole("tab", { name: /Distributions/ }).click();
    // The distributions tab content should load (might show "no data" if no included sources)

    // Switch to Trends tab
    await page.getByRole("tab", { name: /Trends/ }).click();

    // Switch to Data Table tab
    await page.getByRole("tab", { name: /Data Table/ }).click();

    // Switch to RQ Answers tab
    await page.getByRole("tab", { name: /RQ Answers/ }).click();
    // Should show empty state since no classified sources
    await expect(page.getByText(/No classified sources yet/)).toBeVisible();
  });

  test("studies list page shows study cards", async ({ page, request }) => {
    // Create a couple of studies
    await createStudyWithFacets(request, "Study Alpha for List");
    await createStudyWithFacets(request, "Study Beta for List");

    // Navigate to studies list
    await page.goto("/studies");

    // Verify both studies appear
    await expect(page.getByText("Study Alpha for List")).toBeVisible();
    await expect(page.getByText("Study Beta for List")).toBeVisible();
  });
});
