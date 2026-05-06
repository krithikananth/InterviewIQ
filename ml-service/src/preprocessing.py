"""
InterviewIQ — Dataset Preprocessing Pipeline
=============================================
Downloads FER-2013 dataset and preprocesses it for training.

FER-2013 Dataset:
- 35,887 grayscale images (48x48 pixels)
- 7 emotion classes: angry, disgust, fear, happy, sad, surprise, neutral
- CSV format with pixel values

This script:
1. Downloads FER-2013 from Kaggle (or loads from CSV)
2. Converts CSV pixel data to image arrays
3. Organizes into train/test folder structure
4. Normalizes pixel values
5. Reports class distribution
"""

import os
import sys
import numpy as np
import pandas as pd
from pathlib import Path
import cv2

# Emotion labels mapping
EMOTION_LABELS = {
    0: 'angry',
    1: 'disgust',
    2: 'fear',
    3: 'happy',
    4: 'sad',
    5: 'surprise',
    6: 'neutral'
}

# Project paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / 'data'
FER_DIR = DATA_DIR / 'fer2013'
TRAIN_DIR = FER_DIR / 'train'
TEST_DIR = FER_DIR / 'test'


def create_directory_structure():
    """Create the train/test directory structure for each emotion."""
    print("📁 Creating directory structure...")
    for split_dir in [TRAIN_DIR, TEST_DIR]:
        for emotion in EMOTION_LABELS.values():
            emotion_dir = split_dir / emotion
            emotion_dir.mkdir(parents=True, exist_ok=True)
    print("✅ Directory structure created!")


def download_dataset():
    """
    Download FER-2013 dataset.
    Tries kagglehub first, falls back to manual instructions.
    """
    csv_path = DATA_DIR / 'fer2013.csv'

    if csv_path.exists():
        print(f"✅ Dataset already exists at {csv_path}")
        return csv_path

    print("📥 Attempting to download FER-2013 dataset...")

    # Try kagglehub
    try:
        import kagglehub
        path = kagglehub.dataset_download("msambare/fer2013")
        print(f"✅ Dataset downloaded to: {path}")

        # Find the CSV file in downloaded path
        for root, dirs, files in os.walk(path):
            for f in files:
                if f.endswith('.csv') and 'fer2013' in f.lower():
                    import shutil
                    src = os.path.join(root, f)
                    shutil.copy2(src, csv_path)
                    print(f"✅ Copied CSV to {csv_path}")
                    return csv_path

        # If no CSV found, check for image directories
        # The msambare/fer2013 dataset comes pre-organized in folders
        train_path = None
        test_path = None
        for root, dirs, files in os.walk(path):
            if 'train' in dirs:
                train_path = os.path.join(root, 'train')
            if 'test' in dirs:
                test_path = os.path.join(root, 'test')

        if train_path and test_path:
            print(f"✅ Found pre-organized dataset!")
            print(f"   Train: {train_path}")
            print(f"   Test: {test_path}")
            # Copy the organized folders
            import shutil
            if TRAIN_DIR.exists():
                shutil.rmtree(TRAIN_DIR)
            if TEST_DIR.exists():
                shutil.rmtree(TEST_DIR)
            shutil.copytree(train_path, TRAIN_DIR)
            shutil.copytree(test_path, TEST_DIR)
            return "FOLDERS_READY"

    except ImportError:
        print("⚠️  kagglehub not installed. Trying alternative...")
    except Exception as e:
        print(f"⚠️  kagglehub download failed: {e}")

    # Manual download instructions
    print("\n" + "=" * 60)
    print("📋 MANUAL DOWNLOAD INSTRUCTIONS")
    print("=" * 60)
    print("""
1. Go to: https://www.kaggle.com/datasets/msambare/fer2013
2. Click 'Download' (you need a Kaggle account)
3. Extract the ZIP file
4. Place the contents in:
   {}

The dataset should have this structure:
   fer2013/
   ├── train/
   │   ├── angry/
   │   ├── disgust/
   │   ├── fear/
   │   ├── happy/
   │   ├── neutral/
   │   ├── sad/
   │   └── surprise/
   └── test/
       ├── angry/
       ├── ...
""".format(FER_DIR))

    sys.exit(1)


