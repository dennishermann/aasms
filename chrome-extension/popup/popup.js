// Popup script for SMS Assistant

// State
let extractedMetadata = null;
let allStudies = [];
let recentStudies = [];
let currentDuplicateSource = null;

// DOM elements
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const mainForm = document.getElementById('mainForm');
const successState = document.getElementById('successState');
const studySelect = document.getElementById('studySelect');
const addBtn = document.getElementById('addBtn');
const attachBtn = document.getElementById('attachBtn');
const cancelBtn = document.getElementById('cancelBtn');
const retryBtn = document.getElementById('retryBtn');
const doneBtn = document.getElementById('doneBtn');

// Initialize popup
async function init() {
  try {
    // Show loading state
    showState('loading');

    // Run extraction and study fetching in parallel
    const [metadataResult, studiesResult] = await Promise.all([
      extractMetadata(),
      fetchStudies()
    ]);

    if (!metadataResult.success) {
      showError(metadataResult.error || 'Failed to extract metadata');
      return;
    }

    if (!studiesResult.success) {
      showError(studiesResult.error || 'Failed to fetch studies');
      return;
    }

    // Store results
    extractedMetadata = metadataResult.metadata;
    allStudies = studiesResult.studies;

    // Load recent studies from storage
    await loadRecentStudies();

    // Populate studies dropdown
    populateStudiesDropdown();

    // Display metadata
    displayMetadata(extractedMetadata);

    // Show main form
    showState('main');

  } catch (error) {
    console.error('Initialization error:', error);
    showError('An unexpected error occurred');
  }
}

/**
 * Extract metadata from the current tab
 */
async function extractMetadata() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        resolve({ success: false, error: 'No active tab found' });
        return;
      }

      const tab = tabs[0];

      // Send message to content script
      chrome.tabs.sendMessage(
        tab.id,
        { action: 'extractMetadata' },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              error: 'Failed to communicate with page. Try reloading the page.'
            });
            return;
          }

          resolve(response || { success: false, error: 'No response from content script' });
        }
      );
    });
  });
}

/**
 * Fetch studies from backend via service worker
 */
async function fetchStudies() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'fetchStudies' },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }

        resolve(response || { success: false, error: 'No response from service worker' });
      }
    );
  });
}

/**
 * Load recent studies from chrome.storage
 */
async function loadRecentStudies() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['recentStudies'], (result) => {
      recentStudies = result.recentStudies || [];

      // Filter out expired (> 24 hours)
      const now = Date.now();
      recentStudies = recentStudies.filter(s => {
        return (now - s.lastUsed) < (24 * 60 * 60 * 1000);
      });

      // Sort by most recent
      recentStudies.sort((a, b) => b.lastUsed - a.lastUsed);

      resolve();
    });
  });
}

/**
 * Populate studies dropdown
 */
function populateStudiesDropdown() {
  // Clear existing options (except placeholder)
  studySelect.innerHTML = '<option value="">Choose a study...</option>';

  if (allStudies.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No studies found';
    option.disabled = true;
    studySelect.appendChild(option);
    return;
  }

  // Add recent studies first (if any)
  if (recentStudies.length > 0) {
    const recentGroup = document.createElement('optgroup');
    recentGroup.label = 'Recently Used';

    recentStudies.slice(0, 5).forEach(recent => {
      const study = allStudies.find(s => s.id === recent.id);
      if (study) {
        const option = document.createElement('option');
        option.value = study.id;
        option.textContent = study.title;
        recentGroup.appendChild(option);
      }
    });

    studySelect.appendChild(recentGroup);
  }

  // Add all studies
  const allGroup = document.createElement('optgroup');
  allGroup.label = 'All Studies';

  allStudies.forEach(study => {
    const option = document.createElement('option');
    option.value = study.id;
    option.textContent = study.title;
    allGroup.appendChild(option);
  });

  studySelect.appendChild(allGroup);
}

