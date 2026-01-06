// Content script - coordinates metadata extraction

console.log('SMS Assistant content script loaded');

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);

  if (request.action === 'extractMetadata') {
    try {
      // Extract metadata using the appropriate extractor
      const metadata = extractPageMetadata();

      // Detect PDF
      // Only auto-detect PDF if we suspect this is a paper or if the page IS a PDF
      // For generic websites, we should be careful not to pick up random PDF links (like citations)
      const pdfInfo = detectPDF(window.location.href, document);

      // Heuristic: If we found high-quality text content via Readability (WEBPAGE/BLOG_POST),
      // we should be very skeptic of "found" PDFs unless they are the main content.
      const isGenericWebpage = metadata.sourceType === 'WEBPAGE' || metadata.sourceType === 'BLOG_POST';
      const hasGoodContent = metadata.textContent && metadata.textContent.length > 500;

      // If it's a PDF page (browser viewer), always accept
      if (pdfInfo.isPDF) {
        metadata.pdfUrl = pdfInfo.pdfUrl;
        metadata.hasPDF = true;
        metadata.isPDFPage = true;
      }
      // If it's a website with content, only accept PDF if it looks like a "Download PDF" button or similar,
      // NOT just any random link. `detectPDF` is too aggressive for blogs.
      // For now, if we have good text content, we IGNORE the scraped PDF url unless it was explicitly found by the extractor (e.g. metadata.pdfUrl was already set)
      else if (!isGenericWebpage || !hasGoodContent) {
        if (!metadata.pdfUrl && pdfInfo.pdfUrl) {
          metadata.pdfUrl = pdfInfo.pdfUrl;
        }
        metadata.hasPDF = !!metadata.pdfUrl;
        metadata.isPDFPage = false;
      } else {
        // It is a webpage with content. 
        // If the extractor didn't find a DOI/PDF explicitly, we assume the HTML IS the content.
        metadata.hasPDF = false;
        metadata.isPDFPage = false;
      }

      sendResponse({ success: true, metadata });
    } catch (error) {
      console.error('Error in content script:', error);
      sendResponse({
        success: false,
        error: error.message,
        metadata: {
          title: document.title,
          url: window.location.href
        }
      });
    }

    // Return true to indicate we'll send the response asynchronously
    return true;
  }

  if (request.action === 'fetchPDF') {
    (async () => {
      try {
        console.log('Fetching PDF in content script:', request.url);

        // Use the recursive fetcher which handles redirects and HTML wrappers
        const blob = await fetchWithRedirects(request.url);

        const reader = new FileReader();
        reader.onloadend = () => {
          sendResponse({ success: true, data: reader.result }); // result is data:application/pdf;base64,...
        };
        reader.onerror = () => {
          sendResponse({ success: false, error: 'Failed to read blob' });
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error('Error fetching PDF:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Async response
  }

  if (request.action === "getPageContent") {
    try {
      const content = extractMainContent();
      sendResponse({ content });
    } catch (error) {
      console.error('Error extracting page content:', error);
      sendResponse({ content: '' });
    }
    return true;
  }
});

// Extract main content from the page
function extractMainContent() {
  // Try to find main content area
  const mainSelectors = [
    'article',
    'main',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content'
  ];

  for (const selector of mainSelectors) {
    const elem = document.querySelector(selector);
    if (elem) {
      return elem.innerText.substring(0, 5000); // Limit to 5000 chars
    }
  }

  // Fallback to body
  return document.body.innerText.substring(0, 5000);
}

// Helper function to detect PDF (using the utility function from pdf-handler.js)
function detectPDF(url, doc) {
  // Check if current URL is a PDF
  if (url.toLowerCase().endsWith('.pdf') || url.includes('.pdf?')) {
    return { isPDF: true, pdfUrl: url };
  }

  // Check content-type
  const contentType = doc.contentType || doc.mimeType;
  if (contentType && contentType.includes('application/pdf')) {
    return { isPDF: true, pdfUrl: url };
  }

  // Look for PDF links
  const selectors = [
    'a[href$=".pdf"]',
    'a[href*=".pdf?"]',
    'a[href*="/pdf/"]',
    'a.pdf-link',
    'a.download-pdf',
    '[data-pdf-url]'
  ];

  for (const selector of selectors) {
    const link = doc.querySelector(selector);
    if (link) {
      const href = link.getAttribute('href') || link.getAttribute('data-pdf-url');
      if (href) {
        try {
          const absoluteUrl = new URL(href, url);
          return { isPDF: false, pdfUrl: absoluteUrl.href };
        } catch (e) {
          continue;
        }
      }
    }
  }

  return { isPDF: false, pdfUrl: null };
}

// Notify that content script is ready
console.log('SMS Assistant content script ready');




// Helper to resolve PDF via hidden iframe + background interception
// This bypasses JS challenges that fetch() cannot solve
async function resolvePDFViaIframe(url) {
  console.log('Attempting to resolve PDF via iframe/background...', url);

  // 1. Tell background to watch for the S3 redirect
  const resolutionPromise = new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'resolvePDFUrl' }, (response) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      if (response && response.url) resolve(response.url);
      else reject(new Error('Background failed to resolve PDF URL'));
    });
  });

  // 2. Create invisible iframe to trigger the browser's navigation/challenge logic
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);

  // 3. Wait for resolution or timeout
  try {
    const s3Url = await resolutionPromise;
    console.log('Background resolved S3 URL:', s3Url);

    // Now we can fetch the signed S3 URL directly as a blob
    const response = await fetch(s3Url);
    if (!response.ok) throw new Error(`Failed to fetch S3 URL: ${response.status}`);
    return await response.blob();
  } finally {
    // Cleanup
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }
}

