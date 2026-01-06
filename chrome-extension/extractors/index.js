// Extractor router - detects page type and returns appropriate extractor

/**
 * Get the appropriate extractor for the current page
 * @returns {BaseExtractor} The extractor instance
 */
function getExtractor() {
  const extractors = [
    ACMExtractor,
    IEEEExtractor,
    ScopusExtractor,
    ScienceDirectExtractor,
    ArXivExtractor,
    SpringerExtractor,
    WebsiteExtractor, // Prefer WebsiteExtractor (Readability) for generic sites
    GenericExtractor // Keep as ultimate fallback if needed
  ];

  for (const ExtractorClass of extractors) {
    const extractor = new ExtractorClass();
    if (extractor.canHandle()) {
      console.log(`Using ${ExtractorClass.name} for metadata extraction`);
      return extractor;
    }
  }

  // Should never reach here since GenericExtractor always returns true
  return new GenericExtractor();
}

/**
 * Extract metadata from the current page
 * @returns {Object} Extracted metadata
 */
function extractPageMetadata() {
  try {
    const extractor = getExtractor();
    const metadata = extractor.extractMetadata();

    // Ensure BibTeX is generated if not already present
    if (!metadata.bibtex && typeof extractor.generateBibtex === 'function') {
      metadata.bibtex = extractor.generateBibtex(metadata);
    }

    // Clean up null/undefined values
    Object.keys(metadata).forEach(key => {
      if (metadata[key] === null || metadata[key] === undefined) {
        delete metadata[key];
      }
      if (Array.isArray(metadata[key]) && metadata[key].length === 0) {
        delete metadata[key];
      }
    });

    console.log('Extracted metadata:', metadata);
    return metadata;
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return {
      title: document.title,
      url: window.location.href,
      error: error.message
    };
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.getExtractor = getExtractor;
  window.extractPageMetadata = extractPageMetadata;
}





