/**
 * Shared metadata schema definitions
 * Used by both Content Scripts (Extractors) and Service Worker (Background)
 * to ensure consistency in data passing.
 */

// List of all allowed metadata fields that should be persisted to the database
const ALLOWED_METADATA_FIELDS = [
    'title',
    'authors',
    'publicationDate',
    'venue',
    'doi',
    'abstract',
    'keywords',
    'sourceType',
    'sourceCategory',
    'url',
    'sourceOrigin',
    'bibtex',
    'pdfUrl', // Note: pdfUrl is often handled separately for download, but valid in extraction
    'hasPDF',
    'isPDFPage',
    'textContent',
    'content'
];

/**
 * Filter an object to only include allowed metadata fields
 * @param {Object} rawMetadata - The source object
 * @returns {Object} Cleaned object with only allowed keys
 */
function cleanMetadata(rawMetadata) {
    const clean = {};
    ALLOWED_METADATA_FIELDS.forEach(field => {
        if (Object.prototype.hasOwnProperty.call(rawMetadata, field) &&
            rawMetadata[field] !== null &&
            rawMetadata[field] !== undefined) {
            clean[field] = rawMetadata[field];
        }
    });
    return clean;
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ALLOWED_METADATA_FIELDS, cleanMetadata };
} else if (typeof window !== 'undefined') {
    window.ALLOWED_METADATA_FIELDS = ALLOWED_METADATA_FIELDS;
    window.cleanMetadata = cleanMetadata;
} else if (typeof self !== 'undefined') {
    self.ALLOWED_METADATA_FIELDS = ALLOWED_METADATA_FIELDS;
    self.cleanMetadata = cleanMetadata;
}
