class ScienceDirectExtractor extends BaseExtractor {
  canHandle() {
    const isMatch = this.url.includes('sciencedirect.com') ||
      !!document.querySelector('meta[content*="ScienceDirect"]');
    if (isMatch) console.log('ScienceDirectExtractor: matched');
    return isMatch;
  }

  extractMetadata() {
    const metadata = super.extractMetadata();
    metadata.sourceCategory = 'FORMAL';
    metadata.sourceType = 'PDF';

    // Try to parse global state
    // ScienceDirect often stores data in window.__PRELOADED_STATE__
    let state = null;
    try {
      // We look for the script that sets window.__PRELOADED_STATE__
      const scriptContent = Array.from(document.querySelectorAll('script'))
        .find(s => s.textContent.includes('window.__PRELOADED_STATE__='));

      if (scriptContent) {
        const match = scriptContent.textContent.match(/window\.__PRELOADED_STATE__\s*=\s*({.+?});/s);
        if (match) {
          state = JSON.parse(match[1]);
        }
      }
    } catch (e) {
      console.warn('Failed to parse ScienceDirect state:', e);
    }

    if (state && state.article) {
      this.extractFromState(metadata, state);
    } else {
      this.extractFromDOM(metadata);
    }

    return metadata;
  }

  extractFromState(metadata, state) {
    const article = state.article;

    // Title
    try {
      if (article.title && article.title.content && article.title.content.length > 0) {
        metadata.title = article.title.content[0]._ || article.title.content[0];
      }
    } catch (e) { }

    // Venue/Journal
    if (article.srctitle) {
      metadata.venue = article.srctitle;
    }

    // DOI
    if (article.doi) {
      metadata.doi = article.doi;
    }

    // Publication Date
    if (article.dates) {
      metadata.publicationDate = article.dates['Publication date'] ||
        article.dates['Available online'] ||
        article.dates['Accepted'];
    } else if (article['cover-date-start']) {
      metadata.publicationDate = article['cover-date-start'];
    } else if (article['cover-date-text']) {
      metadata.publicationDate = article['cover-date-text'];
    }

    // Abstract
    try {
      const abstracts = state.abstracts || article.abstracts;
      if (abstracts && abstracts.content) {
        const abstractSec = abstracts.content.find(c => c['#name'] === 'abstract-sec');
        if (abstractSec && abstractSec.$$) {
          const paras = abstractSec.$$.filter(p => p['#name'] === 'simple-para');
          metadata.abstract = paras.map(p => p._).join('\n\n');
        }
      }
    } catch (e) { }

    // Authors
    try {
      if (state.authors && state.authors.content) {
        const authorGroup = state.authors.content.find(c => c['#name'] === 'author-group');
        if (authorGroup && authorGroup.$$) {
          const authors = authorGroup.$$.filter(c => c['#name'] === 'author');
          metadata.authors = authors.map(a => {
            const given = a.$$.find(x => x['#name'] === 'given-name')?._;
            const surname = a.$$.find(x => x['#name'] === 'surname')?._;
            return `${given} ${surname}`.trim();
          });
        }
      }
    } catch (e) { }

    // Keywords
    try {
      if (state.combinedContentItems && state.combinedContentItems.content) {
        const keywordsBlock = state.combinedContentItems.content.find(c => c['#name'] === 'keywords');
        if (keywordsBlock && keywordsBlock.$$) {
          metadata.keywords = keywordsBlock.$$.filter(k => k['#name'] === 'keyword')
            .map(k => k.$$.find(t => t['#name'] === 'text')?._)
            .filter(Boolean);
        }
      }
    } catch (e) { }

    // PDF URL STRATEGY
    // 1. Deep scan state for direct S3 link (pdf.sciencedirectassets.com)
    // This bypasses the redirect/auth dance if available
    const s3Link = this.findStringInObject(state, (val) =>
      typeof val === 'string' && val.includes('pdf.sciencedirectassets.com')
    );
    if (s3Link) {
      metadata.pdfUrl = s3Link;
      return;
    }

    // 2. Construct from configuration with ?isdt=1 (Interactive ScienceDirect Technology)
    // This flag is often used by the viewer and helps bypass some checks
    try {
      const cfg = state.pdfDownload ||
        (state.accessbarConfig && state.accessbarConfig.pdfDownload);

      if (cfg && cfg.urlMetadata && cfg.urlMetadata.path && cfg.urlMetadata.pii) {
        const path = cfg.urlMetadata.path;
        const pii = cfg.urlMetadata.pii;
        const ext = cfg.urlMetadata.pdfExtension;
        const q = cfg.urlMetadata.queryParams;

        let pdfUrl = `https://www.sciencedirect.com/${path}/${pii}${ext}`;
        const params = new URLSearchParams(q || {});
        // Add commonly helpful params
        if (!params.has('isdt')) params.set('isdt', '1');

        pdfUrl += `?${params.toString()}`;
        metadata.pdfUrl = pdfUrl;
      }
    } catch (e) { }

    // 3. Fallback to accessbar component
    if (!metadata.pdfUrl && state.accessbarConfig && state.accessbarConfig.components) {
      const viewPdf = state.accessbarConfig.components.find(c => c.id === 'ViewPDF');
      if (viewPdf && viewPdf.href) {
        const url = new URL(viewPdf.href, this.url);
        url.searchParams.set('isdt', '1');
        metadata.pdfUrl = url.href;
      }
    }
  }

