"""
InterviewIQ — Enhanced CNN Training v2 (PyTorch + GPU)
========================================================
Improved architecture with:
- Residual connections
- Label smoothing
- Cosine annealing LR
- MixUp augmentation
- 100 epochs
- Mixed precision (AMP) for faster GPU training

Target accuracy: 68-72% on FER-2013
"""

import os, sys, json, time
import numpy as np
from pathlib import Path
from tqdm import tqdm

import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
from torch.optim.lr_scheduler import CosineAnnealingWarmRestarts
from torch.amp import autocast, GradScaler

sys.path.insert(0, str(Path(__file__).resolve().parent))
from augmentation import create_data_loaders, get_class_weights

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / 'models'
TRAIN_DIR = BASE_DIR / 'data' / 'fer2013' / 'train'

IMG_SIZE = 48
NUM_CLASSES = 7
BATCH_SIZE = 128  # Larger batch for GPU
EPOCHS = 100
LEARNING_RATE = 0.001
LABEL_SMOOTHING = 0.1
EMOTION_LABELS = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral']


# =============================================================================
# IMPROVED CNN WITH RESIDUAL BLOCKS
# =============================================================================
class ResidualBlock(nn.Module):
    """Residual block with skip connection."""
    def __init__(self, in_ch, out_ch, stride=1):
        super().__init__()
        self.conv1 = nn.Conv2d(in_ch, out_ch, 3, stride=stride, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(out_ch)
        self.conv2 = nn.Conv2d(out_ch, out_ch, 3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(out_ch)

        self.shortcut = nn.Sequential()
        if stride != 1 or in_ch != out_ch:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_ch, out_ch, 1, stride=stride, bias=False),
                nn.BatchNorm2d(out_ch)
            )

    def forward(self, x):
        out = F.relu(self.bn1(self.conv1(x)), inplace=True)
        out = self.bn2(self.conv2(out))
        out += self.shortcut(x)
        return F.relu(out, inplace=True)


class SEBlock(nn.Module):
    """Squeeze-and-Excitation attention block."""
    def __init__(self, ch, reduction=16):
        super().__init__()
        self.fc1 = nn.Linear(ch, ch // reduction)
        self.fc2 = nn.Linear(ch // reduction, ch)

    def forward(self, x):
        b, c, _, _ = x.size()
        w = F.adaptive_avg_pool2d(x, 1).view(b, c)
        w = F.relu(self.fc1(w), inplace=True)
        w = torch.sigmoid(self.fc2(w)).view(b, c, 1, 1)
        return x * w


class EmotionCNNv2(nn.Module):
    """
    Enhanced CNN with residual connections + SE attention.
    Architecture: 4 stages with residual blocks, SE attention, and stronger head.
    """
    def __init__(self, num_classes=NUM_CLASSES):
        super().__init__()

        # Initial conv
        self.stem = nn.Sequential(
            nn.Conv2d(1, 64, 3, padding=1, bias=False), nn.BatchNorm2d(64), nn.ReLU(inplace=True)
        )

        # Stage 1: 64 channels
        self.stage1 = nn.Sequential(
            ResidualBlock(64, 64),
            ResidualBlock(64, 64),
            SEBlock(64),
            nn.MaxPool2d(2, 2), nn.Dropout2d(0.2)
        )

        # Stage 2: 128 channels
        self.stage2 = nn.Sequential(
            ResidualBlock(64, 128, stride=1),
            ResidualBlock(128, 128),
            SEBlock(128),
            nn.MaxPool2d(2, 2), nn.Dropout2d(0.25)
        )

        # Stage 3: 256 channels
        self.stage3 = nn.Sequential(
            ResidualBlock(128, 256, stride=1),
            ResidualBlock(256, 256),
            SEBlock(256),
            nn.MaxPool2d(2, 2), nn.Dropout2d(0.3)
        )

        # Stage 4: 512 channels
        self.stage4 = nn.Sequential(
            ResidualBlock(256, 512, stride=1),
            ResidualBlock(512, 512),
            SEBlock(512),
            nn.AdaptiveAvgPool2d(1)
        )

        # Classification head
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(512, 256), nn.BatchNorm1d(256), nn.ReLU(inplace=True), nn.Dropout(0.5),
            nn.Linear(256, 128), nn.BatchNorm1d(128), nn.ReLU(inplace=True), nn.Dropout(0.4),
            nn.Linear(128, num_classes)
        )

        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
            elif isinstance(m, (nn.BatchNorm2d, nn.BatchNorm1d)):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)

    def forward(self, x):
        x = self.stem(x)
        x = self.stage1(x)
        x = self.stage2(x)
        x = self.stage3(x)
        x = self.stage4(x)
        return self.classifier(x)