/**
 * Validate metadata for required fields
 * @param {Object} metadata - Metadata object
 * @returns {Object} Validation result with valid flag and issues array
 */
function validateMetadata(metadata) {
  const issues = [];

  if (!metadata.title || metadata.title.trim().length === 0) {
    issues.push('Title is required');
  }

  if (!metadata.authors || metadata.authors.length === 0) {
    issues.push('At least one author is required');
  }

  return {
    valid: issues.length === 0,
    issues: issues
  };
}

/**
 * Display extracted metadata
 */
function displayMetadata(metadata) {
  // Title
  document.getElementById('metaTitle').textContent = metadata.title || '—';

  // Authors
  if (metadata.authors && metadata.authors.length > 0) {
    document.getElementById('metaAuthors').textContent = metadata.authors.join(', ');
  } else {
    document.getElementById('metaAuthors').textContent = '—';
  }

  // Venue
  document.getElementById('metaVenue').textContent = metadata.venue || '—';

  // Date
  document.getElementById('metaDate').textContent = metadata.publicationDate || '—';

  // DOI
  document.getElementById('metaDoi').textContent = metadata.doi || '—';

  // PDF Status
  const pdfElem = document.getElementById('metaPdf');
  if (metadata.hasPDF) {
    pdfElem.innerHTML = '<span class="badge badge-success">PDF Found</span>';
  } else {
    pdfElem.innerHTML = '<span class="badge badge-warning">No PDF</span>';
  }

  // Source Type
  document.getElementById('metaType').textContent = metadata.sourceType || 'WEBPAGE';

  // Source Category
  const category = metadata.sourceCategory || 'GREY';
  document.getElementById('metaCategory').textContent = category;

  // Abstract (if available)
  if (metadata.abstract) {
    document.getElementById('abstractSection').classList.remove('hidden');
    document.getElementById('metaAbstract').textContent = metadata.abstract;
  }

  // Validate and show/hide warning
  const validation = validateMetadata(metadata);
  const validationWarning = document.getElementById('validation-warning');

  if (!validation.valid) {
    addBtn.disabled = true;
    addBtn.title = validation.issues.join(', ');
    validationWarning.textContent = '⚠️ ' + validation.issues.join(', ');
    validationWarning.classList.remove('hidden');
  } else {
    addBtn.disabled = false;
    addBtn.title = '';
    validationWarning.classList.add('hidden');
  }
}

/**
 * Show a specific state
 */
function showState(state) {
  loadingState.classList.add('hidden');
  errorState.classList.add('hidden');
  mainForm.classList.add('hidden');
  successState.classList.add('hidden');

  switch (state) {
    case 'loading':
      loadingState.classList.remove('hidden');
      break;
    case 'error':
      errorState.classList.remove('hidden');
      break;
    case 'main':
      mainForm.classList.remove('hidden');
      break;
    case 'success':
      successState.classList.remove('hidden');
      break;
  }
}

/**
 * Show error message
 */
function showError(message) {
  document.querySelector('.error-message').textContent = message;
  showState('error');
}



// Watch for manual selection change if already loaded
studySelect.addEventListener('change', () => {
  const studyId = studySelect.value;
  addBtn.disabled = !studyId;
  attachBtn.classList.add('hidden');
  addBtn.classList.remove('hidden');
  document.getElementById('validation-warning').classList.add('hidden'); // Clear previous warnings

  if (studyId) {
    checkDuplicate(studyId);
  }
});

/**
 * Check if source already exists in study
 */
