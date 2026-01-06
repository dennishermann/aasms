// PDF detection and download utilities

/**
 * Detect if the current page is a PDF or has a PDF link
 * @param {string} url - The current page URL
 * @param {Document} doc - The document object
 * @returns {Object} {isPDF: boolean, pdfUrl: string|null}
 */
function detectPDF(url, doc) {
  // Check if current URL is a PDF
  if (url.toLowerCase().endsWith('.pdf') || url.includes('.pdf?')) {
    return { isPDF: true, pdfUrl: url };
  }
  
  // Check content-type from document (if available)
  const contentType = doc.contentType || doc.mimeType;
  if (contentType && contentType.includes('application/pdf')) {
    return { isPDF: true, pdfUrl: url };
  }
  
  // Look for PDF download links in the page
  const pdfUrl = findPDFLink(doc);
  if (pdfUrl) {
    return { isPDF: false, pdfUrl };
  }
  
  return { isPDF: false, pdfUrl: null };
}

/**
 * Find PDF download links in the document
 * @param {Document} doc - The document object
 * @returns {string|null} PDF URL if found
 */
function findPDFLink(doc) {
  // Common patterns for PDF links
  const selectors = [
    'a[href$=".pdf"]',
    'a[href*=".pdf?"]',
    'a[href*="/pdf/"]',
    'a.pdf-link',
    'a.download-pdf',
    '[data-pdf-url]'
  ];
  
  for (const selector of selectors) {
    const links = doc.querySelectorAll(selector);
    for (const link of links) {
      const href = link.getAttribute('href') || link.getAttribute('data-pdf-url');
      if (href) {
        // Convert relative URLs to absolute
        try {
          const absoluteUrl = new URL(href, window.location.href);
          return absoluteUrl.href;
        } catch (e) {
          continue;
        }
      }
    }
  }
  
  // Look for buttons or links with text containing "PDF" or "Download"
  const possibleLinks = doc.querySelectorAll('a, button');
  for (const elem of possibleLinks) {
    const text = elem.textContent.toLowerCase();
    const href = elem.getAttribute('href');
    
    if ((text.includes('pdf') || text.includes('download')) && href) {
      if (href.toLowerCase().includes('pdf')) {
        try {
          const absoluteUrl = new URL(href, window.location.href);
          return absoluteUrl.href;
        } catch (e) {
          continue;
        }
      }
    }
  }
  
  return null;
}

/**
 * Download a PDF from a URL
 * @param {string} url - The PDF URL
 * @returns {Promise<Blob>} The PDF as a Blob
 */
async function downloadPDF(url) {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('application/pdf')) {
      console.warn('URL does not appear to be a PDF:', contentType);
    }
    
    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw new Error('Failed to download PDF. The file may require authentication or be behind a paywall.');
  }
}

/**
 * Get a safe filename from a URL
 * @param {string} url - The PDF URL
 * @param {string} title - The paper title (fallback)
 * @returns {string} A safe filename
 */
function getFilename(url, title) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    
    if (filename && filename.endsWith('.pdf')) {
      return filename;
    }
  } catch (e) {
    // URL parsing failed
  }
  
  // Fallback to title-based filename
  if (title) {
    const safe = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);
    return `${safe}.pdf`;
  }
  
  return 'paper.pdf';
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { detectPDF, downloadPDF, getFilename, findPDFLink };
}





