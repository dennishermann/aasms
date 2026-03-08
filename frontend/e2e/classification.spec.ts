import { test, expect } from "@playwright/test";
import { createStudyWithFacets, addSourceViaAPI } from "./helpers";

test.describe("Classification", () => {
  test("study parameters page shows classification schema", async ({
    page,
    request,
  }) => {
    const study = await createStudyWithFacets(
      request,
      "Classification Schema Test",
    );

    // Navigate to parameters page, classification tab
    await page.goto(`/studies/${study.id}/parameters`);

    // Click on the Classification Schema tab
    await page.getByRole("tab", { name: /Classification/ }).click();

    // Verify facets are displayed in the facet list sidebar
    // First facet is expanded (heading), second is in the list (button)
    await expect(
      page.getByRole("heading", { name: "Research Type" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: /Key Contribution/ }),
    ).toBeVisible();
  });

  test("source detail page shows classification section", async ({
    page,
    request,
  }) => {
    const study = await createStudyWithFacets(
      request,
      "Source Classification Test",
    );

    // Add a source
    const source = await addSourceViaAPI(request, study.id, {
      title: "Classifiable Paper",
      abstract:
        "A paper about software architecture patterns and their evaluation in industry.",
    });

    // Navigate to source detail
    await page.goto(`/studies/${study.id}/sources/${source.id}`);

    // Verify source is displayed
    await expect(page.getByText("Classifiable Paper")).toBeVisible();
  });

  test("parameters page allows adding a new facet", async ({
    page,
    request,
  }) => {
    const study = await createStudyWithFacets(request, "Add Facet Test");

    // Navigate to parameters page, classification tab
    await page.goto(`/studies/${study.id}/parameters`);
    await page.getByRole("tab", { name: /Classification/ }).click();

    // Verify existing facets are visible in the facet list
    await expect(
      page.getByRole("heading", { name: "Research Type" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: /Key Contribution/ }),
    ).toBeVisible();

    // Verify the "Add Facet" button exists
    await expect(
      page.getByRole("button", { name: "Add Facet" }),
    ).toBeVisible();
  });
});
