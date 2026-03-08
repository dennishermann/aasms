# Platform Workflows & Gap Analysis

This document maps the SMS/MLR methodology phases (see [methodology.md](methodology.md)) to the platform's implemented features, and identifies gaps.

---

## Workflow Mapping

### Phase 1: Planning

| Step | Platform Feature | Status | Location |
|------|-----------------|--------|----------|
| Create study | Study creation form | ✅ | `/studies/new` |
| Define motivation | Overview tab editor | ✅ | `/studies/[id]/parameters` → Overview |
| Define research questions | Research Questions editor (reorderable) | ✅ | `/studies/[id]/parameters` → Research Questions |
| Define inclusion criteria | Criteria editor (ordered list) | ✅ | `/studies/[id]/parameters` → Criteria |
| Define exclusion criteria | Criteria editor (ordered list) | ✅ | `/studies/[id]/parameters` → Criteria |
| Define classification scheme | Classification Schema editor | ✅ | `/studies/[id]/parameters` → Classification |
| Configure facets (CLOSED/OPEN/OPEN_CODED) | Facet editor with type selector | ✅ | Facet editor within Classification tab |
| Metadata binding for facets | Facet editor → Metadata binding section | ✅ | Auto-populate from source metadata fields |
| Configure analysis recipes | Recipe editor | ✅ | `/studies/[id]/parameters` → Recipes |

### Phase 2: Search

| Step | Platform Feature | Status | Location |
|------|-----------------|--------|----------|
| Document search protocol | Search Protocol editor | ✅ | `/studies/[id]/parameters` → Search Protocol |
| Record databases searched | Search protocol entries (database, string, date range, count) | ✅ | |
| Execute database searches | Manual (external) | ✅ By design | User searches databases outside the tool |
| Grey literature search | Manual (external) | ✅ By design | User searches Google etc. outside the tool |

### Phase 3: Screening (Source Import & Selection)

| Step | Platform Feature | Status | Location |
|------|-----------------|--------|----------|
| Import from IEEE Xplore (CSV) | Bulk import with IEEE parser | ✅ | `/studies/[id]/sources/add` → Bulk |
| Import from ACM (BibTeX) | Bulk import with ACM parser | ✅ | `/studies/[id]/sources/add` → Bulk |
| Import from SCOPUS (CSV) | Bulk import with SCOPUS parser | ✅ | `/studies/[id]/sources/add` → Bulk |
| Import single PDF | PDF upload with metadata extraction | ✅ | `/studies/[id]/sources/add` → PDF |
| Import URL/webpage | URL form with web scraping + metadata | ✅ | `/studies/[id]/sources/add` → URL |
| Chrome extension import | Browser extension for 6 academic sites | ✅ | Chrome extension popup |
| Duplicate detection | Automatic during import (title + DOI + author/year) | ✅ | Import pipeline |
| AI screening (inclusion/exclusion) | LLM evaluates per criterion with confidence | ✅ | Source detail → Analysis panel |
| Multi-LLM voting | Majority vote across Claude/OpenAI/Gemini | ✅ | Automatic when 2+ providers configured |
| Batch screening | Screen all pending sources with progress | ✅ | Source list → "Screen All Pending" button |
| Manual decision override | Edit inclusion/exclusion decision | ✅ | Source detail → Analysis editor |
| Inter-rater agreement (kappa) | — | ❌ Gap | Votes stored but no kappa computed |
| PRISMA flow diagram | — | ❌ Gap | No visual screening flow diagram |

### Phase 4: Data Extraction & Classification

| Step | Platform Feature | Status | Location |
|------|-----------------|--------|----------|
| LLM classification (CLOSED facets) | Per-facet classification with confidence | ✅ | Source detail → Classifications |
| LLM classification (OPEN facets) | Free-text keyword extraction | ✅ | Source detail → Classifications |
| Batch classification | Classify all included sources with progress | ✅ | Source list → "Classify All Included" button |
| Open coding / keywording | Coding Wizard: suggest categories, drag-drop mapping | ✅ | Facet editor → Coding Wizard |
| Keyword-to-category mapping | Drag-drop keyword mapping UI | ✅ | Facet editor → Keyword mapping |
| Metadata-bound classification | Auto-populate from source fields (e.g., year, venue) | ✅ | Facet metadata binding config |
| Reclassification | Reclassify all sources after schema changes | ✅ | API: `POST /reclassify` |

