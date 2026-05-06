const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionIndex: { type: Number, required: true },
  questionText: { type: String },
  speechText: { type: String, default: '' }, // Transcribed speech
  duration: { type: Number, default: 0 }, // seconds spoken
  emotionScores: {
    dominant: { type: String, default: 'neutral' },
    confidence: { type: Number, default: 0 },
    breakdown: {
      angry: { type: Number, default: 0 },
      disgust: { type: Number, default: 0 },
      fear: { type: Number, default: 0 },
      happy: { type: Number, default: 0 },
      sad: { type: Number, default: 0 },
      surprise: { type: Number, default: 0 },
      neutral: { type: Number, default: 0 }
    }
  },
  eyeContactScore: { type: Number, default: 0 },
  fluencyScore: {
    wordsPerMinute: { type: Number, default: 0 },
    totalWords: { type: Number, default: 0 },
    fillerWords: { type: Number, default: 0 },
    vocabularyDiversity: { type: Number, default: 0 },
    overallScore: { type: Number, default: 0 }
  },
  confidenceScore: { type: Number, default: 0 }
});

const testResponseSchema = new mongoose.Schema({
  test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  respondent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  respondentDetails: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: '' },
    college: { type: String, default: '' },
    position: { type: String, default: '' }
  },
  answers: [answerSchema],
  overallReport: {
    confidenceScore: { type: Number, default: 0 },
    dominantEmotion: { type: String, default: 'neutral' },
    eyeContactScore: { type: Number, default: 0 },
    fluencyScore: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 },
    grade: { type: String, default: 'N/A' } // A, B, C, D, F
  },
  status: { type: String, enum: ['in-progress', 'completed'], default: 'in-progress' }
}, { timestamps: true });

module.exports = mongoose.model('TestResponse', testResponseSchema);