# =============================================================================
# MIXUP AUGMENTATION
# =============================================================================
def mixup_data(x, y, alpha=0.2):
    lam = np.random.beta(alpha, alpha) if alpha > 0 else 1
    idx = torch.randperm(x.size(0), device=x.device)
    mixed_x = lam * x + (1 - lam) * x[idx]
    return mixed_x, y, y[idx], lam


def mixup_criterion(criterion, pred, y_a, y_b, lam):
    return lam * criterion(pred, y_a) + (1 - lam) * criterion(pred, y_b)


# =============================================================================
# TRAINING
# =============================================================================
def train_one_epoch(model, loader, criterion, optimizer, device, epoch, total, scaler, use_mixup=True):
    model.train()
    running_loss = 0.0
    correct = 0
    total_samples = 0

    pbar = tqdm(loader, desc=f'Epoch {epoch}/{total} [Train]', leave=False,
                bar_format='{l_bar}{bar:20}{r_bar}')
    for images, labels in pbar:
        images, labels = images.to(device), labels.to(device)

        if use_mixup and np.random.random() > 0.5:
            images, targets_a, targets_b, lam = mixup_data(images, labels)
            with autocast(device_type='cuda', enabled=device.type == 'cuda'):
                outputs = model(images)
                loss = mixup_criterion(criterion, outputs, targets_a, targets_b, lam)
        else:
            with autocast(device_type='cuda', enabled=device.type == 'cuda'):
                outputs = model(images)
                loss = criterion(outputs, labels)

        optimizer.zero_grad(set_to_none=True)
        if device.type == 'cuda':
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            scaler.step(optimizer)
            scaler.update()
        else:
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

        running_loss += loss.item() * images.size(0)
        _, predicted = outputs.max(1)
        total_samples += labels.size(0)
        correct += predicted.eq(labels).sum().item()
        pbar.set_postfix(loss=f'{running_loss/total_samples:.4f}', acc=f'{correct/total_samples*100:.1f}%')

    return running_loss / total_samples, correct / total_samples


def evaluate(model, loader, criterion, device):
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0
    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            with autocast(device_type='cuda', enabled=device.type == 'cuda'):
                outputs = model(images)
                loss = criterion(outputs, labels)
            running_loss += loss.item() * images.size(0)
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()
    return running_loss / total, correct / total