### Phase 5: Analysis & Visualization

| Step | Platform Feature | Status | Location |
|------|-----------------|--------|----------|
| Summary statistics | Counts, year range, venues, facet coverage | ✅ | `/studies/[id]/analysis` → Overview |
| Frequency distributions | Bar charts, pie charts, frequency tables | ✅ | Analysis → Distributions |
| Time-series trends | Publication trends over years, grouped by facet | ✅ | Analysis → Trends |
| Systematic maps (2D crosstab) | Heatmap + table, count/percentage toggle | ✅ | Analysis → Systematic Maps |
| Bubble plots | ECharts bubble chart component | ✅ | Analysis charts |
| Gap analysis | Underexplored facet combinations with threshold | ✅ | Analysis → Research Gaps |
| Data table (mapping table) | Paginated source × facet matrix | ✅ | Analysis → Data Table |
| Source drilldown | Click chart cell → see underlying sources | ✅ | Drilldown modal |
| RQ answer generation | Recipe-driven answer generation per RQ | ✅ | Analysis → RQ Answers |

### Phase 6: Export & Reporting

| Step | Platform Feature | Status | Location |
|------|-----------------|--------|----------|
| Export sources (BibTeX) | Filtered export (included or all) | ✅ | Source list → Export |
| Export sources (RIS) | Filtered export (included or all) | ✅ | Source list → Export |
| Full dataset export (Excel) | Multi-sheet workbook (protocol, sources, classifications) | ✅ | Study export |
| CSV export from analysis | Per-tab CSV download | ✅ | Analysis tabs → Export button |
| Recipe bundle export (ZIP) | Recipe definition + results + figures | ✅ | Recipes → Export |

### Grey Literature (MLR Extensions)

| Step | Platform Feature | Status | Location |
|------|-----------------|--------|----------|
| URL/webpage import | URL source form + metadata extraction | ✅ | Sources → Add → URL |
| Web content scraping | Scraping router | ⚠️ Stub | `/scrape-url` endpoint not implemented |
| GL quality assessment | — | ❌ Gap | No quality tiers or scoring |
| GL-specific search | — | ❌ Gap (acceptable) | Same as academic: user searches externally |

---

## Identified Gaps

### 1. Web Scraping (stub)
**Priority: Medium** — The `/scrape-url` endpoint exists but is not implemented. Currently, URL sources rely on the frontend sending content. A server-side scraper would improve reliability for grey literature.

### 2. Grey Literature Quality Assessment
**Priority: Low** — The methodology recommends assessing GL quality using tiered criteria (authority, methodology, objectivity, date). This could be a simple quality score field on sources imported via URL, or an automated LLM-based assessment.

### 3. Inter-Rater Reliability (Cohen's Kappa)
**Priority: Low** — Multi-LLM votes are stored in `AnalysisVote` records, but no kappa statistic is computed. This would be useful for reporting the level of agreement between LLM "reviewers." Could be added as a metric on the analysis overview.

### 4. PRISMA Flow Diagram
**Priority: Low** — A PRISMA-style flow diagram showing the screening funnel (identified → screened → eligible → included) is standard in SMS/SLR publications. The data exists (source counts by status), but no visual flow diagram is generated.

### 5. README "Limitations" Section Outdated
**Priority: High** — The README lists several features as "work in progress" that are already implemented:
- ~~Manual override UI for inclusion decisions~~ → Implemented
- ~~Export to standard formats (BibTeX, CSV, RIS)~~ → Implemented
- ~~Batch operations on sources~~ → Implemented

---

## Key User Workflows (E2E Test Coverage)

These are the end-to-end workflows that the E2E tests verify:

1. **Study Lifecycle** — Create study → configure parameters → verify overview
2. **Source Import** — Import BibTeX file → review preview → confirm → verify in list
3. **Screening** — View source → trigger AI analysis → see recommendation → override decision
4. **Classification** — View included source → trigger classification → see facet results → batch classify
5. **Analysis** — View dashboard → explore distributions, maps, gaps → export data
