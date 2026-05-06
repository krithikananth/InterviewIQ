const Test = require('../models/Test');
const TestResponse = require('../models/TestResponse');
const { nanoid } = require('nanoid');

// Sample test questions
const SAMPLE_QUESTIONS = [
  { text: "Tell me about yourself and your background.", timeLimit: 90, order: 1 },
  { text: "What are your greatest strengths and how do you apply them?", timeLimit: 90, order: 2 },
  { text: "Describe a challenge you faced and how you overcame it.", timeLimit: 90, order: 3 },
  { text: "Why are you interested in this role and what can you bring to it?", timeLimit: 90, order: 4 },
  { text: "Where do you see yourself in five years?", timeLimit: 90, order: 5 }
];

// Create a new test
const createTest = async (req, res) => {
  try {
    const { title, description, questions, mode, settings } = req.body;
    if (!title || !questions || questions.length === 0) {
      return res.status(400).json({ error: 'Title and at least one question are required' });
    }

    const shareCode = nanoid(8);
    const test = new Test({
      creator: req.userId,
      title,
      description: description || '',
      questions: questions.map((q, i) => ({ text: q.text, timeLimit: q.timeLimit || 90, order: i + 1 })),
      shareCode,
      mode: mode || 'async',
      settings: settings || {}
    });
    await test.save();

    res.status(201).json({ test, shareLink: `/test/${shareCode}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get sample test
const getSampleTest = async (req, res) => {
  res.json({
    _id: 'sample',
    title: 'Practice Interview — General Questions',
    description: 'A set of 5 common interview questions to practice your skills. AI will analyze your emotions, eye contact, and speech fluency.',
    questions: SAMPLE_QUESTIONS,
    mode: 'async',
    isSample: true,
    settings: { requireCamera: true, requireMicrophone: true, timeLimitPerQuestion: 90 }
  });
};

// Get tests created by current user
const getMyTests = async (req, res) => {
  try {
    const tests = await Test.find({ creator: req.userId }).sort({ createdAt: -1 });
    // Attach response counts
    const testsWithCounts = await Promise.all(tests.map(async (test) => {
      const count = await TestResponse.countDocuments({ test: test._id, status: 'completed' });
      return { ...test.toObject(), responseCount: count };
    }));
    res.json(testsWithCounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get test by share code (public)
const getTestByCode = async (req, res) => {
  try {
    const test = await Test.findOne({ shareCode: req.params.code }).populate('creator', 'name email');
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json(test);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get test by ID
const getTestById = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate('creator', 'name email');
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json(test);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Submit test response
const submitResponse = async (req, res) => {
  try {
    const { testId, respondentDetails, answers, overallReport } = req.body;
    if (!respondentDetails?.name || !respondentDetails?.email) {
      return res.status(400).json({ error: 'Respondent name and email are required' });
    }

    const response = new TestResponse({
      test: testId === 'sample' ? undefined : testId,
      respondent: req.userId || undefined,
      respondentDetails,
      answers: answers || [],
      overallReport: overallReport || {},
      status: 'completed'
    });

    // Handle sample test (no test reference)
    if (testId === 'sample') {
      response.test = undefined;
    }

    await response.save();

    // Increment response count on test
    if (testId !== 'sample') {
      await Test.findByIdAndUpdate(testId, { $inc: { responseCount: 1 } });
    }

    res.status(201).json({ response, message: 'Response submitted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all responses for a test (creator only)
const getTestResponses = async (req, res) => {
  try {
    const test = await Test.findById(req.params.testId);
    if (!test) return res.status(404).json({ error: 'Test not found' });
    if (test.creator.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only the test creator can view responses' });
    }

    const responses = await TestResponse.find({ test: req.params.testId, status: 'completed' })
      .sort({ createdAt: -1 });
    res.json(responses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get my responses (tests I've taken)
const getMyResponses = async (req, res) => {
  try {
    const responses = await TestResponse.find({ respondent: req.userId, status: 'completed' })
      .populate('test', 'title description')
      .sort({ createdAt: -1 });
    res.json(responses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a test
const deleteTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ error: 'Test not found' });
    if (test.creator.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only the creator can delete this test' });
    }
    await Test.findByIdAndDelete(req.params.id);
    await TestResponse.deleteMany({ test: req.params.id });
    res.json({ message: 'Test deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createTest, getSampleTest, getMyTests, getTestByCode,
  getTestById, submitResponse, getTestResponses, getMyResponses, deleteTest
};
