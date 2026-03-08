# SMS Assistant — Status Report & Roadmap

**Author:** Dennis Hermann (TUM Seminar)
**Date:** February 8, 2026
**Version:** 1.0

---

## 1. How a Systematic Mapping Study Works (Methodology)

A systematic mapping study (SMS) is a secondary study method that provides a broad, structured overview of a research area by categorizing and counting primary studies. Unlike systematic literature reviews (which evaluate individual studies in depth), an SMS aims for breadth: mapping *what* research exists, *where* it was published, and *what types* of contributions have been made. The canonical process is defined by Petersen et al. (2008) and consists of five sequential phases, each producing a concrete outcome.

### Phase 1 — Definition of Research Questions → *Review Scope*

The study begins by formulating research questions (RQs) that define its scope. Typical SMS research questions follow recurring patterns: "What topics are addressed?", "What research methods are used?", "How has publication activity changed over time?", and "In which venues is the research published?" These questions directly determine the classification scheme, the search strategy, and ultimately the shape of the resulting map.

**What researchers do in practice (from sample materials):**
Real-world SMS datasets show that studies typically define 2–5 research questions, often organized hierarchically (RQ1, RQ1.1, RQ1.2, etc.). Each RQ maps to one or more classification facets. Researchers document these in a "Setup" or "Protocol" sheet in their master spreadsheet, alongside inclusion/exclusion criteria, target databases, and date ranges.

**Automation potential:** LOW — RQ formulation requires domain expertise and creative judgment. However, a tool can provide templates, enforce structure, suggest standard RQ patterns, and validate that each RQ maps to at least one facet.

### Phase 2 — Conduct Search → *All Papers*

Researchers construct search strings using terms derived from the RQs (structured around population, intervention, comparison, outcome) and execute them across scientific databases (IEEE Xplore, ACM Digital Library, Scopus, Web of Science, Springer, etc.). Some studies also include grey literature (technical reports, blog posts, white papers). The result is a raw pool of potentially relevant papers — often thousands.

**What researchers do in practice:**
Sample materials show search result pools ranging from 353 to 5,453 papers. Researchers export results from each database (typically as CSV, BibTeX, or RIS), import them into a reference manager (Zotero, Mendeley), and deduplicate. The exported data typically includes ~87 metadata fields from Zotero alone, though only ~15–20 are actively used.

**Automation potential:** HIGH — Database queries can be automated or semi-automated. Export parsing, deduplication (via DOI, title similarity, author matching), and metadata normalization are classic automation targets. A Chrome extension for one-click capture from database search result pages is very valuable here.

### Phase 3 — Screening of Papers → *Relevant Papers*

Each paper's title and abstract are evaluated against predefined inclusion and exclusion criteria. Papers that clearly fall outside scope are excluded; borderline cases may be flagged for full-text review. In rigorous studies, two or more reviewers screen independently and then reconcile disagreements.

**What researchers do in practice:**
The sample materials reveal that screening funnels are steep: a typical study might screen 500–5,000 papers to arrive at 10–300 included studies (2–15% inclusion rate). Researchers track decisions using columns like "Include (Y/N)", "Reviewer 1 Decision", "Reviewer 2 Decision", "Conflict Resolution", and "Reason for Exclusion". Some studies use a three-level scheme (Include / Exclude / Uncertain). Quality studies track per-criterion evaluation (IC1, IC2, EC1, EC2, etc.).

**Automation potential:** VERY HIGH — This is the single most time-consuming phase and the best target for AI assistance. An LLM can evaluate each paper's abstract against each criterion with reasoning and confidence scores. Multi-LLM voting can simulate multi-reviewer consensus. Human oversight remains essential for borderline cases.

### Phase 4 — Keywording of Abstracts → *Classification Scheme*

For each included paper, reviewers read the abstract (and potentially full text) and extract keywords that reflect the paper's contribution and context. These keywords are then clustered into categories, forming the classification scheme (facets). Petersen et al. describe three main facet types:

- **Topic facet** — What area does the paper address? (e.g., "requirements variability", "architecture variability")
- **Contribution type facet** — What kind of contribution? (e.g., tool, method, model, process, metric)
- **Research type facet** — What type of research? Using the Wieringa et al. (2006) taxonomy: Validation Research, Evaluation Research, Solution Proposal, Philosophical Paper, Opinion Paper, Experience Paper

The keywording process is inherently iterative: the scheme evolves as more papers are coded. Categories may be added, merged, split, or refined throughout.

**What researchers do in practice:**
Sample materials show 3–8 facets per study, with a mix of predefined (closed) and emergent (open) categories. Common patterns include binary indicator columns (0/1 for each category, enabling easy pivot tables), hierarchical coding (Category → Subcategory), and free-text fields that are later grouped. Multi-reviewer agreement is tracked with columns like "Reviewer1_Category" and "Reviewer2_Category" with a "Final" column after reconciliation.

**Automation potential:** HIGH — LLMs excel at reading abstracts and extracting keywords. The iterative category formation process can be supported by LLM-suggested clusters. However, the researcher must retain control over the final scheme, as it embodies their theoretical framework.

### Phase 5 — Data Extraction and Mapping → *Systematic Map*

With the classification scheme in place, each included paper is formally classified across all facets. The result is a matrix of papers × facets. From this matrix, the systematic map is generated: frequency tables showing how many papers fall into each category, cross-tabulation tables combining two facets (e.g., topic × research type), trend charts showing publication activity over time, and bubble plots visualizing multi-dimensional relationships.

**What researchers do in practice:**
The final deliverable is typically a set of tables and charts: one per research question. Bubble plots (as shown in Figure 3 of Petersen 2008) are the signature visualization — a matrix where bubble size represents paper count at each category intersection. Gap analysis identifies category combinations with few or no papers, suggesting future research directions. Sample materials show that researchers use dedicated "Analysis" or "Synthesis" sheets with pivot tables, charts, and summary statistics.

**Automation potential:** VERY HIGH — Once data extraction is complete, all analysis and visualization is mechanical. Frequency counts, cross-tabulations, trend lines, gap identification, and chart generation are fully automatable.

### Summary: Traditional SMS Effort Distribution

Based on sample materials analysis, a typical SMS requires 250–790 person-hours:

| Phase | Effort Share | Typical Duration | Automation Leverage |
|-------|-------------|-----------------|-------------------|
| RQ Definition & Protocol | 5–10% | 1–3 weeks | Low |
| Search & Collection | 10–15% | 1–2 weeks | High |
| Screening | 30–40% | 3–8 weeks | Very High |
| Keywording & Classification | 20–30% | 2–6 weeks | High |
| Data Extraction & Mapping | 15–25% | 2–4 weeks | Very High |

A well-designed tool targeting screening, classification, and analysis can realistically reduce total effort by 60–80%.

---

## 2. Current Prototype Assessment

### 2.1 Architecture Overview

The SMS Assistant is a full-stack application with a clean microservices architecture:

- **Frontend:** Next.js 16 (React 19, TypeScript, Tailwind CSS 4, shadcn/ui)
- **AI Service:** Python FastAPI with multi-LLM support (Claude, GPT-4o, Gemini)
- **Database:** PostgreSQL 16 via Prisma ORM
- **File Storage:** MinIO (S3-compatible)
- **Browser Extension:** Chrome Manifest v3 with site-specific extractors
- **Visualization:** Apache ECharts for interactive charts

### 2.2 Feature-by-Feature Methodology Mapping

The table below maps each Petersen 2008 process step to the tool's current implementation status.

#### Phase 1: Research Question Definition

