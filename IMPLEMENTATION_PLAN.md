# SMS Assistant — Implementation Plan

## Analysis of Proposed New Features

### Feature A: RQ Formulation Helper

**Current state:** Research questions are bare text fields — no templates, no validation, no AI assistance. The user types a question string and an order number. That's it.

**Why it matters:** RQ formulation is the most consequential step in an SMS. A poorly scoped RQ leads to an unfocused search, irrelevant results, and a useless map. Yet researchers (especially first-timers) often struggle to write RQs that are actually answerable via an SMS.

**Proposed design — two layers:**

Layer 1: *Pattern Library.* Petersen 2008 identifies four recurring RQ archetypes: (a) topic distribution ("What topics are addressed and how many papers per topic?"), (b) research method distribution ("What research methods are used?"), (c) temporal trend ("How has publication activity changed over time?"), (d) venue distribution ("Where is this research published?"). Surfacing these as selectable templates with fill-in-the-blank fields (e.g., "What [contribution types] are proposed in the area of [your topic]?") gives the researcher a structural starting point.

Layer 2: *AI-Assisted Generation.* Given the study title, description, and motivation, an LLM can suggest 3–5 candidate RQs. More importantly, the LLM can validate existing RQs: "Is this RQ answerable via a classification-based SMS?" and suggest facets that would be needed to answer each RQ.

The second layer naturally connects to auto-suggesting facets from RQs — creating a throughline from "I want to study X" to a complete study protocol.

**Verdict:** High value, medium complexity. Layer 1 is a quick win (UI-only). Layer 2 requires a new Python endpoint + prompt engineering. The RQ → facet suggestion bridge is the highest-value part and should be prioritized.

---

### Feature B: Coded Sections View (Evidence-Based Classification)

**Current state:** The investigation revealed a significant gap. When the LLM classifies a paper against a facet, it returns only a brief `reasoning` string (e.g., "The paper proposes a novel method for context management"). There are no citations to specific passages, no highlighted text, no evidence trail. For OPEN facets, `FacetKeyword` records have an `evidence` field, but it's a single string — not a structured reference to a text section.

The extracted text is sent to the LLM as a single 50KB blob with zero segmentation. There's no concept of "sections" (abstract, introduction, methodology, results, conclusion).

**Why it matters:** This is arguably the single most important gap for research credibility. When a reviewer asks "why did you classify paper X as evaluation research?", the researcher needs to point to the specific paragraph that evidences this. Without it, the classification is an opaque LLM output that can't be verified or defended.

**Proposed design — three components:**

Component 1: *Schema changes.* Add an `EvidencePassage` model that stores: source text snippet (50–300 chars), start/end character offsets in the extracted text, the facet + classification it supports, the source (LLM-generated or user-added), and confidence.

Component 2: *Prompt changes.* Modify the classification prompts to require the LLM to cite specific text passages. Instead of "classify this paper", the prompt becomes "classify this paper AND quote the 1–3 most relevant passages that support your classification." This is a well-established technique (RAG-style citation) that LLMs handle well.

Component 3: *Source detail UI.* In the source detail page, add a "Coded Sections" tab showing the extracted text with highlighted evidence passages, color-coded by facet. Users can click to see which classification each highlight supports, and can select new text spans to add manual evidence.

**On multi-agent classification:** Currently, multi-LLM voting only applies to inclusion/exclusion. Extending it to classification would mean each LLM independently classifies each facet, and disagreements surface for human review. This is a natural extension but should be a separate ticket from the evidence view.

**Verdict:** Very high value, high complexity. This is a 3-part effort: schema migration + prompt engineering + new UI component. Should be broken into sub-tickets.

---

### Feature C: Full Data Table Export

**Current state:** A mapping table CSV export exists (`generateMappingTableCsv()`) that outputs included sources with all facet classifications. However, it's bare-bones: CSV only, no formatting, limited metadata columns, only CLASSIFIED/INCLUDED sources.

**Why it matters:** The sample materials show that the final extraction spreadsheet is the core deliverable of an SMS. It's what gets attached to the paper, shared with co-authors, and used for all analysis. Researchers expect a comprehensive, multi-sheet Excel file — not a flat CSV.

**Proposed design:** Export as .xlsx with multiple sheets: (1) "Protocol" — study title, RQs, criteria, facet definitions, search strategy, (2) "All Sources" — every paper with metadata and screening decision, (3) "Included Sources" — only included papers with all classification columns, (4) "Exclusion Log" — excluded papers with reasons, (5) "Summary Statistics" — counts per facet, cross-tabs, (6) "Data Dictionary" — column definitions and facet category descriptions.

The Included Sources sheet should mirror the format seen in sample materials: one row per paper, columns for all metadata (title, authors, year, venue, DOI, type), then one column per facet category (using 0/1 indicators for closed facets to enable pivot tables), plus a column for each open facet's value.

**Verdict:** Medium value, medium complexity. Builds on existing mapping table service. The openpyxl formatting is the main new work. Quick win with high visibility.

---

## Implementation Tickets

Each ticket below is designed to be self-contained — you can hand it directly to a Claude Code instance as a prompt. They are sequenced by dependency and priority.

---

### TICKET 01: Batch Screening & Classification Operations

**Priority:** P0 — Critical
**Phase:** 1 (Foundation)
**Estimated effort:** 1–2 days
**Dependencies:** None

#### Description

Add "Analyze All Pending" and "Classify All Included" batch action buttons to the sources page. Currently, a researcher must click "analyze" on each source individually — this doesn't scale beyond ~20 papers.

#### Technical Approach

**Backend (Next.js API routes):**

Create `POST /api/studies/[id]/sources/batch-analyze` that:
- Fetches all sources with status `PENDING` (or accepts a status filter)
- Iterates through sources, calling the existing per-source analyze endpoint logic
- Returns a streaming response (SSE via `ReadableStream`) with progress updates: `{ current: 5, total: 47, sourceId: "...", sourceTitle: "...", status: "success"|"error" }`
- Handles failures gracefully: if one source fails, continue with the rest, log the error

Create `POST /api/studies/[id]/sources/batch-classify` with same pattern for classification of all INCLUDED sources.

**Frontend (Sources page):**

