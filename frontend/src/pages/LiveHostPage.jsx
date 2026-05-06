import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Peer from 'peerjs'
import { Camera, Mic, MicOff, ChevronRight, Clock, CheckCircle, Users, Video, VideoOff, Phone, PhoneOff, Eye, Smile, TrendingUp, Download } from 'lucide-react'
import jsPDF from 'jspdf'

const ML_API = import.meta.env.VITE_ML_URL || 'http://localhost:8000'
const BACKEND_API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function LiveHostPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user, token } = useAuth()

  const peerRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localVideoRef = useRef(null)
  const analysisRef = useRef(null)
  const canvasRef = useRef(null)

  const [status, setStatus] = useState('waiting') // waiting, connected, interview, ended
  const [test, setTest] = useState(null)
  const [currentQ, setCurrentQ] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [answers, setAnswers] = useState([])
  const [emotionData, setEmotionData] = useState(null)
  const [candidateName, setCandidateName] = useState('')
  const [report, setReport] = useState(null)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)

  // Attach streams to video elements whenever they change
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream
  }, [remoteStream, status])
  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream
  }, [localStream, status])

  // Load test data
  useEffect(() => {
    if (!roomId) return
    fetch(`${BACKEND_API}/tests/share/${roomId}`)
      .then(r => r.json()).then(setTest).catch(console.error)
  }, [roomId])

  // Initialize PeerJS as host
  useEffect(() => {
    const peerId = `interviewiq-host-${roomId}`
    const peer = new Peer(peerId, { debug: 0 })

    peer.on('open', (id) => {
      console.log('Host peer ready:', id)
      setStatus('waiting')
    })

    peer.on('call', (call) => {
      // Answer with our own camera
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          setLocalStream(stream)
          call.answer(stream)
          call.on('stream', (rs) => { setRemoteStream(rs); setStatus('connected') })
        })
        .catch(() => {
          call.answer()
          call.on('stream', (rs) => { setRemoteStream(rs); setStatus('connected') })
        })
    })

    peer.on('connection', (conn) => {
      conn.on('data', (data) => {
        if (data.type === 'join') setCandidateName(data.name || 'Candidate')
        if (data.type === 'speech') {
          setAnswers(prev => {
            const updated = [...prev]
            if (updated[data.questionIndex]) updated[data.questionIndex].speechText = data.text
            return updated
          })
        }
      })
      // Store connection for sending messages
      peerRef.current = { peer, conn }
    })

    peer.on('error', (err) => console.error('Peer error:', err))
    peerRef.current = { peer, conn: null }

    return () => { peer.destroy(); stopAnalysis() }
  }, [roomId])

  // Timer
  useEffect(() => {
    if (status !== 'interview' || timeLeft <= 0) return
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleNextQuestion(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [status, timeLeft, currentQ])

  // Start ML analysis on remote video
  const startAnalysis = () => {
    if (!canvasRef.current) {
      const c = document.createElement('canvas')
      c.width = 640; c.height = 480
      canvasRef.current = c
    }

    analysisRef.current = setInterval(async () => {
      const video = remoteVideoRef.current
      if (!video || !video.srcObject) return

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, 640, 480)
      const img = canvas.toDataURL('image/jpeg', 0.7)

      try {
        const res = await fetch(`${ML_API}/api/analyze-frame`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: img, session_id: `live-${roomId}` })
        })
        const data = await res.json()
        setEmotionData(data)
      } catch (e) {}
    }, 600)
  }

  const stopAnalysis = () => clearInterval(analysisRef.current)

  // Start the interview
  const startInterview = () => {
    if (!test?.questions?.length) return
    setStatus('interview')
    setCurrentQ(0)
    setTimeLeft(test.questions[0].timeLimit)
    setAnswers(test.questions.map((q, i) => ({
      questionIndex: i, questionText: q.text, speechText: '',
      emotionScores: { dominant: 'neutral', confidence: 0 },
      eyeContactScore: 0, confidenceScore: 0, duration: 0,
      fluencyScore: { wordsPerMinute: 0, totalWords: 0, overallScore: 0 }
    })))
    startAnalysis()
    // Tell candidate to start
    peerRef.current?.conn?.send({ type: 'start', questions: test.questions })
  }

  // Next question
  const handleNextQuestion = () => {
    const q = test.questions[currentQ]
    const duration = q.timeLimit - timeLeft

    // Update current answer with emotion data
    setAnswers(prev => {
      const updated = [...prev]
      updated[currentQ] = {
        ...updated[currentQ], duration,
        emotionScores: emotionData?.emotion ? {
          dominant: emotionData.emotion.label, confidence: emotionData.emotion.confidence
        } : { dominant: 'neutral', confidence: 0 },
        eyeContactScore: emotionData?.eye_contact?.score || 0,
        confidenceScore: emotionData?.confidence?.overall_score || 0
      }
      return updated
    })

    if (currentQ + 1 < test.questions.length) {
      const next = currentQ + 1
      setCurrentQ(next)
      setTimeLeft(test.questions[next].timeLimit)
      peerRef.current?.conn?.send({ type: 'nextQuestion', index: next })
    } else {
      endInterview()
    }
  }

  // End interview
  const endInterview = () => {
    stopAnalysis()
    setStatus('ended')
    peerRef.current?.conn?.send({ type: 'end' })

    const avgConfidence = answers.reduce((s, a) => s + a.confidenceScore, 0) / answers.length
    const avgEye = answers.reduce((s, a) => s + a.eyeContactScore, 0) / answers.length
    const dominant = answers.map(a => a.emotionScores?.dominant || 'neutral')
      .sort((a, b) => answers.filter(v => v.emotionScores?.dominant === a).length -
        answers.filter(v => v.emotionScores?.dominant === b).length).pop() || 'neutral'
    const overallScore = Math.round(avgConfidence * 0.4 + avgEye * 0.3 + 30)
    const grade = overallScore >= 80 ? 'A' : overallScore >= 65 ? 'B' : overallScore >= 50 ? 'C' : 'D'

    setReport({
      answers, candidateName,
      overallReport: { confidenceScore: Math.round(avgConfidence), eyeContactScore: Math.round(avgEye), dominantEmotion: dominant, grade }
    })
  }

  // Download PDF
  const downloadPDF = () => {
    if (!report) return
    const doc = new jsPDF()
    const r = report.overallReport
    doc.setFontSize(22); doc.setTextColor(108, 92, 231)
    doc.text('InterviewIQ — Live Interview Report', 20, 22)
    doc.setDrawColor(108, 92, 231); doc.line(20, 27, 190, 27)
    doc.setFontSize(12); doc.setTextColor(80, 80, 80)
    doc.text(`Candidate: ${report.candidateName}`, 20, 36)
    doc.text(`Date: ${new Date().toLocaleString()}`, 20, 43)
    doc.text(`Grade: ${r.grade} | Confidence: ${r.confidenceScore}/100 | Eye Contact: ${r.eyeContactScore}%`, 20, 54)
    let y = 68
    report.answers.forEach((ans, i) => {
      if (y > 260) { doc.addPage(); y = 20 }
      doc.setFontSize(10); doc.setTextColor(108, 92, 231)
      doc.text(`Q${i + 1}: ${ans.questionText}`, 20, y); y += 6
      doc.setTextColor(80, 80, 80)
      doc.text(`Emotion: ${ans.emotionScores?.dominant} | Eye: ${ans.eyeContactScore}% | Confidence: ${ans.confidenceScore}`, 25, y); y += 5
      const lines = doc.splitTextToSize(`Speech: "${ans.speechText || 'No speech'}"`, 160)
      doc.text(lines, 25, y); y += lines.length * 4 + 6
    })
    doc.save(`LiveInterview_${report.candidateName}_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const shareLink = `${window.location.origin}/live/join/${roomId}`
  const emotion = emotionData?.emotion
  const eyeContact = emotionData?.eye_contact
  const confidence = emotionData?.confidence

  // ── WAITING FOR CANDIDATE ──
  if (status === 'waiting') {
    return (
      <div className="animate-in" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <div className="page-header"><h2>🎥 Live Interview Room</h2><p>{test?.title || 'Loading...'}</p></div>
        <div className="card" style={{ padding: '32px' }}>
          <Users size={48} style={{ color: 'var(--accent-primary)', margin: '0 auto 16px', display: 'block' }} />
          <h3 style={{ marginBottom: '8px' }}>Waiting for candidate...</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>Share this link with the candidate to join:</p>
          <div style={{ background: 'rgba(108,92,231,0.1)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '16px', wordBreak: 'break-all' }}>
            <code style={{ color: 'var(--accent-primary)', fontSize: '13px' }}>{shareLink}</code>
          </div>
          <button className="btn btn-primary" onClick={() => { navigator.clipboard.writeText(shareLink) }}>
            📋 Copy Link
          </button>
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-warning)', animation: 'pulse-glow 1.5s infinite' }} />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Listening for connections...</span>
          </div>
        </div>
      </div>
    )
  }

  // ── CANDIDATE CONNECTED ──
  if (status === 'connected') {
    return (
      <div className="animate-in" style={{ maxWidth: '700px', margin: '0 auto' }}>
        <div className="page-header" style={{ textAlign: 'center' }}><h2>✅ {candidateName || 'Candidate'} Connected!</h2></div>
        <div className="card" style={{ padding: '24px', textAlign: 'center', position: 'relative' }}>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', maxHeight: '400px', borderRadius: 'var(--radius-md)', background: '#000', marginBottom: '16px', objectFit: 'contain' }} />
          <video ref={localVideoRef} autoPlay playsInline muted style={{ position: 'absolute', bottom: '80px', right: '40px', width: '120px', borderRadius: 'var(--radius-sm)', border: '2px solid var(--accent-primary)', objectFit: 'cover' }} />
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{test?.questions?.length || 0} questions ready</p>
          <button className="btn btn-primary btn-lg" onClick={startInterview} style={{ width: '100%' }}>
            <Camera size={20} /> Start Interview
          </button>
        </div>
      </div>
    )
  }

  // ── INTERVIEW IN PROGRESS ──
  if (status === 'interview' && test) {
    const q = test.questions[currentQ]
    const progress = (currentQ / test.questions.length) * 100

    return (
      <div className="animate-in">
        {/* Progress */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Question {currentQ + 1} of {test.questions.length}</span>
            <span style={{ fontSize: '13px', color: timeLeft < 15 ? 'var(--color-danger)' : 'var(--text-secondary)', fontWeight: 600 }}>
              <Clock size={14} style={{ display: 'inline', marginRight: 4 }} />{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <div className="progress-bar" style={{ height: '6px' }}>
            <div className="progress-bar-fill purple" style={{ width: `${progress}%`, transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* Question */}
        <div className="card" style={{ marginBottom: '20px', textAlign: 'center', padding: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Question {currentQ + 1}</div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1.5 }}>{q.text}</h2>
        </div>

        <div className="grid-2-1">
          {/* Candidate Video */}
          <div>
            <div style={{ marginBottom: '16px', position: 'relative', background: '#000', borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '16/9' }}>
              <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '8px' }}>
                <div className="webcam-badge live">● LIVE — {candidateName}</div>
                {emotion && <div className="webcam-badge emotion">{emotion.label?.toUpperCase()} {Math.round(emotion.confidence * 100)}%</div>}
              </div>
              {/* Mini self-view */}
              <video ref={localVideoRef} autoPlay playsInline muted style={{ position: 'absolute', bottom: '12px', right: '12px', width: '120px', height: '90px', borderRadius: 'var(--radius-sm)', border: '2px solid var(--accent-primary)', objectFit: 'cover' }} />
            </div>

            <button className="btn btn-primary btn-lg" onClick={handleNextQuestion} style={{ width: '100%' }}>
              {currentQ + 1 < test.questions.length ? <><ChevronRight size={20} /> Next Question</> : <><CheckCircle size={20} /> End Interview</>}
            </button>
          </div>

          {/* AI Analysis Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {emotion?.all_scores && (
              <div className="card">
                <h4 className="card-title" style={{ fontSize: '13px' }}><Smile size={14} style={{ display: 'inline', marginRight: 6 }} />Emotions</h4>
                {Object.entries(emotion.all_scores).sort(([, a], [, b]) => b - a).slice(0, 4).map(([name, score]) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', width: '55px', textTransform: 'capitalize' }}>{name}</span>
                    <div className="progress-bar" style={{ flex: 1, height: '5px' }}>
                      <div style={{ height: '100%', borderRadius: '99px', width: `${score * 100}%`, background: 'var(--accent-primary)', transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, width: '30px', textAlign: 'right' }}>{Math.round(score * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
            <div className="card">
              <h4 className="card-title" style={{ fontSize: '13px' }}><Eye size={14} style={{ display: 'inline', marginRight: 6 }} />Eye Contact</h4>
              <div style={{ textAlign: 'center', fontSize: '36px', fontWeight: 900, color: (eyeContact?.score || 0) > 60 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                {eyeContact?.score || 0}%
              </div>
            </div>
            {confidence && (
              <div className="card">
                <h4 className="card-title" style={{ fontSize: '13px' }}><TrendingUp size={14} style={{ display: 'inline', marginRight: 6 }} />Confidence</h4>
                <div style={{ textAlign: 'center', fontSize: '36px', fontWeight: 900, color: confidence.overall_score > 60 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {Math.round(confidence.overall_score)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── INTERVIEW ENDED ──
  if (status === 'ended' && report) {
    const r = report.overallReport
    const gradeColor = r.grade === 'A' ? 'var(--color-success)' : r.grade === 'B' ? '#00cec9' : 'var(--color-warning)'
    return (
      <div className="animate-in">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div><h2>Interview Complete! 🎉</h2><p>{candidateName} — {test?.title}</p></div>
          <button className="btn btn-primary" onClick={downloadPDF}><Download size={16} /> Download PDF</button>
        </div>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="stat-card"><div className="stat-icon purple" style={{ fontSize: '28px', fontWeight: 900, color: gradeColor, background: 'none' }}>{r.grade}</div><div><div className="stat-label">Grade</div></div></div>
          <div className="stat-card"><div className="stat-icon green"><CheckCircle size={20} /></div><div><div className="stat-value">{r.confidenceScore}</div><div className="stat-label">Confidence</div></div></div>
          <div className="stat-card"><div className="stat-icon yellow" style={{ fontSize: '20px' }}>👁️</div><div><div className="stat-value">{r.eyeContactScore}%</div><div className="stat-label">Eye Contact</div></div></div>
          <div className="stat-card"><div className="stat-icon purple" style={{ textTransform: 'capitalize' }}>{r.dominantEmotion?.slice(0, 3)}</div><div><div className="stat-value" style={{ textTransform: 'capitalize' }}>{r.dominantEmotion}</div><div className="stat-label">Emotion</div></div></div>
        </div>
        {report.answers.map((ans, i) => (
          <div className="card" key={i} style={{ marginTop: '16px' }}>
            <h4 style={{ fontSize: '14px', color: 'var(--accent-secondary)', marginBottom: '8px' }}>Q{i + 1}: {ans.questionText}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '8px' }}>
              <div><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Emotion</span><div style={{ fontSize: '14px', fontWeight: 600, textTransform: 'capitalize' }}>{ans.emotionScores?.dominant}</div></div>
              <div><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Eye Contact</span><div style={{ fontSize: '14px', fontWeight: 600 }}>{ans.eyeContactScore}%</div></div>
              <div><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Confidence</span><div style={{ fontSize: '14px', fontWeight: 600 }}>{ans.confidenceScore}</div></div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--border-color)' }}>
              "{ans.speechText || 'No speech detected'}"
            </p>
          </div>
        ))}
        <button className="btn btn-outline" onClick={() => navigate('/')} style={{ marginTop: '24px' }}>Back to Dashboard</button>
      </div>
    )
  }

  return <div className="animate-in" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
}