| Requirement | Status | Notes |
|------------|--------|-------|
| Create and manage RQs | ✅ Done | Ordered list with add/remove |
| Study motivation/description | ✅ Done | Markdown editor with preview |
| Study status tracking | ✅ Done | DRAFT → ACTIVE → COMPLETED → ARCHIVED |
| Protocol documentation | ⚠️ Partial | Motivation exists; no formal protocol template (search strategy, date ranges, databases planned) |

#### Phase 2: Search & Collection

| Requirement | Status | Notes |
|------------|--------|-------|
| Bulk import from databases | ✅ Done | CSV/BibTeX from IEEE, ACM, Scopus with streaming |
| Chrome extension capture | ✅ Done | Site-specific extractors for 6+ databases |
| Duplicate detection | ✅ Done | Title similarity, DOI, author matching |
| PDF upload & text extraction | ✅ Done | PyMuPDF + PDFPlumber |
| Web/grey literature support | ✅ Done | URL scraping, grey literature tiers |
| Search string documentation | ❌ Missing | No way to document what search strings were used per database |
| Database coverage tracking | ❌ Missing | No tracking of which databases have been searched and how many results each returned |
| Import batch statistics | ✅ Done | Tracks totals, duplicates, new sources per batch |
| Snowballing support | ❌ Missing | No forward/backward citation tracking |

#### Phase 3: Screening

| Requirement | Status | Notes |
|------------|--------|-------|
| Inclusion/exclusion criteria definition | ✅ Done | Configurable text-based criteria |
| AI-powered screening | ✅ Done | Per-criterion LLM evaluation with reasoning |
| Multi-LLM voting | ✅ Done | 2–3 LLMs vote independently, majority wins |
| Confidence scoring | ✅ Done | 0–1 scale per evaluation |
| Per-criterion breakdown | ✅ Done | Individual criterion decisions visible |
| Manual override | ⚠️ Partial | `isUserEdited` field exists in schema but UI for overriding decisions needs work |
| Batch screening | ⚠️ Partial | Can trigger per-source; no "screen all pending" bulk action |
| Screening statistics (PRISMA flow) | ❌ Missing | No PRISMA-style flow diagram showing funnel |
| Inter-rater agreement metrics | ❌ Missing | Multi-LLM votes tracked but no Kappa/Krippendorff calculation |
| Conflict resolution workflow | ❌ Missing | No explicit UI for resolving LLM disagreements |
| Full-text screening for borderline cases | ❌ Missing | Screening uses abstract/metadata only; no "flag for full-text review" workflow |

#### Phase 4: Keywording & Classification

| Requirement | Status | Notes |
|------------|--------|-------|
| Define classification facets | ✅ Done | CLOSED, OPEN, OPEN_CODED types |
| Link facets to RQs | ✅ Done | Each facet can be associated with an RQ |
| AI-powered classification | ✅ Done | Per-facet LLM classification with confidence |
| Open coding with LLM assistance | ✅ Done | Coding wizard: suggest → cluster → map keywords |
| Category management | ✅ Done | Add, edit, approve/reject categories |
| Auto-assign threshold | ✅ Done | Configurable confidence threshold |
| Iterative scheme evolution | ⚠️ Partial | Can add categories, but no merge/split UI |
| Classification based on full text | ⚠️ Partial | Uses extracted text + abstract; depends on PDF availability |
| Multi-valued classification | ❌ Missing | A paper can only be in one category per facet currently |
| Wieringa research type taxonomy | ⚠️ Partial | Supported as a closed facet but not a built-in standard |
| Inter-coder agreement | ❌ Missing | No multi-reviewer classification agreement tracking |
| Classification audit trail | ✅ Done | Confidence, reasoning, auto-assigned flags stored |

#### Phase 5: Data Extraction & Mapping