- Add a dropdown button "Batch Actions" next to "Add Source" with options: "Screen All Pending", "Classify All Included"
- On click, show a modal with a progress bar and live log of which paper is being processed
- Use `EventSource` or `fetch` with `ReadableStream` to consume the SSE
- On completion, show summary: "47 sources screened: 12 included, 31 excluded, 4 errors"
- Invalidate the sources list query to refresh statuses

**Key files to modify:**
- New: `frontend/app/api/studies/[id]/sources/batch-analyze/route.ts`
- New: `frontend/app/api/studies/[id]/sources/batch-classify/route.ts`
- Modify: `frontend/app/studies/[id]/sources/page.tsx` (add batch action buttons)
- New: `frontend/components/source/batch-progress-modal.tsx`

#### Definition of Done

- [ ] "Screen All Pending" button visible on sources page when pending sources exist
- [ ] Clicking it processes all pending sources sequentially with visible progress
- [ ] Individual failures don't halt the batch — errors are logged and summarized
- [ ] "Classify All Included" button works the same for classification
- [ ] Sources list refreshes after batch completes
- [ ] Buttons are disabled during processing with a loading state
- [ ] Progress modal shows: current/total count, current paper title, elapsed time

#### Testing

- Create a study with 10+ sources in PENDING status
- Run "Screen All Pending" and verify all are processed
- Deliberately break one source (e.g., empty title) and verify batch continues
- Verify the sources list shows updated statuses after completion

---

### TICKET 02: Search Protocol Documentation

**Priority:** P0 — Critical
**Phase:** 1 (Foundation)
**Estimated effort:** 1 day
**Dependencies:** None

#### Description

Add a "Search Protocol" section to the study parameters where researchers document their search strategy: which databases were searched, what search strings were used, date ranges, and how many results each search returned. This is a core reproducibility requirement — without it, the SMS cannot be replicated.

#### Technical Approach

**Database schema (Prisma):**

