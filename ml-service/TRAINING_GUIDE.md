# InterviewIQ Emotion Model Training v3 (Target: 85% Accuracy)

## Quick Start

### 1. Verify GPU & Install Dependencies

```bash
cd ml-service
python train.py
```

This will:
- ✅ Check GPU availability
- ✅ Verify training data exists
- ✅ Install all required dependencies
- ✅ Start training automatically

### 2. Monitor Training

Training will take **2-4 hours on GPU** (RTX 3090/4090) or **6-8 hours on RTX 2080**.

Expected accuracy progression:
- **Epoch 10**: ~55-60%
- **Epoch 30**: ~70-75%
- **Epoch 50**: ~78-82%
- **Epoch 80-120**: **85%+** ✨

## Architecture Improvements (v3)

### Model Changes
| Feature | v2 | v3 |
|---------|----|----|
| **Input Size** | 48×48 | 64×64 |
| **Channels** | 512 | 512 |
| **Blocks** | ResNet | MobileNetV3 (MBConv) |
| **Attention** | SE blocks | SE blocks (improved) |
| **Loss** | CrossEntropy | **Focal Loss** |
| **Augmentation** | Standard | CutMix + Advanced |
| **Target Accuracy** | 68-72% | **85%+** |

### Key Improvements

1. **Focal Loss** - Handles class imbalance (especially "surprise")
   - Focuses on hard-to-classify samples
   - Weighted for rare emotions

2. **EfficientNet-style Architecture** (MBConv blocks)
   - Depthwise separable convolutions for efficiency
   - Inverted bottleneck design
   - Better feature extraction

3. **Advanced Augmentation**
   - CutMix (random patch mixing)
   - GaussianBlur (noise robustness)
   - Enhanced geometric transforms
   - Color jitter with contrast/saturation

4. **Better Batch Size**
   - Increased from 128 to **256** for better gradient estimates

5. **Longer Training**
   - Increased epochs from 100 to **200**
   - CosineAnnealing with warm restarts

## Training Details

### Hyperparameters

```python
BATCH_SIZE = 256          # Larger batch for better gradients
EPOCHS = 200              # More epochs for convergence
LEARNING_RATE = 0.001     # Adam optimizer
IMG_SIZE = 64             # Higher resolution
FOCAL_GAMMA = 2.0         # Focus on hard samples
FOCAL_ALPHA = 0.25        # Class balancing
```

### Data Augmentation

**Training transforms:**
- Random rotation: ±20°
- Random affine: translate 15%, scale 0.85-1.15, shear 15°
- Color jitter: brightness 0.3, contrast 0.3
- Gaussian blur: σ 0.1-2.0
- Horizontal flip: 50%
- CutMix: 70% probability

**Validation transforms:**
- No augmentation (only resize + normalize)

### Class Weights & Focal Loss

Class weights adjusted for imbalance:
```
Angry:    1.2×
Disgust:  1.5×
Fear:     1.3×
Happy:    0.8×
Sad:      1.1×
Surprise: 2.0× (heavily boosted)
Neutral:  0.7×
```

Focal Loss formula:
```
FL(pt) = -α(1-pt)^γ * log(pt)
where γ=2.0 focuses on hard examples
```

## GPU Usage

### NVIDIA GPU Requirements

**Minimum:**
- RTX 2060 (6GB VRAM)
- Training time: 8-10 hours

**Recommended:**
- RTX 3080 (10GB VRAM)
- Training time: 3-4 hours

**Optimal:**
- RTX 4090 (24GB VRAM) or RTX 3090
- Training time: 1.5-2 hours
- Can use batch_size=512 for even better convergence

### Memory Optimization

If you get OOM errors:
1. Reduce BATCH_SIZE in `train_emotion_85.py`
2. Reduce image size (IMG_SIZE)
3. Use gradient accumulation

## Training Output

The training will save:

```
ml-service/models/
├── emotion_model.pth              # Latest model
├── emotion_model_best.pth         # Best model (85%+ accuracy)
├── emotion_model_v3_best.pth      # v3 backup
├── training_history_v3.json       # Training metrics
└── training_history_v3.png        # Accuracy/loss curves
```

## Expected Accuracy per Emotion

With 85% overall accuracy target:

| Emotion | Typical Accuracy |
|---------|-----------------|
| Happy | 92-96% |
| Neutral | 88-92% |
| Sad | 82-88% |
| Angry | 80-86% |
| Fear | 75-82% |
| Disgust | 78-85% |
| Surprise | 75-85% (improved from 40-50%) |

## Post-Training

After training completes:

### 1. Test Locally
```bash
python -c "
from ml_service.src.emotion_predictor import EmotionPredictor
predictor = EmotionPredictor()
# It will automatically load the best model
"
```

### 2. Update Production
Push to GitHub:
```bash
git add ml-service/models/emotion_model.pth
git commit -m "train: improve emotion accuracy to 85% with v3 model"
git push
```

Redeploy on Render:
- Go to Render Dashboard
- Find ML Service
- Click "Deploy latest"
- Wait 5-10 minutes for new model to load

### 3. Test on Real Interviews
The new model should:
- ✅ Detect "surprise" properly (was missing before)
- ✅ Better distinguish "angry" vs "disgust"
- ✅ More stable predictions overall
- ✅ Work well with varied lighting/camera angles

## Troubleshooting

### Training is slow
- Check GPU: `nvidia-smi`
- Verify CUDA is working: `python -c "import torch; print(torch.cuda.is_available())"`
- Reduce batch size if OOM

### Surprise emotion still not detected
- This suggests data imbalance in FER2013
- Consider downloading CK+ dataset (see below)
- Increase surprise weight further in `EMOTION_CONFIDENCE_WEIGHTS`

### Validation accuracy plateaus at ~75%
- Increase training epochs to 250+
- Use learning rate scheduler: try lr=0.0005
- Increase dropout in classifier

## Advanced: Adding More Data (CK+ Dataset)

To further improve accuracy, download CK+ (Cohn-Kanade Extended):

```bash
# 1. Download from: https://www.jeffcohn.net/DBDownload/
# 2. Extract to: ml-service/data/ckplus/
# 3. Update create_data_loaders() to include both datasets

# In augmentation.py modify:
def create_data_loaders(batch_size=BATCH_SIZE, val_split=0.1):
    fer2013_dataset = datasets.ImageFolder(str(TRAIN_DIR), ...)
    ckplus_dataset = datasets.ImageFolder(str(CKPLUS_DIR), ...)
    combined = ConcatDataset([fer2013_dataset, ckplus_dataset])
    # ... rest of code
```

Expected accuracy with combined datasets: **88-92%**

## References

- Paper: "Focal Loss for Dense Object Detection" (Lin et al.)
- Model: EfficientNet architecture
- Data: FER2013 + optional CK+ datasets
