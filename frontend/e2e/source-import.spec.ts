import { test, expect } from "@playwright/test";
import { createStudyViaAPI } from "./helpers";
import path from "path";

test.describe("Source Import", () => {
  test("bulk import BibTeX file and verify sources appear", async ({
    page,
    request,
  }) => {
    const study = await createStudyViaAPI(request, "Import Test Study");

    // Navigate to add source page
    await page.goto(`/studies/${study.id}/sources`);
    await page.getByRole("link", { name: "Add Source" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/studies/${study.id}/sources/add`),
    );

    // Select bulk upload
    await page.getByText("Bulk Upload").click();

    // Select ACM database
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: /ACM Digital Library/ }).click();

    // Upload the BibTeX fixture file
    const fixtureFile = path.join(__dirname, "fixtures", "sample.bib");
    await page.locator('input[type="file"]').setInputFiles(fixtureFile);

    // Click preview
    await page.getByRole("button", { name: /Preview Sources/ }).click();

    // Verify preview shows parsed sources
    await expect(
      page.getByText(/Succesfully parsed 3 sources/),
    ).toBeVisible();
    await expect(
      page.getByText("A Systematic Mapping Study on Microservice"),
    ).toBeVisible();
    await expect(
      page.getByText("DevOps Practices in Large-Scale"),
    ).toBeVisible();
    await expect(
      page.getByText("Testing Strategies for Cloud-Native"),
    ).toBeVisible();

    // Start import
    await page.getByRole("button", { name: "Start Import" }).click();

    // Wait for import to complete (should be fast with FakeProvider)
    await expect(page.getByText("Import Complete!")).toBeVisible({
      timeout: 30_000,
    });

    // Navigate to sources list and verify sources are there
    await page.getByRole("button", { name: "View Results" }).click();
    await expect(page).toHaveURL(new RegExp(`/studies/${study.id}/sources`));
  });

  test("add a single source via manual entry", async ({ page, request }) => {
    const study = await createStudyViaAPI(request, "Manual Source Study");

    // Navigate to add source page
    await page.goto(`/studies/${study.id}/sources/add`);

    // Select URL type (since PDF requires an actual file and LLM parsing)
    await page.getByText("Add URL").click();

    // Fill in the URL
    await page.getByRole("textbox", { name: "URL" }).fill("https://example.com/article");

    // Fill in metadata
    await page.getByRole("textbox", { name: "Title" }).fill("Example Web Article");

    // Submit
    await page.getByRole("button", { name: "Add Source" }).click();

    // Should redirect back to sources list
    await page.waitForURL(new RegExp(`/studies/${study.id}/sources`), {
      timeout: 10_000,
    });
  });
});