def train_v2():
    print("=" * 65)
    print("  InterviewIQ -- Enhanced CNN Training v2 (Residual + SE + MixUp)")
    print("=" * 65)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Device: {device}" + (f" ({torch.cuda.get_device_name(0)})" if device.type == 'cuda' else ""))
    print(f"Config: {IMG_SIZE}x{IMG_SIZE}, batch={BATCH_SIZE}, epochs={EPOCHS}, lr={LEARNING_RATE}")
    print(f"Features: ResidualBlocks + SE Attention + MixUp + LabelSmoothing + CosineAnnealing + AMP")

    # Data
    print("\n[1/5] Loading Data...", flush=True)
    train_loader, val_loader, test_loader = create_data_loaders(BATCH_SIZE)

    # Class weights
    print("\n[2/5] Class Weights...", flush=True)
    class_weights = get_class_weights(TRAIN_DIR).to(device)

    # Model
    print("\n[3/5] Building Enhanced CNN...", flush=True)
    model = EmotionCNNv2(NUM_CLASSES).to(device)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"   Params: {total_params:,}", flush=True)

    # Loss with label smoothing + class weights
    criterion = nn.CrossEntropyLoss(weight=class_weights, label_smoothing=LABEL_SMOOTHING)
    optimizer = optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=1e-4)
    scheduler = CosineAnnealingWarmRestarts(optimizer, T_0=15, T_mult=2, eta_min=1e-6)
    scaler = GradScaler(enabled=device.type == 'cuda')

    # Train
    print(f"\n[4/5] Training...", flush=True)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    history = {'accuracy': [], 'val_accuracy': [], 'loss': [], 'val_loss': []}
    best_val_acc = 0.0
    patience_counter = 0
    patience = 20

    start_time = time.time()

    for epoch in range(EPOCHS):
        epoch_start = time.time()

        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, device, epoch+1, EPOCHS, scaler)
        val_loss, val_acc = evaluate(model, val_loader, criterion, device)
        scheduler.step(epoch)

        current_lr = optimizer.param_groups[0]['lr']
        elapsed = time.time() - epoch_start

        history['accuracy'].append(train_acc)
        history['val_accuracy'].append(val_acc)
        history['loss'].append(train_loss)
        history['val_loss'].append(val_loss)

        marker = ''
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), str(MODEL_DIR / 'emotion_model_v2_best.pth'))
            patience_counter = 0
            marker = ' ** BEST **'
        else:
            patience_counter += 1

        print(f"   Epoch {epoch+1:3d}/{EPOCHS} | "
              f"Train: {train_acc*100:.2f}% | Val: {val_acc*100:.2f}% | "
              f"LR: {current_lr:.2e} | {elapsed:.1f}s{marker}", flush=True)

        if patience_counter >= patience:
            print(f"\n   Early stopping at epoch {epoch+1}", flush=True)
            break

    total_time = time.time() - start_time
    print(f"\n   Training time: {total_time/60:.1f} minutes", flush=True)

    # Evaluate
    print("\n[5/5] Final Evaluation...", flush=True)
    model.load_state_dict(torch.load(str(MODEL_DIR / 'emotion_model_v2_best.pth'), weights_only=True))
    test_loss, test_acc = evaluate(model, test_loader, criterion, device)
    print(f"   Test Accuracy: {test_acc*100:.2f}%", flush=True)

    # Save
    torch.save(model.state_dict(), str(MODEL_DIR / 'emotion_model_best.pth'))  # Overwrite v1
    torch.save(model.state_dict(), str(MODEL_DIR / 'emotion_model.pth'))

    with open(MODEL_DIR / 'training_history_v2.json', 'w') as f:
        json.dump({
            **{k: [float(v) for v in vals] for k, vals in history.items()},
            'test_accuracy': float(test_acc), 'best_val_accuracy': float(best_val_acc),
            'epochs_trained': len(history['accuracy']),
            'training_time_minutes': round(total_time/60, 1),
            'model': 'EmotionCNNv2 (ResNet + SE + MixUp)'
        }, f, indent=2)

    # Plot
    try:
        import matplotlib; matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        fig, axes = plt.subplots(1, 2, figsize=(14, 5))
        epochs_range = range(1, len(history['accuracy'])+1)
        axes[0].plot(epochs_range, [a*100 for a in history['accuracy']], label='Train', color='#6c5ce7', lw=2)
        axes[0].plot(epochs_range, [a*100 for a in history['val_accuracy']], label='Val', color='#00cec9', lw=2)
        axes[0].set_title('Accuracy (%)'); axes[0].legend(); axes[0].grid(True, alpha=0.3)
        axes[1].plot(epochs_range, history['loss'], label='Train', color='#6c5ce7', lw=2)
        axes[1].plot(epochs_range, history['val_loss'], label='Val', color='#00cec9', lw=2)
        axes[1].set_title('Loss'); axes[1].legend(); axes[1].grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig(str(MODEL_DIR / 'training_history_v2.png'), dpi=150)
        plt.close()
        print("   Training plots saved!", flush=True)
    except Exception as e:
        print(f"   Could not generate plots: {e}", flush=True)

    print("\n" + "=" * 65)
    print(f"  TRAINING COMPLETE!")
    print(f"  Test Accuracy: {test_acc*100:.2f}%")
    print(f"  Best Val Accuracy: {best_val_acc*100:.2f}%")
    print(f"  Epochs: {len(history['accuracy'])} | Time: {total_time/60:.1f} min")
    if best_val_acc >= 0.70: print("  EXCELLENT!")
    elif best_val_acc >= 0.65: print("  GOOD — expected range")
    elif best_val_acc >= 0.55: print("  FAIR")
    else: print("  LOW")
    print("=" * 65)

    return model


# Make EmotionCNN available for the predictor (backward compat)
EmotionCNN = EmotionCNNv2

if __name__ == '__main__':
    train_v2()
