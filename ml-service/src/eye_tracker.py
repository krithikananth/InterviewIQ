"""
InterviewIQ — Eye Contact Tracker (Enhanced)
================================================
Tracks eye contact using MediaPipe FaceLandmarker Tasks API for precise
iris/pupil tracking. Falls back to OpenCV heuristic if unavailable.

Key improvements:
- MediaPipe Tasks API FaceLandmarker for real landmark tracking (478 landmarks)
- Iris position ratio for gaze direction estimation
- Exponential moving average for smooth, stable scores
- Proper left/right eye analysis with per-eye gaze scoring
"""

import cv2
import numpy as np
import time
import os


# MediaPipe Face Mesh landmark indices for eyes
# Left eye contour
LEFT_EYE = [362, 385, 387, 263, 373, 380]
# Right eye contour
RIGHT_EYE = [33, 160, 158, 133, 153, 144]
# Left iris center (from FaceLandmarker with output_face_blendshapes)
LEFT_IRIS = [468, 469, 470, 471, 472]
# Right iris center
RIGHT_IRIS = [473, 474, 475, 476, 477]


class EyeTracker:
    """Eye contact tracking using MediaPipe FaceLandmarker + OpenCV fallback."""

    def __init__(self):
        self.available = True
        self.use_mediapipe = False
        self.landmarker = None

        # Try loading MediaPipe Tasks API FaceLandmarker
        try:
            from mediapipe.tasks.python import vision, BaseOptions

            model_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'face_landmarker.task')

            if os.path.exists(model_path):
                options = vision.FaceLandmarkerOptions(
                    base_options=BaseOptions(model_asset_path=model_path),
                    num_faces=1,
                    output_face_blendshapes=False,
                    output_facial_transformation_matrixes=False,
                    min_face_detection_confidence=0.5,
                    min_tracking_confidence=0.5
                )
                self.landmarker = vision.FaceLandmarker.create_from_options(options)
                self.use_mediapipe = True
                print("✅ Eye tracker initialized (MediaPipe FaceLandmarker Tasks API)")
            else:
                print(f"⚠️  FaceLandmarker model not found at {model_path}. Using OpenCV fallback.")
        except Exception as e:
            print(f"⚠️  MediaPipe FaceLandmarker unavailable ({e}). Using OpenCV heuristic.")

        # Load cascades for fallback
        self.eye_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_eye.xml'
        )
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )

        # Tracking state
        self.contact_frames = 0
        self.total_frames = 0
        self.history = []
        self.last_score = 0
        self.last_face_center = None

        # Exponential moving average for smooth scores
        self.ema_score = 50.0  # Start at 50%
        self.ema_alpha = 0.15  # Smoothing factor

        if not self.use_mediapipe:
            print("✅ Eye tracker initialized (OpenCV Heuristic)")

    def process_frame(self, frame):
        """Process a frame and estimate eye contact."""
        self.total_frames += 1

        if self.use_mediapipe:
            return self._process_mediapipe(frame)
        else:
            return self._process_opencv(frame)

    def _process_mediapipe(self, frame):
        """Use MediaPipe FaceLandmarker Tasks API for precise gaze tracking."""
        import mediapipe as mp

        h, w = frame.shape[:2]
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        results = self.landmarker.detect(mp_image)

        if not results.face_landmarks or len(results.face_landmarks) == 0:
            self._update_ema(False)
            return {
                'is_looking': False,
                'score': self._get_ema_score(),
                'gaze_ratio': 0.0,
                'head_centered': False
            }

        landmarks = results.face_landmarks[0]

        # Check if we have iris landmarks (need at least 478 landmarks)
        has_iris = len(landmarks) > 472

        if has_iris:
            # Calculate gaze direction using iris position relative to eye corners
            left_gaze = self._calculate_iris_gaze_tasks(landmarks, LEFT_EYE, LEFT_IRIS, w, h)
            right_gaze = self._calculate_iris_gaze_tasks(landmarks, RIGHT_EYE, RIGHT_IRIS, w, h)

            avg_gaze_x = (left_gaze[0] + right_gaze[0]) / 2
            avg_gaze_y = (left_gaze[1] + right_gaze[1]) / 2

            # Check if looking at camera
            looking_h = 0.25 <= avg_gaze_x <= 0.75
            looking_v = 0.20 <= avg_gaze_y <= 0.80
        else:
            # Fallback: use face orientation from landmarks
            looking_h = True
            looking_v = True
            avg_gaze_x = 0.5
            avg_gaze_y = 0.5

        # Head pose estimation using nose tip
        nose_tip = landmarks[1]
        head_centered_x = 0.2 < nose_tip.x < 0.8
        head_centered_y = 0.15 < nose_tip.y < 0.85

        is_looking = looking_h and looking_v and head_centered_x and head_centered_y

        # Continuous gaze quality score
        gaze_quality_h = 1.0 - abs(avg_gaze_x - 0.5) * 2
        gaze_quality_v = 1.0 - abs(avg_gaze_y - 0.5) * 2
        gaze_quality = max(0, min(1, (gaze_quality_h * 0.6 + gaze_quality_v * 0.4)))

        if is_looking:
            self.contact_frames += 1

        self._update_ema(is_looking, gaze_quality)

        score = self._get_ema_score()
        self.history.append({'time': time.time(), 'looking': is_looking, 'quality': gaze_quality})
        if len(self.history) > 300:
            self.history = self.history[-300:]
        self.last_score = score

        return {
            'is_looking': is_looking,
            'score': score,
            'gaze_ratio': round(gaze_quality, 2),
            'head_centered': head_centered_x and head_centered_y
        }

    def _calculate_iris_gaze_tasks(self, landmarks, eye_indices, iris_indices, img_w, img_h):
        """Calculate iris position relative to eye boundaries using Tasks API landmarks."""
        eye_points = [(landmarks[i].x * img_w, landmarks[i].y * img_h) for i in eye_indices]
        iris_points = [(landmarks[i].x * img_w, landmarks[i].y * img_h) for i in iris_indices
                       if i < len(landmarks)]

        if not iris_points:
            return (0.5, 0.5)

        iris_cx = np.mean([p[0] for p in iris_points])
        iris_cy = np.mean([p[1] for p in iris_points])

        eye_xs = [p[0] for p in eye_points]
        eye_ys = [p[1] for p in eye_points]
        eye_left, eye_right = min(eye_xs), max(eye_xs)
        eye_top, eye_bottom = min(eye_ys), max(eye_ys)

        eye_width = eye_right - eye_left
        eye_height = eye_bottom - eye_top

        if eye_width < 1 or eye_height < 1:
            return (0.5, 0.5)

        h_ratio = (iris_cx - eye_left) / eye_width
        v_ratio = (iris_cy - eye_top) / eye_height

        return (np.clip(h_ratio, 0, 1), np.clip(v_ratio, 0, 1))

    def _process_opencv(self, frame):
        """Fallback: OpenCV-based eye contact estimation."""
        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)

        faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5,
            minSize=(60, 60), flags=cv2.CASCADE_SCALE_IMAGE
        )

        if len(faces) == 0:
            self._update_ema(False)
            return {
                'is_looking': False,
                'score': self._get_ema_score(),
                'gaze_ratio': 0.0,
                'head_centered': False
            }

        x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
        face_cx = (x + fw / 2) / w
        face_cy = (y + fh / 2) / h

        head_centered_x = 0.15 < face_cx < 0.85
        head_centered_y = 0.10 < face_cy < 0.90

        # Detect eyes in upper 60% of face
        eye_region_h = int(fh * 0.6)
        face_roi = gray[y:y + eye_region_h, x:x + fw]
        eyes = self.eye_cascade.detectMultiScale(
            face_roi, scaleFactor=1.1, minNeighbors=3,
            minSize=(15, 15), maxSize=(fw // 2, eye_region_h // 2)
        )

        eyes_detected = len(eyes)
        face_well_centered = 0.30 < face_cx < 0.70 and 0.25 < face_cy < 0.75

        stable = True
        if self.last_face_center is not None:
            dx = abs(face_cx - self.last_face_center[0])
            dy = abs(face_cy - self.last_face_center[1])
            stable = dx < 0.08 and dy < 0.08
        self.last_face_center = (face_cx, face_cy)

        if eyes_detected >= 2 and head_centered_x and head_centered_y:
            is_looking = True
        elif eyes_detected >= 1 and face_well_centered and stable:
            is_looking = True
        elif face_well_centered and stable and head_centered_x:
            is_looking = True
        else:
            is_looking = False

        if is_looking:
            self.contact_frames += 1

        self._update_ema(is_looking)

        score = self._get_ema_score()
        self.history.append({'time': time.time(), 'looking': is_looking})
        if len(self.history) > 300:
            self.history = self.history[-300:]
        self.last_score = score

        return {
            'is_looking': is_looking,
            'score': score,
            'gaze_ratio': 0.5 if is_looking else 0.0,
            'head_centered': head_centered_x and head_centered_y
        }

    def _update_ema(self, is_looking, quality=None):
        """Update exponential moving average score."""
        if quality is not None:
            target = quality * 100
        else:
            target = 100.0 if is_looking else 0.0
        self.ema_score = self.ema_alpha * target + (1 - self.ema_alpha) * self.ema_score

    def _get_ema_score(self):
        return int(max(0, min(100, round(self.ema_score))))

    def _get_running_score(self):
        if self.total_frames == 0:
            return 0
        return int((self.contact_frames / self.total_frames) * 100)

    def get_summary(self):
        return {
            'overall_score': self._get_running_score(),
            'total_frames': self.total_frames,
            'contact_frames': self.contact_frames,
            'contact_percentage': round(self.contact_frames / max(1, self.total_frames) * 100, 1)
        }

    def reset(self):
        self.contact_frames = 0
        self.total_frames = 0
        self.history = []
        self.last_score = 0
        self.last_face_center = None
        self.ema_score = 50.0