| Requirement | Status | Notes |
|------------|--------|-------|
| Frequency analysis (single facet) | ✅ Done | Bar, pie charts with counts/percentages |
| Cross-tabulation (two facets) | ✅ Done | Heatmaps, tables |
| Bubble plots | ✅ Done | ECharts bubble visualization |
| Time-series / trend analysis | ✅ Done | Publication trends over years |
| Gap analysis | ✅ Done | Identifies under-represented combinations |
| Mapping table (source × facet) | ✅ Done | Full matrix with drill-down |
| RQ recipe system | ✅ Done | Templated answers: DISTRIBUTION, MAP, TREND, GAP |
| Source drill-down from charts | ✅ Done | Click any data point to see underlying papers |
| Export to CSV/PNG | ✅ Done | Data and chart export |
| PRISMA flow diagram | ❌ Missing | Standard reporting requirement not implemented |
| BibTeX export of included studies | ❌ Missing | No way to export bibliography of final set |
| Report generation | ❌ Missing | No automated report/paper section generation |
| Customizable chart appearance | ⚠️ Partial | Some config options; limited for publication-quality output |

### 2.3 What the Prototype Does Well

**Strong foundations across the entire workflow.** The tool covers all five Petersen phases to some degree — this is uncommon for research tools, which tend to focus on one phase only (e.g., Covidence for screening, NVivo for coding). Having the entire pipeline in one tool is a genuine differentiator.

**The AI-powered screening with multi-LLM voting is the standout feature.** The per-criterion evaluation with individual reasoning, combined with multi-provider consensus, directly addresses the biggest pain point in SMS research. The implementation is technically sound with proper async patterns, error handling, and audit trails.

**The classification system is flexible and well-designed.** The three facet types (CLOSED, OPEN, OPEN_CODED) with the coding wizard for open facet categorization closely mirrors how researchers actually work: starting with open coding, then iteratively forming categories.

**The analysis dashboard is comprehensive.** Seven analysis tabs covering all standard SMS visualizations (frequency, cross-tab, trends, gaps, bubble plots) with interactive drill-down. The RQ recipe system for binding analyses to research questions is a thoughtful feature.

**The database schema is excellent.** The Prisma schema comprehensively models the SMS workflow with proper relationships, audit trails, and quality flags. It's one of the strongest technical aspects of the project.

### 2.4 What Needs Improvement

**The screening workflow lacks human-in-the-loop affordances.** While AI screening works, there's no efficient way for a researcher to review AI decisions, override them, and track the review status. A screening dashboard showing AI recommendations with accept/reject/flag actions would transform usability.

**No PRISMA flow diagram.** This is the standard reporting format for any systematic study — it's a must-have for publication. Most reviewers will reject an SMS paper without one.

**No search protocol documentation.** Researchers need to document their search strings, databases searched, date ranges, and result counts. This is part of the reproducibility requirement. Currently, only import batches are tracked, not the search strategy itself.

**Batch operations are limited.** With hundreds of papers, researchers need "analyze all pending", "classify all included", "export all" actions. Currently, operations are mostly one-at-a-time.

**The coding wizard needs refinement.** While it supports open coding, there's no way to merge or split categories, no semantic similarity for deduplication, and no saturation detection. These are standard requirements for qualitative coding.

### 2.5 Technical Implementation Quality

**Overall Quality Score: 8.2/10**

| Dimension | Score | Assessment |
|-----------|-------|-----------|
| Code Quality (Python) | 8.5 | Clean async patterns, good error handling, proper logging |
| Code Quality (Frontend) | 8.0 | Modern React patterns, TanStack Query, good component structure |
| Database Design | 9.0 | Comprehensive schema, proper indexing, audit trail support |
| SMS Methodology Alignment | 8.0 | Covers main phases, missing some rigor aspects |
| UI/UX Polish | 7.5 | Clean design, but some workflows need more thought |
| Prompt Engineering | 7.5 | Functional but could benefit from chain-of-thought and calibration |

**Notable technical strengths:**
- Robust input validation (Zod frontend, Pydantic backend)
- Streaming import for large files
- OpenAI context caching for cost optimization
- Proper separation of concerns between Next.js API routes and Python AI service
- Chrome extension with site-specific extractors for 6+ academic databases

