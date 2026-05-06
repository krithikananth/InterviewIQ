const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * Proxy frame to ML service for analysis
 */
const analyzeFrame = async (imageBase64, sessionId = 'default') => {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/api/analyze-frame`, {
      image: imageBase64,
      session_id: sessionId
    }, { timeout: 5000 });
    return response.data;
  } catch (error) {
    console.error('ML Service error:', error.message);
    return { face_detected: false, error: error.message };
  }
};

/**
 * Start a new ML session
 */
const startMLSession = async (sessionId) => {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/api/session/start?session_id=${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('ML Session start error:', error.message);
    return { error: error.message };
  }
};

/**
 * Get ML session report
 */
const getMLReport = async (sessionId) => {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/api/session/${sessionId}/report`);
    return response.data;
  } catch (error) {
    console.error('ML Report error:', error.message);
    return { error: error.message };
  }
};

/**
 * End ML session
 */
const endMLSession = async (sessionId) => {
  try {
    const response = await axios.delete(`${ML_SERVICE_URL}/api/session/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('ML Session end error:', error.message);
    return { error: error.message };
  }
};

module.exports = { analyzeFrame, startMLSession, getMLReport, endMLSession };