async function checkDuplicate(studyId) {
  if (!extractedMetadata || !extractedMetadata.title) return;

  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: 'checkDuplicate',
          data: {
            studyId,
            metadata: extractedMetadata
          }
        },
        resolve
      );
    });

    const validationWarning = document.getElementById('validation-warning');

    if (response && response.exists) {
      currentDuplicateSource = response.source;

      // Update UI for duplicate
      addBtn.classList.add('hidden');

      // If needs PDF (or always allow attaching additional info if we want, but sticking to PDF for now)
      validationWarning.innerHTML = `
        <strong>Source already exists</strong> in "${response.source.studyTitle}".
        ${response.needsPdf ? '<br>It is missing a PDF.' : ''}
      `;
      validationWarning.classList.remove('hidden');
      validationWarning.classList.add('warning-message'); // Ensure class

      // Show Attach PDF button
      attachBtn.classList.remove('hidden');
      attachBtn.textContent = 'Attach PDF to Existing Source';

    } else {
      currentDuplicateSource = null;
      addBtn.classList.remove('hidden');
      attachBtn.classList.add('hidden');
      // Validation warning might be used by validateMetadata, so we don't clear it blindly unless it was ours
      // But validateMetadata is called in displayMetadata, usually static. 
      // We should re-run validation to be safe or just leave it if it's invalid.
      // Re-running validation:
      const validation = validateMetadata(extractedMetadata);
      if (validation.valid) {
        validationWarning.classList.add('hidden');
      }
    }

  } catch (error) {
    console.error('Error checking duplicate:', error);
  }
}

/**
 * Add source to selected study
 */
async function addSource() {
  const studyId = studySelect.value;

  if (!studyId) {
    alert('Please select a study');
    return;
  }

  // Disable button and show loading
  addBtn.disabled = true;
  addBtn.textContent = 'Adding...';

  try {
    // Send to service worker
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: 'addSource',
          data: {
            studyId,
            metadata: extractedMetadata
          }
        },
        resolve
      );
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to add source');
    }

    // Update recent studies
    await updateRecentStudies(studyId);

    // Show success
    showState('success');

    // Auto-close after 2 seconds
    setTimeout(() => {
      window.close();
    }, 2000);

  } catch (error) {
    console.error('Error adding source:', error);
    alert(error.message || 'Failed to add source');

    // Re-enable button
    addBtn.disabled = false;
    addBtn.textContent = 'Add to Study';
  }
}


/**
 * Attach PDF to existing source
 */
async function attachPdf() {
  if (!currentDuplicateSource || !extractedMetadata.pdfUrl) {
    alert('No PDF found to attach');
    return;


  }

  const studyId = studySelect.value;

  // Disable button and show loading
  attachBtn.disabled = true;
  attachBtn.textContent = 'Attaching PDF...';

  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: 'attachPdf',
          data: {
            studyId,
            sourceId: currentDuplicateSource.id,
            pdfUrl: extractedMetadata.pdfUrl
          }
        },
        resolve
      );
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to attach PDF');
    }

    await updateRecentStudies(studyId);
    showState('success');
    setTimeout(() => {
      window.close();
    }, 2000);

  } catch (error) {
    console.error('Error attaching PDF:', error);
    alert(error.message || 'Failed to attach PDF');
    attachBtn.disabled = false;
    attachBtn.textContent = 'Attach PDF to Existing Source';
  }
}

/**
 * Update recent studies in storage
 */
async function updateRecentStudies(studyId) {
  const study = allStudies.find(s => s.id === studyId);
  if (!study) return;

  // Remove existing entry
  recentStudies = recentStudies.filter(s => s.id !== studyId);

  // Add to front
  recentStudies.unshift({
    id: studyId,
    title: study.title,
    lastUsed: Date.now()
  });

  // Keep only 10
  recentStudies = recentStudies.slice(0, 10);

  // Save to storage
  return new Promise((resolve) => {
    chrome.storage.local.set({ recentStudies }, resolve);
  });
}

// Event listeners
// studySelect listener moved up to be with checkDuplicate logic logic

addBtn.addEventListener('click', addSource);
attachBtn.addEventListener('click', attachPdf);



cancelBtn.addEventListener('click', () => {
  window.close();
});

retryBtn.addEventListener('click', () => {
  init();
});

doneBtn.addEventListener('click', () => {
  window.close();
});

// Initialize on load
init();

