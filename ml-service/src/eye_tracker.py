"""
InterviewIQ — Eye Contact Tracker
====================================
Tracks eye contact using head position analysis.
Uses MediaPipe if available, otherwise falls back to OpenCV Haar Cascade.

The OpenCV fallback is designed to be generous and stable:
- Face centered + visible = likely looking at camera
- EMA smoothing prevents score flickering
"""

import cv2
import numpy as np
import time
import os


class EyeTracker:
    """Eye contact tracking using face analysis."""

    def __init__(self):
        self.use_mediapipe = False
        self.landmarker = None

        # Try loading MediaPipe FaceLandmarker
        try:
            from mediapipe.tasks.python import vision, BaseOptions
            import mediapipe as mp

            model_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'face_landmarker.task')

            # Auto-download if missing
            if not os.path.exists(model_path):
                try:
                    import urllib.request
                    os.makedirs(os.path.dirname(model_path), exist_ok=True)
                    url = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
                    print("Downloading face_landmarker model...")
                    urllib.request.urlretrieve(url, model_path)
                    print(f"Downloaded ({os.path.getsize(model_path) // 1024}KB)")
                except Exception as e:
                    print(f"Could not download face model: {e}")

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
                print("Eye tracker: MediaPipe FaceLandmarker")
        except Exception as e:
            print(f"MediaPipe unavailable: {e}")

        # OpenCV cascades (always loaded as fallback)
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        self.eye_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_eye.xml'
        )

        if not self.use_mediapipe:
            print("Eye tracker: OpenCV Haar Cascade (fallback)")

        # State
        self.contact_frames = 0
        self.total_frames = 0
        self.history = []
        self.last_score = 0
        self.last_face_center = None
        self.ema_score = 50.0
        self.ema_alpha = 0.12

    def process_frame(self, frame):
        """Process a video frame and return eye contact estimation."""
        self.total_frames += 1

        if self.use_mediapipe and self.landmarker:
            return self._process_mediapipe(frame)
        return self._process_opencv(frame)

    def _process_mediapipe(self, frame):
        """MediaPipe-based gaze tracking with iris landmarks."""
        import mediapipe as mp

        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

        try:
            results = self.landmarker.detect(mp_img)
        except Exception:
            return self._process_opencv(frame)

        if not results.face_landmarks or len(results.face_landmarks) == 0:
            self._update_ema(False)
            return self._make_result(False)

        lm = results.face_landmarks[0]

        # Nose tip for head pose
        nose = lm[1]
        head_ok = 0.2 < nose.x < 0.8 and 0.15 < nose.y < 0.85

        # Iris landmarks (468-477) for gaze if available
        if len(lm) > 472:
            # Left eye: contour [362,385,387,263,373,380], iris [468-472]
            # Right eye: contour [33,160,158,133,153,144], iris [473-477]
            lg = self._iris_ratio(lm, [362, 385, 387, 263, 373, 380], [468, 469, 470, 471, 472], w, h)
            rg = self._iris_ratio(lm, [33, 160, 158, 133, 153, 144], [473, 474, 475, 476, 477], w, h)
            gx = (lg[0] + rg[0]) / 2
            gy = (lg[1] + rg[1]) / 2
            looking = 0.25 <= gx <= 0.75 and 0.2 <= gy <= 0.8 and head_ok
        else:
            looking = head_ok

        if looking:
            self.contact_frames += 1
        self._update_ema(looking)
        return self._make_result(looking)

    def _iris_ratio(self, lm, eye_idx, iris_idx, w, h):
        """Calculate iris position as ratio within eye boundaries."""
        eye_pts = [(lm[i].x * w, lm[i].y * h) for i in eye_idx]
        iris_pts = [(lm[i].x * w, lm[i].y * h) for i in iris_idx if i < len(lm)]

        if not iris_pts:
            return (0.5, 0.5)

        ix = np.mean([p[0] for p in iris_pts])
        iy = np.mean([p[1] for p in iris_pts])

        xs = [p[0] for p in eye_pts]
        ys = [p[1] for p in eye_pts]
        ew = max(xs) - min(xs)
        eh = max(ys) - min(ys)

        if ew < 1 or eh < 1:
            return (0.5, 0.5)

        return (np.clip((ix - min(xs)) / ew, 0, 1),
                np.clip((iy - min(ys)) / eh, 0, 1))

    def _process_opencv(self, frame):
        """OpenCV fallback: face position + eye detection heuristic."""
        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)

        faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5,
            minSize=(50, 50), flags=cv2.CASCADE_SCALE_IMAGE
        )

        if len(faces) == 0:
            self._update_ema(False)
            return self._make_result(False)

        # Largest face
        x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
        cx = (x + fw / 2) / w
        cy = (y + fh / 2) / h

        centered = 0.2 < cx < 0.8 and 0.15 < cy < 0.85
        well_centered = 0.3 < cx < 0.7 and 0.25 < cy < 0.75

        # Check movement stability
        stable = True
        if self.last_face_center:
            dx = abs(cx - self.last_face_center[0])
            dy = abs(cy - self.last_face_center[1])
            stable = dx < 0.08 and dy < 0.08
        self.last_face_center = (cx, cy)

        # Eye detection in upper face
        roi_h = int(fh * 0.6)
        roi = gray[y:y + roi_h, x:x + fw]
        eyes = self.eye_cascade.detectMultiScale(
            roi, scaleFactor=1.1, minNeighbors=3,
            minSize=(12, 12), maxSize=(fw // 2, roi_h // 2)
        )
        n_eyes = len(eyes)

        # Decision logic — generous to avoid false negatives
        if n_eyes >= 2 and centered:
            looking = True
        elif n_eyes >= 1 and well_centered and stable:
            looking = True
        elif well_centered and stable:
            looking = True  # Face centered and stable = probably looking
        else:
            looking = False

        if looking:
            self.contact_frames += 1
        self._update_ema(looking)
        return self._make_result(looking)

    def _update_ema(self, looking):
        target = 100.0 if looking else 0.0
        self.ema_score = self.ema_alpha * target + (1 - self.ema_alpha) * self.ema_score

    def _make_result(self, looking):
        score = int(max(0, min(100, round(self.ema_score))))
        self.history.append({'time': time.time(), 'looking': looking})
        if len(self.history) > 300:
            self.history = self.history[-300:]
        self.last_score = score
        return {
            'is_looking': looking,
            'score': score,
            'gaze_ratio': 0.5 if looking else 0.0,
            'head_centered': looking
        }

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
