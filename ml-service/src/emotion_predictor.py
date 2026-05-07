"""
InterviewIQ — Emotion Predictor (PyTorch)
============================================
Loads trained PyTorch CNN model and predicts emotions from face images.
"""

import numpy as np
from pathlib import Path
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


class EmotionPredictor:
    """Predicts facial emotions using trained PyTorch CNN model (v2 or v3)."""

    def __init__(self, model_path=None):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

        if model_path is None:
            # Try to load v3 first (85% target), then v2, then v1
            for name in ['emotion_model_best.pth', 'emotion_model_v3_best.pth', 'emotion_model_v2_best.pth', 'emotion_model.pth']:
                candidate = MODEL_DIR / name
                if candidate.exists():
                    model_path = str(candidate)
                    break

        if model_path is None or not Path(model_path).exists():
            raise FileNotFoundError("Model not found. Train first with train_emotion_85.py")

        print(f"📦 Loading emotion model from {model_path}...")

        # Try loading v3 first, then fall back to v2
        try:
            from train_emotion_85 import EmotionCNNv3
            self.model = EmotionCNNv3()
            print("   (Using v3 architecture - optimized for 85% accuracy)")
        except (ImportError, ModuleNotFoundError):
            try:
                from train_emotion import EmotionCNN
                self.model = EmotionCNN()
                print("   (Using v2 architecture)")
            except ImportError:
                print("   (Using fallback architecture)")
                # Fallback
                from train_emotion import EmotionCNN
                self.model = EmotionCNN()

        state = torch.load(model_path, map_location=self.device, weights_only=True)
        # Handle if it's a full model save vs state_dict
        if isinstance(state, dict) and not any(k.startswith('module.') for k in state.keys()):
            self.model.load_state_dict(state)
        else:
            self.model.load_state_dict(state)

        self.model.to(self.device)
        self.model.eval()
        print("✅ Emotion model loaded!")

    def predict(self, face_image):
        """
        Predict emotion from preprocessed face image.
        Args: face_image — numpy array (1, 48, 48, 1) normalized [0,1] (OpenCV format)
        Returns: dict with emotion, confidence, all_scores
        """
        if face_image is None:
            return None

        # Convert from (1, H, W, 1) to PyTorch (1, 1, H, W)
        if isinstance(face_image, np.ndarray):
            tensor = torch.FloatTensor(face_image).permute(0, 3, 1, 2).to(self.device)
        else:
            tensor = face_image.to(self.device)

        # Apply the same normalization used during training (mean=0.5, std=0.5)
        tensor = (tensor - 0.5) / 0.5

        with torch.no_grad():
            logits = self.model(tensor)
            probs = F.softmax(logits, dim=1).cpu().numpy()[0]

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
            probs = F.softmax(logits, dim=1).cpu().numpy()

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
