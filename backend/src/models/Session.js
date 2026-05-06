const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: { type: String, default: 'anonymous' },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  duration: { type: Number, default: 0 }, // seconds
  overallConfidence: { type: Number, default: 0 },
  dominantEmotion: { type: String, default: 'neutral' },
  eyeContactScore: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  emotionTimeline: [{
    timestamp: Number,
    emotion: String,
    confidence: Number,
    eyeContact: Boolean
  }],
  emotionBreakdown: {
    angry: { type: Number, default: 0 },
    disgust: { type: Number, default: 0 },
    fear: { type: Number, default: 0 },
    happy: { type: Number, default: 0 },
    sad: { type: Number, default: 0 },
    surprise: { type: Number, default: 0 },
    neutral: { type: Number, default: 0 }
  },
  confidenceComponents: {
    eyeContact: { type: Number, default: 0 },
    emotionPositivity: { type: Number, default: 0 },
    emotionStability: { type: Number, default: 0 },
    movementStability: { type: Number, default: 0 },
    smileFrequency: { type: Number, default: 0 }
  },
  recommendations: [{ area: String, score: Number, tip: String }]
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