Add a new model:
```prisma
model SearchProtocolEntry {
  id            String   @id @default(uuid())
  studyId       String
  database      String   // e.g., "IEEE Xplore", "ACM DL", "Scopus"
  searchString  String   // The actual query used
  dateSearched  DateTime
  dateRangeFrom DateTime? // Publication date filter start
  dateRangeTo   DateTime? // Publication date filter end
  totalResults  Int?     // How many hits the search returned
  notes         String?  // Any notes about the search
  importBatchId String?  // Optional link to the import batch
  study         Study    @relation(fields: [studyId], references: [id], onDelete: Cascade)
  importBatch   ImportBatch? @relation(fields: [importBatchId], references: [id])
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

Add `searchProtocolEntries SearchProtocolEntry[]` relation to the Study model.

**API routes:**
- `GET /api/studies/[id]/search-protocol` — list all entries
- `POST /api/studies/[id]/search-protocol` — add entry
- `PUT /api/studies/[id]/search-protocol/[entryId]` — update entry
- `DELETE /api/studies/[id]/search-protocol/[entryId]` — delete entry

**Frontend:**
- Add a "Search Protocol" tab in the parameters page (between "Selection Criteria" and "Classification Schema")
- Table view showing all entries: Database | Search String | Date Searched | Results | Actions
- "Add Entry" button opening a form modal
- During bulk import, optionally pre-fill a search protocol entry (database auto-detected from file format)

**Key files to modify:**
- Modify: `frontend/prisma/schema.prisma` (add model + relation)
- New: `frontend/app/api/studies/[id]/search-protocol/route.ts`
- New: `frontend/components/parameters/search-protocol-editor.tsx`
- Modify: `frontend/app/studies/[id]/parameters/page.tsx` (add tab)

#### Definition of Done

- [ ] "Search Protocol" tab visible in study parameters
- [ ] Can add, edit, and delete search protocol entries
- [ ] Each entry captures: database name, search string, date searched, date range, result count, notes
- [ ] Entries display in a readable table format
- [ ] Study overview page shows a summary of search protocol (e.g., "3 databases searched, 1,247 total results")
- [ ] Optional: link entries to import batches

#### Testing

- Create a study and add 3 search protocol entries for different databases
- Verify entries persist after page refresh
- Edit an entry and verify changes are saved
- Delete an entry and verify it's removed
- Check study overview reflects the protocol data

---

### TICKET 03: BibTeX / RIS Export

**Priority:** P1 — High Value
**Phase:** 1 (Foundation)
**Estimated effort:** 0.5 day
**Dependencies:** None

#### Description

Add export buttons to download the bibliography of included (or all) sources in BibTeX and RIS formats. BibTeX data is already stored per source in the `bibtex` field — this is mainly a formatting and download task.

#### Technical Approach

**API route:**

Create `GET /api/studies/[id]/sources/export` with query params:
- `format`: "bibtex" | "ris" | "csv"
- `filter`: "all" | "included" | "excluded" | "pending"

For BibTeX: if a source has a stored `bibtex` field, use it directly. Otherwise, generate a BibTeX entry from the metadata fields (title, authors, year, venue, doi).

For RIS: generate from metadata fields using the RIS tag format (TY, AU, TI, JO, PY, DO, AB, ER).

Return as a downloadable file with appropriate Content-Type and Content-Disposition headers.

**Frontend:**

Add an export dropdown button on the sources page with options:
- "Export BibTeX (Included)" / "Export BibTeX (All)"
- "Export RIS (Included)" / "Export RIS (All)"

**Key files to modify:**
- New: `frontend/app/api/studies/[id]/sources/export/route.ts`
- New: `frontend/lib/services/export/bibtex-generator.ts`
- New: `frontend/lib/services/export/ris-generator.ts`
- Modify: `frontend/app/studies/[id]/sources/page.tsx` (add export button)

#### Definition of Done

- [ ] Export dropdown visible on sources page
- [ ] BibTeX export produces a valid `.bib` file importable into Zotero/Mendeley
- [ ] RIS export produces a valid `.ris` file
- [ ] Exports respect the selected filter (included/all/excluded)
- [ ] Sources with existing BibTeX data use it; others have BibTeX generated from metadata
- [ ] File download triggers correctly in the browser

#### Testing

- Export BibTeX of included sources and import into Zotero — verify all entries appear
- Export a source that has stored BibTeX — verify it's used verbatim
- Export a source without stored BibTeX — verify one is generated correctly
- Test with special characters in titles/author names

---

### TICKET 04: Study Progress Dashboard

**Priority:** P1 — High Value
**Phase:** 1 (Foundation)
**Estimated effort:** 0.5–1 day
**Dependencies:** None

#### Description

Replace the current overview page's static count cards with a visual workflow progress tracker showing how far along the study is in each phase: Collection → Screening → Classification → Analysis.

#### Technical Approach

**Progress computation logic (new service):**

Create `frontend/lib/services/study/progress-service.ts`:
```typescript
interface StudyProgress {
  collection: { total: number; withPdf: number; needsPdf: number };
  screening: { total: number; screened: number; pending: number; included: number; excluded: number };
  classification: { total: number; classified: number; pending: number; coverage: Record<string, number> };
  analysis: { recipesTotal: number; recipesRun: number; recipesStale: number };
}
```

Compute from existing data — no new API needed, just aggregate from existing endpoints.

**Frontend component:**

Create a horizontal step indicator showing the four phases as connected nodes. Each phase shows: phase name, a circular progress indicator (percentage), key metric (e.g., "47/312 screened"), and status color (grey=not started, blue=in progress, green=complete).

Below the stepper, keep the existing metric cards but reorganize them by phase.

**Key files to modify:**
- New: `frontend/lib/services/study/progress-service.ts`
- New: `frontend/components/study/study-progress-stepper.tsx`
- Modify: `frontend/app/studies/[id]/page.tsx` (replace top section)

#### Definition of Done

- [ ] Study overview shows a 4-phase progress stepper at the top
- [ ] Each phase shows percentage complete and key metric
- [ ] Phases are color-coded: not started (grey), in progress (blue), complete (green)
- [ ] Progress percentages are computed from real data
- [ ] Clicking a phase navigates to the relevant page (sources, analysis, etc.)

#### Testing

- View a study with no sources — all phases grey
- Add sources — collection phase turns blue
- Screen some sources — screening phase shows progress
- Classify included sources — classification updates
- Run recipes — analysis phase reflects it

---

### TICKET 05: Full Data Table Export (Excel)

**Priority:** P1 — High Value
**Phase:** 1 (Foundation)
**Estimated effort:** 1–2 days
**Dependencies:** None

#### Description

Export the complete SMS dataset as a multi-sheet Excel workbook matching the format researchers expect from sample materials. This is distinct from the existing basic CSV mapping table export.

#### Technical Approach

**New API endpoint:**

Create `POST /api/studies/[id]/export/full` that generates an .xlsx file using a server-side script. The endpoint should:

1. Fetch all study data (parameters, sources, analyses, classifications, recipes)
2. Call a Python script or use a JS library (exceljs or xlsx-populate) to build the workbook
3. Return the file as a download

**Workbook structure (6 sheets):**

Sheet 1 — "Protocol": Study title, description, motivation, RQs, inclusion/exclusion criteria, search protocol entries, facet definitions with categories, date generated.

Sheet 2 — "All Sources": Every source regardless of status. Columns: ID, Title, Authors, Year, Venue, Venue Type, DOI, Source Category, Grey Lit Tier, Status, Final Decision, Inclusion Confidence, Exclusion Reasoning.

Sheet 3 — "Included Sources" (the main extraction table): Only included/classified sources. Columns: ID, Title, Authors, Year, Venue, DOI, then one column per facet. For CLOSED facets: category name. For OPEN facets: value text. For facets with multiple categories in the future: semicolon-separated.

Sheet 4 — "Exclusion Log": Excluded sources with: Title, Authors, Year, Reason for Exclusion (from AI reasoning), Confidence Score.

Sheet 5 — "Classification Matrix": Pivot-style sheet with facet categories as columns and 0/1 indicators per source (enables Excel pivot tables).

Sheet 6 — "Data Dictionary": Column name | Description | Type | Possible Values for every column in the Included Sources sheet.

**Formatting:** Header rows bold with colored background, column auto-width, freeze top row, data validation where applicable.

**Recommended approach:** Build this in the Python service using openpyxl (already available in the Python environment), since the Python service already has database access and pandas.

**Key files to create:**
- New: `python-service/src/services/export_service.py`
- New: `python-service/src/routes/export.py`
- New: `frontend/app/api/studies/[id]/export/full/route.ts` (proxy to Python)
- Modify: sources page or analysis page to add "Export Full Dataset" button

#### Definition of Done

- [ ] "Export Full Dataset" button available on the analysis page or sources page
- [ ] Downloads a `.xlsx` file with 6 sheets as described above
- [ ] Protocol sheet contains all study configuration
- [ ] All Sources sheet has every source with status and decision
- [ ] Included Sources sheet has all facet classifications as columns
- [ ] Classification Matrix sheet uses 0/1 indicators for pivot table compatibility
- [ ] Headers are formatted (bold, colored, frozen)
- [ ] File opens correctly in Excel and Google Sheets

#### Testing

- Export a study with 50+ sources (mix of included/excluded/pending)
- Verify all 6 sheets contain correct data
- Open in Excel and create a pivot table from the Classification Matrix sheet
- Verify the Protocol sheet accurately reflects the study configuration
- Test with OPEN facets that have long text values

---

### TICKET 06: Screening Review Dashboard

**Priority:** P0 — Critical
**Phase:** 2 (Screening Quality)
**Estimated effort:** 2–3 days
**Dependencies:** TICKET 01 (batch screening should exist first so there are AI decisions to review)

#### Description

Create a dedicated screening review interface where the researcher reviews AI screening decisions efficiently. This is the core human-in-the-loop workflow — without it, AI screening is an opaque black box.

#### Technical Approach

**New page:** `frontend/app/studies/[id]/review/page.tsx`

**Layout — split view:**
Left panel (60%): Paper details — title, abstract, full text excerpt (scrollable), PDF viewer if available.
Right panel (40%): AI evaluation — per-criterion breakdown showing:
- Each inclusion criterion: met/not met + reasoning + confidence
- Each exclusion criterion: triggered/not triggered + reasoning + confidence
- If voting was used: which LLMs agreed/disagreed per criterion
- Overall recommendation: INCLUDE/EXCLUDE with total confidence

**Action bar (bottom):**
- "Accept AI Decision" (green) — confirms the AI recommendation
- "Override: Include" (blue) — overrides to include regardless of AI
- "Override: Exclude" (red) — overrides to exclude regardless of AI
- "Flag for Discussion" (yellow) — marks as NEEDS_REVIEW
- Next/Previous navigation buttons
- Keyboard shortcuts: `a` = accept, `i` = override include, `e` = override exclude, `f` = flag, `→` = next, `←` = previous

**Filter/queue system:**
- Dropdown to filter the review queue: "All Analyzed", "AI Recommends Include", "AI Recommends Exclude", "Low Confidence (<70%)", "LLM Disagreements", "Flagged"
- Show count of remaining papers to review in each category
- Auto-advance to next paper after action

**Data model changes:**
- Add `reviewStatus` field to Source: `UNREVIEWED` | `ACCEPTED` | `OVERRIDDEN` | `FLAGGED`
- Add `reviewedAt` DateTime and `reviewNote` String fields
- The existing `isUserEdited` field on SourceAnalysis can be used for tracking overrides

**Key files to create/modify:**
- New: `frontend/app/studies/[id]/review/page.tsx`
- New: `frontend/components/review/review-panel.tsx`
- New: `frontend/components/review/criteria-evaluation-display.tsx`
- New: `frontend/components/review/review-action-bar.tsx`
- New: `frontend/lib/hooks/use-review-queue.ts`
- Modify: `frontend/prisma/schema.prisma` (add reviewStatus, reviewedAt, reviewNote to Source)
- Modify: sidebar navigation to add "Review" link

#### Definition of Done

- [ ] "Review" page accessible from study sidebar navigation
- [ ] Split view shows paper content (left) and AI evaluation (right)
- [ ] Per-criterion evaluation visible with reasoning and confidence
- [ ] Voting details visible when multi-LLM voting was used
- [ ] Accept/Override/Flag actions work and update source status
- [ ] Keyboard shortcuts work for all actions + navigation
- [ ] Filter dropdown works for all queue categories
- [ ] Counter shows remaining papers to review
- [ ] Auto-advances to next paper after action
- [ ] Review status persists across page reloads

#### Testing

- Screen 20 sources via batch, then open review page
- Verify all 20 appear in the review queue
- Accept 5, override 3 to include, flag 2
- Filter by "Flagged" — verify only 2 appear
- Filter by "Low Confidence" — verify correct subset
- Use keyboard shortcuts exclusively — verify all work
- Refresh page — verify review statuses persist

---

### TICKET 07: PRISMA Flow Diagram

**Priority:** P0 — Critical
**Phase:** 2 (Screening Quality)
**Estimated effort:** 1–1.5 days
**Dependencies:** None (can use existing data)

#### Description

Auto-generate a PRISMA 2020 flow diagram from study data. PRISMA (Preferred Reporting Items for Systematic reviews and Meta-Analyses) is the standard reporting format. The diagram shows: records identified (per database) → duplicates removed → records screened → records excluded (with reasons) → reports assessed → studies included.

#### Technical Approach

**Data aggregation service:**

Create `frontend/lib/services/analysis/prisma-service.ts` that computes:
```typescript
interface PrismaData {
  identification: {
    databases: { name: string; count: number }[]; // From search protocol or import batches
    totalIdentified: number;
    duplicatesRemoved: number;
  };
  screening: {
    recordsScreened: number;
    recordsExcluded: number;
    exclusionReasons: { criterion: string; count: number }[]; // Group by which EC triggered
  };
  included: {
    reportsAssessed: number; // Full-text assessed
    reportsExcluded: number;
    studiesIncluded: number;
  };
}
```

**Visualization:**

Use a React component with SVG or a diagramming library (e.g., reactflow, or just hand-coded SVG) to render the standard PRISMA 2020 flow chart boxes and arrows. The diagram should be a faithful reproduction of the PRISMA template.

**Export:**

- "Download as PNG" button (using html2canvas or similar)
- "Download as SVG" button (for use in LaTeX)

**Placement:** Add as a card/section on the analysis overview page and as a sub-tab under analysis.

**Key files to create:**
- New: `frontend/lib/services/analysis/prisma-service.ts`
- New: `frontend/components/analysis/prisma-flow-diagram.tsx`
- Modify: `frontend/components/analysis/tabs/overview-tab.tsx` (add PRISMA section)

#### Definition of Done

- [ ] PRISMA flow diagram visible on the analysis overview page
- [ ] Boxes show correct counts from study data (identified, screened, excluded, included)
- [ ] Exclusion box shows breakdown by criterion
- [ ] Identification section shows per-database counts (from import batches or search protocol)
- [ ] Duplicate count shown (from import batch statistics)
- [ ] Export to PNG works
- [ ] Export to SVG works
- [ ] Diagram follows PRISMA 2020 template layout

#### Testing

- View diagram for a study with 100+ sources across 3 databases
- Verify all counts add up (identified - duplicates = screened; screened - excluded = included)
- Export PNG and verify it's publication-quality resolution
- Export SVG and include in a LaTeX document

---

### TICKET 08: Inter-Rater Agreement Metrics

**Priority:** P1 — High Value
**Phase:** 2 (Screening Quality)
**Estimated effort:** 1 day
**Dependencies:** Multi-LLM voting must exist (it does already)

#### Description

Calculate and display inter-rater agreement metrics for multi-LLM screening decisions. When 2–3 LLMs independently evaluate papers, we can compute Cohen's Kappa (2 raters) or Fleiss' Kappa (3+ raters) to quantify agreement. This is a standard methodological rigor metric.

#### Technical Approach

**Computation (Python service):**

Create `POST /api/agreement-metrics` endpoint in the Python service that:
- Takes a study ID
- Fetches all AnalysisVote records for that study
- Groups votes by source × criterion
- Computes per-criterion and overall agreement:
  - Cohen's Kappa for 2 LLMs
  - Fleiss' Kappa for 3 LLMs
  - Percent agreement (simple)
  - Krippendorff's Alpha (handles missing data)
- Returns metrics per criterion and overall

Use `sklearn.metrics.cohen_kappa_score` or implement directly (it's a simple formula).

**Frontend display:**

Add an "Agreement Metrics" card to the analysis overview showing:
- Overall agreement score with interpretation (Poor / Fair / Moderate / Substantial / Almost Perfect)
- Per-criterion breakdown table
- Per-LLM provider confusion matrix

**Key files to create:**
- New: `python-service/src/services/agreement_service.py`
- New: `python-service/src/routes/agreement.py`
- New: `frontend/components/analysis/agreement-metrics-card.tsx`
- Modify: `frontend/components/analysis/tabs/overview-tab.tsx`

#### Definition of Done

- [ ] Agreement metrics card visible on analysis overview when voting data exists
- [ ] Shows overall Kappa score with verbal interpretation
- [ ] Shows per-criterion Kappa scores
- [ ] Shows percent agreement alongside Kappa
- [ ] Handles edge cases: only 1 LLM (shows "N/A — single rater"), all agree (Kappa = 1.0)
- [ ] Hidden when no voting data exists

#### Testing

- Run multi-LLM screening on 20+ sources
- Verify Kappa scores are computed correctly (compare with manual calculation on 3–4 sources)
- Test with perfect agreement (all LLMs agree) — Kappa should be 1.0
- Test with a study that used single LLM — card should not appear

---

### TICKET 09: Evidence-Based Classification (Schema + Prompts)

**Priority:** P0 — Critical (for credibility)
**Phase:** 3 (Classification Depth)
**Estimated effort:** 2–3 days
**Dependencies:** None

#### Description

Modify the classification system to require and store evidence passages — specific text excerpts from the paper that support each classification decision. This is the backend/prompt half of the "Coded Sections View" feature.

#### Technical Approach

**Database schema changes (Prisma):**

Add a new model:
```prisma
model EvidencePassage {
  id               String         @id @default(uuid())
  classificationId String
  classification   Classification @relation(fields: [classificationId], references: [id], onDelete: Cascade)
  text             String         // The quoted text passage (50-300 chars)
  startOffset      Int?           // Character offset in extracted text (optional)
  endOffset        Int?           // Character offset in extracted text (optional)
  sectionHint      String?        // Detected section: "abstract", "introduction", "methods", etc.
  source           String         @default("llm") // "llm" or "user"
  confidence       Float?
  createdAt        DateTime       @default(now())

  @@index([classificationId])
}
```

Add `evidencePassages EvidencePassage[]` relation to Classification model.

**Prompt changes (Python service):**

Modify `build_per_facet_prompt()` in `python-service/src/core/prompts.py` to require citations:

The classification response schema should change from:
```json
{ "category": "...", "confidence": 0.85, "reasoning": "..." }
```
to:
```json
{
  "category": "...",
  "confidence": 0.85,
  "reasoning": "...",
  "evidence": [
    { "text": "exact quote from paper...", "section_hint": "methods" },
    { "text": "another quote...", "section_hint": "results" }
  ]
}
```

The prompt should instruct: "For each classification, quote 1–3 short passages (50–200 words each) from the paper that directly support your classification. Use exact text from the document."

**Classification service changes:**

Modify `classify_source()` in `classification_service.py` to:
1. Parse the new `evidence` field from the LLM response
2. Attempt to find the exact text in the extracted content and compute character offsets
3. Store EvidencePassage records linked to each Classification

**API changes:**

Modify the source detail API to include evidence passages when returning classification data.

**Key files to modify:**
- Modify: `frontend/prisma/schema.prisma` (add EvidencePassage model)
- Modify: `python-service/src/core/prompts.py` (add evidence requirement)
- Modify: `python-service/src/services/classification_service.py` (parse + store evidence)
- Modify: `frontend/app/api/studies/[id]/sources/[sourceId]/route.ts` (include evidence in response)
- Modify: `frontend/app/api/studies/[id]/sources/[sourceId]/classify/route.ts` (store evidence)

#### Definition of Done

- [ ] New EvidencePassage model exists in database
- [ ] Classification prompts require the LLM to provide evidence quotes
- [ ] LLM responses include evidence passages with section hints
- [ ] Evidence passages are stored in the database with classification links
- [ ] Character offsets are computed when exact text is found in extracted content
- [ ] Source detail API returns evidence passages alongside classifications
- [ ] Backward compatible: existing classifications without evidence still work

#### Testing

- Classify a source with a PDF that has extractable text
- Verify the LLM response includes evidence quotes
- Verify evidence passages are stored in the database
- Verify offsets match the correct positions in the extracted text
- Classify a source with metadata only — verify it degrades gracefully (may have no evidence)

---

### TICKET 10: Coded Sections View (UI)

**Priority:** P1 — High Value
**Phase:** 3 (Classification Depth)
**Estimated effort:** 2–3 days
**Dependencies:** TICKET 09 (evidence passages must exist in the data model)

#### Description

Add a "Coded Sections" tab to the source detail page that displays the paper's extracted text with highlighted evidence passages, color-coded by facet. Users can view which classification each highlight supports and can manually add new highlights.

#### Technical Approach

**New tab component:** `frontend/components/source/detail/coded-sections-tab.tsx`

**Text viewer with highlighting:**

Use a read-only text viewer (could be a simple `<div>` with `<mark>` tags, or a library like `react-text-annotate`) that:
- Displays the full extracted text from `SourceAnalysis.extractedText`
- Overlays highlight spans at the character offsets from EvidencePassage records
- Each highlight is color-coded by facet (use the same color palette as the analysis charts)
- Hovering over a highlight shows a tooltip: "Facet: Research Type → Evaluation Research (conf: 0.87)"
- Clicking a highlight opens a sidebar panel showing the full classification details

**Sidebar / annotation panel:**
- Shows all classifications for this source, grouped by facet
- Each classification shows: category, confidence, reasoning, and its evidence passages
- Evidence passages are clickable — scrolls to the passage in the text viewer and highlights it

**Manual annotation:**
- User can select text in the viewer and right-click → "Add Evidence for..." → select facet
- Creates a new EvidencePassage with `source: "user"`
- Also allow user to remove evidence passages

**Section detection (optional enhancement):**
- Basic heuristic: detect section headings (lines that are ALL CAPS or match patterns like "1. Introduction", "ABSTRACT", "METHODOLOGY")
- Show section markers in the left margin of the text viewer
- Allow filtering highlights by section

**Key files to create:**
- New: `frontend/components/source/detail/coded-sections-tab.tsx`
- New: `frontend/components/source/detail/text-viewer-with-highlights.tsx`
- New: `frontend/components/source/detail/annotation-sidebar.tsx`
- New: `frontend/app/api/studies/[id]/sources/[sourceId]/evidence/route.ts` (CRUD for manual evidence)
- Modify: `frontend/app/studies/[id]/sources/[sourceId]/page.tsx` (add tab)

#### Definition of Done

- [ ] "Coded Sections" tab visible on source detail page when extracted text exists
- [ ] Extracted text displayed in a scrollable viewer
- [ ] Evidence passages highlighted with facet-specific colors
- [ ] Hover tooltip shows facet name, category, and confidence
- [ ] Click on highlight scrolls to details in sidebar
- [ ] Sidebar shows all classifications grouped by facet
- [ ] User can select text and add it as evidence for a facet
- [ ] User can remove evidence passages
- [ ] Color legend shows which color maps to which facet
- [ ] Tab gracefully handles sources without extracted text (shows message)

#### Testing

- View a classified source with evidence passages — verify highlights appear at correct positions
- Click a highlight — verify sidebar scrolls to the right classification
- Select text and add as evidence — verify new highlight appears
- Remove an evidence passage — verify highlight disappears
- View a source without extracted text — verify helpful empty state message
- View a source with overlapping evidence (two facets cite same text) — verify both colors show

---

### TICKET 11: Multi-Valued Classification

**Priority:** P0 — Critical
**Phase:** 3 (Classification Depth)
**Estimated effort:** 1.5–2 days
**Dependencies:** None

#### Description

Allow a paper to be assigned to multiple categories within a single facet. Currently, each Classification record links to one facet and one category. In practice, papers often span multiple categories (e.g., a paper that is both "Evaluation Research" AND "Solution Proposal").

#### Technical Approach

**Schema approach:** The current schema already supports this in principle — multiple Classification records can exist for the same (analysisId, facetId) pair. However, the code assumes one classification per facet per source.

**Changes needed:**

1. **Prompts:** Modify classification prompts to allow multiple selections for CLOSED facets. Change from "select the ONE most appropriate category" to "select ALL categories that apply (1–3 typically)". Return format becomes `{ "categories": ["cat1", "cat2"], ... }`.

2. **Classification service:** Modify `_classify_single_facet()` to handle array responses and create multiple Classification records.

3. **Frontend — Classification display:** Update `ClassificationsView` component to show multiple badges per facet instead of one.

4. **Analysis queries:** Update all analysis services (frequency, crosstab, mapping table) to count a paper in each of its categories (not just one). A paper classified as both "Evaluation Research" and "Solution Proposal" should add +1 to both category counts.

5. **Export:** Update the mapping table CSV and the full export (TICKET 05) to handle multiple values per facet (semicolon-separated in text columns, multiple 1s in the indicator matrix).

**Key files to modify:**
- Modify: `python-service/src/core/prompts.py` (allow multiple categories)
- Modify: `python-service/src/services/classification_service.py` (handle array responses)
- Modify: `frontend/components/source/analysis/classifications-view.tsx` (show multiple)
- Modify: `frontend/lib/services/analysis/frequency-service.ts` (count multi-values)
- Modify: `frontend/lib/services/analysis/crosstab-service.ts` (handle multi-values)
- Modify: `frontend/lib/services/analysis/mapping-table-service.ts` (multi-value export)

#### Definition of Done

- [ ] CLOSED facet prompts ask LLM to select all applicable categories
- [ ] LLM can return 1–3 categories per facet
- [ ] Multiple Classification records are created when multiple categories apply
- [ ] Source detail shows all assigned categories per facet
- [ ] Frequency analysis counts multi-classified papers in each category
- [ ] Cross-tabulation handles multi-valued facets correctly
- [ ] Export formats show multiple values (semicolon-separated or multiple indicator columns)

#### Testing

- Classify a paper that clearly spans two categories — verify both are assigned
- Check frequency counts: total per-category counts should exceed total papers (since papers counted multiple times)
- Verify cross-tab with a multi-valued facet produces correct results
- Export and verify formatting of multi-valued entries

---

### TICKET 12: Category Merge / Split

**Priority:** P1 — High Value
**Phase:** 3 (Classification Depth)
**Estimated effort:** 1–1.5 days
**Dependencies:** None

#### Description

Add merge and split operations to the facet coding wizard. Merge: select 2+ categories → combine into one (all papers re-classified). Split: select 1 category → define 2+ new categories → AI re-classifies affected papers.

#### Technical Approach

**Merge operation:**
1. User selects 2+ categories in the facet editor
2. Clicks "Merge" → modal asks for the merged category name
3. Backend: creates new category (or uses one of the selected), updates all Classification records pointing to the old categories to point to the new one, deletes old categories
4. `PUT /api/studies/[id]/facets/[facetId]/categories/merge` with body `{ sourceIds: [...], targetName: "...", targetDescription: "..." }`

**Split operation:**
1. User selects 1 category and clicks "Split"
2. Modal asks for 2+ new category names with descriptions
3. Backend: creates new categories, fetches all papers classified under the old category, sends each to the LLM for re-classification against only the new sub-categories (cheaper, focused prompt), updates Classification records, deletes old category
4. `POST /api/studies/[id]/facets/[facetId]/categories/split` with body `{ sourceId: "...", newCategories: [...] }`

**Frontend — Coding wizard enhancement:**
- Add "Merge Selected" button (enabled when 2+ categories are checked)
- Add "Split" button per category
- Both show a confirmation modal with the operation details
- Show progress during split (since re-classification involves LLM calls)

**Key files to create/modify:**
- New: `frontend/app/api/studies/[id]/facets/[facetId]/categories/merge/route.ts`
- New: `frontend/app/api/studies/[id]/facets/[facetId]/categories/split/route.ts`
- Modify: `frontend/components/facets/coding-wizard.tsx` (add merge/split UI)
- Modify or new: Python service endpoint for targeted re-classification

#### Definition of Done

- [ ] "Merge" button visible when 2+ categories selected in coding wizard
- [ ] Merge combines categories and re-points all classifications
- [ ] "Split" button visible per category
- [ ] Split creates new sub-categories and triggers LLM re-classification
- [ ] Re-classification during split shows progress
- [ ] Both operations are reversible (or at least confirmed with a warning)
- [ ] Analysis results reflect the updated categories after merge/split

#### Testing

- Create a facet with 5 categories, merge 2 → verify papers are re-assigned
- Split 1 category into 3 → verify LLM re-classifies affected papers
- Run frequency analysis before and after — verify counts are consistent
- Test merge of categories that have papers with evidence passages — verify evidence preserved

---

### TICKET 13: RQ Formulation Helper

**Priority:** P1 — High Value
**Phase:** 4 (Intelligence)
**Estimated effort:** 2 days
**Dependencies:** None

#### Description

Add AI-assisted research question formulation with a pattern library and LLM-powered suggestions. The helper should guide the researcher from "I want to study X" to a well-formed set of RQs with corresponding facets.

#### Technical Approach

**Part 1 — Pattern Library (frontend-only):**

Create a modal/drawer that shows standard SMS RQ templates with fill-in-the-blank fields:
- **Distribution:** "What [aspect] are addressed in [topic] and how frequently?"
- **Trend:** "How has research on [topic] evolved over [time period]?"
- **Venue:** "In which venues is research on [topic] published?"
- **Method:** "What research methods are used in studies on [topic]?"
- **Gap:** "What areas of [topic] lack research attention?"
- **Taxonomy:** "What categories of [aspect] exist in [topic]?"

Each template comes with a description and a suggested facet type (e.g., Distribution → CLOSED facet).

When the user selects a template and fills in the blanks, the RQ text is generated and added to the study.

**Part 2 — AI-Powered Suggestions (requires Python endpoint):**

New endpoint `POST /api/suggest-rqs` in the Python service:
- Input: `{ title, description, motivation, existingRqs: [...] }`
- Prompt: "You are an expert researcher. Given this study about [title], suggest 3–5 research questions suitable for a systematic mapping study. Each RQ should be answerable by classifying papers into categories. For each RQ, also suggest what classification facets would be needed to answer it."
- Output: `{ suggestions: [{ question, rationale, suggestedFacets: [{ name, type, possibleCategories }] }] }`

**Part 3 — RQ → Facet Bridge:**

When the user accepts a suggested RQ, offer to auto-create the corresponding facets. This creates a smooth flow: describe study → get RQ suggestions → accept RQs → facets auto-generated → study protocol is complete.

**Frontend integration:**

On the research questions editor page, add two buttons:
- "Use Template" → opens the pattern library modal
- "Get AI Suggestions" → calls the LLM endpoint, shows suggestions in a card layout with "Accept" / "Modify" / "Dismiss" actions per suggestion

**Key files to create:**
- New: `frontend/components/parameters/rq-template-library.tsx`
- New: `frontend/components/parameters/rq-ai-suggestions.tsx`
- New: `python-service/src/routes/rq_suggestions.py`
- Modify: `frontend/components/parameters/research-questions-editor.tsx` (add buttons)
- Modify: `frontend/app/api/studies/[id]/facets/route.ts` (support batch facet creation from suggestions)

#### Definition of Done

- [ ] "Use Template" button opens a modal with 6+ RQ pattern templates
- [ ] Templates have fill-in-the-blank fields that generate complete RQ text
- [ ] Selecting a template adds the RQ to the study
- [ ] "Get AI Suggestions" button calls LLM and returns 3–5 RQ suggestions
- [ ] Each suggestion includes the question text, rationale, and suggested facets
- [ ] User can accept, modify, or dismiss each suggestion
- [ ] Accepting a suggestion adds the RQ and optionally auto-creates the corresponding facets
- [ ] Works with empty study (no existing RQs) and with existing RQs (suggests additional)

#### Testing

- Create a new study with just a title — use "Get AI Suggestions" — verify relevant RQs suggested
- Accept 2 suggestions with auto-facet creation — verify facets are created and linked to RQs
- Use the template library — fill in blanks — verify RQ text is well-formed
- Test with a study that already has 3 RQs — verify suggestions complement (not duplicate) existing RQs

---

### TICKET 14: Real-Time Progress for Long Operations (WebSocket/SSE)

**Priority:** P2 — Differentiator
**Phase:** 4 (Intelligence)
**Estimated effort:** 1.5 days
**Dependencies:** TICKET 01 (batch operations should exist to benefit from this)

#### Description

Add Server-Sent Events (SSE) streaming for long-running operations (batch screening, batch classification, re-classification during split). Currently there's no feedback during these operations.

#### Technical Approach

**SSE approach** (simpler than WebSocket, sufficient for one-way server→client communication):

Modify the batch operation endpoints (from TICKET 01) to use `ReadableStream` with `text/event-stream` content type.

Event format:
```
data: {"type":"progress","current":5,"total":47,"sourceId":"...","sourceTitle":"...","status":"analyzing"}

