// Chrome storage wrapper for managing recent studies

const RECENT_STUDIES_KEY = 'recentStudies';
const MAX_RECENT_STUDIES = 10;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Get recently used studies
 * @returns {Promise<Array>} List of recent study objects {id, title, lastUsed}
 */
async function getRecentStudies() {
  return new Promise((resolve) => {
    chrome.storage.local.get([RECENT_STUDIES_KEY], (result) => {
      const recent = result[RECENT_STUDIES_KEY] || [];
      
      // Filter out expired entries (older than 24 hours)
      const now = Date.now();
      const valid = recent.filter(study => {
        return (now - study.lastUsed) < CACHE_DURATION;
      });
      
      // Sort by most recently used
      valid.sort((a, b) => b.lastUsed - a.lastUsed);
      
      resolve(valid);
    });
  });
}

/**
 * Add or update a study in the recent list
 * @param {string} studyId - The study ID
 * @param {string} studyTitle - The study title
 * @returns {Promise<void>}
 */
async function addRecentStudy(studyId, studyTitle) {
  const recent = await getRecentStudies();
  
  // Remove existing entry if present
  const filtered = recent.filter(s => s.id !== studyId);
  
  // Add to the front
  filtered.unshift({
    id: studyId,
    title: studyTitle,
    lastUsed: Date.now()
  });
  
  // Keep only MAX_RECENT_STUDIES
  const trimmed = filtered.slice(0, MAX_RECENT_STUDIES);
  
  return new Promise((resolve) => {
    chrome.storage.local.set({ [RECENT_STUDIES_KEY]: trimmed }, resolve);
  });
}

/**
 * Clear all recent studies
 * @returns {Promise<void>}
 */
async function clearRecentStudies() {
  return new Promise((resolve) => {
    chrome.storage.local.remove([RECENT_STUDIES_KEY], resolve);
  });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getRecentStudies, addRecentStudy, clearRecentStudies };
}