**Notable technical gaps:**
- No WebSocket/SSE for long-running operations — users don't see progress during batch analysis
- No retry/queue for failed LLM calls in batch operations
- No rate limiting in the frontend for API calls
- Test coverage appears minimal

---

## 3. Roadmap: What Still Needs to Be Done

The roadmap is organized by priority (P0 = critical for methodology compliance, P1 = high value for usability, P2 = nice-to-have differentiators) and grouped by theme.

### 🔴 P0 — Critical: Methodology Compliance

These are required for the tool to produce a methodologically valid SMS.

#### 3.1 PRISMA Flow Diagram Generator
**Gap:** No visual representation of the screening funnel.
**What:** Auto-generate a PRISMA 2020 flow diagram from study data showing: records identified → duplicates removed → screened → excluded (with reasons) → included.
**Why:** Virtually all SMS papers require this. Reviewers will reject without it.
**Effort:** Medium (data exists; needs visualization + export as SVG/PNG)

#### 3.2 Search Protocol Documentation
**Gap:** No way to record search strategy.
**What:** Add a "Search Protocol" section to study parameters: database name, search string used, date range, result count, date searched. Link each import batch to a search protocol entry.
**Why:** Reproducibility is a core requirement. Other researchers must be able to replicate the search.
**Effort:** Low–Medium (new data model + simple form UI)

#### 3.3 Screening Review Dashboard
**Gap:** No efficient human-in-the-loop screening workflow.
**What:** A dedicated review interface where the researcher sees the paper's title, abstract, and the AI's per-criterion evaluation side-by-side. Quick actions: Accept AI decision / Override to Include / Override to Exclude / Flag for Discussion. Keyboard shortcuts for speed (j/k navigate, a/r/f for accept/reject/flag).
**Why:** AI screening needs human validation. Without an efficient review workflow, the tool doesn't save time — it just shifts the bottleneck.
**Effort:** Medium (new page + data model updates for review status)

#### 3.4 Batch Operations
**Gap:** No bulk screening or classification.
**What:** "Analyze All Pending Sources" and "Classify All Included Sources" batch actions with progress tracking (WebSocket/SSE for real-time progress bar). Queue-based processing with retry on failure.
**Why:** With 500+ papers, clicking "analyze" one by one is not viable.
**Effort:** Medium–High (backend queue + progress streaming + frontend progress UI)

#### 3.5 Multi-valued Classification
**Gap:** A paper can only belong to one category per facet.
**What:** Allow papers to be tagged with multiple categories per facet (e.g., a paper about both "requirements variability" AND "architecture variability").
**Why:** Real SMS data frequently requires this. Sample materials show this is the norm, not the exception.
**Effort:** Medium (schema change: Classification becomes many-to-many; analysis queries need updating)

### 🟡 P1 — High Value: Usability & Rigor

#### 3.6 Inter-Rater Agreement Metrics
**Gap:** Multi-LLM votes are tracked but not analyzed.
**What:** Calculate and display Cohen's Kappa (for 2 raters) or Fleiss' Kappa / Krippendorff's Alpha (for 3+ LLMs) for both screening and classification. Show agreement per criterion and overall.
**Why:** Demonstrates methodological rigor and helps identify criteria that are ambiguous.
**Effort:** Low–Medium (statistical calculation + dashboard widget)

#### 3.7 Conflict Resolution Workflow
**Gap:** When LLMs disagree, there's no structured way to resolve it.
**What:** Flag papers where LLMs disagree. Present the disagreement (which LLM said what for which criterion) and let the researcher make the final call with documented reasoning.
**Why:** Transparent conflict resolution is essential for methodological rigor.
**Effort:** Medium (extends screening review dashboard)

