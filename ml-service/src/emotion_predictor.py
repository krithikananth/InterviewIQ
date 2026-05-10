"""
InterviewIQ — Emotion Predictor (PyTorch, Enhanced)
======================================================
Loads trained PyTorch CNN model and predicts emotions from face images.

Key improvements:
- Auto-detects model architecture from checkpoint
- Proper normalization matching training pipeline
- Temperature scaling for better-calibrated confidence scores
- Frame averaging for more stable predictions
"""

import numpy as np
from pathlib import Path
from collections import deque
import torch
import torch.nn.functional as F

EMOTION_LABELS = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral']
EMOTION_COLORS = {
    'angry': (0, 0, 255), 'disgust': (0, 128, 0), 'fear': (128, 0, 128),
    'happy': (0, 255, 255), 'sad': (255, 0, 0), 'surprise': (0, 165, 255),
    'neutral': (200, 200, 200)
}

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / 'models'

# Temperature for softmax calibration (lower = sharper predictions)
TEMPERATURE = 1.5


class EmotionPredictor:
    """Predicts facial emotions using trained PyTorch CNN model with temporal smoothing."""

    def __init__(self, model_path=None):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

        if model_path is None:
            # Try to load models in order of quality
            for name in ['emotion_model_best.pth', 'emotion_model_v3_best.pth',
                         'emotion_model_v2_best.pth', 'emotion_model.pth']:
                candidate = MODEL_DIR / name
                if candidate.exists():
                    model_path = str(candidate)
                    break

        if model_path is None or not Path(model_path).exists():
            raise FileNotFoundError("Model not found. Train first with: python src/train_emotion.py")

        print(f"📦 Loading emotion model from {Path(model_path).name}...")

        # Auto-detect architecture from state dict
        state = torch.load(model_path, map_location=self.device, weights_only=True)

        # Determine architecture by examining state dict keys
        model = self._create_model_from_state(state)
        model.load_state_dict(state)

        self.model = model.to(self.device)
        self.model.eval()

        # Temporal smoothing buffer (average last N predictions)
        self.prediction_buffer = deque(maxlen=5)

        print("✅ Emotion model loaded!")

    def _create_model_from_state(self, state_dict):
        """Auto-detect and create the correct model architecture from state dict keys."""
        keys = list(state_dict.keys())

        # Check for v3 indicators (has expand_conv, MBConv blocks)
        has_expand_conv = any('expand_conv' in k for k in keys)
        # Check for v2 indicators (has shortcut, ResidualBlock)
        has_shortcut = any('shortcut' in k for k in keys)

        if has_expand_conv:
            # v3 (EfficientNet-style MBConv)
            try:
                import sys
                sys.path.insert(0, str(Path(__file__).resolve().parent))
                from train_emotion_85 import EmotionCNNv3
                print("   Architecture: v3 (EfficientNet + MBConv)")
                return EmotionCNNv3()
            except Exception as e:
                print(f"   Failed to load v3 architecture: {e}")

        if has_shortcut:
            # v2 (Residual + SE blocks)
            try:
                import sys
                sys.path.insert(0, str(Path(__file__).resolve().parent))
                from train_emotion import EmotionCNN
                print("   Architecture: v2 (ResNet + SE)")
                return EmotionCNN()
            except Exception as e:
                print(f"   Failed to load v2 architecture: {e}")

        # Fallback: try both
        try:
            from train_emotion import EmotionCNN
            model = EmotionCNN()
            # Test if state dict is compatible
            model.load_state_dict(state_dict)
            print("   Architecture: v2 (fallback)")
            return model
        except Exception:
            pass

        try:
            from train_emotion_85 import EmotionCNNv3
            model = EmotionCNNv3()
            model.load_state_dict(state_dict)
            print("   Architecture: v3 (fallback)")
            return model
        except Exception:
            pass

        raise RuntimeError("Could not match any model architecture to the checkpoint")

    def predict(self, face_image):
        """
        Predict emotion from preprocessed face image.
        Args: face_image — numpy array (1, 48, 48, 1) normalized [0,1] (OpenCV format)
        Returns: dict with emotion, confidence, all_scores (temporally smoothed)
        """
        if face_image is None:
            return None

        # Convert from (1, H, W, 1) to PyTorch (1, 1, H, W)
        if isinstance(face_image, np.ndarray):
            tensor = torch.FloatTensor(face_image).permute(0, 3, 1, 2).to(self.device)
        else:
            tensor = face_image.to(self.device)

        # Apply the same normalization used during training (mean=0.5, std=0.5)
        # Input face_image is in [0, 1] range from face_detector
        # Training normalization: transforms.Normalize(mean=[0.5], std=[0.5])
        # This maps [0,1] -> [-1,1]
        tensor = (tensor - 0.5) / 0.5

        with torch.no_grad():
            logits = self.model(tensor)
            # Temperature-scaled softmax for better calibration
            probs = F.softmax(logits / TEMPERATURE, dim=1).cpu().numpy()[0]

        # Add to temporal buffer
        self.prediction_buffer.append(probs)

        # Average over recent predictions for stability
        if len(self.prediction_buffer) >= 2:
            # Weighted average: more recent = higher weight
            weights = np.array([0.5 ** (len(self.prediction_buffer) - 1 - i)
                                for i in range(len(self.prediction_buffer))])
            weights /= weights.sum()
            smoothed_probs = np.zeros_like(probs)
            for w, p in zip(weights, self.prediction_buffer):
                smoothed_probs += w * p
            probs = smoothed_probs

        emotion_idx = int(np.argmax(probs))
        emotion = EMOTION_LABELS[emotion_idx]

        return {
            'emotion': emotion,
            'confidence': float(probs[emotion_idx]),
            'emotion_index': emotion_idx,
            'all_scores': {EMOTION_LABELS[i]: float(probs[i]) for i in range(len(EMOTION_LABELS))},
            'color': EMOTION_COLORS.get(emotion, (255, 255, 255))
        }

    def predict_batch(self, face_images):
        """Predict emotions for a batch of face images."""
        if len(face_images) == 0:
            return []

        batch = np.vstack(face_images)
        tensor = torch.FloatTensor(batch).permute(0, 3, 1, 2).to(self.device)

        # Apply the same normalization used during training (mean=0.5, std=0.5)
        tensor = (tensor - 0.5) / 0.5

        with torch.no_grad():
            logits = self.model(tensor)
            probs = F.softmax(logits / TEMPERATURE, dim=1).cpu().numpy()

        results = []
        for pred in probs:
            idx = int(np.argmax(pred))
            emotion = EMOTION_LABELS[idx]
            results.append({
                'emotion': emotion, 'confidence': float(pred[idx]),
                'emotion_index': idx,
                'all_scores': {EMOTION_LABELS[i]: float(pred[i]) for i in range(len(EMOTION_LABELS))},
                'color': EMOTION_COLORS.get(emotion, (255, 255, 255))
            })
        return results

    def reset(self):
        """Reset temporal smoothing buffer (call when starting new session)."""
        self.prediction_buffer.clear()
