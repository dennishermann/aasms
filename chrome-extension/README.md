# SMS Assistant Chrome Extension

A Chrome extension for adding research sources to Systematic Mapping Studies directly from academic databases and web pages.

## Features

- 🔍 **Smart Metadata Extraction**: Automatically extracts title, authors, venue, DOI, abstract, and more
- 📚 **Multi-Source Support**: Works with ACM, IEEE, arXiv, Springer, ScienceDirect, and generic web pages
- 📄 **PDF Download**: Automatically downloads and uploads PDFs (when available)
- ⚡ **Quick Access**: Recently used studies appear first
- 🎯 **Simple Workflow**: One-click source addition with metadata preview

## Installation

### Development Mode

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `chrome-extension` directory
5. The extension icon should appear in your toolbar

### Prerequisites

- Chrome browser (version 88+)
- SMS Assistant backend running at `http://localhost:3000`

## Usage

1. **Navigate to a research paper page** (e.g., ACM Digital Library, IEEE Xplore, arXiv, or any blog/article)

2. **Click the extension icon** in your browser toolbar

3. **Review extracted metadata**: The extension will automatically extract:
   - Title
   - Authors
   - Venue/Publisher
   - Publication date
   - DOI (if available)
   - Abstract
   - Keywords
   - PDF link (if available)

4. **Select target study**: Choose from recently used studies or search all studies

5. **Click "Add to Study"**: The extension will:
   - Download the PDF (if available)
   - Upload the source with metadata to your selected study
   - Show a success message

6. **Done!** The extension will automatically close after 2 seconds

## Supported Sites

### Academic Databases (Custom Extractors)
- **ACM Digital Library** (dl.acm.org)
- **IEEE Xplore** (ieeexplore.ieee.org)
- **arXiv** (arxiv.org)
- **Springer Link** (link.springer.com)
- **ScienceDirect** (sciencedirect.com)

### Generic Sites (Fallback Extractor)
- Blogs and articles with standard meta tags
- Sites using OpenGraph or schema.org markup
- Any webpage with extractable metadata

## Architecture

```
chrome-extension/
├── manifest.json              # Extension configuration
├── popup/                     # User interface
│   ├── popup.html            # Popup layout
│   ├── popup.js              # Popup logic
│   └── popup.css             # Popup styles
├── background/                # Background processing
│   └── service-worker.js     # API calls & PDF download
├── content/                   # Page integration
│   └── content-script.js     # Metadata extraction coordination
├── extractors/                # Metadata extractors
│   ├── base-extractor.js     # Base class
│   ├── acm-extractor.js      # ACM-specific
│   ├── ieee-extractor.js     # IEEE-specific
│   ├── arxiv-extractor.js    # arXiv-specific
│   ├── springer-extractor.js # Springer-specific
│   ├── sciencedirect-extractor.js # ScienceDirect-specific
│   ├── generic-extractor.js  # Fallback for any site
│   └── index.js              # Extractor router
└── utils/                     # Utility functions
    ├── api.js                # Backend API communication
    ├── storage.js            # Chrome storage wrapper
    └── pdf-handler.js        # PDF detection & download
```

## Development

### Adding a New Site Extractor

1. Create a new file in `extractors/` (e.g., `springer-extractor.js`)
2. Extend the `BaseExtractor` class
3. Implement `canHandle()` and `extractMetadata()` methods
4. Add to the manifest.json content_scripts array
5. Add to the extractors list in `extractors/index.js`

Example:

```javascript
class MyExtractor extends BaseExtractor {
  canHandle() {
    return this.url.includes('mysite.com');
  }
  
  extractMetadata() {
    const metadata = super.extractMetadata();
    metadata.title = this.getText('h1.article-title');
    metadata.authors = this.getAllText('.author-name');
    // ... extract other fields
    return metadata;
  }
}
```

### Testing

1. Make changes to the extension code
2. Go to `chrome://extensions/`
3. Click the refresh icon on the SMS Assistant extension card
4. Test on various academic sites and blogs
5. Check the browser console for errors (F12 → Console)

### Debugging

- **Content Script Logs**: Open DevTools on the page (F12) → Console tab
- **Popup Logs**: Right-click extension icon → Inspect popup → Console tab
- **Background Logs**: Go to `chrome://extensions/` → Click "service worker" link → Console tab

## API Integration

The extension communicates with the SMS Assistant backend at `http://localhost:3000`.

### Endpoints Used

- `GET /api/studies` - Fetch all studies
- `POST /api/studies/{id}/sources/add` - Add source with metadata and PDF

### Data Format

The extension sends a FormData object with:
- `sourceType`: "PDF" or "URL"
- `file`: PDF blob (when type is "PDF")
- `metadata`: JSON string with:
  - title, authors, venue, publicationDate
  - doi, abstract, keywords
  - sourceCategory ("FORMAL" or "GREY")

## Limitations

- **PDF Access**: Some PDFs require institutional access or authentication
- **Paywall Content**: Extension cannot bypass paywalls
- **Dynamic Sites**: Some JavaScript-heavy sites may not be fully supported
- **Rate Limiting**: Respect site rate limits when extracting metadata

## Future Enhancements

- [ ] Batch import from multiple tabs
- [ ] Duplicate detection before adding
- [ ] Custom metadata editing before saving
- [ ] Support for more academic databases
- [ ] Firefox compatibility
- [ ] Offline mode with queue

## Troubleshooting

### Extension doesn't work on a page

1. Refresh the page
2. Check if backend is running (`http://localhost:3000`)
3. Open DevTools console (F12) for error messages

### No studies appear in dropdown

1. Make sure backend is running
2. Create at least one study in the web interface
3. Check browser console for API errors

### PDF download fails

1. This is normal for paywalled content
2. Metadata will still be saved
3. You can manually upload the PDF later

### "Failed to communicate with page" error

1. Reload the page
2. Reload the extension (chrome://extensions/)
3. Check if the site blocks content scripts

## License

Part of the SMS Assistant project.





