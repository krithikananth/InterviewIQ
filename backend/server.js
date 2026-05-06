require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const testRoutes = require('./src/routes/testRoutes');
const sessionRoutes = require('./src/routes/sessionRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/sessions', sessionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', service: 'InterviewIQ Backend', timestamp: new Date() });
});

// Root
app.get('/', (req, res) => {
  res.json({
    service: 'InterviewIQ Backend API',
    version: '2.0.0',
    endpoints: {
      auth: { register: 'POST /api/auth/register', login: 'POST /api/auth/login', me: 'GET /api/auth/me' },
      tests: { create: 'POST /api/tests', myTests: 'GET /api/tests', sample: 'GET /api/tests/sample', share: 'GET /api/tests/share/:code' },
      sessions: { start: 'POST /api/sessions/start', analyze: 'POST /api/sessions/analyze-frame' }
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 InterviewIQ Backend v2 running on http://localhost:${PORT}`);
  console.log(`   ML Service: ${process.env.ML_SERVICE_URL || 'http://localhost:8000'}`);
  console.log(`   MongoDB: ${process.env.MONGODB_URI}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});
