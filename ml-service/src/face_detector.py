"""
InterviewIQ — Face Detection Module
=====================================
Handles face detection using OpenCV's Haar Cascade.
"""

import cv2
import numpy as np


class FaceDetector:
    """Face detector using OpenCV Haar Cascade."""

    def __init__(self):
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        self.face_cascade = cv2.CascadeClassifier(cascade_path)
        if self.face_cascade.empty():
            raise RuntimeError(f"Failed to load Haar Cascade from {cascade_path}")
        print("✅ Face detector initialized (Haar Cascade)")

    def detect_faces(self, frame):
        """Detect faces in a BGR frame. Returns list of (x, y, w, h)."""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5,
            minSize=(30, 30), flags=cv2.CASCADE_SCALE_IMAGE
        )
        return [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in faces]

    def extract_face(self, frame, bbox, target_size=(64, 64)):
        """Extract and preprocess face for emotion model. Returns (1,64,64,1) normalized array."""
        x, y, w, h = bbox
        pad_x, pad_y = int(w * 0.1), int(h * 0.1)
        fh, fw = frame.shape[:2]
        x1, y1 = max(0, x - pad_x), max(0, y - pad_y)
        x2, y2 = min(fw, x + w + pad_x), min(fh, y + h + pad_y)
        face_roi = frame[y1:y2, x1:x2]
        if face_roi.size == 0:
            return None
        gray_face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray_face = clahe.apply(gray_face)
        gray_face = cv2.resize(gray_face, target_size, interpolation=cv2.INTER_AREA)
        gray_face = gray_face.astype(np.float32) / 255.0
        return np.expand_dims(np.expand_dims(gray_face, axis=-1), axis=0)

    def draw_face_box(self, frame, bbox, label='', color=(0, 255, 0), thickness=2):
        """Draw bounding box and label on frame."""
        x, y, w, h = bbox
        cv2.rectangle(frame, (x, y), (x + w, y + h), color, thickness)
        if label:
            lsz = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0]
            cv2.rectangle(frame, (x, y - lsz[1] - 10), (x + lsz[0] + 10, y), color, -1)
            cv2.putText(frame, label, (x + 5, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
        return frame
