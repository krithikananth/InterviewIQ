import { useState, useRef, useEffect } from 'react'
import Webcam from 'react-webcam'
import { Camera, StopCircle, RotateCcw, Eye, Smile, TrendingUp, AlertCircle, Video, VideoOff, Download } from 'lucide-react'
import jsPDF from 'jspdf'

const ML_API = 'http://localhost:8000'
const EMOTION_COLORS = {
  happy: '#fdcb6e', sad: '#74b9ff', angry: '#ff6b6b',
  fear: '#a29bfe', surprise: '#fd79a8', disgust: '#00b894', neutral: '#636e72'
}

export default function InterviewPage() {
  const webcamRef = useRef(null)
  const intervalRef = useRef(null)

  // Camera toggle state (separate from analysis)
  const [cameraOn, setCameraOn] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [frameCount, setFrameCount] = useState(0)
  const [report, setReport] = useState(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const timerRef = useRef(null)

  // Webcam constraints for HIGH QUALITY
  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: 'user',
    frameRate: { ideal: 30 }
  }

  // Toggle camera ON/OFF
  const toggleCamera = () => {
    if (cameraOn && isRunning) {
      stopSession()
    }
    setCameraOn(prev => !prev)
  }

  const startSession = async () => {
    if (!cameraOn) {
      setCameraOn(true)
      // Wait a moment for webcam to initialize
      await new Promise(r => setTimeout(r, 1500))
    }

    try {
      setError(null)
      const sid = `session_${Date.now()}`
      const res = await fetch(`${ML_API}/api/session/start?session_id=${sid}`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to start ML session')
      setSessionId(sid)
      setIsRunning(true)
      setFrameCount(0)
      setReport(null)
      setElapsedTime(0)

      // Start timer
      timerRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000)

      // Start analysis loop (every 400ms = ~2.5 FPS analysis)
      intervalRef.current = setInterval(() => captureAndAnalyze(sid), 400)
    } catch (err) {
      setError(`Cannot connect to ML service at ${ML_API}. Start it with: python api/main.py`)
    }
  }

  const captureAndAnalyze = async (sid) => {
    if (!webcamRef.current) return
    // High quality screenshot
    const imageSrc = webcamRef.current.getScreenshot({ width: 640, height: 480 })
    if (!imageSrc) return

    try {
      const res = await fetch(`${ML_API}/api/analyze-frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageSrc, session_id: sid })
      })
      const data = await res.json()
      setResult(data)
      setFrameCount(prev => prev + 1)
    } catch (err) { /* silently retry */ }
  }

  const stopSession = async () => {
    clearInterval(intervalRef.current)
    clearInterval(timerRef.current)
    setIsRunning(false)

    if (sessionId) {
      try {
        const res = await fetch(`${ML_API}/api/session/${sessionId}/report`)
        const data = await res.json()
        setReport(data)
      } catch (err) {
        console.error('Failed to get report:', err)
      }
    }
  }

  const resetSession = () => {
    clearInterval(intervalRef.current)
    clearInterval(timerRef.current)
    setIsRunning(false)
    setResult(null)
    setSessionId(null)
    setFrameCount(0)
    setReport(null)
    setError(null)
    setElapsedTime(0)
  }

  // Download PDF report
  const downloadPDF = () => {
    if (!report) return
    const doc = new jsPDF()
    const score = report.score || {}
    const components = score.components || {}

    // Title
    doc.setFontSize(24)
    doc.setTextColor(108, 92, 231)
    doc.text('InterviewIQ', 20, 25)
    doc.setFontSize(14)
    doc.setTextColor(100, 100, 100)
    doc.text('Interview Analysis Report', 20, 35)

    // Date
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 45)
    doc.text(`Duration: ${formatTime(elapsedTime)} | Frames: ${frameCount}`, 20, 52)

    // Divider
    doc.setDrawColor(108, 92, 231)
    doc.setLineWidth(0.5)
    doc.line(20, 58, 190, 58)

    // Overall Score
    doc.setFontSize(18)
    doc.setTextColor(40, 40, 40)
    doc.text('Overall Scores', 20, 70)

    doc.setFontSize(36)
    doc.setTextColor(108, 92, 231)
    doc.text(`${Math.round(score.overall_score || 0)}`, 20, 90)
    doc.setFontSize(12)
    doc.setTextColor(100, 100, 100)
    doc.text('/100 Confidence Score', 50, 90)

    doc.setFontSize(14)
    doc.setTextColor(40, 40, 40)
    let y = 105

    doc.text(`Eye Contact: ${report.eye_contact?.overall_score || 0}%`, 20, y); y += 10
    doc.text(`Dominant Emotion: ${(report.dominant_emotion || 'neutral').toUpperCase()}`, 20, y); y += 15

    // Component Scores
    doc.setFontSize(16)
    doc.text('Confidence Breakdown', 20, y); y += 10
    doc.setFontSize(11)
    doc.setTextColor(80, 80, 80)

    Object.entries(components).forEach(([key, val]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      doc.text(`${label}: ${Math.round(val)}/100`, 25, y)
      // Draw bar
      doc.setFillColor(230, 230, 240)
      doc.rect(110, y - 4, 70, 5, 'F')
      const color = val > 70 ? [0, 206, 201] : val > 45 ? [253, 203, 110] : [255, 107, 107]
      doc.setFillColor(...color)
      doc.rect(110, y - 4, val * 0.7, 5, 'F')
      y += 10
    })

    // Emotion Distribution
    y += 5
    doc.setFontSize(16)
    doc.setTextColor(40, 40, 40)
    doc.text('Emotion Distribution', 20, y); y += 10
    doc.setFontSize(11)
    doc.setTextColor(80, 80, 80)

    const emotions = report.emotion_timeline || {}
    Object.entries(emotions).sort(([,a],[,b]) => b - a).forEach(([em, pct]) => {
      doc.text(`${em.charAt(0).toUpperCase() + em.slice(1)}: ${pct}%`, 25, y)
      y += 8
    })

    // Recommendations
    y += 5
    doc.setFontSize(16)
    doc.setTextColor(40, 40, 40)
    doc.text('Recommendations', 20, y); y += 10
    doc.setFontSize(10)
    doc.setTextColor(80, 80, 80)

    ;(report.recommendations || []).forEach((rec, i) => {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.setTextColor(108, 92, 231)
      doc.text(`${rec.area}:`, 25, y)
      doc.setTextColor(80, 80, 80)
      // Word wrap the tip
      const lines = doc.splitTextToSize(rec.tip, 155)
      doc.text(lines, 25, y + 6)
      y += 6 + lines.length * 5 + 5
    })

    // Footer
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text('Generated by InterviewIQ - AI Interview Emotion & Confidence Analyzer', 20, 285)

    doc.save(`InterviewIQ_Report_${new Date().toISOString().slice(0,10)}.pdf`)
  }

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current)
      clearInterval(timerRef.current)
    }
  }, [])

  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`

  const emotion = result?.emotion
  const eyeContact = result?.eye_contact
  const confidence = result?.confidence

  return (
    <div className="animate-in">
      <div className="page-header" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          <h2>Interview Analysis</h2>
          <p>Real-time AI emotion detection & confidence scoring</p>
        </div>
        {/* Camera Toggle Switch */}
        <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
          <span style={{fontSize:'13px', color:'var(--text-secondary)'}}>Camera</span>
          <button
            onClick={toggleCamera}
            style={{
              width: '56px', height: '30px', borderRadius: '15px', border: 'none', cursor: 'pointer',
              background: cameraOn ? 'var(--color-success)' : 'rgba(255,255,255,0.1)',
              position: 'relative', transition: 'background 0.3s ease'
            }}
          >
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%', background: 'white',
              position: 'absolute', top: '3px',
              left: cameraOn ? '29px' : '3px',
              transition: 'left 0.3s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {cameraOn ? <Video size={12} color="var(--color-success)" /> : <VideoOff size={12} color="#666" />}
            </div>
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding:'16px 20px', background:'rgba(255,107,107,0.1)',
          border:'1px solid rgba(255,107,107,0.3)', borderRadius:'var(--radius-md)',
          marginBottom:'20px', display:'flex', alignItems:'center', gap:'12px',
          color:'var(--color-danger)', fontSize:'14px'
        }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="grid-2-1">
        {/* Webcam */}
        <div>
          <div className="webcam-container" style={{marginBottom:'16px', minHeight:'400px'}}>
            {cameraOn ? (
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                screenshotQuality={0.85}
                mirrored={true}
                videoConstraints={videoConstraints}
                style={{width:'100%', height:'100%', objectFit:'cover'}}
              />
            ) : (
              <div style={{
                width:'100%', height:'100%', minHeight:'400px',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                background:'var(--bg-secondary)', color:'var(--text-muted)'
              }}>
                <VideoOff size={48} style={{marginBottom:'16px', opacity:0.4}} />
                <p style={{fontSize:'14px'}}>Camera is off</p>
                <p style={{fontSize:'12px', marginTop:'4px'}}>Toggle the switch above to turn on</p>
              </div>
            )}

            {/* Overlays */}
            {cameraOn && (
              <div className="webcam-overlay">
                {isRunning && (
                  <>
                    <div className="webcam-badge live">● LIVE — {formatTime(elapsedTime)}</div>
                    {emotion && (
                      <div className="webcam-badge emotion" style={{borderColor: EMOTION_COLORS[emotion.label]}}>
                        {emotion.label.toUpperCase()} {Math.round(emotion.confidence * 100)}%
                      </div>
                    )}
                    {eyeContact && (
                      <div className="webcam-badge emotion">
                        <Eye size={14} /> {eyeContact.is_looking ? 'Looking' : 'Away'} {eyeContact.score}%
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Confidence bar */}
            {confidence && isRunning && (
              <div style={{
                position:'absolute', bottom:'16px', left:'16px', right:'16px',
                background:'var(--bg-glass)', backdropFilter:'blur(10px)',
                borderRadius:'var(--radius-md)', padding:'12px 16px',
                display:'flex', alignItems:'center', justifyContent:'space-between'
              }}>
                <span style={{fontSize:'13px', fontWeight:600}}>Confidence</span>
                <div style={{display:'flex', alignItems:'center', gap:'12px', flex:1, margin:'0 16px'}}>
                  <div className="progress-bar" style={{flex:1}}>
                    <div className={`progress-bar-fill ${confidence.overall_score > 60 ? 'green' : confidence.overall_score > 35 ? 'yellow' : 'red'}`}
                         style={{width:`${confidence.overall_score}%`}} />
                  </div>
                </div>
                <span style={{fontSize:'18px', fontWeight:800,
                  color: confidence.overall_score > 60 ? 'var(--color-success)' : confidence.overall_score > 35 ? 'var(--color-warning)' : 'var(--color-danger)'
                }}>{Math.round(confidence.overall_score)}</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{display:'flex', gap:'12px'}}>
            {!isRunning ? (
              <button className="btn btn-primary btn-lg" onClick={startSession} style={{flex:1}}>
                <Camera size={20} /> Start Analysis
              </button>
            ) : (
              <button className="btn btn-danger btn-lg" onClick={stopSession} style={{flex:1}}>
                <StopCircle size={20} /> Stop & Get Report
              </button>
            )}
            <button className="btn btn-outline btn-lg" onClick={resetSession}><RotateCcw size={20} /></button>
          </div>

          {isRunning && (
            <div style={{textAlign:'center', marginTop:'12px', fontSize:'13px', color:'var(--text-muted)'}}>
              Frames: {frameCount} | Session: {sessionId?.slice(-8)}
            </div>
          )}
        </div>

        {/* Right Panel — Live Stats */}
        <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
          {/* Emotions */}
          <div className="card">
            <h3 className="card-title"><Smile size={16} style={{display:'inline',marginRight:8}} />Emotions</h3>
            {emotion?.all_scores ? (
              <div className="emotion-bars">
                {Object.entries(emotion.all_scores).sort(([,a],[,b]) => b - a).map(([name, score]) => (
                  <div className="emotion-bar-item" key={name}>
                    <span className="emotion-bar-label">{name}</span>
                    <div className="progress-bar" style={{flex:1}}>
                      <div style={{height:'100%', borderRadius:'var(--radius-full)',
                        width:`${score*100}%`, background:EMOTION_COLORS[name]||'#636e72', transition:'width 0.3s ease'}} />
                    </div>
                    <span className="emotion-bar-value">{Math.round(score*100)}%</span>
                  </div>
                ))}
              </div>
            ) : <p style={{color:'var(--text-muted)', fontSize:'13px'}}>Start session to see emotions</p>}
          </div>

          {/* Eye Contact */}
          <div className="card">
            <h3 className="card-title"><Eye size={16} style={{display:'inline',marginRight:8}} />Eye Contact</h3>
            <div style={{textAlign:'center', padding:'16px 0'}}>
              <div style={{fontSize:'48px', fontWeight:900,
                color:(eyeContact?.score||0)>60?'var(--color-success)':'var(--color-warning)'}}>
                {eyeContact?.score || 0}%
              </div>
              <div style={{fontSize:'14px', fontWeight:600, marginTop:'8px',
                color:eyeContact?.is_looking?'var(--color-success)':'var(--color-danger)'}}>
                {eyeContact?.is_looking ? '👁️ Looking at Camera' : '👀 Looking Away'}
              </div>
            </div>
          </div>

          {/* Confidence Components */}
          {confidence?.components && (
            <div className="card">
              <h3 className="card-title"><TrendingUp size={16} style={{display:'inline',marginRight:8}} />Breakdown</h3>
              <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                {Object.entries(confidence.components).map(([key, val]) => (
                  <div key={key} style={{display:'flex', alignItems:'center', gap:'8px'}}>
                    <span style={{fontSize:'12px', color:'var(--text-secondary)', width:'100px', textTransform:'capitalize'}}>
                      {key.replace(/_/g,' ')}
                    </span>
                    <div className="progress-bar" style={{flex:1}}>
                      <div className="progress-bar-fill purple" style={{width:`${val}%`}} />
                    </div>
                    <span style={{fontSize:'12px', fontWeight:600, width:'35px', textAlign:'right'}}>{Math.round(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session Report */}
      {report && (
        <div className="card" style={{marginTop:'24px', animation:'slide-up 0.5s ease'}} id="session-report">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px'}}>
            <h3 className="card-title" style={{fontSize:'20px', margin:0}}>📊 Session Report</h3>
            <button className="btn btn-primary" onClick={downloadPDF}><Download size={16} /> Download PDF</button>
          </div>
          <div className="grid-3" style={{marginTop:'16px'}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:'48px', fontWeight:900, color:'var(--accent-secondary)'}}>
                {Math.round(report.score?.overall_score||0)}
              </div>
              <div style={{fontSize:'13px', color:'var(--text-secondary)'}}>Confidence Score</div>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:'48px', fontWeight:900, color:'var(--color-success)'}}>
                {report.eye_contact?.overall_score||0}%
              </div>
              <div style={{fontSize:'13px', color:'var(--text-secondary)'}}>Eye Contact</div>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:'28px', fontWeight:800, color:'var(--color-warning)', textTransform:'capitalize', marginTop:'10px'}}>
                {report.dominant_emotion||'neutral'}
              </div>
              <div style={{fontSize:'13px', color:'var(--text-secondary)', marginTop:'6px'}}>Dominant Emotion</div>
            </div>
          </div>

          {report.recommendations?.length > 0 && (
            <div style={{marginTop:'24px'}}>
              <h4 style={{fontSize:'16px', fontWeight:600, marginBottom:'16px'}}>💡 Recommendations</h4>
              {report.recommendations.map((rec, i) => (
                <div className="recommendation-card" key={i}>
                  <div>
                    <div className="area">{rec.area}</div>
                    <div className="tip">{rec.tip}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
