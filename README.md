# 🧠 InterviewIQ — AI Interview Emotion & Confidence Analyzer

Real-time AI-powered interview analysis system that detects facial emotions, tracks eye contact, and calculates interview confidence scores using deep learning.

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)
![PyTorch](https://img.shields.io/badge/PyTorch-2.x-red?logo=pytorch)
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi)

## 🎯 Features

- **Real-Time Emotion Detection** — CNN trained on FER-2013 (35,887 images, 7 emotions)
- **Eye Contact Tracking** — OpenCV-based gaze estimation
- **Confidence Scoring** — Multi-factor algorithm (eye contact, emotion stability, movement, smile frequency)
- **Live Webcam Analysis** — Process webcam feed at ~2.5 FPS with GPU acceleration
- **PDF Report Export** — Download detailed analysis reports
- **Premium Dark UI** — Glassmorphism design with real-time charts

## 📸 Screenshots

### Dashboard
Premium dark theme with animated CTA and tech stack badges.

### Interview Analysis
Live webcam with emotion bars, eye contact score, and confidence meter.

### Reports
Doughnut charts, confidence breakdown, and AI recommendations.

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React + Vite  │◄──►│  Node.js/Express │◄──►│  FastAPI + GPU  │
│   (Frontend)    │    │   (Backend API)  │    │  (ML Service)   │
│   Port 5173     │    │   Port 5000      │    │  Port 8000      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                      │
                                                ┌─────┴─────┐
                                                │ PyTorch   │
                                                │ CNN Model │
                                                │ (63-68%)  │
                                                └───────────┘
```

## 🚀 Quick Start

### Prerequisites
- Python 3.10+ (PyTorch)
- Node.js 18+
- NVIDIA GPU (recommended, not required)
- MongoDB (optional)

### 1. Clone & Setup ML Service
```bash
git clone https://github.com/YOUR_USERNAME/InterviewIQ.git
cd InterviewIQ

# Install Python dependencies
cd ml-service
pip install -r requirements.txt

# For GPU support (NVIDIA):
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
```

### 2. Download Dataset & Train Model
```bash
# Download FER-2013 and train CNN
python src/preprocessing.py
python src/train_emotion.py

# Training takes ~30-60 min on GPU, ~2-3 hours on CPU
```

### 3. Start ML Service
```bash
python api/main.py
# Runs on http://localhost:8000
```

### 4. Start Backend (Optional)
```bash
cd ../backend
npm install
node server.js
# Runs on http://localhost:5000
```

### 5. Start Frontend
```bash
cd ../frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### 6. Open Browser
Navigate to **http://localhost:5173** → Click **Interview** → **Start Analysis**

## 📊 Model Performance

| Metric | v1 (Basic CNN) | v2 (ResNet + SE) |
|--------|---------------|-----------------|
| Test Accuracy | 63.61% | ~68%+ |
| Architecture | 4-block CNN | Residual + SE Attention |
| Parameters | 5M | 11M |
| Training | 42 min GPU | ~60 min GPU |
| Features | Basic | MixUp, LabelSmoothing, AMP |

> Human accuracy on FER-2013 is ~65%. State-of-the-art is ~75%.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **ML Model** | PyTorch, CNN with Residual + SE blocks |
| **ML API** | FastAPI, Uvicorn, WebSocket |
| **Computer Vision** | OpenCV (face detection, eye tracking) |
| **Backend** | Node.js, Express, MongoDB |
| **Frontend** | React 18, Vite, Chart.js, react-webcam |
| **Design** | Vanilla CSS, Glassmorphism, Dark theme |

## 📁 Project Structure

```
InterviewIQ/
├── ml-service/
│   ├── api/main.py              # FastAPI server
│   ├── src/
│   │   ├── train_emotion.py     # CNN training (ResNet + SE)
│   │   ├── augmentation.py      # Data augmentation pipeline
│   │   ├── preprocessing.py     # FER-2013 dataset downloader
│   │   ├── face_detector.py     # OpenCV face detection
│   │   ├── emotion_predictor.py # PyTorch inference
│   │   ├── eye_tracker.py       # Eye contact tracking
│   │   └── confidence_scorer.py # Confidence algorithm
│   ├── models/                  # Trained .pth models
│   └── requirements.txt
├── backend/
│   ├── server.js                # Express server
│   └── src/
│       ├── config/db.js
│       ├── models/Session.js
│       ├── controllers/sessionController.js
│       ├── routes/sessionRoutes.js
│       └── services/mlService.js
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── index.css            # Design system
│       └── pages/
│           ├── DashboardPage.jsx
│           ├── InterviewPage.jsx
│           └── ReportPage.jsx
└── README.md
```

## 🚢 Deployment

### Option 1: Docker (Recommended)
```bash
docker-compose up --build
```

### Option 2: Manual Deployment
1. **ML Service** → Deploy on a GPU server (AWS EC2 g4dn, Google Cloud GPU)
2. **Backend** → Deploy on Render / Railway / Heroku
3. **Frontend** → Deploy on Vercel / Netlify

### Option 3: Cloud Platforms
- **Render**: Backend + ML Service
- **Vercel**: Frontend (static)
- **Railway**: Full stack

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## 📄 License

MIT License

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
