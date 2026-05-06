const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  createTest, getSampleTest, getMyTests, getTestByCode,
  getTestById, submitResponse, getTestResponses, getMyResponses, deleteTest
} = require('../controllers/testController');

// Public routes
router.get('/sample', getSampleTest);
router.get('/share/:code', getTestByCode);

// Auth required
router.post('/', auth, createTest);
router.get('/', auth, getMyTests);
router.get('/my-responses', auth, getMyResponses);
router.get('/:id', auth, getTestById);
router.delete('/:id', auth, deleteTest);
router.get('/:testId/responses', auth, getTestResponses);

// Submit response (optional auth)
router.post('/respond', submitResponse);

module.exports = router;