// Recursive helper to handle HTML wrappers and redirects
async function fetchWithRedirects(url, depth = 0) {
  if (depth > 5) {
    throw new Error('Too many redirects');
  }

  console.log(`Fetch depth ${depth}: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    // If we hit a 403 on a 'main.pdf' link, it often means the No-JS path failed.
    // Try iframe resolution on the ORIGINAL url if possible, or this one.
    if (response.status === 403 && url.includes('main.pdf')) {
      console.warn('Hit 403 on likely PDF target. Trying iframe resolution...');
      // Use iframe resolution for this URL
      return await resolvePDFViaIframe(url);
    }
    throw new Error(`HTTP error ${response.status}`);
  }

  const contentType = response.headers.get('Content-Type') || '';
  console.log(`Response type: ${contentType}`);

  // Only return as blob if it is NOT HTML.
  // This prevents returning HTML wrappers as corrupt PDFs just because the URL ends in .pdf
  if (!contentType.includes('text/html') && (
    contentType.includes('application/pdf') ||
    contentType.includes('application/octet-stream') ||
    url.toLowerCase().endsWith('.pdf')
  )) {
    return await response.blob();
  }

  if (contentType.includes('text/html')) {
    const text = await response.text();
    console.log('Parsing HTML for redirects...');

    // Check for ScienceDirect Challenge 
    if (text.includes('cra_js_challenge') || text.includes('id="nojspx"')) {
      console.log('Detected ScienceDirect Challenge. Switching to iframe resolver.');
      return await resolvePDFViaIframe(url);
    }

    // 1. Meta Refresh
    const metaRefreshMatch = text.match(/<meta\s+http-equiv=["']refresh["']\s+content=["'][^;]*;\s*url=([^"']+)["']/i);

    // 2. JS Redirects
    const jsRedirectMatch = text.match(/(?:window|self|top|document)\.location(?:\.(?:href|replace|assign))?\s*(?:=|[\(])\s*['"]([^'"]+)['"]/i);

    // 3. Known Patterns
    const iframeMatch = text.match(/<iframe[^>]*src=["']([^"']*(?:getPDF|stampPDF|\.pdf)[^"']*)["']/i);

    // Look for signed S3 links (common in ScienceDirect/scopus)
    // Matches: "https://pdf.sciencedirectassets.com/..." or JSON encoded "https:\/\/pdf..."
    // We use a greedy match until we hit a quote or whitespace to capture the full signed URL with params
    const s3Match = text.match(/(https?:\\?\/\\?\/pdf\.sciencedirectassets\.com[^"'\s<>]*)/i);

    // 7. Generic / Website (Fallback)
    // Use WebsiteExtractor as the primary fallback for blogs/websites
    // Note: WebsiteExtractor is not defined in this document. This line will cause a ReferenceError.
    // Assuming this is a placeholder for a future implementation or a conceptual change.
    // return new WebsiteExtractor();
    const specificMatch = text.match(/['"]([^'"]+\.pdf[^'"]*)['"]/i);

    let redirectUrl = null;

    // Prioritize signed S3 links (the "gold standard") as they bypass challenges
    if (s3Match) redirectUrl = s3Match[1];
    else if (metaRefreshMatch) redirectUrl = metaRefreshMatch[1];
    else if (jsRedirectMatch) redirectUrl = jsRedirectMatch[1];
    else if (iframeMatch) redirectUrl = iframeMatch[1];
    else if (specificMatch) redirectUrl = specificMatch[1];

    if (redirectUrl) {
      // Fix JSON escaped slashes (https:\/\/ -> https://)
      redirectUrl = redirectUrl.replace(/\\\//g, '/');
      console.log('Found redirect:', redirectUrl);
      redirectUrl = redirectUrl.replace(/&amp;/g, '&');
      const absoluteRedirect = new URL(redirectUrl, url).href;

      // Wait a small bit if it's a "challenge" or "loading" page
      // to be nice to the server, though fetch blocks anyway
      await new Promise(r => setTimeout(r, 500));

      return fetchWithRedirects(absoluteRedirect, depth + 1);
    }

    // If we simply can't find a link, check if it's the specific "embed about:blank" case
    // which might mean we hit the end of the road for static analysis.
    if (text.includes('src="about:blank"') && text.includes('type="application/pdf"')) {
      throw new Error('Hit PDF viewer wrapper but could not extract source URL.');
    }

    console.warn('Redirect extraction failed. Snippet:', text.substring(0, 300));
    throw new Error('Retrieved content is HTML and no redirect could be extracted.');
  }

  // Default fallback (e.g. valid data but unknown type)
  return await response.blob();
}

