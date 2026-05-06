const Session = require('../models/Session');
const { analyzeFrame, startMLSession, getMLReport, endMLSession } = require('../services/mlService');
const { v4: uuidv4 } = require('uuid');

/**
 * Start a new interview session
 */
const startSession = async (req, res) => {
  try {
    const sessionId = uuidv4();
    
    // Create DB record
    const session = new Session({ _id: undefined, status: 'active' });
    await session.save().catch(() => {});

    // Start ML session
    await startMLSession(sessionId);

    res.json({
      success: true,
      sessionId,
      dbId: session._id?.toString(),
      message: 'Interview session started'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Analyze a webcam frame
 */
const analyzeFrameController = async (req, res) => {
  try {
    const { image, sessionId } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const result = await analyzeFrame(image, sessionId || 'default');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get session report
 */
const getReport = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const report = await getMLReport(sessionId);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * End session and get final report
 */
const endSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await endMLSession(sessionId);

    // Save to DB if available
    if (result.final_report) {
      try {
        const session = await Session.findOneAndUpdate(
          { status: 'active' },
          {
            status: 'completed',
            endTime: new Date(),
            overallConfidence: result.final_report.score?.overall_score || 0,
            confidenceComponents: result.final_report.score?.components || {},
            recommendations: result.final_report.recommendations || []
          },
          { new: true, sort: { createdAt: -1 } }
        );
      } catch (dbError) {
        console.log('DB save skipped:', dbError.message);
      }
    }

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all past sessions
 */
const getSessions = async (req, res) => {
  try {
    const sessions = await Session.find({ status: 'completed' })
      .sort({ createdAt: -1 }).limit(20);
    res.json(sessions);
  } catch (error) {
    res.json([]); // Return empty if DB unavailable
  }
};

module.exports = { startSession, analyzeFrameController, getReport, endSession, getSessions };
