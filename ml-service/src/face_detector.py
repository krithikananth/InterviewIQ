"""
InterviewIQ — Face Detection Module (Enhanced)
=================================================
Handles face detection and preprocessing using OpenCV.

Key improvements:
- Dynamic target size (matches training resolution)
- Better CLAHE preprocessing for consistent contrast
- Proper face padding with boundary checks
- Histogram equalization for detection in poor lighting
"""

import cv2
import numpy as np


class FaceDetector:
    """Face detector using OpenCV Haar Cascade with enhanced preprocessing."""

    def __init__(self):
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        self.face_cascade = cv2.CascadeClassifier(cascade_path)
        if self.face_cascade.empty():
            raise RuntimeError(f"Failed to load Haar Cascade from {cascade_path}")

        # CLAHE for consistent contrast normalization
        self.clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(4, 4))
        print("✅ Face detector initialized (Haar Cascade)")

    def detect_faces(self, frame):
        """Detect faces in a BGR frame. Returns list of (x, y, w, h)."""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # Apply histogram equalization for better detection in varied lighting
        gray = cv2.equalizeHist(gray)

        faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5,
            minSize=(40, 40), flags=cv2.CASCADE_SCALE_IMAGE
        )
        return [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in faces]

    def extract_face(self, frame, bbox, target_size=(48, 48)):
        """
        Extract and preprocess face for emotion model.
        Returns (1, target_size, target_size, 1) normalized array in [0, 1] range.

        The target_size should match the model's training resolution.
        Default is 48x48 to match FER-2013 dataset resolution.
        """
        x, y, w, h = bbox

        # Add padding around face (10% on each side) for context
        pad_x = int(w * 0.1)
        pad_y = int(h * 0.1)
        fh, fw = frame.shape[:2]
        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y)
        x2 = min(fw, x + w + pad_x)
        y2 = min(fh, y + h + pad_y)

        face_roi = frame[y1:y2, x1:x2]
        if face_roi.size == 0:
            return None

        # Convert to grayscale
        if len(face_roi.shape) == 3:
            gray_face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
        else:
            gray_face = face_roi

        # Apply CLAHE for consistent contrast (matches training preprocessing)
        gray_face = self.clahe.apply(gray_face)

        # Resize to target size using INTER_AREA (best for downsampling)
        gray_face = cv2.resize(gray_face, target_size, interpolation=cv2.INTER_AREA)

        # Normalize to [0, 1] range
        gray_face = gray_face.astype(np.float32) / 255.0

        # Return as (1, H, W, 1) for batch processing
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
