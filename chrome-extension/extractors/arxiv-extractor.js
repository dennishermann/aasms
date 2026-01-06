// arXiv extractor

class ArXivExtractor extends BaseExtractor {
  canHandle() {
    return this.url.includes('arxiv.org');
  }

  extractMetadata() {
    const metadata = super.extractMetadata();

    // Title
    metadata.title = this.getText('h1.title') ||
      this.getMeta('citation_title');
    if (metadata.title && metadata.title.startsWith('Title:')) {
      metadata.title = metadata.title.replace('Title:', '').trim();
    }

    // Authors
    const authorElems = this.doc.querySelectorAll('.authors a');
    metadata.authors = Array.from(authorElems).map(el => this.cleanText(el.textContent));

    // If no authors found, try the authors div
    if (metadata.authors.length === 0) {
      const authorsDiv = this.doc.querySelector('.authors');
      if (authorsDiv) {
        const authorText = authorsDiv.textContent.replace('Authors:', '').trim();
        metadata.authors = this.parseAuthors(authorText);
      }
    }

    // Publication date (submission date)
    const submittedText = this.getText('.dateline');
    if (submittedText) {
      const dateMatch = submittedText.match(/(\d{1,2}\s+\w+\s+\d{4})/);
      if (dateMatch) {
        try {
          const date = new Date(dateMatch[1]);
          if (!isNaN(date.getTime())) {
            metadata.publicationDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
          } else {
            metadata.publicationDate = dateMatch[1];
          }
        } catch (e) {
          metadata.publicationDate = dateMatch[1];
        }
      }
    }

    // Venue - arXiv category
    const categoryElem = this.doc.querySelector('.subheader .tag');
    if (categoryElem) {
      metadata.venue = `arXiv ${categoryElem.textContent.trim()}`;
    }

    // Abstract
    const abstractDiv = this.doc.querySelector('.abstract');
    if (abstractDiv) {
      // DOM-based cleanup: clone node and remove the descriptor span
      const clone = abstractDiv.cloneNode(true);
      const descriptor = clone.querySelector('.descriptor');
      if (descriptor) {
        descriptor.remove();
      }

      let abstractText = clone.textContent;
      if (abstractText) {
        // Additional cleanup just in case
        abstractText = abstractText.replace(/^\s*Abstract:?\s*/i, '').trim();
        metadata.abstract = this.cleanText(abstractText);
      }
    }

    // Keywords/subjects
    const subjectsDiv = this.doc.querySelector('.subjects');
    if (subjectsDiv) {
      const subjectsText = subjectsDiv.textContent.replace('Subjects:', '').trim();
      metadata.keywords = subjectsText.split(';').map(s => s.trim()).filter(s => s);
    }

    // PDF URL
    const pdfLink = this.doc.querySelector('.download-pdf');
    if (pdfLink) {
      const href = pdfLink.getAttribute('href');
      if (href) {
        metadata.pdfUrl = new URL(href, 'https://arxiv.org').href;
      }
    }

    // Fallback: construct PDF URL from arXiv ID
    if (!metadata.pdfUrl) {
      const arxivIdMatch = this.url.match(/arxiv\.org\/(abs|pdf)\/(\d+\.\d+)/);
      if (arxivIdMatch) {
        metadata.pdfUrl = `https://arxiv.org/pdf/${arxivIdMatch[2]}.pdf`;
      }
    }

    // DOI (if available)
    const doiLink = this.doc.querySelector('a[href*="doi.org"]');
    if (doiLink) {
      const href = doiLink.getAttribute('href');
      if (href && href.includes('doi.org/')) {
        metadata.doi = href.split('doi.org/')[1];
      }
    }

    metadata.sourceCategory = 'FORMAL';
    metadata.sourceType = 'PDF';

    return metadata;
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.ArXivExtractor = ArXivExtractor;
}