data: {"type":"result","sourceId":"...","decision":"INCLUDE","confidence":0.87}

data: {"type":"error","sourceId":"...","error":"Rate limit exceeded","retrying":true}

data: {"type":"complete","summary":{"included":12,"excluded":31,"errors":4,"duration":127}}
```

**Frontend consumer:**

Create a reusable hook `useSSEProgress(url)` that:
- Opens an EventSource connection to the endpoint
- Parses events and maintains progress state
- Handles reconnection on failure
- Returns: `{ progress, isRunning, errors, summary }`

**Progress UI component:**

Enhance the batch progress modal (from TICKET 01) with:
- Animated progress bar with percentage
- Current operation: "Screening: [Paper Title]..."
- Live log of completed items (scrollable, most recent at top)
- ETA based on average processing time per item
- Error count with expandable error list
- "Cancel" button to abort the batch

**Key files to create/modify:**
- New: `frontend/lib/hooks/use-sse-progress.ts`
- Modify: batch operation routes to use SSE streaming
- Modify: `frontend/components/source/batch-progress-modal.tsx` (enhanced UI)

#### Definition of Done

- [ ] Batch screening streams progress events in real-time
- [ ] Progress bar updates live with percentage and current item
- [ ] ETA shown based on average processing time
- [ ] Errors displayed without halting the stream
- [ ] "Cancel" button stops the operation
- [ ] Connection auto-reconnects on network interruption
- [ ] Works correctly in Chrome and Firefox

#### Testing

- Run batch screening on 30+ sources — verify real-time progress updates
- Deliberately cause errors (empty abstracts) — verify they appear in error list
- Cancel mid-operation — verify remaining items are not processed
- Simulate network interruption — verify reconnection and progress continuity

---

### TICKET 15: Conflict Resolution Workflow

**Priority:** P1 — High Value
**Phase:** 2 (Screening Quality)
**Estimated effort:** 1 day
**Dependencies:** TICKET 06 (extends the screening review dashboard)

#### Description

When multi-LLM voting produces disagreements, surface these in a dedicated "Conflicts" view within the review dashboard. Show which LLMs disagreed on which criteria, present the competing reasoning side by side, and let the researcher make the final call.

#### Technical Approach

**Identifying conflicts:**

A conflict exists when: not all LLMs agree on a criterion for a given source. Query `AnalysisVote` records grouped by `(analysisId, criterionType, criterionIndex)` where distinct `decision` values exist.

**Frontend — Conflict view (sub-view of Review Dashboard):**

Add a "Conflicts Only" filter to the review dashboard queue (from TICKET 06). For each conflicted source, the right panel shows:

Per-criterion conflict display:
- Criterion text at the top
- Below: columns for each LLM provider showing their individual decision (Include/Exclude), confidence score, and reasoning text
- Highlight the disagreement in red
- Radio button for the researcher's final decision per criterion

This extends the review dashboard rather than creating a separate page.

**Key files to create/modify:**
- New: `frontend/components/review/conflict-detail-view.tsx`
- Modify: `frontend/lib/hooks/use-review-queue.ts` (add conflict filter)
- Modify: `frontend/components/review/review-panel.tsx` (show conflict detail when applicable)
- New: `frontend/lib/services/analysis/conflict-service.ts` (identify conflicts from votes)

#### Definition of Done

- [ ] "Conflicts" filter in review dashboard shows only sources with LLM disagreements
- [ ] Conflict count displayed in filter dropdown
- [ ] Conflict detail shows per-criterion LLM votes side by side
- [ ] Researcher can set a final decision per criterion
- [ ] Resolving all conflicts for a source removes it from the conflict queue
- [ ] Conflict resolution is auditable (who decided what and when)

#### Testing

- Run multi-LLM screening on sources designed to produce disagreements (ambiguous papers)
- Verify conflicts are correctly identified and counted
- Resolve a conflict — verify the source moves to "resolved" status
- Check that the final decision uses the researcher's override, not the majority vote

---

### TICKET 16: Standard Taxonomies Library

**Priority:** P2 — Differentiator
**Phase:** 3 (Classification Depth)
**Estimated effort:** 0.5 day
**Dependencies:** None

#### Description

Ship with pre-built classification facets that researchers can import into their studies. The most important is the Wieringa et al. (2006) research type taxonomy used in the Petersen paper.

#### Technical Approach

**Seed data file:**

Create `frontend/lib/data/standard-taxonomies.ts` containing:

1. **Wieringa Research Types** (6 categories with descriptions — from Petersen 2008 Table 3): Validation Research, Evaluation Research, Solution Proposal, Philosophical Papers, Opinion Papers, Experience Papers.

2. **Publication Venue Types** (common): Journal, Conference, Workshop, Symposium, Book Chapter, Technical Report, Preprint.

3. **Contribution Types** (common in SE mapping studies): Tool, Method, Model, Framework, Process, Metric, Taxonomy, Dataset, Survey.

**Frontend — Import from library:**

In the facet creation form, add a "Import from Library" button that opens a modal listing available taxonomies. Selecting one pre-fills the facet name, description, type (CLOSED), and all categories with descriptions.

**Key files to create:**
- New: `frontend/lib/data/standard-taxonomies.ts`
- New: `frontend/components/facets/taxonomy-library-modal.tsx`
- Modify: facet creation form to add "Import from Library" button

#### Definition of Done

- [ ] "Import from Library" button visible when creating a new facet
- [ ] Library modal shows 3+ standard taxonomies
- [ ] Selecting a taxonomy pre-fills facet name, description, and all categories
- [ ] Imported categories include descriptions
- [ ] User can still modify the imported facet before saving
- [ ] Wieringa research type taxonomy is accurate per the original paper

#### Testing

- Create a new facet using the Wieringa taxonomy — verify all 6 categories imported correctly
- Modify an imported category name — verify changes are preserved
- Import a taxonomy and then add additional custom categories — verify both coexist

---

## Sequencing Summary

| # | Ticket | Priority | Phase | Depends On | Est. Days |
|---|--------|----------|-------|------------|-----------|
| 01 | Batch Screening & Classification | P0 | 1 | — | 1.5 |
| 02 | Search Protocol Documentation | P0 | 1 | — | 1 |
| 03 | BibTeX / RIS Export | P1 | 1 | — | 0.5 |
| 04 | Study Progress Dashboard | P1 | 1 | — | 0.75 |
| 05 | Full Data Table Export (Excel) | P1 | 1 | — | 1.5 |
| 06 | Screening Review Dashboard | P0 | 2 | 01 | 2.5 |
| 07 | PRISMA Flow Diagram | P0 | 2 | — | 1.25 |
| 08 | Inter-Rater Agreement Metrics | P1 | 2 | — | 1 |
| 09 | Evidence-Based Classification | P0 | 3 | — | 2.5 |
| 10 | Coded Sections View (UI) | P1 | 3 | 09 | 2.5 |
| 11 | Multi-Valued Classification | P0 | 3 | — | 1.75 |
| 12 | Category Merge / Split | P1 | 3 | — | 1.25 |
| 13 | RQ Formulation Helper | P1 | 4 | — | 2 |
| 14 | Real-Time Progress (SSE) | P2 | 4 | 01 | 1.5 |
| 15 | Conflict Resolution Workflow | P1 | 2 | 06 | 1 |
| 16 | Standard Taxonomies Library | P2 | 3 | — | 0.5 |

**Total estimated effort: ~21.5 days**

**Parallelization:** Within each phase, tickets without dependencies can be worked on in parallel. For example, Phase 1 tickets 01–05 are all independent and can be assigned to 5 separate Claude Code instances simultaneously.
