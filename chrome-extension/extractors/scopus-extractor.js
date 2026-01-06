// Scopus extractor

class ScopusExtractor extends BaseExtractor {
    canHandle() {
        return this.url.includes('scopus.com');
    }

    extractMetadata() {
        const metadata = super.extractMetadata();

        // Title
        metadata.title = this.getMeta('citation_title') ||
            this.getMeta('og:title') ||
            this.getText('h1') ||
            this.getText('h2.h3'); // Scopus sometimes uses h2 for title

        // Authors
        // Scopus often lists authors in meta tags
        const authorMeta = this.doc.querySelectorAll('meta[name="citation_author"]');
        if (authorMeta.length > 0) {
            metadata.authors = Array.from(authorMeta).map(el => el.getAttribute('content'));
        }

        // Fallback to DOM if no meta tags
        if (metadata.authors.length === 0) {
            const authorElems = this.doc.querySelectorAll('#authorlist span.previewTxt, .authorLink');
            if (authorElems.length > 0) {
                metadata.authors = Array.from(authorElems).map(el => this.cleanText(el.textContent));
            }
        }

        // Publication Date
        metadata.publicationDate = this.getMeta('citation_publication_date') ||
            this.getMeta('citation_date');

        // Journal/Venue
        metadata.venue = this.getMeta('citation_journal_title') ||
            this.getMeta('citation_conference_title');

        // DOI
        metadata.doi = this.getMeta('citation_doi');

        // Abstract
        metadata.abstract = this.getMeta('citation_abstract') ||
            this.getMeta('og:description');

        if (!metadata.abstract) {
            // Scopus Abstract section
            const abstractSection = this.doc.querySelector('#abstractSection p, .abstractComponent');
            if (abstractSection) {
                metadata.abstract = this.cleanText(abstractSection.textContent);
            }
        }

        // Keywords
        const keywordAuth = this.getMeta('citation_keywords');
        if (keywordAuth) {
            metadata.keywords = keywordAuth.split(';').map(k => k.trim());
        }

        // Fallback keywords
        if (metadata.keywords.length === 0) {
            const keywords = this.doc.querySelectorAll('.keywords-section .badges .badge');
            if (keywords.length > 0) {
                metadata.keywords = Array.from(keywords).map(k => this.cleanText(k.textContent));
            }
        }

        // PDF URL - Scopus is often an aggregator, but might have links
        const pdfLink = this.getMeta('citation_pdf_url') ||
            this.doc.querySelector('a[title="Download PDF"]');

        if (pdfLink) {
            metadata.pdfUrl = typeof pdfLink === 'string' ? pdfLink : pdfLink.href;
        }

        metadata.sourceCategory = 'FORMAL';
        metadata.sourceType = 'WEBPAGE'; // Scopus is usually a record view, unless direct PDF

        // Try to extract more from JSON-LD if available (BaseExtractor handles this)
        this.extractJsonLd(metadata);

        return metadata;
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ScopusExtractor = ScopusExtractor;
}