def load_from_csv(csv_path):
    """Load FER-2013 from CSV and save as images."""
    print(f"📊 Loading CSV from {csv_path}...")
    df = pd.read_csv(csv_path)

    print(f"   Total samples: {len(df)}")
    print(f"   Columns: {list(df.columns)}")

    create_directory_structure()

    counters = {e: {'train': 0, 'test': 0} for e in EMOTION_LABELS.values()}

    for idx, row in df.iterrows():
        emotion_idx = int(row['emotion'])
        pixels = np.array(row['pixels'].split(), dtype=np.uint8).reshape(48, 48)
        emotion_name = EMOTION_LABELS[emotion_idx]

        # FER-2013 CSV has 'Usage' column: Training, PublicTest, PrivateTest
        if 'Usage' in df.columns:
            usage = row['Usage']
            if usage == 'Training':
                split = 'train'
                save_dir = TRAIN_DIR
            else:
                split = 'test'
                save_dir = TEST_DIR
        else:
            # Default 80/20 split
            split = 'train' if np.random.random() < 0.8 else 'test'
            save_dir = TRAIN_DIR if split == 'train' else TEST_DIR

        filename = f"{emotion_name}_{counters[emotion_name][split]:05d}.png"
        filepath = save_dir / emotion_name / filename
        cv2.imwrite(str(filepath), pixels)
        counters[emotion_name][split] += 1

        if (idx + 1) % 5000 == 0:
            print(f"   Processed {idx + 1}/{len(df)} images...")

    print("\n✅ Dataset saved as images!")
    return counters


def load_from_folders():
    """Load dataset statistics from pre-organized folders."""
    counters = {e: {'train': 0, 'test': 0} for e in EMOTION_LABELS.values()}

    for split, split_dir in [('train', TRAIN_DIR), ('test', TEST_DIR)]:
        if not split_dir.exists():
            continue
        for emotion_dir in split_dir.iterdir():
            if emotion_dir.is_dir():
                emotion_name = emotion_dir.name
                if emotion_name in counters:
                    count = len(list(emotion_dir.glob('*.*')))
                    counters[emotion_name][split] = count

    return counters


def print_distribution(counters):
    """Print the class distribution table."""
    print("\n📊 CLASS DISTRIBUTION:")
    print("=" * 55)
    print(f"{'Emotion':<12} {'Train':>8} {'Test':>8} {'Total':>8} {'%':>8}")
    print("-" * 55)

    total_train = sum(c['train'] for c in counters.values())
    total_test = sum(c['test'] for c in counters.values())
    total = total_train + total_test

    for emotion, counts in sorted(counters.items()):
        t = counts['train'] + counts['test']
        pct = (t / total * 100) if total > 0 else 0
        print(f"{emotion:<12} {counts['train']:>8} {counts['test']:>8} {t:>8} {pct:>7.1f}%")

    print("-" * 55)
    print(f"{'TOTAL':<12} {total_train:>8} {total_test:>8} {total:>8} {'100.0%':>8}")
    print("=" * 55)

    # Identify imbalanced classes
    if total > 0:
        avg = total / len(counters)
        print("\n⚠️  CLASS IMBALANCE ANALYSIS:")
        for emotion, counts in counters.items():
            t = counts['train'] + counts['test']
            ratio = t / avg
            if ratio < 0.5:
                print(f"   🔴 {emotion}: severely underrepresented ({ratio:.2f}x avg)")
            elif ratio < 0.8:
                print(f"   🟡 {emotion}: slightly underrepresented ({ratio:.2f}x avg)")
            elif ratio > 1.5:
                print(f"   🟢 {emotion}: overrepresented ({ratio:.2f}x avg)")


def verify_dataset():
    """Verify dataset integrity."""
    print("\n🔍 Verifying dataset...")

    issues = []
    for split, split_dir in [('train', TRAIN_DIR), ('test', TEST_DIR)]:
        if not split_dir.exists():
            issues.append(f"Missing directory: {split_dir}")
            continue

        for emotion in EMOTION_LABELS.values():
            emotion_dir = split_dir / emotion
            if not emotion_dir.exists():
                issues.append(f"Missing emotion directory: {emotion_dir}")
                continue

            count = len(list(emotion_dir.glob('*.*')))
            if count == 0:
                issues.append(f"Empty directory: {emotion_dir}")

    if issues:
        print("❌ Issues found:")
        for issue in issues:
            print(f"   - {issue}")
        return False
    else:
        print("✅ Dataset verification passed!")
        return True


def main():
    """Main preprocessing pipeline."""
    print("🚀 InterviewIQ — Dataset Preprocessing Pipeline")
    print("=" * 50)

    # Check if dataset folders already exist and are populated
    if TRAIN_DIR.exists() and TEST_DIR.exists():
        counters = load_from_folders()
        total = sum(c['train'] + c['test'] for c in counters.values())
        if total > 0:
            print(f"✅ Found existing dataset with {total} images!")
            print_distribution(counters)
            verify_dataset()
            return

    # Download dataset
    result = download_dataset()

    if result == "FOLDERS_READY":
        # Dataset was downloaded as pre-organized folders
        counters = load_from_folders()
    elif result and Path(result).suffix == '.csv':
        # Dataset was downloaded as CSV
        counters = load_from_csv(result)
    else:
        print("❌ Could not load dataset!")
        return

    print_distribution(counters)
    verify_dataset()

    print("\n🎉 Preprocessing complete! Ready for training.")


if __name__ == '__main__':
    main()
