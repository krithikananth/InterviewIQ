require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
const sessionRoutes = require('./src/routes/sessionRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Large limit for base64 images
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/sessions', sessionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', service: 'InterviewIQ Backend', timestamp: new Date() });
});

// Root
app.get('/', (req, res) => {
  res.json({
    service: 'InterviewIQ Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      startSession: 'POST /api/sessions/start',
      analyzeFrame: 'POST /api/sessions/analyze-frame',
      getReport: 'GET /api/sessions/report/:sessionId',
      endSession: 'DELETE /api/sessions/end/:sessionId',
      history: 'GET /api/sessions/history'
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 InterviewIQ Backend running on http://localhost:${PORT}`);
  console.log(`   ML Service: ${process.env.ML_SERVICE_URL || 'http://localhost:8000'}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});
