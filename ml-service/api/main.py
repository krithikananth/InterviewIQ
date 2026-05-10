"""
InterviewIQ — FastAPI ML Service (PyTorch)
============================================
REST API + WebSocket for real-time emotion detection and confidence scoring.
"""

import os
import sys
import base64
import time
import json
import numpy as np
import cv2
from pathlib import Path
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'src'))
from face_detector import FaceDetector
from emotion_predictor import EmotionPredictor
from eye_tracker import EyeTracker
from confidence_scorer import ConfidenceScorer

app = FastAPI(title="InterviewIQ ML Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

face_detector = None
emotion_predictor = None
eye_tracker = None
sessions = {}


class FrameInput(BaseModel):
    image: str
    session_id: Optional[str] = "default"


@app.on_event("startup")
async def startup():
    global face_detector, emotion_predictor, eye_tracker
    print("Loading ML models...")
    face_detector = FaceDetector()
    emotion_predictor = EmotionPredictor()
    eye_tracker = EyeTracker()
    print("All models loaded!")


@app.get("/")
async def root():
    return {"service": "InterviewIQ ML Service", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy", "models_loaded": all([face_detector, emotion_predictor, eye_tracker])}


@app.post("/api/analyze-frame")
async def analyze_frame(data: FrameInput):
    try:
        img_bytes = base64.b64decode(data.image.split(',')[-1] if ',' in data.image else data.image)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid image")

        sid = data.session_id
        if sid not in sessions:
            sessions[sid] = ConfidenceScorer()

        faces = face_detector.detect_faces(frame)
        result = {"face_detected": False, "emotion": None, "eye_contact": None, "confidence": None}

        if faces:
            largest = max(faces, key=lambda f: f[2] * f[3])
            result["face_detected"] = True
            result["face_bbox"] = list(largest)

            face_img = face_detector.extract_face(frame, largest)
            emotion = emotion_predictor.predict(face_img) if face_img is not None else None
            eye = eye_tracker.process_frame(frame)

            if emotion:
                result["emotion"] = {"label": emotion["emotion"], "confidence": emotion["confidence"], "all_scores": emotion["all_scores"]}
            if eye:
                result["eye_contact"] = {"is_looking": eye["is_looking"], "score": eye["score"]}

            sessions[sid].update(emotion, eye, largest)
            result["confidence"] = sessions[sid].calculate_score()

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/session/start")
async def start_session(session_id: str = "default"):
    sessions[session_id] = ConfidenceScorer()
    eye_tracker.reset()
    if hasattr(emotion_predictor, 'reset'):
        emotion_predictor.reset()
    return {"session_id": session_id, "status": "started"}


@app.get("/api/session/{session_id}/report")
async def get_report(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    scorer = sessions[session_id]
    return {
        "session_id": session_id,
        "score": scorer.calculate_score(),
        "dominant_emotion": scorer.get_dominant_emotion(),
        "emotion_timeline": scorer.get_emotion_timeline(),
        "eye_contact": eye_tracker.get_summary(),
        "recommendations": scorer.get_recommendations()
    }


@app.delete("/api/session/{session_id}")
async def end_session(session_id: str):
    if session_id in sessions:
        report = {"score": sessions[session_id].calculate_score(), "recommendations": sessions[session_id].get_recommendations()}
        del sessions[session_id]
        return {"session_id": session_id, "status": "ended", "final_report": report}
    raise HTTPException(status_code=404, detail="Session not found")


@app.websocket("/ws/analyze")
async def websocket_analyze(websocket: WebSocket):
    await websocket.accept()
    sid = f"ws_{int(time.time())}"
    sessions[sid] = ConfidenceScorer()
    eye_tracker.reset()
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            img_b64 = msg.get("image", "")
            img_bytes = base64.b64decode(img_b64.split(',')[-1] if ',' in img_b64 else img_b64)
            frame = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
            if frame is None:
                await websocket.send_json({"error": "Invalid frame"})
                continue

            faces = face_detector.detect_faces(frame)
            result = {"face_detected": False}
            if faces:
                largest = max(faces, key=lambda f: f[2] * f[3])
                result["face_detected"] = True
                face_img = face_detector.extract_face(frame, largest)
                emotion = emotion_predictor.predict(face_img) if face_img is not None else None
                eye = eye_tracker.process_frame(frame)
                if emotion:
                    result["emotion"] = {"label": emotion["emotion"], "confidence": emotion["confidence"], "all_scores": emotion["all_scores"]}
                if eye:
                    result["eye_contact"] = {"is_looking": eye["is_looking"], "score": eye["score"]}
                sessions[sid].update(emotion, eye, largest)
                result["confidence"] = sessions[sid].calculate_score()
            await websocket.send_json(result)
    except WebSocketDisconnect:
        if sid in sessions:
            del sessions[sid]


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
