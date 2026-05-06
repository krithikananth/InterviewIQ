"""
InterviewIQ — Eye Contact Tracker
====================================
Tracks eye contact using head position heuristics.
Falls back from MediaPipe to OpenCV-based approach.
"""

import cv2
import numpy as np
import time


class EyeTracker:
    """Eye contact tracking using face position heuristics and optional MediaPipe."""

    def __init__(self):
        self.available = True
        self.use_mediapipe = False

        # Try loading MediaPipe tasks API
        try:
            import mediapipe as mp
            from mediapipe.tasks import python as mp_python
            from mediapipe.tasks.python import vision

            # Check if face landmarker model exists
            import os
            model_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'face_landmarker.task')
            if os.path.exists(model_path):
                options = vision.FaceLandmarkerOptions(
                    base_options=mp_python.BaseOptions(model_asset_path=model_path),
                    num_faces=1,
                    output_face_blendshapes=False
                )
                self.landmarker = vision.FaceLandmarker.create_from_options(options)
                self.use_mediapipe = True
                print("✅ Eye tracker initialized (MediaPipe Tasks)")
            else:
                print("⚠️  MediaPipe model not found. Using OpenCV heuristic eye tracking.")
        except Exception as e:
            print(f"⚠️  MediaPipe unavailable ({e}). Using OpenCV heuristic eye tracking.")

        # Load eye cascade for fallback
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
        print("✅ Eye tracker initialized (OpenCV Heuristic)")

    def process_frame(self, frame):
        """
        Process a frame and estimate eye contact.
        Uses face position centering + eye detection as proxy for eye contact.
        """
        self.total_frames += 1
        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Detect face
        faces = self.face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(30, 30))

        if len(faces) == 0:
            return {
                'is_looking': False,
                'score': self._get_running_score(),
                'gaze_ratio': 0.0,
                'head_centered': False
            }

        # Use largest face
        x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
        face_cx = (x + fw / 2) / w
        face_cy = (y + fh / 2) / h

        # Check if face is centered (proxy for looking at camera)
        head_centered_x = 0.25 < face_cx < 0.75
        head_centered_y = 0.2 < face_cy < 0.8

        # Detect eyes within face region
        face_roi = gray[y:y+fh, x:x+fw]
        eyes = self.eye_cascade.detectMultiScale(face_roi, 1.1, 3, minSize=(15, 15))
        eyes_detected = len(eyes) >= 2  # Both eyes visible = likely looking at camera

        # Check face stability (not moving too fast)
        stable = True
        if self.last_face_center is not None:
            dx = abs(face_cx - self.last_face_center[0])
            dy = abs(face_cy - self.last_face_center[1])
            stable = dx < 0.05 and dy < 0.05
        self.last_face_center = (face_cx, face_cy)

        # Determine eye contact
        is_looking = head_centered_x and head_centered_y and eyes_detected

        if is_looking:
            self.contact_frames += 1

        score = self._get_running_score()
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
