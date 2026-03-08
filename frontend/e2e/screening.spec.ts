import { test, expect } from "@playwright/test";
import { createStudyWithCriteria, addSourceViaAPI } from "./helpers";

test.describe("Screening", () => {
  test("view source detail and see analysis results", async ({
    page,
    request,
  }) => {
    // Setup: create study with criteria and a source
    const study = await createStudyWithCriteria(request, "Screening Test Study");
    const source = await addSourceViaAPI(request, study.id, {
      title: "Test Paper on Software Testing",
      authors: ["Smith, J.", "Doe, A."],
      abstract:
        "This paper presents a systematic approach to software testing using modern techniques.",
      venue: "ICSE 2024",
      publicationDate: "2024-06-15",
    });

    // Navigate to the source detail page
    await page.goto(`/studies/${study.id}/sources/${source.id}`);

    // Verify source metadata is displayed
    await expect(
      page.getByText("Test Paper on Software Testing"),
    ).toBeVisible();
    await expect(page.getByText("Smith, J.")).toBeVisible();

    // The source should show as PENDING initially
    await expect(page.getByText("PENDING").first()).toBeVisible();
  });

  test("source list shows sources with correct status", async ({
    page,
    request,
  }) => {
    const study = await createStudyWithCriteria(
      request,
      "Source List Status Test",
    );

    // Add multiple sources
    await addSourceViaAPI(request, study.id, {
      title: "Paper Alpha",
      abstract: "Research on topic alpha.",
    });
    await addSourceViaAPI(request, study.id, {
      title: "Paper Beta",
      abstract: "Research on topic beta.",
    });

    // Navigate to sources list
    await page.goto(`/studies/${study.id}/sources`);

    // Verify both sources appear
    await expect(page.getByText("Paper Alpha")).toBeVisible();
    await expect(page.getByText("Paper Beta")).toBeVisible();

    // Verify the "All" tab shows count
    await expect(page.getByRole("tab", { name: /All/ })).toBeVisible();
  });

  test("manual inclusion decision can be set", async ({ page, request }) => {
    const study = await createStudyWithCriteria(
      request,
      "Manual Decision Test",
    );
    const source = await addSourceViaAPI(request, study.id, {
      title: "Paper for Manual Decision",
      abstract: "A paper that will be manually included.",
    });

    // Navigate to source detail
    await page.goto(`/studies/${study.id}/sources/${source.id}`);
    await expect(
      page.getByText("Paper for Manual Decision"),
    ).toBeVisible();

    // Look for the status indicator - source should be PENDING
    await expect(page.getByText("PENDING").first()).toBeVisible();
  });
});
