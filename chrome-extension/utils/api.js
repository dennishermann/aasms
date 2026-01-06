// API communication with the backend
const BACKEND_URL = 'http://localhost:3000';

/**
 * Fetch all studies from the backend
 * @returns {Promise<Array>} List of studies
 */
async function fetchStudies() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/studies`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching studies:', error);
    throw new Error('Failed to fetch studies. Make sure the backend is running at localhost:3000');
  }
}

/**
 * Add a source to a study
 * @param {string} studyId - The study ID
 * @param {FormData} formData - Form data with metadata and optionally a PDF file
 * @returns {Promise<Object>} The created source
 */
async function addSource(studyId, formData) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/studies/${studyId}/sources/add`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error adding source:', error);
    throw error;
  }
}

/**
 * Fetch a single study by ID
 * @param {string} studyId - The study ID
 * @returns {Promise<Object>} The study object
 */
async function fetchStudy(studyId) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/studies/${studyId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching study:', error);
    throw error;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fetchStudies, addSource, fetchStudy };
}





