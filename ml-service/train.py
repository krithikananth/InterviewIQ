#!/usr/bin/env python3
"""
Quick GPU Verification & Training Launcher for InterviewIQ v3
==============================================================
Checks GPU availability and trains the emotion model to 85% accuracy
"""

import sys
import subprocess
from pathlib import Path

def check_gpu():
    """Check GPU availability"""
    try:
        import torch
        print("✅ PyTorch installed")
        print(f"   Version: {torch.__version__}")

        if torch.cuda.is_available():
            print(f"✅ CUDA available")
            print(f"   GPU: {torch.cuda.get_device_name(0)}")
            print(f"   GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
            return True
        else:
            print("⚠️  CUDA NOT available - training on CPU (SLOW!)")
            return False
    except ImportError:
        print("❌ PyTorch not installed!")
        print("   Run: pip install torch torchvision")
        return False

def check_data():
    """Check if training data exists"""
    data_dir = Path(__file__).resolve().parent.parent / 'data' / 'fer2013' / 'train'
    if data_dir.exists():
        print(f"✅ FER2013 data found at {data_dir}")
        # Count samples
        from pathlib import Path
        emotions = {}
        for emotion_dir in data_dir.glob('*'):
            if emotion_dir.is_dir():
                count = len(list(emotion_dir.glob('*.*')))
                emotions[emotion_dir.name] = count

        total = sum(emotions.values())
        print(f"   Total samples: {total}")
        for emotion, count in sorted(emotions.items()):
            print(f"   - {emotion}: {count}")
        return True
    else:
        print(f"❌ FER2013 data NOT found!")
        print(f"   Expected: {data_dir}")
        return False

def main():
    print("=" * 70)
    print("  InterviewIQ Emotion Model v3 — GPU Training to 85%")
    print("=" * 70)

    print("\n[1/3] Checking GPU...\n")
    has_gpu = check_gpu()

    print("\n[2/3] Checking Training Data...\n")
    has_data = check_data()

    if not has_data:
        print("\n⚠️  Training data not found. Please ensure FER2013 data is in:")
        print("   ml-service/data/fer2013/train/")
        return

    print("\n[3/3] Installing Requirements...\n")
    req_file = Path(__file__).resolve().parent.parent / 'requirements.txt'
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', str(req_file), '-q'], check=False)

    print("\n" + "=" * 70)
    print("  Starting Training...")
    print("=" * 70 + "\n")

    # Import and run training
    from train_emotion_85 import train_v3_85
    train_v3_85()

if __name__ == '__main__':
    main()
