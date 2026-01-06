// Extractor for generic websites and blogs using Readability
class WebsiteExtractor extends BaseExtractor {
    canHandle() {
        // This handles "everything else"
        // We can make it return true and register it last, or explicitly check for sourceCategory
        return true;
    }

    extractMetadata() {
        // Start with base metadata
        const metadata = {
            authors: [],
            keywords: [],
            sourceType: 'WEBPAGE',
            sourceCategory: 'GREY',
            url: this.url,
            // Initialize other fields
            title: null,
            publicationDate: null,
            venue: null,
            abstract: null,
            pdfUrl: null,
            doi: null
        };

        // 1. Try Readability Logic First (High Quality)
        if (typeof Readability !== 'undefined' && typeof DOMPurify !== 'undefined') {
            try {
                const clone = document.cloneNode(true);
                const reader = new Readability(clone);
                const article = reader.parse();

                // LOGGING requested by user
                console.log('[WebsiteExtractor] Readability Output:', article);

                if (article) {
                    metadata.title = article.title;
                    metadata.textContent = article.textContent;
                    metadata.content = DOMPurify.sanitize(article.content);
                    metadata.abstract = article.excerpt;
                    metadata.venue = article.siteName;

                    // Authors from Readability (Byline)
                    // strict check: avoid splitting paragraphs
                    if (article.byline) {
                        const byline = this.cleanText(article.byline);
                        if (this.isValidAuthorString(byline)) {
                            metadata.authors = [byline];
                        } else {
                            console.warn('[WebsiteExtractor] Rejected byline (too long/complex):', byline);
                        }
                    }
                }
            } catch (e) {
                console.error('[WebsiteExtractor] Readability failed:', e);
            }
        }

        // 2. Fallbacks for missing data
        if (!metadata.title) {
            metadata.title = this.getMeta('og:title') || this.getText('h1') || this.getText('title');
        }

        if (!metadata.abstract) {
            metadata.abstract = this.getMeta('description') || this.getMeta('og:description');
        }

        if (!metadata.venue) {
            metadata.venue = this.getMeta('og:site_name') || window.location.hostname;
        }

        // 3. URLs
        // check for DOI
        const doiLink = this.doc.querySelector('a[href*="doi.org"]');
        if (doiLink) {
            const href = doiLink.getAttribute('href');
            if (href.includes('doi.org/')) metadata.doi = href.split('doi.org/')[1];
        }

        // 4. Source Type Refinement
        if (this.isBlogPost()) {
            metadata.sourceType = 'BLOG_POST';
        }

        return metadata;
    }

    isValidAuthorString(str) {
        if (!str) return false;
        // If it's too long (e.g. > 100 chars), it's likely a bio or list of unrelated things
        if (str.length > 100) return false;
        // If it contains " and " multiple times, it might be a sentence
        // But "A and B" is valid. "A and B and C" is valid.
        // "Returning info and by encouraging..." is invalid.
        // Heuristic: check for common sentence words?
        // For now, strict length and basic sanity check
        return true;
    }

    isBlogPost() {
        const url = this.url.toLowerCase();
        return url.includes('/blog/') || url.includes('/post/') || this.doc.querySelector('.blog') !== null;
    }
}

if (typeof window !== 'undefined') {
    window.WebsiteExtractor = WebsiteExtractor;
}
