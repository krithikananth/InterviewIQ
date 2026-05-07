@echo off
REM Quick Training Script for InterviewIQ Emotion Model v3 (Windows)
REM Usage: cd ml-service && train_gpu.bat

setlocal enabledelayedexpansion

echo.
echo ==========================================
echo   InterviewIQ Emotion Training v3 (85%%)
echo ==========================================
echo.

echo [1/3] Installing dependencies...
pip install -q -r requirements.txt

echo [2/3] Verifying GPU...
python << 'EOF'
import torch
if torch.cuda.is_available():
    print(f"✅ GPU Ready: {torch.cuda.get_device_name(0)}")
    print(f"   Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
else:
    print("⚠️  CUDA not available, using CPU (will be slow)")
EOF

echo.
echo [3/3] Starting training...
echo.

cd src
python train_emotion_85.py
pause
