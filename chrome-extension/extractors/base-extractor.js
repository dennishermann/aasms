// Base class for metadata extractors

class BaseExtractor {
  constructor() {
    this.doc = document;
    this.url = window.location.href;
  }


  /**
   * Extract metadata from JSON-LD structured data
   * @param {Object} metadata - Metadata object to update
   */
  extractJsonLd(metadata) {
    const scripts = this.doc.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);

        // Handle arrays
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          if (item['@type'] === 'Article' || item['@type'] === 'BlogPosting' || item['@type'] === 'ScholarlyArticle') {
            metadata.title = metadata.title || item.headline || item.name;
            metadata.abstract = metadata.abstract || item.description;
            metadata.publicationDate = metadata.publicationDate || item.datePublished;

            // Authors
            if (item.author) {
              const authors = Array.isArray(item.author) ? item.author : [item.author];
              const authorNames = authors.map(a => {
                return typeof a === 'string' ? a : (a.name || '');
              }).filter(n => n);

              if (authorNames.length > 0 && metadata.authors.length === 0) {
                metadata.authors = authorNames;
              }
            }

            // Keywords
            if (item.keywords) {
              const keywords = typeof item.keywords === 'string' ?
                item.keywords.split(',').map(k => k.trim()) :
                item.keywords;
              if (metadata.keywords.length === 0) {
                metadata.keywords = keywords;
              }
            }
          }
        }
      } catch (e) {
        // Invalid JSON-LD, skip
        continue;
      }
    }
  }

  /**
   * Check if this extractor can handle the current page
   * @returns {boolean}
   */
  canHandle() {
    return false;
  }

  /**
   * Extract metadata from the page
   * @returns {Object} Metadata object
   */
  extractMetadata() {
    const metadata = {
      authors: [],
      keywords: [],
      sourceType: 'PDF',
      sourceCategory: 'FORMAL',
      url: this.url
    };

    // Initialize all other allowed fields to null if not already set
    if (typeof ALLOWED_METADATA_FIELDS !== 'undefined') {
      ALLOWED_METADATA_FIELDS.forEach(field => {
        if (!Object.prototype.hasOwnProperty.call(metadata, field)) {
          metadata[field] = null;
        }
      });
    } else {
      // Fallback defaults if schema not loaded
      metadata.title = null;
      metadata.venue = null;
      metadata.publicationDate = null;
      metadata.doi = null;
      metadata.abstract = null;
      metadata.pdfUrl = null;
      metadata.bibtex = null;
      metadata.sourceOrigin = null;
    }

    return metadata;
  }

  /**
   * Helper: Get text content from a selector
   * @param {string} selector - CSS selector
   * @returns {string|null}
   */
  getText(selector) {
    const elem = this.doc.querySelector(selector);
    return elem ? elem.textContent.trim() : null;
  }

  /**
   * Helper: Get attribute from a selector
   * @param {string} selector - CSS selector
   * @param {string} attr - Attribute name
   * @returns {string|null}
   */
  getAttr(selector, attr) {
    const elem = this.doc.querySelector(selector);
    return elem ? elem.getAttribute(attr) : null;
  }

  /**
   * Helper: Get all text contents from a selector
   * @param {string} selector - CSS selector
   * @returns {Array<string>}
   */
  getAllText(selector) {
    const elems = this.doc.querySelectorAll(selector);
    return Array.from(elems).map(e => e.textContent.trim()).filter(t => t.length > 0);
  }

  /**
   * Helper: Get meta tag content
   * @param {string} name - Meta tag name or property
   * @returns {string|null}
   */
  getMeta(name) {
    const elem = this.doc.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return elem ? elem.getAttribute('content') : null;
  }

  /**
   * Helper: Clean and normalize text
   * @param {string} text - Text to clean
   * @returns {string}
   */
  cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Helper: Parse author names from various formats
   * @param {string} authorString - Author string
   * @returns {Array<string>}
   */
  parseAuthors(authorString) {
    if (!authorString) return [];

    // Split by common separators
    // CAUTION: splitting by 'and' can break if the string is a sentence.
    // Check if the string looks like a sentence (long, contains common words)
    if (authorString.length > 200) {
      // likely not a clean author list
      return [this.cleanText(authorString)];
    }

    const separators = [';', ',', ' and ', ' AND '];
    let authors = [authorString];

    for (const sep of separators) {
      const temp = [];
      for (const author of authors) {
        const parts = author.split(sep);
        // usage heuristic: if parts are very long, maybe we shouldn't have split?
        // for now, just split
        temp.push(...parts);
      }
      authors = temp;
    }

    return authors
      .map(a => this.cleanText(a))
      .filter(a => a.length > 0 && a.length < 50); // Filter out fragments that are too long
  }

  /**
   * Extract authors from page content using pattern matching
   * @returns {Array<string>} Array of author names
   */
  extractAuthorsFromContent() {
    const authors = new Set();

    // Pattern 1: Common byline patterns
    const bylinePatterns = [
      /(?:by|written by|author:|posted by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
      /(?:by|written by|author:|posted by)\s+([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)+[A-Z][a-z]+)/gi
    ];

    const bodyText = this.doc.body.innerText;
    for (const pattern of bylinePatterns) {
      const matches = bodyText.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) authors.add(this.cleanText(match[1]));
      }
    }

    // Pattern 2: Schema.org author
    const schemaAuthors = this.doc.querySelectorAll('[itemprop="author"]');
    for (const elem of schemaAuthors) {
      const name = elem.getAttribute('content') || elem.textContent;
      if (name) authors.add(this.cleanText(name));
    }

    // Pattern 3: Common author elements
    const authorElems = this.doc.querySelectorAll(
      '.author-name, .byline, [rel="author"], .post-author-name, .author-bio .name'
    );
    for (const elem of authorElems) {
      const name = this.cleanText(elem.textContent);
      if (name && name.length > 2 && name.length < 50) {
        authors.add(name);
      }
    }

    return Array.from(authors);
  }

  /**
   * Generate a simple BibTeX entry
   * @param {Object} metadata - The metadata object
   * @returns {string|null} BibTeX string
   */
  generateBibtex(metadata) {
    if (!metadata.title || metadata.authors.length === 0) return null;

    const type = 'article'; // Default to article
    // Create a citation key: FirstAuthor + Year + TitleWord
    const firstAuthorLastName = metadata.authors[0].split(/\s+/).pop().replace(/[^a-zA-Z]/g, '');
    const year = metadata.publicationDate ? (metadata.publicationDate.match(/\d{4}/) || [''])[0] : '';
    const titleWord = metadata.title.split(/\s+/)[0].replace(/[^a-zA-Z]/g, '');
    const citationKey = `${firstAuthorLastName}${year}${titleWord}`.toLowerCase() || 'generated';

    let bibtex = `@${type}{${citationKey},\n`;
    bibtex += `  title = {${metadata.title}},\n`;
    bibtex += `  author = {${metadata.authors.join(' and ')}},\n`;

    if (year) bibtex += `  year = {${year}},\n`;
    if (metadata.venue) bibtex += `  journal = {${metadata.venue}},\n`;
    if (metadata.doi) bibtex += `  doi = {${metadata.doi}},\n`;
    if (metadata.pdfUrl) bibtex += `  url = {${metadata.pdfUrl}},\n`;
    if (metadata.abstract) bibtex += `  abstract = {${metadata.abstract.substring(0, 500)}...},\n`;

    bibtex += `}`;
    return bibtex;
  }
}

// Make available globally for other extractors
if (typeof window !== 'undefined') {
  window.BaseExtractor = BaseExtractor;
}