#### 3.8 Category Merge/Split in Coding Wizard
**Gap:** Categories can only be added, not merged or split.
**What:** Allow researchers to select two categories and merge them (all papers re-classified), or split one category into two with AI-assisted re-classification of existing papers.
**Why:** The classification scheme is iterative by definition (Petersen 2008). Researchers constantly refine categories.
**Effort:** Medium (UI for merge/split + backend re-classification logic)

#### 3.9 BibTeX / RIS Export
**Gap:** No way to export the bibliography of included studies.
**What:** Export included sources as BibTeX, RIS, or CSV. Support filtered export (e.g., all papers in category X).
**Why:** Standard requirement for writing the SMS paper. Researchers need to generate reference lists.
**Effort:** Low (BibTeX is already stored per source; format and download)

#### 3.10 Study Progress Dashboard
**Gap:** Overview page shows counts but not workflow progress.
**What:** A visual progress tracker showing: total papers → screened → included → classified → analyzed. Color-coded phases. Percentage completion per phase. Estimated remaining effort.
**Why:** Researchers need to know where they are in the process, especially for reporting to supervisors.
**Effort:** Low (data exists; just needs visualization)

#### 3.11 Full-Text PDF Viewer with Annotation
**Gap:** PDFs can be stored but not viewed/annotated in-app.
**What:** In-browser PDF viewer (pdf.js) with highlighting and annotation support. Link annotations to classification decisions ("I classified this as X because of this paragraph").
**Why:** Full-text review is needed for borderline screening decisions and detailed classification.
**Effort:** High (pdf.js integration + annotation data model + UI)

### 🟢 P2 — Differentiators: What Would Make This Stand Out

#### 3.12 Report/Paper Section Generator
**Gap:** No automated report generation.
**What:** Generate draft sections of the SMS paper: methodology description (based on protocol), results section (based on analysis), tables and figures (from recipes), bibliography. Export as LaTeX or Word.
**Why:** Writing the paper is the final bottleneck. Auto-generating draft sections from the tool's data would be a game-changer.
**Effort:** High (LLM-generated text + template engine + export formats)

#### 3.13 Snowballing Support
**Gap:** No forward/backward citation tracking.
**What:** For included papers, fetch citations (via Semantic Scholar API or OpenAlex) and identify papers that cite or are cited by included studies. Flag new candidates for screening.
**Why:** Snowballing is a recommended supplementary search strategy that catches papers missed by database searches.
**Effort:** Medium–High (API integration + dedup against existing sources)

#### 3.14 Collaborative Multi-Researcher Support
**Gap:** Single-user only.
**What:** User accounts, study sharing, role-based access (lead researcher, reviewer), independent screening with reconciliation.
**Why:** Rigorous SMS studies require multiple reviewers. This is the #1 limitation for real-world adoption.
**Effort:** Very High (auth system, permissions, conflict resolution, real-time sync)

#### 3.15 Study Templates & Standard Taxonomies
**Gap:** No pre-built classification schemes.
**What:** Ship with standard taxonomies (Wieringa research types, ACM CCS, IEEE keywords) as importable facet templates. Allow saving and sharing custom schemes between studies.
**Why:** Saves setup time and promotes consistency across studies.
**Effort:** Low–Medium (seed data + import/export logic)

#### 3.16 LLM Calibration Round
**Gap:** LLMs evaluate without calibration.
**What:** Before full screening, run a calibration sample (10–20 papers) where the researcher evaluates manually, then compare LLM decisions to the human baseline. Adjust prompts or criteria based on disagreements.
**Why:** Improves LLM accuracy and gives researchers confidence in the automated results.
**Effort:** Medium (calibration workflow + comparison metrics)

#### 3.17 Duplicate Detection Improvements
**Gap:** Current dedup is basic (title similarity + DOI).
**What:** Semantic dedup using embedding similarity. Cross-database identifier matching (arXiv ID ↔ DOI ↔ Scopus ID). Fuzzy author matching handling name variants.
**Why:** Real imports show 10–30% duplicate rates across databases. Better dedup saves significant screening effort.
**Effort:** Medium (embedding model integration + matching logic)

