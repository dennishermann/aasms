// Springer Link extractor

class SpringerExtractor extends BaseExtractor {
  canHandle() {
    return this.url.includes('link.springer.com');
  }
  
  extractMetadata() {
    const metadata = super.extractMetadata();
    
    // Title
    metadata.title = this.getText('h1.c-article-title, h1.ChapterTitle') ||
                    this.getMeta('citation_title') ||
                    this.getText('title');
    
    // Authors
    const authorElems = this.doc.querySelectorAll('.c-article-author-list__item, .authors__name');
    metadata.authors = Array.from(authorElems).map(el => this.cleanText(el.textContent));
    
    // Fallback to meta tags
    if (metadata.authors.length === 0) {
      const authorMeta = this.doc.querySelectorAll('meta[name="citation_author"]');
      metadata.authors = Array.from(authorMeta).map(el => el.getAttribute('content'));
    }
    
    // DOI
    metadata.doi = this.getMeta('citation_doi') ||
                   this.getAttr('a.c-bibliographic-information__doi', 'href');
    if (metadata.doi && metadata.doi.includes('doi.org/')) {
      metadata.doi = metadata.doi.split('doi.org/')[1];
    }
    
    // Publication date
    metadata.publicationDate = this.getMeta('citation_publication_date') ||
                               this.getMeta('citation_online_date') ||
                               this.getText('.c-article-identifiers__item time, .ArticleCitation_Year');
    
    // Venue
    metadata.venue = this.getMeta('citation_journal_title') ||
                     this.getMeta('citation_conference_title') ||
                     this.getMeta('citation_book_title') ||
                     this.getText('.c-article-identifiers__item a[data-track-action="journal"], .JournalTitle');
    
    // Abstract
    const abstractDiv = this.doc.querySelector('#Abs1-content, .c-article-section__content');
    if (abstractDiv) {
      metadata.abstract = this.cleanText(abstractDiv.textContent);
    }
    
    // Keywords
    const keywordElems = this.doc.querySelectorAll('.c-article-subject-list__subject, .Keyword');
    metadata.keywords = Array.from(keywordElems).map(el => this.cleanText(el.textContent));
    
    // PDF URL
    const pdfLink = this.doc.querySelector('a[data-track-action="download pdf"], a.c-pdf-download__link');
    if (pdfLink) {
      const href = pdfLink.getAttribute('href');
      if (href) {
        metadata.pdfUrl = new URL(href, this.url).href;
      }
    }
    
    // Fallback to meta tag
    if (!metadata.pdfUrl) {
      metadata.pdfUrl = this.getMeta('citation_pdf_url');
    }
    
    metadata.sourceCategory = 'FORMAL';
    metadata.sourceType = 'PDF';
    
    return metadata;
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.SpringerExtractor = SpringerExtractor;
}





