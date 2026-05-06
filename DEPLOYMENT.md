# 🚢 InterviewIQ Deployment Guide

## Architecture Overview
```
[Vercel/Netlify]     [Render/Railway]     [GPU Server]
   Frontend    ◄──►   Node.js API    ◄──►  FastAPI ML
   (Static)           (Backend)            (PyTorch)
```

---

## Option 1: Vercel (Frontend) + Render (Backend + ML)

### Step 1: Deploy Frontend to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Build frontend
cd frontend
npm run build

# Deploy
vercel --prod
```

**Vercel Settings:**
- Framework: Vite
- Build command: `npm run build`
- Output: `dist`
- Environment variable: `VITE_API_URL=https://your-backend.onrender.com`

### Step 2: Deploy Backend to Render
1. Go to [render.com](https://render.com) → New Web Service
2. Connect your GitHub repo
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment Variables:**
     - `ML_SERVICE_URL=https://your-ml-service.onrender.com`
     - `MONGODB_URI=mongodb+srv://...`
     - `NODE_ENV=production`

### Step 3: Deploy ML Service to Render
1. New Web Service → Connect GitHub
2. Settings:
   - **Root Directory:** `ml-service`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python api/main.py`
   - **Instance Type:** Standard (CPU) or GPU if available

> ⚠️ **Note:** For GPU inference, use a GPU-enabled cloud provider (AWS, GCP, or Render GPU instances).

---

## Option 2: Docker Compose (Self-Hosted)

### docker-compose.yml
```yaml
version: '3.8'
services:
  ml-service:
    build: ./ml-service
    ports: ["8000:8000"]
    volumes: ["./ml-service/models:/app/models"]
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]

  backend:
    build: ./backend
    ports: ["5000:5000"]
    environment:
      - ML_SERVICE_URL=http://ml-service:8000
      - MONGODB_URI=mongodb://mongo:27017/interviewiq
    depends_on: [ml-service, mongo]

  frontend:
    build: ./frontend
    ports: ["3000:80"]
    depends_on: [backend]

  mongo:
    image: mongo:7
    volumes: ["mongo-data:/data/db"]

volumes:
  mongo-data:
```

### ML Service Dockerfile
```dockerfile
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "api/main.py"]
```

---

## Option 3: AWS EC2 (GPU)

1. Launch **g4dn.xlarge** instance (NVIDIA T4 GPU)
2. Install CUDA drivers + Docker
3. Clone repo and run Docker Compose
4. Set up Nginx reverse proxy + SSL

---

## Environment Variables

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000
VITE_ML_URL=http://localhost:8000
```

### Backend (.env)
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/interviewiq
ML_SERVICE_URL=http://localhost:8000
NODE_ENV=production
```

### ML Service
```
No env vars needed — models are loaded from ./models/ directory
```

---

## Model File Hosting

The trained `.pth` model files are too large for Git. Options:
1. **Google Drive** — Upload and download during deployment
2. **Hugging Face Hub** — Host model weights
3. **S3/GCS** — Cloud storage bucket
4. **Train on server** — Download dataset and train directly

```bash
# Download model from Google Drive (example)
pip install gdown
gdown --id YOUR_FILE_ID -O models/emotion_model_best.pth
```
