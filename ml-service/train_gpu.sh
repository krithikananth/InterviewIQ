#!/bin/bash
# Quick Training Script for InterviewIQ Emotion Model v3
# Usage: cd ml-service && bash train_gpu.sh

echo "=========================================="
echo "  InterviewIQ Emotion Training v3 (85%)"
echo "=========================================="
echo ""

# Install dependencies
echo "[1/3] Installing dependencies..."
pip install -q -r requirements.txt

# Verify GPU
echo "[2/3] Verifying GPU..."
python3 << 'EOF'
import torch
if torch.cuda.is_available():
    print(f"✅ GPU Ready: {torch.cuda.get_device_name(0)}")
    print(f"   Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
else:
    print("⚠️  CUDA not available, using CPU (will be slow)")
EOF

# Start training
echo ""
echo "[3/3] Starting training..."
echo ""
cd src
python3 train_emotion_85.py