#### 3.18 Real-Time Progress for Long Operations
**Gap:** No feedback during batch operations.
**What:** WebSocket or SSE connection for streaming progress updates during batch screening/classification. Show "Processing paper 47/312... Current: [paper title]" with ETA.
**Why:** Batch operations on 500+ papers take minutes to hours. Users need to know it's working.
**Effort:** Medium (WebSocket setup + frontend progress component)

---

## 4. Recommended Implementation Order

Given the seminar context and the goal of having a demonstrably complete tool, here's a suggested sequence:

### Sprint 1 (Immediate — 1-2 weeks)
Focus: Make the existing workflow actually usable end-to-end.

1. **Batch Operations (P0)** — "Analyze All" and "Classify All" buttons
2. **Search Protocol Documentation (P0)** — Simple form for recording search strategy
3. **BibTeX/RIS Export (P1)** — Quick win, very visible
4. **Study Progress Dashboard (P1)** — Visual progress tracker

### Sprint 2 (Short-term — 2-3 weeks)
Focus: Screening quality and methodology compliance.

5. **Screening Review Dashboard (P0)** — The human-in-the-loop interface
6. **PRISMA Flow Diagram (P0)** — Auto-generated from study data
7. **Inter-Rater Agreement Metrics (P1)** — Kappa scores for LLM voting
8. **Conflict Resolution Workflow (P1)** — Extends the review dashboard

### Sprint 3 (Medium-term — 2-3 weeks)
Focus: Classification depth and analysis quality.

9. **Multi-valued Classification (P0)** — Schema + UI update
10. **Category Merge/Split (P1)** — Coding wizard enhancement
11. **Standard Taxonomies (P2)** — Wieringa research types as a template
12. **Real-Time Progress (P2)** — WebSocket for batch operations

### Sprint 4 (Stretch — if time allows)
Focus: Publication-ready output.

13. **Report Generator (P2)** — Draft paper sections from data
14. **Full-Text PDF Viewer (P1)** — In-browser viewing with annotation
15. **LLM Calibration Round (P2)** — Improve screening accuracy
16. **Snowballing (P2)** — Citation tracking via APIs

---

## 5. Appendix: Key Patterns from Sample Materials

Analysis of 11 real-world SMS datasets (across AI in SE, GDPR, blockchain, GraphQL, agile, and software architecture domains) revealed these universal patterns that should inform the tool's design:

**Pattern 1: Hierarchical RQ structure.** RQs are nested (RQ1 → RQ1.1 → RQ1.1.1) with each leaf mapping to specific extraction columns. The tool should support hierarchical RQs.

**Pattern 2: Binary indicator columns.** Researchers use 0/1 columns for categories to enable pivot table analysis. The tool's analysis engine should mirror this approach internally.

**Pattern 3: Multi-reviewer consensus tracking.** Studies use "Reviewer1", "Reviewer2", "Final" column patterns. The multi-LLM voting maps to this, but the tool should expose it more explicitly.

**Pattern 4: Separate sheets per phase.** Researchers organize data across 10–15 sheets (Search Results, Screening, Extraction, Quality Assessment, Analysis). The tool's tabbed interface mirrors this.

**Pattern 5: Free-text + coded dual columns.** For open facets, researchers keep both the original free-text annotation and the coded category. The tool's `rawValue` + `value` fields in the Classification model already support this.

**Pattern 6: Screening funnels are steep.** Typical ratios are 500–5,000 initial → 50–300 included (2–15%). The tool needs to handle this scale efficiently via batch operations.

**Pattern 7: No existing dedicated SMS tools.** None of the sample studies used a specialized SMS tool — they all used Excel/Google Sheets + Zotero. This confirms the market opportunity and the importance of being better than spreadsheets at every phase.
