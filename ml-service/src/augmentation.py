"""
InterviewIQ — Data Augmentation Pipeline (PyTorch)
====================================================
Handles FER-2013 data loading and augmentation using PyTorch.
"""

import torch
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
TRAIN_DIR = BASE_DIR / 'data' / 'fer2013' / 'train'
TEST_DIR = BASE_DIR / 'data' / 'fer2013' / 'test'

IMG_SIZE = 48
BATCH_SIZE = 64
EMOTION_LABELS = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral']


def get_class_weights(train_dir):
    """Calculate class weights for imbalanced dataset."""
    class_counts = {}
    total = 0
    for i, emotion in enumerate(EMOTION_LABELS):
        emotion_dir = Path(train_dir) / emotion
        count = len(list(emotion_dir.glob('*.*'))) if emotion_dir.exists() else 0
        class_counts[i] = count
        total += count

    if total == 0:
        return torch.ones(len(EMOTION_LABELS))

    n_classes = len(EMOTION_LABELS)
    weights = []
    print("\n⚖️  CLASS WEIGHTS:")
    for cls_id in range(n_classes):
        count = class_counts[cls_id]
        w = total / (n_classes * count) if count > 0 else 1.0
        weights.append(w)
        print(f"   {EMOTION_LABELS[cls_id]:<12}: {w:.3f} (count: {count})")

    return torch.FloatTensor(weights)


def get_train_transforms():
    """Training transforms with augmentation."""
    return transforms.Compose([
        transforms.Grayscale(num_output_channels=1),
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.RandomRotation(15),
        transforms.RandomHorizontalFlip(),
        transforms.RandomAffine(degrees=0, translate=(0.1, 0.1), scale=(0.9, 1.1), shear=10),
        transforms.ColorJitter(brightness=0.2),
        transforms.ToTensor(),  # Converts to [0, 1] and (C, H, W)
    ])


def get_test_transforms():
    """Test/inference transforms (no augmentation)."""
    return transforms.Compose([
        transforms.Grayscale(num_output_channels=1),
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
    ])


def create_data_loaders(batch_size=BATCH_SIZE, val_split=0.1):
    """Create train, validation, and test data loaders."""
    # Full training dataset
    full_train = datasets.ImageFolder(str(TRAIN_DIR), transform=get_train_transforms())

    # Split into train and validation
    total = len(full_train)
    val_size = int(total * val_split)
    train_size = total - val_size
    train_dataset, val_dataset = torch.utils.data.random_split(full_train, [train_size, val_size])

    # Override transforms for validation (no augmentation)
    val_no_aug = datasets.ImageFolder(str(TRAIN_DIR), transform=get_test_transforms())
    val_dataset_clean = torch.utils.data.Subset(val_no_aug, val_dataset.indices)

    # Test dataset
    test_dataset = datasets.ImageFolder(str(TEST_DIR), transform=get_test_transforms())

    print(f"📊 Train: {train_size} | Val: {val_size} | Test: {len(test_dataset)}")

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0, pin_memory=True)
    val_loader = DataLoader(val_dataset_clean, batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=True)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=True)

    return train_loader, val_loader, test_loader


# Legacy-compatible wrappers for other scripts
class _GeneratorWrapper:
    """Mimics the old Keras generator interface for compatibility."""
    def __init__(self, loader, total):
        self.loader = loader
        self.samples = total
    def __iter__(self):
        return iter(self.loader)
    def __len__(self):
        return len(self.loader)


def create_train_generator(batch_size=BATCH_SIZE):
    train_loader, val_loader, _ = create_data_loaders(batch_size)
    return _GeneratorWrapper(train_loader, len(train_loader.dataset)), _GeneratorWrapper(val_loader, len(val_loader.dataset))


def create_test_generator(batch_size=BATCH_SIZE):
    _, _, test_loader = create_data_loaders(batch_size)
    return _GeneratorWrapper(test_loader, len(test_loader.dataset))


if __name__ == '__main__':
    print("🔧 Augmentation Pipeline Test (PyTorch)")
    weights = get_class_weights(TRAIN_DIR)
    train_loader, val_loader, test_loader = create_data_loaders()
    # Test one batch
    images, labels = next(iter(train_loader))
    print(f"   Batch shape: {images.shape}, Labels shape: {labels.shape}")
    print(f"   Pixel range: [{images.min():.3f}, {images.max():.3f}]")
