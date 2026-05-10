FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for OpenCV and MediaPipe
RUN apt-get update && apt-get install -y libgl1-mesa-glx libglib2.0-0 curl && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (CPU-only PyTorch to save space)
COPY requirements-hf.txt .
RUN pip install --no-cache-dir -r requirements-hf.txt

# Copy application code
COPY . .

# Download MediaPipe Face Landmarker model if not present
RUN if [ ! -f models/face_landmarker.task ]; then \
    curl -L -o models/face_landmarker.task \
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"; \
    fi

EXPOSE 7860

ENV PORT=7860
ENV PYTHONUNBUFFERED=1
ENV PYTHONIOENCODING=utf-8

CMD ["python", "api/main.py"]