  // Helper to deep search object
  findStringInObject(obj, predicate, validKeys = ['u', 'url', 'href', 'src', 'link']) {
    if (!obj) return null;
    if (predicate(obj)) return obj;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const result = this.findStringInObject(item, predicate);
        if (result) return result;
      }
    } else if (typeof obj === 'object') {
      for (const key in obj) {
        // Optimization: only check likely keys for URLs? Or check all?
        // Checking all is safer for "hidden" deep links
        const result = this.findStringInObject(obj[key], predicate);
        if (result) return result;
      }
    }
    return null;
  }

  extractFromDOM(metadata) {
    // 1. Check for S3 Direct Link in DOM
    const s3Link = document.querySelector('a[href*="pdf.sciencedirectassets.com"], iframe[src*="pdf.sciencedirectassets.com"]');
    if (s3Link) {
      metadata.pdfUrl = s3Link.href || s3Link.src;
      return;
    }

    // Fallback to meta tags and selectors
    metadata.title = this.getMeta('citation_title') || this.getText('h1.article-title');

    const authorMetas = document.querySelectorAll('meta[name="citation_author"]');
    if (authorMetas.length > 0) {
      metadata.authors = Array.from(authorMetas).map(m => m.getAttribute('content'));
    }

    // Fallback: DOM query for displayed authors (as seen in screenshots)
    if (!metadata.authors || metadata.authors.length === 0) {
      const authorNodes = document.querySelectorAll('.author-group .author, .author-group button');
      if (authorNodes.length > 0) {
        metadata.authors = Array.from(authorNodes).map(node => {
          const given = node.querySelector('.given-name')?.textContent;
          const surname = node.querySelector('.surname')?.textContent;
          if (given && surname) return `${given} ${surname}`.trim();
          return node.textContent.trim();
        }).filter(name => name.length > 0);
      }
    }

    metadata.publicationDate = this.getMeta('citation_publication_date');
    metadata.doi = this.getMeta('citation_doi');

    const venue = this.getMeta('citation_journal_title');
    if (venue) metadata.venue = venue;

    // Abstract
    const abstractDiv = document.querySelector('.abstract.author');
    if (abstractDiv) {
      metadata.abstract = this.cleanText(abstractDiv.textContent);
    }

    // PDF
    const pdfMeta = this.getMeta('citation_pdf_url');
    if (pdfMeta) {
      metadata.pdfUrl = pdfMeta;
    } else {
      const link = document.querySelector('a[href*="/pdfft"]');
      if (link) {
        metadata.pdfUrl = link.href;
      } else {
        // Generic "View PDF" link search
        const viewPdfLink = Array.from(document.querySelectorAll('a')).find(a =>
          a.textContent.includes('View PDF') || a.title.includes('View PDF')
        );
        if (viewPdfLink) metadata.pdfUrl = viewPdfLink.href;
      }
    }
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.ScienceDirectExtractor = ScienceDirectExtractor;
}
