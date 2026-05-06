const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  timeLimit: { type: Number, default: 90 }, // seconds
  order: { type: Number, required: true }
});

const testSchema = new mongoose.Schema({
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  questions: [questionSchema],
  shareCode: { type: String, unique: true, required: true },
  isPublic: { type: Boolean, default: true },
  mode: { type: String, enum: ['async', 'live'], default: 'async' },
  settings: {
    showEmotionFeedback: { type: Boolean, default: false },
    requireCamera: { type: Boolean, default: true },
    requireMicrophone: { type: Boolean, default: true },
    timeLimitPerQuestion: { type: Number, default: 90 }
  },
  responseCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Test', testSchema);
