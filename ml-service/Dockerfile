FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for OpenCV
RUN apt-get update && apt-get install -y libgl1-mesa-glx libglib2.0-0 && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (CPU-only PyTorch to save space)
COPY requirements-hf.txt .
RUN pip install --no-cache-dir -r requirements-hf.txt

# Copy application code
COPY . .

EXPOSE 7860

ENV PORT=7860
ENV PYTHONUNBUFFERED=1

CMD ["python", "api/main.py"]
