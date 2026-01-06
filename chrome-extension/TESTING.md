# Testing Guide for SMS Assistant Chrome Extension

## Setup

### 1. Start the Backend

```bash
cd frontend
npm run dev
```

Make sure the backend is running at `http://localhost:3000`.

### 2. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the `/Users/dh/development/aasms/chrome-extension` directory
5. The extension should appear in your extensions list

### 3. Create a Test Study

1. Go to `http://localhost:3000`
2. Create a new study
3. Add some research questions and parameters (optional but recommended)

## Test Cases

### Test 1: arXiv Paper

**URL**: https://arxiv.org/abs/2301.07041

**Expected Behavior**:
- Title extracted
- Authors listed
- PDF link detected
- Abstract shown
- Category/subjects as keywords

**Steps**:
1. Navigate to the arXiv URL
2. Click extension icon
3. Verify metadata is displayed correctly
4. Select a study
5. Click "Add to Study"
6. Check backend to confirm source was added

### Test 2: ACM Digital Library

**URL**: https://dl.acm.org/doi/10.1145/3597503.3639089

**Expected Behavior**:
- Full paper metadata extracted
- DOI detected
- Conference/journal name as venue
- Keywords extracted
- PDF link (if accessible)

**Steps**:
1. Navigate to ACM URL
2. Click extension
3. Verify metadata
4. Add to study
5. Verify in backend

### Test 3: IEEE Xplore

**URL**: https://ieeexplore.ieee.org/document/9796235

**Expected Behavior**:
- Paper title and authors
- DOI and publication date
- Abstract text
- Keywords/index terms

**Steps**:
1. Navigate to IEEE URL
2. Test extraction
3. Note: PDF may not be accessible without subscription

### Test 4: Blog Post (Generic)

**URL**: https://martinfowler.com/articles/microservices.html

**Expected Behavior**:
- Title from page
- Author (Martin Fowler)
- Date from meta tags or page
- Source type: BLOG_POST or WEBPAGE
- Category: GREY

**Steps**:
1. Navigate to blog URL
2. Test extraction
3. Verify grey literature categorization

### Test 5: Medium Article

**URL**: Any Medium article (e.g., https://medium.com/@...")

**Expected Behavior**:
- Title and author
- Publication date
- OpenGraph description as abstract
- Type: BLOG_POST
- Category: GREY

### Test 6: Springer Link

**URL**: https://link.springer.com/article/10.1007/s10664-023-10123-4

**Expected Behavior**:
- Full academic metadata
- DOI
- Journal name as venue
- Keywords

## Manual Checks

### UI/UX
- [ ] Popup opens quickly (< 1 second)
- [ ] Loading state shows during extraction
- [ ] Metadata displays in a readable format
- [ ] Study dropdown is populated correctly
- [ ] Recently used studies appear first
- [ ] Error messages are clear
- [ ] Success state shows after adding
- [ ] Popup closes automatically after success

### Functionality
- [ ] Extension works on all test URLs
- [ ] PDF detection works
- [ ] PDF download works (when accessible)
- [ ] Metadata extraction is accurate
- [ ] Source is added to correct study
- [ ] Recent studies list updates
- [ ] Error handling for network issues
- [ ] Error handling for missing backend

### Edge Cases
- [ ] Extension works on page with no metadata
- [ ] Extension handles PDF-only pages
- [ ] Extension works when backend is offline (shows error)
- [ ] Extension works with empty studies list
- [ ] Extension handles very long titles/abstracts

## Debugging

### Check Logs

**Content Script Logs** (on the page):
1. Open DevTools (F12)
2. Go to Console tab
3. Look for "SMS Assistant content script loaded"

**Popup Logs**:
1. Right-click extension icon
2. Select "Inspect popup"
3. Check Console tab

**Service Worker Logs**:
1. Go to `chrome://extensions/`
2. Find SMS Assistant
3. Click "service worker" link
4. Check Console tab

### Common Issues

**Issue**: "Failed to communicate with page"
- **Solution**: Reload the page and try again

**Issue**: No studies in dropdown
- **Solution**: Create a study in the web interface first

**Issue**: PDF download fails
- **Solution**: Normal for paywalled content, metadata is still saved

**Issue**: Extension doesn't appear
- **Solution**: Check that developer mode is enabled and extension is loaded

**Issue**: Backend connection fails
- **Solution**: Make sure Next.js dev server is running on port 3000

## Success Criteria

The extension is working correctly if:

✅ Metadata extracts accurately from test pages
✅ PDFs download when available
✅ Sources appear in the backend study
✅ UI is responsive and intuitive
✅ Errors are handled gracefully
✅ Works on multiple academic databases
✅ Works on generic websites/blogs

## Notes

- Some PDFs require institutional access (expected limitation)
- Extraction accuracy varies by site structure
- Generic extractor is a fallback for unknown sites
- CORS is configured in backend to allow extension access





