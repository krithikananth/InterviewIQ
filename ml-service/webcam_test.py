"""
InterviewIQ — Real-Time Webcam Test
======================================
Runs the full pipeline: face detection → emotion prediction → eye tracking → confidence scoring
All displayed live on webcam feed.

Controls:
  Q - Quit
  R - Reset scores
  S - Screenshot
"""

import cv2
import sys
import time
import json
import numpy as np
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'src'))
from face_detector import FaceDetector
from emotion_predictor import EmotionPredictor
from eye_tracker import EyeTracker
from confidence_scorer import ConfidenceScorer

# Colors
BG_COLOR = (30, 30, 30)
TEXT_COLOR = (255, 255, 255)
GREEN = (0, 200, 0)
RED = (0, 0, 200)
YELLOW = (0, 200, 200)
CYAN = (200, 200, 0)

BASE_DIR = Path(__file__).resolve().parent


def draw_dashboard(frame, emotion_result, eye_result, confidence_result):
    """Draw an overlay dashboard on the frame."""
    h, w = frame.shape[:2]
    
    # Semi-transparent overlay panel on the right
    panel_w = 280
    overlay = frame.copy()
    cv2.rectangle(overlay, (w - panel_w, 0), (w, h), BG_COLOR, -1)
    cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)
    
    x_start = w - panel_w + 15
    y = 30

    # Title
    cv2.putText(frame, "InterviewIQ", (x_start, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, CYAN, 2)
    y += 35

    # Emotion section
    cv2.putText(frame, "EMOTION", (x_start, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, YELLOW, 1)
    y += 25
    if emotion_result:
        emotion = emotion_result['emotion'].upper()
        conf = emotion_result['confidence'] * 100
        color = emotion_result.get('color', TEXT_COLOR)
        cv2.putText(frame, f"{emotion}", (x_start, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        y += 22
        cv2.putText(frame, f"Confidence: {conf:.1f}%", (x_start, y), cv2.FONT_HERSHEY_SIMPLEX, 0.45, TEXT_COLOR, 1)
        y += 25

        # Mini bar chart for emotions
        if 'all_scores' in emotion_result:
            for em, score in sorted(emotion_result['all_scores'].items(), key=lambda x: -x[1])[:4]:
                bar_w = int(score * 150)
                cv2.rectangle(frame, (x_start, y - 8), (x_start + bar_w, y + 2), CYAN, -1)
                cv2.putText(frame, f"{em[:3]} {score*100:.0f}%", (x_start + bar_w + 5, y), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.35, TEXT_COLOR, 1)
                y += 18
    y += 15

    # Eye contact section
    cv2.putText(frame, "EYE CONTACT", (x_start, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, YELLOW, 1)
    y += 25
    if eye_result:
        looking = eye_result.get('is_looking', False)
        score = eye_result.get('score', 0)
        status = "LOOKING" if looking else "AWAY"
        status_color = GREEN if looking else RED
        cv2.putText(frame, status, (x_start, y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 2)
        y += 22
        cv2.putText(frame, f"Score: {score}%", (x_start, y), cv2.FONT_HERSHEY_SIMPLEX, 0.45, TEXT_COLOR, 1)
        # Progress bar
        y += 15
        bar_bg_w = 200
        bar_fill = int(score / 100 * bar_bg_w)
        cv2.rectangle(frame, (x_start, y), (x_start + bar_bg_w, y + 8), (50, 50, 50), -1)
        bar_color = GREEN if score > 60 else YELLOW if score > 30 else RED
        cv2.rectangle(frame, (x_start, y), (x_start + bar_fill, y + 8), bar_color, -1)
    y += 25

    # Confidence section
    cv2.putText(frame, "CONFIDENCE", (x_start, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, YELLOW, 1)
    y += 25
    if confidence_result:
        overall = confidence_result['overall_score']
        cv2.putText(frame, f"{overall:.0f}/100", (x_start, y), cv2.FONT_HERSHEY_SIMPLEX, 0.8, 
                    GREEN if overall > 60 else YELLOW if overall > 35 else RED, 2)
        y += 25
        # Component scores
        for comp, val in confidence_result.get('components', {}).items():
            label = comp.replace('_', ' ').title()[:15]
            cv2.putText(frame, f"{label}: {val:.0f}", (x_start, y), cv2.FONT_HERSHEY_SIMPLEX, 0.35, TEXT_COLOR, 1)
            y += 16

    # FPS and controls at bottom
    y = h - 40
    cv2.putText(frame, "Q:Quit  R:Reset  S:Screenshot", (x_start, y), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (150, 150, 150), 1)

    return frame


def main():
    print("=" * 60)
    print("🎥 InterviewIQ — Real-Time Webcam Analysis")
    print("=" * 60)

    # Initialize modules
    print("\n🔧 Initializing modules...")
    face_detector = FaceDetector()
    emotion_predictor = EmotionPredictor()
    eye_tracker = EyeTracker()
    confidence_scorer = ConfidenceScorer()

    # Open webcam
    print("📷 Opening webcam...")
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("❌ Cannot open webcam!")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    frame_count = 0
    skip_frames = 2  # Process every Nth frame for performance
    fps_time = time.time()
    fps = 0

    emotion_result = None
    eye_result = None
    confidence_result = None

    print("✅ Running! Press Q to quit.\n")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)  # Mirror
        frame_count += 1

        # Calculate FPS
        if frame_count % 30 == 0:
            fps = 30 / (time.time() - fps_time + 0.001)
            fps_time = time.time()

        # Process every Nth frame for performance
        if frame_count % skip_frames == 0:
            # Face detection
            faces = face_detector.detect_faces(frame)

            if faces:
                # Use largest face
                largest = max(faces, key=lambda f: f[2] * f[3])

                # Extract face for emotion model
                face_img = face_detector.extract_face(frame, largest)
                if face_img is not None:
                    emotion_result = emotion_predictor.predict(face_img)

                # Eye tracking
                eye_result = eye_tracker.process_frame(frame)

                # Update confidence scorer
                confidence_scorer.update(emotion_result, eye_result, largest)
                confidence_result = confidence_scorer.calculate_score()

                # Draw face box with emotion label
                label = f"{emotion_result['emotion']} ({emotion_result['confidence']*100:.0f}%)" if emotion_result else ""
                color = emotion_result.get('color', GREEN) if emotion_result else GREEN
                face_detector.draw_face_box(frame, largest, label, color)
            else:
                eye_result = eye_tracker.process_frame(frame)

        # Draw dashboard
        frame = draw_dashboard(frame, emotion_result, eye_result, confidence_result)

        # FPS counter
        cv2.putText(frame, f"FPS: {fps:.0f}", (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, GREEN, 2)

        # Show frame
        cv2.imshow('InterviewIQ - Webcam Analysis', frame)

        # Key controls
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('r'):
            confidence_scorer.reset()
            eye_tracker.reset()
            print("🔄 Scores reset!")
        elif key == ord('s'):
            screenshot_path = str(BASE_DIR / f'screenshot_{int(time.time())}.png')
            cv2.imwrite(screenshot_path, frame)
            print(f"📸 Screenshot saved: {screenshot_path}")

    # Cleanup
    cap.release()
    cv2.destroyAllWindows()

    # Print final report
    print("\n" + "=" * 60)
    print("📊 SESSION REPORT")
    print("=" * 60)
    final_score = confidence_scorer.calculate_score()
    print(f"   Overall Confidence: {final_score['overall_score']:.0f}/100")
    print(f"   Duration: {final_score['duration_seconds']:.0f}s")
    print(f"   Dominant Emotion: {confidence_scorer.get_dominant_emotion()}")
    print(f"\n   Component Scores:")
    for comp, val in final_score['components'].items():
        print(f"     {comp.replace('_', ' ').title()}: {val:.0f}/100")
    
    # Recommendations
    print(f"\n   💡 Recommendations:")
    for rec in confidence_scorer.get_recommendations():
        print(f"     • {rec['area']}: {rec['tip']}")

    # Save report
    report = {
        'score': final_score,
        'dominant_emotion': confidence_scorer.get_dominant_emotion(),
        'emotion_timeline': confidence_scorer.get_emotion_timeline(),
        'eye_contact': eye_tracker.get_summary(),
        'recommendations': confidence_scorer.get_recommendations()
    }
    report_path = BASE_DIR / f'session_report_{int(time.time())}.json'
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"\n   💾 Report saved: {report_path}")


if __name__ == '__main__':
    main()
