# InterviewIQ 🧠

AI-powered interview analysis platform that evaluates candidates through emotion detection, eye contact tracking, confidence scoring, and speech analysis in real-time.

## Live Demo

- **App:** [interview-iq-one-gamma.vercel.app](https://interview-iq-one-gamma.vercel.app)
- **ML API:** [krithikananth-interviewiq.hf.space](https://krithikananth-interviewiq.hf.space)

## Features

- **Live Interview** — Real-time video call with AI analysis (WebRTC)
- **Async Tests** — Create tests, share links, collect responses
- **Emotion Detection** — CNN model classifying 7 emotions from facial expressions
- **Eye Contact Tracking** — Measures gaze direction via face landmark detection
- **Confidence Scoring** — Composite score from posture, expression, and gaze
- **Speech Analysis** — Real-time transcription with fluency and WPM metrics
- **PDF Reports** — Downloadable per-candidate performance reports

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| ML Service | Python + FastAPI + PyTorch |
| Database | MongoDB Atlas |
| Video | PeerJS (WebRTC) |
| Auth | JWT + bcrypt |

## Architecture

```
Frontend (Vercel)  ←→  Backend (Render)  ←→  MongoDB Atlas
       ↕                     ↕
  PeerJS WebRTC      ML Service (HuggingFace)
  (live video)       (emotion/eye/confidence)
```

## Quick Start

```bash
# Backend
cd backend
npm install
cp .env.example .env   # add MONGODB_URI, JWT_SECRET, ML_SERVICE_URL
npm run dev

# Frontend
cd frontend
npm install
npm run dev

# ML Service
cd ml-service
pip install -r requirements.txt
python api/main.py
```

## Environment Variables

**Backend** (`.env`):
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret
ML_SERVICE_URL=http://localhost:8000
PORT=5000
```

**Frontend** (`.env`):
```
VITE_API_URL=http://localhost:5000/api
VITE_ML_URL=http://localhost:8000
```

## Project Structure

```
├── frontend/          React app (Vite)
│   └── src/pages/     AuthPage, DashboardPage, CreateTestPage,
│                      TakeTestPage, LiveHostPage, LiveJoinPage,
│                      InterviewPage, ReportPage, MyTestsPage
├── backend/           Express API
│   └── src/           models, routes, middleware
├── ml-service/        FastAPI + PyTorch
│   ├── api/           REST endpoints
│   ├── src/           emotion predictor, face detection
│   └── models/        trained CNN weights
└── README.md
```

## Deployment

| Service | Platform | Tier |
|---------|----------|------|
| Frontend | Vercel | Free |
| Backend | Render | Free |
| ML Service | HuggingFace Spaces | Free |
| Database | MongoDB Atlas | M0 Free |

## License

MIT
