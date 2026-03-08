# SMS/MLR Methodology Reference

This document summarizes the systematic mapping study (SMS) and multivocal literature review (MLR) methodology, extracted from two reference papers stored in `literature/`.

**References:**
- Petersen, K., Vakkalanka, S., & Kuzniarz, L. (2015). *Guidelines for conducting systematic mapping studies in software engineering: An update.* Information and Software Technology, 64, 1–18.
- Garousi, V., Felderer, M., & Mäntylä, M. V. (2019). *Guidelines for including grey literature and conducting multivocal literature reviews in software engineering.* Information and Software Technology, 106, 101–121.

---

## Systematic Mapping Study Process (Petersen et al. 2015)

A systematic mapping study provides a structured overview of a research area by categorizing and counting contributions. The process has six phases:

### Phase 1: Need Identification & Scoping

- **Identify the need**: Confirm no recent SMS/SLR exists on the topic, or the existing one is outdated
- **Define scope**: Use the PICO framework (Population, Intervention, Comparison, Outcome) to bound the study
- **Define research questions (RQs)**: Typically 3–6 questions that guide the entire study. Common patterns:
  - What types of research exist on topic X?
  - How has research on X evolved over time?
  - What research methods are used?
  - What venues publish research on X?
  - What are the open research gaps?

### Phase 2: Search Strategy

- **Select databases**: Common choices include IEEE Xplore, ACM Digital Library, Scopus, Web of Science, SpringerLink
- **Define search strings**: Boolean combinations of keywords derived from RQs (AND/OR operators)
- **Document the protocol**: Record databases searched, search strings used, date ranges, number of results per database
- **Snowballing** (optional): Forward and backward citation chasing from included studies
- **Manual search** (optional): Browse specific venues or conference proceedings

### Phase 3: Study Selection (Screening)

- **Define inclusion/exclusion criteria**: Explicit, objective criteria applied consistently
  - Common inclusion: published in peer-reviewed venue, written in English, within date range, relevant to topic
  - Common exclusion: duplicate, short paper (<4 pages), not primary study, out of scope
- **Pilot screening**: Two reviewers independently screen a sample (~50 papers), compute inter-rater agreement (Cohen's kappa)
- **Screen all studies**: Apply criteria to title+abstract first, then full text if needed
- **Resolve disagreements**: Discussion or third reviewer for borderline cases
- **Document decisions**: Record inclusion/exclusion reason for each study

### Phase 4: Data Extraction & Classification

- **Define classification scheme**: Two types of facets:
  - **Topic-independent** (generic): Research type (validation, evaluation, solution proposal, experience report, opinion, philosophical), research method (experiment, case study, survey, etc.), venue type (journal, conference, workshop)
  - **Topic-specific**: Derived from RQs. Can use:
    - *Existing schemes*: Reuse categories from prior SMS/SLR
    - *Keywording/open coding*: Read abstracts, identify keywords, cluster into emergent categories
- **Extract data**: For each included study, record values for every facet
- **Pilot extraction**: Two reviewers extract data for a sample, compare and calibrate

### Phase 5: Analysis & Visualization

- **Frequency analysis**: Count studies per category for each facet → bar charts, pie charts
- **Time-series analysis**: Plot number of studies per year, optionally grouped by facet → line charts
- **Cross-tabulation (systematic maps)**: 2D matrices combining two facets → bubble plots, heatmaps
  - Cell size/color represents number of studies
  - Reveals research gaps (empty or sparse cells)
- **Gap identification**: Highlight underexplored combinations of facets
- **Summary statistics**: Total studies, included/excluded counts, year range, venue distribution

### Phase 6: Validity & Reporting

- **Threats to validity**:
  - *Descriptive validity*: Accurate data extraction
  - *Theoretical validity*: Classification scheme covers the domain
  - *Generalizability*: Database selection covers relevant literature
  - *Interpretive validity*: Conclusions follow from data
  - *Repeatability*: Protocol documented enough for replication
- **Report structure**: Background → method → results (one section per RQ) → discussion → threats → conclusion

---

## Multivocal Literature Review Extensions (Garousi et al. 2019)

An MLR extends SMS/SLR to include **grey literature (GL)** — sources not published in formal peer-reviewed channels. This is particularly valuable in software engineering where practitioner knowledge (blogs, white papers, tool docs) complements academic research.

### When to Include Grey Literature

Include GL when:
- The topic has significant practitioner interest
- Academic literature alone is insufficient
- Practitioner perspectives are valuable (e.g., tools, practices, industry trends)
- The field is fast-moving (GL appears faster than peer-reviewed papers)

### Grey Literature Tiers

| Tier | Description | Examples |
|------|-------------|----------|
| **1st tier** (high credibility) | Authored, edited, with clear methodology | Books, government reports, white papers, theses |
| **2nd tier** (moderate) | Some editorial oversight | Annual reports, conference talks/videos, Q&A sites, wiki articles |
| **3rd tier** (low credibility) | No editorial process | Blog posts, tweets, emails, news articles |

### GL Search Strategy

- **Search engines**: Google (first 10 pages), Google Scholar
- **Specialized sites**: Stack Overflow, Medium, dev.to, company blogs
- **Snowballing**: Follow references in found GL sources
- **Stop criteria**: Theoretical saturation (no new themes emerging), or predefined page limit

### GL Quality Assessment

Assess each GL source on criteria such as:
- Authority of the author/organization
- Methodology or rigor of the content
- Objectivity vs. promotional content
- Date and currency of the information
- Relevance to the research questions
- Use a checklist or scoring rubric; set a minimum quality threshold

### GL-Specific Data Extraction

- **Source metadata**: URL, author/organization, publication date, source type (blog, video, report)
- **Traceability**: Record URL access date (GL can disappear or change)
- **Content extraction**: May need to extract from HTML, video transcripts, slide decks

### Synthesis

- **Qualitative coding**: Thematic analysis of GL alongside academic sources
- **Triangulation**: Compare findings from GL vs. academic literature
- **Dual reporting**: Present findings relevant to both researchers and practitioners

---

## How This Maps to SMS Assistant

The SMS Assistant platform implements the above methodology as follows:

| Methodology Phase | Platform Feature |
|---|---|
| Need identification & scoping | Study creation with motivation field |
| Define research questions | Parameters → Research Questions tab |
| Define criteria | Parameters → Criteria tab (inclusion + exclusion) |
| Search strategy documentation | Parameters → Search Protocol tab |
| Source import | Bulk import (IEEE, ACM, SCOPUS), PDF upload, URL import, Chrome extension |
| Screening | AI-powered inclusion/exclusion with per-criterion analysis |
| Multi-reviewer agreement | Multi-LLM voting (Claude + OpenAI + Gemini majority vote) |
| Classification scheme | Parameters → Classification tab (CLOSED, OPEN, OPEN_CODED facets) |
| Keywording / open coding | Coding Wizard for emergent categories |
| Frequency analysis | Analysis → Distributions tab |
| Time-series trends | Analysis → Trends tab |
| Systematic maps (crosstabs) | Analysis → Systematic Maps tab (heatmaps + bubble plots) |
| Gap analysis | Analysis → Research Gaps tab |
| Data export | BibTeX/RIS export, Excel export, CSV from analysis tabs |
| Grey literature | URL source import with metadata extraction |

See [docs/workflows.md](workflows.md) for the detailed workflow mapping and gap analysis.
