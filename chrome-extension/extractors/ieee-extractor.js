// IEEE Xplore extractor

class IEEEExtractor extends BaseExtractor {
  canHandle() {
    return this.url.includes('ieeexplore.ieee.org');
  }

  extractMetadata() {
    const metadata = super.extractMetadata();

    // Attempt to extract from xplGlobal script variable which contains rich metadata
    try {
      this.extractFromGlobalObj(metadata);
    } catch (e) {
      console.error('IEEE Global obj extraction failed', e);
    }

    // Fallbacks if global object extraction didn't populate everything

    // Title
    if (!metadata.title) {
      metadata.title = this.getText('h1.document-title') ||
        this.getMeta('citation_title') ||
        this.getText('title');
    }

    // Authors
    if (metadata.authors.length === 0) {
      // Try the xpl-modal buttons which seem to contain author names now
      const authorBtns = this.doc.querySelectorAll('.authors-info-container .authors-info button, xpl-author-banner button');
      if (authorBtns.length > 0) {
        metadata.authors = Array.from(authorBtns).map(el => this.cleanText(el.textContent));
      } else {
        // Old selectors
        const authorElems = this.doc.querySelectorAll('.authors-info .author, .authors .author-name');
        metadata.authors = Array.from(authorElems).map(el => this.cleanText(el.textContent));
      }

      // Fallback to meta tags
      if (metadata.authors.length === 0) {
        const authorMeta = this.doc.querySelectorAll('meta[name="citation_author"]');
        metadata.authors = Array.from(authorMeta).map(el => el.getAttribute('content'));
      }
    }

    // DOI
    if (!metadata.doi) {
      metadata.doi = this.getMeta('citation_doi');
      if (!metadata.doi) {
        const doiLink = this.doc.querySelector('a.stats-document-lh-link-doi');
        if (doiLink) {
          const doiText = doiLink.textContent;
          metadata.doi = doiText.replace('DOI:', '').trim();
        }
      }
    }

    // Publication date
    if (!metadata.publicationDate) {
      metadata.publicationDate = this.getMeta('citation_publication_date') ||
        this.getMeta('citation_online_date') ||
        this.getText('.doc-abstract-pubdate, .u-pb-1.stats-document-abstract-publishedIn');
    }

    // Abstract
    if (!metadata.abstract) {
      const abstractDiv = this.doc.querySelector('.abstract-text, .u-mb-1');
      if (abstractDiv) {
        metadata.abstract = this.cleanText(abstractDiv.textContent);
      }
    }

    // Keywords
    if (metadata.keywords.length === 0) {
      const keywordElems = this.doc.querySelectorAll('.doc-keywords-list .stats-keywords-list-item, .keywords-list .keyword');
      metadata.keywords = Array.from(keywordElems).map(el => this.cleanText(el.textContent));
    }

    // PDF URL
    if (!metadata.pdfUrl) {
      // Check for the specific PDF button class seen in HTML
      const pdfBtn = this.doc.querySelector('a.xpl-btn-pdf, a.pdf-btn, a[href*="/stamp/stamp.jsp"]');
      if (pdfBtn) {
        const href = pdfBtn.getAttribute('href');
        if (href) {
          metadata.pdfUrl = new URL(href, this.url).href;
        }
      }
    }

    metadata.sourceCategory = 'FORMAL';
    metadata.sourceType = 'PDF';

    // Try JSON-LD as last resort / supplement
    this.extractJsonLd(metadata);

    // Generate BibTeX
    metadata.bibtex = this.generateBibtex(metadata);

    return metadata;
  }

  extractFromGlobalObj(metadata) {
    const scripts = Array.from(this.doc.querySelectorAll('script'));
    const xplScript = scripts.find(s => s.textContent.includes('xplGlobal.document.metadata='));

    if (xplScript) {
      const text = xplScript.textContent;
      const marker = 'xplGlobal.document.metadata=';
      const startIdx = text.indexOf(marker);

      if (startIdx !== -1) {
        let openBraces = 0;
        let inString = false;
        let escape = false;
        let endIdx = -1;

        // Start scanning from the first opening brace
        const jsonStart = text.indexOf('{', startIdx);
        if (jsonStart !== -1) {
          for (let i = jsonStart; i < text.length; i++) {
            const char = text[i];

            if (escape) {
              escape = false;
              continue;
            }

            if (char === '\\') {
              escape = true;
              continue;
            }

            if (char === '"') {
              inString = !inString;
              continue;
            }

            if (!inString) {
              if (char === '{') {
                openBraces++;
              } else if (char === '}') {
                openBraces--;
                if (openBraces === 0) {
                  endIdx = i + 1;
                  break;
                }
              }
            }
          }

          if (endIdx !== -1) {
            try {
              const jsonStr = text.substring(jsonStart, endIdx);
              const jsonObj = JSON.parse(jsonStr);

              // Title: Use displayDocTitle or formulaStrippedArticleTitle. publicationTitle is usually the conference/journal name.
              if (jsonObj.displayDocTitle) metadata.title = jsonObj.displayDocTitle;
              else if (jsonObj.formulaStrippedArticleTitle) metadata.title = jsonObj.formulaStrippedArticleTitle;
              else if (jsonObj.title) metadata.title = jsonObj.title;

              if (jsonObj.abstract) metadata.abstract = this.cleanHtml(jsonObj.abstract);

              if (jsonObj.authors && Array.isArray(jsonObj.authors)) {
                metadata.authors = jsonObj.authors.map(a => a.name);
              }

              // Keywords extraction
              if (jsonObj.keywords && Array.isArray(jsonObj.keywords)) {
                metadata.keywords = jsonObj.keywords.flatMap(k => k.kwd || []);
              }

              // PDF URL
              // We prioritize pdfUrl (stamp.jsp) because it handles the authentication redirection flow.
              // We have updated the content script to parse the wrapper HTML if encountered.
              if (jsonObj.pdfUrl) {
                metadata.pdfUrl = new URL(jsonObj.pdfUrl, this.url).href;
              } else if (jsonObj.pdfPath) {
                metadata.pdfUrl = new URL(jsonObj.pdfPath, this.url).href;
              }

              if (jsonObj.publicationDate) metadata.publicationDate = jsonObj.publicationDate;
              if (jsonObj.displayPublicationDate) metadata.publicationDate = jsonObj.displayPublicationDate;
              if (jsonObj.doi) metadata.doi = jsonObj.doi;

              // Venue
              if (jsonObj.publicationTitle) metadata.venue = jsonObj.publicationTitle;

            } catch (e) {
              console.warn('Failed to parse xplGlobal JSON', e);
            }
          }
        }
      }
    }
  }

  cleanHtml(html) {
    if (!html) return null;
    const tmp = this.doc.createElement('div');
    tmp.innerHTML = html;
    return this.cleanText(tmp.textContent);
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.IEEEExtractor = IEEEExtractor;
}
