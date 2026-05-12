"""
InterviewIQ — Emotion Predictor (PyTorch)
============================================
Loads trained PyTorch CNN model and predicts emotions from face images.

CRITICAL: The training pipeline uses ONLY transforms.ToTensor() which maps
pixel values to [0, 1] range. There is NO Normalize(mean, std) applied.
Therefore inference must also use [0, 1] range — no extra normalization.
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

# Temperature for softmax calibration (>1 = softer predictions, prevents overconfidence)
TEMPERATURE = 1.8


class EmotionPredictor:
    """Predicts facial emotions using trained PyTorch CNN model with temporal smoothing."""

    def __init__(self, model_path=None):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

        if model_path is None:
            for name in ['emotion_model_best.pth', 'emotion_model_v2_best.pth',
                         'emotion_model.pth']:
                candidate = MODEL_DIR / name
                if candidate.exists():
                    model_path = str(candidate)
                    break

        if model_path is None or not Path(model_path).exists():
            raise FileNotFoundError("Model not found. Train first with: python src/train_emotion.py")

        print(f"Loading emotion model from {Path(model_path).name}...")

        # Load state dict
        state = torch.load(model_path, map_location=self.device, weights_only=True)

        # Auto-detect and create model architecture
        model = self._create_model_from_state(state)
        model.load_state_dict(state)

        self.model = model.to(self.device)
        self.model.eval()

        # Temporal smoothing buffer (average last N predictions for stability)
        self.prediction_buffer = deque(maxlen=7)

        print("Emotion model loaded successfully!")

    def _create_model_from_state(self, state_dict):
        """Auto-detect and create the correct model architecture from state dict keys."""
        keys = list(state_dict.keys())

        # Check for v2 indicators (has stem, stage1, shortcut — ResidualBlock + SE)
        has_stem = any('stem' in k for k in keys)
        has_shortcut = any('shortcut' in k for k in keys)

        if has_stem and has_shortcut:
            try:
                import sys
                sys.path.insert(0, str(Path(__file__).resolve().parent))
                from train_emotion import EmotionCNNv2
                print("   Architecture: v2 (ResNet + SE)")
                return EmotionCNNv2()
            except ImportError:
                # If EmotionCNNv2 not found, try EmotionCNN alias
                try:
                    from train_emotion import EmotionCNN
                    print("   Architecture: v2 (via EmotionCNN alias)")
                    return EmotionCNN()
                except Exception as e:
                    print(f"   Failed to import model class: {e}")

        # Generic fallback: try importing whatever is available
        try:
            from train_emotion import EmotionCNN
            model = EmotionCNN()
            model.load_state_dict(state_dict)
            print("   Architecture: detected via fallback")
            return model
        except Exception:
            pass

        raise RuntimeError("Could not match any model architecture to the checkpoint")

    def predict(self, face_image):
        """
        Predict emotion from preprocessed face image.
        
        Args: face_image — numpy array (1, 48, 48, 1) normalized to [0, 1]
              (this matches the training pipeline which uses only ToTensor())
        
        Returns: dict with emotion, confidence, all_scores
        """
        if face_image is None:
            return None

        # Convert from (1, H, W, 1) to PyTorch (1, 1, H, W)
        if isinstance(face_image, np.ndarray):
            tensor = torch.FloatTensor(face_image).permute(0, 3, 1, 2).to(self.device)
        else:
            tensor = face_image.to(self.device)

        # IMPORTANT: Do NOT apply any additional normalization!
        # The training pipeline uses only transforms.ToTensor() which maps to [0, 1]
        # The face_detector already outputs [0, 1] normalized images
        # Adding (tensor - 0.5) / 0.5 would corrupt the input and cause "surprise" bias

        with torch.no_grad():
            logits = self.model(tensor)
            # Temperature-scaled softmax for better calibration
            probs = F.softmax(logits / TEMPERATURE, dim=1).cpu().numpy()[0]

        # Add to temporal buffer for smoothing
        self.prediction_buffer.append(probs)

        # Weighted average over recent predictions for stability
        if len(self.prediction_buffer) >= 2:
            weights = np.array([0.6 ** (len(self.prediction_buffer) - 1 - i)
                                for i in range(len(self.prediction_buffer))])
            weights /= weights.sum()
            smoothed = np.zeros_like(probs)
            for w, p in zip(weights, self.prediction_buffer):
                smoothed += w * p
            probs = smoothed

        emotion_idx = int(np.argmax(probs))
        emotion = EMOTION_LABELS[emotion_idx]

        return {
            'emotion': emotion,
            'confidence': float(probs[emotion_idx]),
            'emotion_index': emotion_idx,
            'all_scores': {EMOTION_LABELS[i]: round(float(probs[i]), 4) for i in range(len(EMOTION_LABELS))},
            'color': EMOTION_COLORS.get(emotion, (255, 255, 255))
        }

    def predict_batch(self, face_images):
        """Predict emotions for a batch of face images."""
        if len(face_images) == 0:
            return []

        batch = np.vstack(face_images)
        tensor = torch.FloatTensor(batch).permute(0, 3, 1, 2).to(self.device)
        # No extra normalization — input is already [0, 1]

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
                'all_scores': {EMOTION_LABELS[i]: round(float(pred[i]), 4) for i in range(len(EMOTION_LABELS))},
                'color': EMOTION_COLORS.get(emotion, (255, 255, 255))
            })
        return results

    def reset(self):
        """Reset temporal smoothing buffer (call when starting new session)."""
        self.prediction_buffer.clear()
