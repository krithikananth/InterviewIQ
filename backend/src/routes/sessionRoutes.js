const express = require('express');
const router = express.Router();
const {
  startSession,
  analyzeFrameController,
  getReport,
  endSession,
  getSessions
} = require('../controllers/sessionController');

// Session management
router.post('/start', startSession);
router.post('/analyze-frame', analyzeFrameController);
router.get('/report/:sessionId', getReport);
router.delete('/end/:sessionId', endSession);
router.get('/history', getSessions);

module.exports = router;
