// ACM Digital Library extractor

class ACMExtractor extends BaseExtractor {
  canHandle() {
    return this.url.includes('dl.acm.org');
  }

  extractMetadata() {
    const metadata = super.extractMetadata();

    // Title
    metadata.title = this.getText('h1[property="name"]') ||
      this.getText('h1.citation__title') ||
      this.getMeta('citation_title') ||
      this.getText('title');

    // Authors
    // Try structured data on page first
    const authorItems = this.doc.querySelectorAll('span[property="author"]');
    if (authorItems.length > 0) {
      metadata.authors = Array.from(authorItems).map(item => {
        const givenElem = item.querySelector('[property="givenName"]');
        const familyElem = item.querySelector('[property="familyName"]');

        const given = givenElem ? this.cleanText(givenElem.textContent) : null;
        const family = familyElem ? this.cleanText(familyElem.textContent) : null;

        if (given && family) return `${given} ${family}`;

        // Fallback to title attribute or text content
        const link = item.querySelector('a');
        return (link && link.title) ? link.title : this.cleanText(item.textContent);
      }).filter(name => name);
    }

    // Fallback to old selectors if no structured authors found
    if (metadata.authors.length === 0) {
      const authorElems = this.doc.querySelectorAll('.author-name, .loa__author-name span[property="name"]');
      metadata.authors = Array.from(authorElems).map(el => this.cleanText(el.textContent));
    }

    // Fallback to meta tags
    if (metadata.authors.length === 0) {
      const authorMeta = this.doc.querySelectorAll('meta[name="citation_author"]');
      metadata.authors = Array.from(authorMeta).map(el => el.getAttribute('content'));
    }

    // DOI
    metadata.doi = this.getMeta('citation_doi') ||
      this.getAttr('a[href*="doi.org"]', 'href');
    if (metadata.doi && metadata.doi.includes('doi.org/')) {
      metadata.doi = metadata.doi.split('doi.org/')[1];
    }

    // Publication date
    metadata.publicationDate = this.getText('.core-date-published') ||
      this.getMeta('citation_publication_date') ||
      this.getMeta('citation_online_date') ||
      this.getText('.CitationCoverDate');

    // Venue (conference/journal)
    metadata.venue = this.getText('.core-self-citation [property="isPartOf"] [property="name"]') ||
      this.getMeta('citation_conference_title') ||
      this.getMeta('citation_journal_title') ||
      this.getText('.epub-section__title');

    // Abstract
    const abstractDiv = this.doc.querySelector('.abstractSection, .article__section--abstract, #abstract');
    if (abstractDiv) {
      const paragraphs = abstractDiv.querySelectorAll('p, [role="paragraph"]');
      if (paragraphs.length > 0) {
        const abstractText = Array.from(paragraphs)
          .map(p => p.textContent.trim())
          .join(' ');
        metadata.abstract = this.cleanText(abstractText);
      } else {
        metadata.abstract = this.cleanText(abstractDiv.textContent);
      }
    }

    // Keywords
    const keywordElems = this.doc.querySelectorAll('.tag-list__tag, .keyword');
    metadata.keywords = Array.from(keywordElems).map(el => this.cleanText(el.textContent));

    // PDF URL
    // Prioritize specific, high-confidence selectors
    let pdfUrl = null;

    // 1. User-specific feedback: aria-label="View PDF" in .info-panel
    const viewPdfBtn = this.doc.querySelector('a[aria-label="View PDF"]');
    if (viewPdfBtn) {
      pdfUrl = viewPdfBtn.getAttribute('href');
    }

    // 2. Info-panel specific check
    if (!pdfUrl) {
      const infoPanelPdf = this.doc.querySelector('.info-panel a[href*="pdf"], .info-panel a[title="PDF"]');
      if (infoPanelPdf) {
        pdfUrl = infoPanelPdf.getAttribute('href');
      }
    }

    // 3. Standard ACM DOI PDF pattern (e.g. /doi/pdf/10.1145/xxxx)
    if (!pdfUrl) {
      const doiPdf = this.doc.querySelector('a[href*="/doi/pdf/"]');
      if (doiPdf) {
        pdfUrl = doiPdf.getAttribute('href');
      }
    }

    // 4. Known ACM classes (red button etc)
    if (!pdfUrl) {
      const classBtn = this.doc.querySelector('a.article__downloadBtn, a.btn--red[href*="pdf"]');
      if (classBtn) {
        pdfUrl = classBtn.getAttribute('href');
      }
    }

    if (pdfUrl) {
      metadata.pdfUrl = new URL(pdfUrl, this.url).href;
    }

    // Fallback to meta tag
    if (!metadata.pdfUrl) {
      metadata.pdfUrl = this.getMeta('citation_pdf_url');
    }

    metadata.sourceCategory = 'FORMAL';
    metadata.sourceType = 'PDF';

    // Generate BibTeX
    metadata.bibtex = this.generateBibtex(metadata);

    return metadata;
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.ACMExtractor = ACMExtractor;
}





