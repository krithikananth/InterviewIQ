"""
InterviewIQ — Face Detection Module
=====================================
Handles face detection and preprocessing using OpenCV.

CRITICAL: extract_face() preprocessing MUST match the training pipeline exactly.
Training uses: Grayscale → Resize(48x48) → ToTensor [0,1]
NO CLAHE, NO histogram equalization, NO extra processing.
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
        print("Face detector initialized (Haar Cascade)")

    def detect_faces(self, frame):
        """Detect faces in a BGR frame. Returns list of (x, y, w, h)."""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # Histogram equalization helps detection (not applied to extracted face)
        eq_gray = cv2.equalizeHist(gray)

        faces = self.face_cascade.detectMultiScale(
            eq_gray, scaleFactor=1.1, minNeighbors=5,
            minSize=(40, 40), flags=cv2.CASCADE_SCALE_IMAGE
        )
        return [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in faces]

    def extract_face(self, frame, bbox, target_size=(48, 48)):
        """
        Extract and preprocess face for emotion model.
        Returns (1, 48, 48, 1) normalized array in [0, 1] range.

        MUST match training exactly:
        - Convert to grayscale
        - Resize to 48x48
        - Normalize to [0, 1]
        - NO CLAHE, NO histogram equalization
        """
        x, y, w, h = bbox

        # Slight padding for context (10%)
        pad = int(min(w, h) * 0.1)
        fh, fw = frame.shape[:2]
        x1 = max(0, x - pad)
        y1 = max(0, y - pad)
        x2 = min(fw, x + w + pad)
        y2 = min(fh, y + h + pad)

        face_roi = frame[y1:y2, x1:x2]
        if face_roi.size == 0:
            return None

        # Convert to grayscale (matches transforms.Grayscale)
        if len(face_roi.shape) == 3:
            gray_face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
        else:
            gray_face = face_roi

        # Resize to 48x48 (matches transforms.Resize)
        gray_face = cv2.resize(gray_face, target_size, interpolation=cv2.INTER_AREA)

        # Normalize to [0, 1] (matches transforms.ToTensor)
        gray_face = gray_face.astype(np.float32) / 255.0

        # Shape: (1, 48, 48, 1)
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
