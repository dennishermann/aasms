// Generic extractor for blogs and unknown websites

class GenericExtractor extends BaseExtractor {
  canHandle() {
    // This is the fallback extractor, always returns true
    return true;
  }

  extractMetadata() {
    const metadata = super.extractMetadata();

    // Title - try multiple sources
    metadata.title = this.getMeta('og:title') ||
      this.getMeta('twitter:title') ||
      this.getMeta('citation_title') ||
      this.getText('h1') ||
      this.getText('title');

    // Authors - try multiple sources
    const author = this.getMeta('author') ||
      this.getMeta('article:author') ||
      this.getMeta('citation_author');

    if (author) {
      metadata.authors = this.parseAuthors(author);
    } else {
      // Try to find author in common HTML patterns
      const authorElem = this.doc.querySelector('.author, .by-author, [rel="author"], .post-author');
      if (authorElem) {
        metadata.authors = [this.cleanText(authorElem.textContent)];
      }
    }

    // If still no authors found, use pattern matching
    if (metadata.authors.length === 0) {
      metadata.authors = this.extractAuthorsFromContent();
    }

    // Publication date - try multiple sources
    metadata.publicationDate = this.getMeta('article:published_time') ||
      this.getMeta('publishdate') ||
      this.getMeta('date') ||
      this.getMeta('DC.date');

    // If no date found, try to find it in HTML
    if (!metadata.publicationDate) {
      const dateElem = this.doc.querySelector('time, .date, .post-date, .published');
      if (dateElem) {
        metadata.publicationDate = dateElem.getAttribute('datetime') ||
          this.cleanText(dateElem.textContent);
      }
    }

    // Abstract/Description
    let abstract = this.getMeta('og:description') ||
      this.getMeta('twitter:description') ||
      this.getMeta('description') ||
      this.getMeta('DC.description');

    if (abstract) {
      let abstractText = abstract;
      // Robust cleanup: finding the prefix match and slicing it off
      const prefixMatch = abstractText.match(/^\s*abstract\s*:?\s*/i);
      if (prefixMatch) {
        abstractText = abstractText.slice(prefixMatch[0].length);
      }
      metadata.abstract = this.cleanText(abstractText);
    } else {
      metadata.abstract = null;
    }

    // If no meta description, try to get first paragraph
    if (!metadata.abstract) {
      const articleContent = this.doc.querySelector('article, .article-content, .post-content, main');
      if (articleContent) {
        const firstP = articleContent.querySelector('p');
        if (firstP) {
          metadata.abstract = this.cleanText(firstP.textContent).substring(0, 500);
        }
      }
    }

    // Keywords
    const keywordsMeta = this.getMeta('keywords') || this.getMeta('article:tag');
    if (keywordsMeta) {
      metadata.keywords = keywordsMeta.split(',').map(k => k.trim()).filter(k => k);
    } else {
      // Try to find tags in HTML
      const tagElems = this.doc.querySelectorAll('.tag, .post-tag, [rel="tag"]');
      metadata.keywords = Array.from(tagElems).map(el => this.cleanText(el.textContent));
    }

    // Venue - for blogs, use the site name
    metadata.venue = this.getMeta('og:site_name') ||
      this.getMeta('application-name') ||
      this.getText('header .site-title, .site-name');

    // DOI (rare but possible for blog posts referencing papers)
    const doiLink = this.doc.querySelector('a[href*="doi.org"]');
    if (doiLink) {
      const href = doiLink.getAttribute('href');
      if (href && href.includes('doi.org/')) {
        metadata.doi = href.split('doi.org/')[1];
      }
    }

    // PDF URL - check if there's a PDF link on the page
    // BUT only if it's NOT a blog post, to avoid picking up citations
    if (!this.isBlogPost()) {
      const pdfLink = this.doc.querySelector('a[href$=".pdf"], a[href*=".pdf?"]');
      if (pdfLink) {
        const href = pdfLink.getAttribute('href');
        if (href) {
          try {
            metadata.pdfUrl = new URL(href, this.url).href;
          } catch (e) {
            // Invalid URL
          }
        }
      }
    }

    // Try JSON-LD structured data
    this.extractJsonLd(metadata);

    // Determine source category based on URL and content
    metadata.sourceCategory = this.determineSourceCategory();
    metadata.sourceType = metadata.pdfUrl ? 'PDF' : 'WEBPAGE';

    // If it looks like a blog, mark as BLOG_POST
    if (this.isBlogPost()) {
      metadata.sourceType = 'BLOG_POST';
    }

    // Try Readability for content and fallback metadata
    if (typeof Readability !== 'undefined' && typeof DOMPurify !== 'undefined') {
      try {
        // Clone the document to avoid modifying the live page
        const clone = document.cloneNode(true);
        const reader = new Readability(clone);
        const article = reader.parse();

        if (article) {
          // Add content for backend LLM analysis
          // We prioritize textContent for the LLM as it's cleaner
          metadata.textContent = article.textContent;
          metadata.content = DOMPurify.sanitize(article.content);

          // Use Readability metadata as fallback or primary if missing
          if (!metadata.title && article.title) {
            metadata.title = article.title;
          }

          if (!metadata.abstract && article.excerpt) {
            metadata.abstract = article.excerpt;
          }

          // Try to parse byline for authors if we still have none
          if (metadata.authors.length === 0 && article.byline) {
            const byline = this.cleanText(article.byline);
            // Verify byline is length and looks like a name/list of names, not a paragraph
            if (byline && byline.length < 100) {
              // Simple split by comma or 'and'
              metadata.authors = [byline];
            }
          }
        }
      } catch (e) {
        console.error('Readability parsing failed:', e);
      }
    }

    return metadata;
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
   * Determine if this is likely a blog post
   * @returns {boolean}
   */
  isBlogPost() {
    const url = this.url.toLowerCase();
    const blogIndicators = ['/blog/', '/post/', '/article/', 'medium.com', 'wordpress.com', 'blogger.com'];

    for (const indicator of blogIndicators) {
      if (url.includes(indicator)) {
        return true;
      }
    }

    // Check for blog-related HTML classes
    const blogClasses = this.doc.querySelector('.blog, .post, .article, .entry');
    return blogClasses !== null;
  }

  /**
   * Determine source category based on URL and content
   * @returns {string} 'FORMAL' or 'GREY'
   */
  determineSourceCategory() {
    const url = this.url.toLowerCase();

    // Known academic/formal sources
    const formalIndicators = [
      'arxiv.org', 'acm.org', 'ieee.org', 'springer.com', 'sciencedirect.com',
      'nature.com', 'science.org', 'doi.org', 'researchgate.net', 'semanticscholar.org'
    ];

    for (const indicator of formalIndicators) {
      if (url.includes(indicator)) {
        return 'FORMAL';
      }
    }

    // Check for DOI - strong indicator of formal publication
    if (this.getMeta('citation_doi') || this.doc.querySelector('a[href*="doi.org"]')) {
      return 'FORMAL';
    }

    // Default to grey literature for blogs and general websites
    return 'GREY';
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.GenericExtractor = GenericExtractor;
}

