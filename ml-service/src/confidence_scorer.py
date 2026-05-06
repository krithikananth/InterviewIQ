"""
InterviewIQ — Confidence Scoring System
==========================================
Calculates interview confidence score using multiple signals:
- Eye contact percentage
- Dominant emotions & stability
- Face movement stability
- Smile frequency

Score range: 0-100
"""

import numpy as np
from collections import deque
import time


# Emotion weights for confidence (positive emotions boost score)
EMOTION_CONFIDENCE_WEIGHTS = {
    'happy': 0.85,
    'surprise': 0.60,
    'neutral': 0.70,
    'sad': 0.25,
    'angry': 0.20,
    'fear': 0.15,
    'disgust': 0.10
}


class ConfidenceScorer:
    """Calculates real-time confidence score from multiple behavioral signals."""

    def __init__(self, window_size=150):
        """
        Args:
            window_size: number of frames to consider for rolling calculations
        """
        self.window_size = window_size
        self.emotion_history = deque(maxlen=window_size)
        self.eye_contact_history = deque(maxlen=window_size)
        self.face_position_history = deque(maxlen=window_size)
        self.smile_count = 0
        self.total_frames = 0
        self.start_time = time.time()

    def update(self, emotion_result, eye_result, face_bbox=None):
        """
        Update confidence scorer with new frame data.

        Args:
            emotion_result: dict from EmotionPredictor.predict()
            eye_result: dict from EyeTracker.process_frame()
            face_bbox: (x, y, w, h) face bounding box
        """
        self.total_frames += 1

        if emotion_result:
            self.emotion_history.append(emotion_result)
            if emotion_result['emotion'] == 'happy' and emotion_result['confidence'] > 0.5:
                self.smile_count += 1

        if eye_result:
            self.eye_contact_history.append(eye_result.get('is_looking', False))

        if face_bbox:
            cx = face_bbox[0] + face_bbox[2] / 2
            cy = face_bbox[1] + face_bbox[3] / 2
            self.face_position_history.append((cx, cy))

    def calculate_score(self):
        """
        Calculate overall confidence score (0-100).

        Components:
        - Eye contact score (30% weight)
        - Emotion positivity score (30% weight)
        - Emotion stability score (20% weight)
        - Movement stability score (10% weight)
        - Smile frequency score (10% weight)
        """
        scores = {}

        # 1. Eye contact score (30%)
        if self.eye_contact_history:
            contact_ratio = sum(self.eye_contact_history) / len(self.eye_contact_history)
            scores['eye_contact'] = contact_ratio * 100
        else:
            scores['eye_contact'] = 50

        # 2. Emotion positivity score (30%)
        if self.emotion_history:
            emotion_scores = []
            for e in self.emotion_history:
                weight = EMOTION_CONFIDENCE_WEIGHTS.get(e['emotion'], 0.5)
                emotion_scores.append(weight * e['confidence'])
            scores['emotion_positivity'] = np.mean(emotion_scores) * 100
        else:
            scores['emotion_positivity'] = 50

        # 3. Emotion stability score (20%)
        if len(self.emotion_history) > 10:
            emotions = [e['emotion'] for e in self.emotion_history]
            changes = sum(1 for i in range(1, len(emotions)) if emotions[i] != emotions[i-1])
            change_rate = changes / len(emotions)
            scores['emotion_stability'] = max(0, (1 - change_rate * 2)) * 100
        else:
            scores['emotion_stability'] = 50

        # 4. Movement stability score (10%)
        if len(self.face_position_history) > 10:
            positions = list(self.face_position_history)
            movements = []
            for i in range(1, len(positions)):
                dx = positions[i][0] - positions[i-1][0]
                dy = positions[i][1] - positions[i-1][1]
                movements.append(np.sqrt(dx**2 + dy**2))
            avg_movement = np.mean(movements)
            scores['movement_stability'] = max(0, min(100, 100 - avg_movement * 2))
        else:
            scores['movement_stability'] = 50

        # 5. Smile frequency score (10%)
        if self.total_frames > 0:
            smile_ratio = self.smile_count / self.total_frames
            scores['smile_frequency'] = min(100, smile_ratio * 300)
        else:
            scores['smile_frequency'] = 50

        # Weighted average
        weights = {
            'eye_contact': 0.30,
            'emotion_positivity': 0.30,
            'emotion_stability': 0.20,
            'movement_stability': 0.10,
            'smile_frequency': 0.10
        }

        overall = sum(scores[k] * weights[k] for k in weights)
        overall = max(0, min(100, overall))

        return {
            'overall_score': round(overall, 1),
            'components': {k: round(v, 1) for k, v in scores.items()},
            'weights': weights,
            'total_frames': self.total_frames,
            'duration_seconds': round(time.time() - self.start_time, 1)
        }

    def get_dominant_emotion(self):
        """Get the most frequent emotion in the session."""
        if not self.emotion_history:
            return 'neutral'
        emotions = [e['emotion'] for e in self.emotion_history]
        from collections import Counter
        return Counter(emotions).most_common(1)[0][0]

    def get_emotion_timeline(self):
        """Get emotion distribution over time for charts."""
        if not self.emotion_history:
            return {}
        emotions = [e['emotion'] for e in self.emotion_history]
        from collections import Counter
        counts = Counter(emotions)
        total = len(emotions)
        return {k: round(v / total * 100, 1) for k, v in counts.items()}

    def get_recommendations(self):
        """Generate interview improvement recommendations."""
        score = self.calculate_score()
        recommendations = []
        components = score['components']

        if components['eye_contact'] < 50:
            recommendations.append({
                'area': 'Eye Contact',
                'score': components['eye_contact'],
                'tip': 'Try to maintain more consistent eye contact with the camera. Look at the webcam lens, not the screen.'
            })

        if components['emotion_positivity'] < 40:
            recommendations.append({
                'area': 'Facial Expression',
                'score': components['emotion_positivity'],
                'tip': 'Try to appear more positive and engaged. Practice a natural, relaxed smile.'
            })

        if components['emotion_stability'] < 40:
            recommendations.append({
                'area': 'Emotional Consistency',
                'score': components['emotion_stability'],
                'tip': 'Your expressions changed frequently. Try to maintain a calm, composed demeanor.'
            })

        if components['movement_stability'] < 40:
            recommendations.append({
                'area': 'Physical Composure',
                'score': components['movement_stability'],
                'tip': 'You moved around quite a bit. Try to stay centered in frame with minimal fidgeting.'
            })

        if components['smile_frequency'] < 30:
            recommendations.append({
                'area': 'Approachability',
                'score': components['smile_frequency'],
                'tip': 'Consider smiling more naturally during the interview to appear warmer and more approachable.'
            })

        if not recommendations:
            recommendations.append({
                'area': 'Overall',
                'score': score['overall_score'],
                'tip': 'Great job! Your interview presence is strong across all measured areas.'
            })

        return recommendations

    def reset(self):
        """Reset all tracking state."""
        self.emotion_history.clear()
        self.eye_contact_history.clear()
        self.face_position_history.clear()
        self.smile_count = 0
        self.total_frames = 0
        self.start_time = time.time()
