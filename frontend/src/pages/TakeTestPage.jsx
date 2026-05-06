import { useState, useRef, useEffect, useCallback } from 'react'
import Webcam from 'react-webcam'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Camera, Mic, MicOff, ChevronRight, Clock, CheckCircle, AlertCircle, User, Mail, Phone, Building, Briefcase } from 'lucide-react'
import jsPDF from 'jspdf'

const ML_API = import.meta.env.VITE_ML_URL || 'http://localhost:8000'
const BACKEND_API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const SAMPLE_QUESTIONS = [
  { text: "Tell me about yourself and your background.", timeLimit: 90, order: 1 },
  { text: "What are your greatest strengths and how do you apply them?", timeLimit: 90, order: 2 },
  { text: "Describe a challenge you faced and how you overcame it.", timeLimit: 90, order: 3 },
  { text: "Why are you interested in this role and what can you bring to it?", timeLimit: 90, order: 4 },
  { text: "Where do you see yourself in five years?", timeLimit: 90, order: 5 }
]

export default function TakeTestPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const webcamRef = useRef(null)
  const analysisRef = useRef(null)
  const recognitionRef = useRef(null)

  // Phases: details → test → report
  const [phase, setPhase] = useState('details')
  const [test, setTest] = useState(null)
  const [currentQ, setCurrentQ] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [answers, setAnswers] = useState([])
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [emotionData, setEmotionData] = useState(null)
  const [report, setReport] = useState(null)
  const [cameraOn, setCameraOn] = useState(false)

  // User details form
  const [details, setDetails] = useState({
    name: user?.name || '', email: user?.email || '',
    phone: '', college: '', position: ''
  })

  // Load test
  useEffect(() => {
    if (code === 'sample') {
      setTest({ _id: 'sample', title: 'Practice Interview — General Questions', questions: SAMPLE_QUESTIONS, isSample: true })
    } else if (code) {
      fetch(`${BACKEND_API}/tests/share/${code}`)
        .then(r => r.json()).then(setTest).catch(console.error)
    }
  }, [code])

  // Timer
  useEffect(() => {
    if (phase !== 'test' || timeLeft <= 0) return
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleNextQuestion(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [phase, timeLeft, currentQ])

  // Start test
  const startTest = () => {
    if (!details.name || !details.email) return
    setCameraOn(true)
    setPhase('test')
    setCurrentQ(0)
    setAnswers([])
    setTimeLeft(test.questions[0].timeLimit)
    startAnalysis()
    startSpeechRecognition()
  }

  // ML analysis loop
  const startAnalysis = () => {
    analysisRef.current = setInterval(async () => {
      if (!webcamRef.current) return
      const img = webcamRef.current.getScreenshot({ width: 640, height: 480 })
      if (!img) return
      try {
        const res = await fetch(`${ML_API}/api/analyze-frame`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: img, session_id: 'test' })
        })
        const data = await res.json()
        setEmotionData(data)
      } catch (e) {}
    }, 500)
  }

  // Speech recognition — restarts fresh for each question
  const startSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
    startFreshRecognition()
  }

  const startFreshRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    // Stop any existing recognition
    try { recognitionRef.current?.stop() } catch(e) {}

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript + ' '
        } else {
          transcript += event.results[i][0].transcript
        }
      }
      setCurrentTranscript(transcript.trim())
    }

    recognition.onerror = () => { setTimeout(() => { try { recognition.start() } catch(e) {} }, 1000) }
    recognition.onend = () => { setTimeout(() => { try { recognition.start() } catch(e) {} }, 500) }

    try { recognition.start(); setIsListening(true) } catch(e) {}
    recognitionRef.current = recognition
  }

  // Fluency analysis
  const analyzeFluency = (text, duration) => {
    if (!text || duration === 0) return { wordsPerMinute: 0, totalWords: 0, fillerWords: 0, vocabularyDiversity: 0, overallScore: 0 }

    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0)
    const totalWords = words.length
    const wpm = Math.round((totalWords / duration) * 60)
    const fillerList = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally', 'so', 'well', 'right']
    const fillerWords = words.filter(w => fillerList.includes(w)).length
    const uniqueWords = new Set(words).size
    const vocabularyDiversity = totalWords > 0 ? Math.round((uniqueWords / totalWords) * 100) : 0

    // Score: WPM (ideal 120-160), low fillers, high vocabulary
    let score = 50
    if (wpm >= 100 && wpm <= 180) score += 20
    else if (wpm >= 60) score += 10
    if (fillerWords / Math.max(1, totalWords) < 0.05) score += 15
    else if (fillerWords / Math.max(1, totalWords) < 0.1) score += 8
    if (vocabularyDiversity > 60) score += 15
    else if (vocabularyDiversity > 40) score += 8

    return { wordsPerMinute: wpm, totalWords, fillerWords, vocabularyDiversity, overallScore: Math.min(100, score) }
  }

  // Next question
  const handleNextQuestion = () => {
    const q = test.questions[currentQ]
    const duration = q.timeLimit - timeLeft
    const fluency = analyzeFluency(currentTranscript, duration)

    const answer = {
      questionIndex: currentQ,
      questionText: q.text,
      speechText: currentTranscript,
      duration,
      emotionScores: emotionData?.emotion ? {
        dominant: emotionData.emotion.label,
        confidence: emotionData.emotion.confidence,
        breakdown: emotionData.emotion.all_scores || {}
      } : { dominant: 'neutral', confidence: 0, breakdown: {} },
      eyeContactScore: emotionData?.eye_contact?.score || 0,
      fluencyScore: fluency,
      confidenceScore: emotionData?.confidence?.overall_score || 0
    }

    const newAnswers = [...answers, answer]
    setAnswers(newAnswers)
    setCurrentTranscript('')

    if (currentQ + 1 < test.questions.length) {
      setCurrentQ(currentQ + 1)
      setTimeLeft(test.questions[currentQ + 1].timeLimit)
      // Restart speech recognition fresh for next question
      startFreshRecognition()
    } else {
      finishTest(newAnswers)
    }
  }

  // Finish test
  const finishTest = async (finalAnswers) => {
    clearInterval(analysisRef.current)
    try { recognitionRef.current?.stop() } catch(e) {}
    setIsListening(false)
    setPhase('report')

    // Calculate overall report
    const avgConfidence = finalAnswers.reduce((s, a) => s + a.confidenceScore, 0) / finalAnswers.length
    const avgEyeContact = finalAnswers.reduce((s, a) => s + a.eyeContactScore, 0) / finalAnswers.length
    const avgFluency = finalAnswers.reduce((s, a) => s + a.fluencyScore.overallScore, 0) / finalAnswers.length
    const emotions = finalAnswers.map(a => a.emotionScores.dominant)
    const dominantEmotion = emotions.sort((a,b) => emotions.filter(v=>v===a).length - emotions.filter(v=>v===b).length).pop() || 'neutral'

    const overallScore = Math.round(avgConfidence * 0.3 + avgEyeContact * 0.25 + avgFluency * 0.3 + (dominantEmotion === 'happy' ? 15 : dominantEmotion === 'neutral' ? 10 : 5))
    const grade = overallScore >= 80 ? 'A' : overallScore >= 65 ? 'B' : overallScore >= 50 ? 'C' : overallScore >= 35 ? 'D' : 'F'

    const overallReport = {
      confidenceScore: Math.round(avgConfidence),
      dominantEmotion, eyeContactScore: Math.round(avgEyeContact),
      fluencyScore: Math.round(avgFluency),
      totalDuration: finalAnswers.reduce((s, a) => s + a.duration, 0),
      grade
    }

    setReport({ answers: finalAnswers, overallReport, respondentDetails: details })

    // Save to backend
    try {
      await fetch(`${BACKEND_API}/tests/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ testId: test._id || 'sample', respondentDetails: details, answers: finalAnswers, overallReport })
      })
    } catch (e) { console.error('Failed to save response:', e) }
  }

  // Download PDF
  const downloadPDF = () => {
    if (!report) return
    const doc = new jsPDF()
    const { overallReport: r, respondentDetails: d, answers: a } = report

    doc.setFontSize(22); doc.setTextColor(108, 92, 231)
    doc.text('InterviewIQ — Test Report', 20, 22)
    doc.setDrawColor(108, 92, 231); doc.line(20, 27, 190, 27)

    doc.setFontSize(11); doc.setTextColor(80, 80, 80)
    doc.text(`Name: ${d.name}`, 20, 36)
    doc.text(`Email: ${d.email}`, 20, 43)
    if (d.phone) doc.text(`Phone: ${d.phone}`, 120, 36)
    if (d.college) doc.text(`College: ${d.college}`, 120, 43)
    if (d.position) doc.text(`Position: ${d.position}`, 20, 50)
    doc.text(`Date: ${new Date().toLocaleString()}`, 120, 50)

    let y = 62
    doc.setFontSize(16); doc.setTextColor(40, 40, 40)
    doc.text('Overall Scores', 20, y); y += 12
    doc.setFontSize(12)
    doc.text(`Grade: ${r.grade}`, 20, y)
    doc.text(`Confidence: ${r.confidenceScore}/100`, 70, y)
    doc.text(`Eye Contact: ${r.eyeContactScore}%`, 130, y); y += 8
    doc.text(`Fluency: ${r.fluencyScore}/100`, 20, y)
    doc.text(`Dominant Emotion: ${r.dominantEmotion}`, 70, y); y += 15

    doc.setFontSize(14); doc.text('Question-by-Question Analysis', 20, y); y += 10
    a.forEach((ans, i) => {
      if (y > 260) { doc.addPage(); y = 20 }
      doc.setFontSize(10); doc.setTextColor(108, 92, 231)
      doc.text(`Q${i+1}: ${ans.questionText}`, 20, y); y += 6
      doc.setTextColor(80, 80, 80)
      doc.text(`Emotion: ${ans.emotionScores.dominant} | Eye: ${ans.eyeContactScore}% | Fluency: ${ans.fluencyScore.overallScore}/100 | WPM: ${ans.fluencyScore.wordsPerMinute}`, 25, y); y += 5
      const speechLines = doc.splitTextToSize(`Speech: "${ans.speechText || 'No speech detected'}"`, 160)
      doc.text(speechLines, 25, y); y += speechLines.length * 4 + 6
    })

    doc.setFontSize(8); doc.setTextColor(150, 150, 150)
    doc.text('Generated by InterviewIQ — AI Interview Analyzer', 20, 285)
    doc.save(`InterviewIQ_${d.name.replace(/\s/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`)
  }

  if (!test) return <div className="animate-in" style={{padding: '40px', textAlign: 'center', color: 'var(--text-muted)'}}>Loading test...</div>

  // PHASE: User Details
  if (phase === 'details') {
    return (
      <div className="animate-in" style={{maxWidth: '600px', margin: '0 auto'}}>
        <div className="page-header" style={{textAlign: 'center'}}>
          <h2>{test.title}</h2>
          <p>{test.questions?.length || 0} questions • ~{Math.round((test.questions?.length || 0) * 1.5)} minutes</p>
        </div>

        <div className="card" style={{padding: '32px'}}>
          <h3 className="card-title">Enter Your Details</h3>
          <p style={{color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px'}}>
            These will appear in your report. Camera and microphone access required.
          </p>

          <form onSubmit={(e) => { e.preventDefault(); startTest() }}>
            {[
              { icon: User, label: 'Full Name *', key: 'name', type: 'text', required: true },
              { icon: Mail, label: 'Email *', key: 'email', type: 'email', required: true },
              { icon: Phone, label: 'Phone', key: 'phone', type: 'tel' },
              { icon: Building, label: 'College / Company', key: 'college', type: 'text' },
              { icon: Briefcase, label: 'Position Applying For', key: 'position', type: 'text' }
            ].map(field => (
              <div key={field.key} style={{marginBottom: '16px'}}>
                <label style={{display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px'}}>{field.label}</label>
                <div style={{position: 'relative'}}>
                  <field.icon size={16} style={{position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)'}} />
                  <input type={field.type} value={details[field.key]} required={field.required}
                    onChange={e => setDetails(prev => ({...prev, [field.key]: e.target.value}))}
                    style={{
                      width: '100%', padding: '12px 12px 12px 40px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.03)',
                      color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            ))}

            <button type="submit" className="btn btn-primary btn-lg" style={{width: '100%', marginTop: '8px'}}>
              <Camera size={20} /> Start Interview
            </button>
          </form>
        </div>
      </div>
    )
  }

  // PHASE: Test in progress
  if (phase === 'test') {
    const q = test.questions[currentQ]
    const progress = ((currentQ) / test.questions.length) * 100

    return (
      <div className="animate-in">
        {/* Progress */}
        <div style={{marginBottom: '20px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
            <span style={{fontSize: '13px', color: 'var(--text-secondary)'}}>Question {currentQ + 1} of {test.questions.length}</span>
            <span style={{fontSize: '13px', color: timeLeft < 15 ? 'var(--color-danger)' : 'var(--text-secondary)', fontWeight: 600}}>
              <Clock size={14} style={{display: 'inline', marginRight: 4}} />{Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}
            </span>
          </div>
          <div className="progress-bar" style={{height: '6px'}}>
            <div className="progress-bar-fill purple" style={{width: `${progress}%`, transition: 'width 0.3s'}} />
          </div>
        </div>

        {/* Question */}
        <div className="card" style={{marginBottom: '20px', textAlign: 'center', padding: '32px'}}>
          <div style={{fontSize: '12px', fontWeight: 600, color: 'var(--accent-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px'}}>
            Question {currentQ + 1}
          </div>
          <h2 style={{fontSize: '22px', fontWeight: 700, lineHeight: 1.5}}>{q.text}</h2>
        </div>

        <div className="grid-2-1">
          {/* Webcam */}
          <div>
            <div className="webcam-container" style={{marginBottom: '16px'}}>
              <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" screenshotQuality={0.8}
                mirrored videoConstraints={{width: 1280, height: 720, facingMode: 'user'}}
                style={{width: '100%', height: '100%', objectFit: 'cover'}} />
              <div className="webcam-overlay">
                <div className="webcam-badge live">● REC</div>
                {emotionData?.emotion && (
                  <div className="webcam-badge emotion">{emotionData.emotion.label.toUpperCase()} {Math.round(emotionData.emotion.confidence * 100)}%</div>
                )}
              </div>
            </div>

            {/* Speech transcript */}
            <div className="card" style={{minHeight: '100px'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                {isListening ? <Mic size={16} color="var(--color-danger)" /> : <MicOff size={16} color="var(--text-muted)" />}
                <span style={{fontSize: '13px', fontWeight: 600, color: isListening ? 'var(--color-danger)' : 'var(--text-muted)'}}>
                  {isListening ? 'Listening...' : 'Microphone off'}
                </span>
              </div>
              <p style={{fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.7, minHeight: '40px'}}>
                {currentTranscript || <span style={{color: 'var(--text-muted)', fontStyle: 'italic'}}>Start speaking to see your transcript...</span>}
              </p>
            </div>

            <button className="btn btn-primary btn-lg" onClick={handleNextQuestion} style={{width: '100%', marginTop: '16px'}}>
              {currentQ + 1 < test.questions.length ? <><ChevronRight size={20} /> Next Question</> : <><CheckCircle size={20} /> Finish Test</>}
            </button>
          </div>

          {/* Side panel */}
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            {emotionData?.emotion?.all_scores && (
              <div className="card">
                <h4 className="card-title" style={{fontSize: '13px'}}>Live Emotions</h4>
                <div className="emotion-bars">
                  {Object.entries(emotionData.emotion.all_scores).sort(([,a],[,b]) => b-a).slice(0, 4).map(([name, score]) => (
                    <div className="emotion-bar-item" key={name}>
                      <span className="emotion-bar-label" style={{width: '60px', fontSize: '11px'}}>{name}</span>
                      <div className="progress-bar" style={{flex: 1, height: '6px'}}>
                        <div style={{height: '100%', borderRadius: '99px', width: `${score*100}%`, background: 'var(--accent-primary)', transition: 'width 0.3s'}} />
                      </div>
                      <span style={{fontSize: '11px', fontWeight: 600, width: '30px', textAlign: 'right'}}>{Math.round(score*100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="card">
              <h4 className="card-title" style={{fontSize: '13px'}}>Answered</h4>
              {test.questions.map((q, i) => (
                <div key={i} style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', opacity: i <= currentQ ? 1 : 0.3}}>
                  {i < currentQ ? <CheckCircle size={14} color="var(--color-success)" /> : i === currentQ ? <div style={{width: 14, height: 14, borderRadius: '50%', background: 'var(--accent-primary)', animation: 'pulse-glow 1.5s infinite'}} /> : <div style={{width: 14, height: 14, borderRadius: '50%', border: '1px solid var(--border-color)'}} />}
                  <span style={{fontSize: '12px', color: 'var(--text-secondary)'}}>Q{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // PHASE: Report
  if (phase === 'report' && report) {
    const r = report.overallReport
    const gradeColor = r.grade === 'A' ? 'var(--color-success)' : r.grade === 'B' ? '#00cec9' : r.grade === 'C' ? 'var(--color-warning)' : 'var(--color-danger)'

    return (
      <div className="animate-in">
        <div className="page-header" style={{display: 'flex', justifyContent: 'space-between'}}>
          <div><h2>Test Complete! 🎉</h2><p>{details.name} — {test.title}</p></div>
          <button className="btn btn-primary" onClick={downloadPDF}>Download PDF</button>
        </div>

        {/* Overall */}
        <div className="stats-grid" style={{gridTemplateColumns: 'repeat(5, 1fr)'}}>
          <div className="stat-card"><div className="stat-icon purple" style={{fontSize: '28px', fontWeight: 900, color: gradeColor, background: 'none'}}>{r.grade}</div><div><div className="stat-label">Grade</div></div></div>
          <div className="stat-card"><div className="stat-icon green"><CheckCircle size={20} /></div><div><div className="stat-value">{r.confidenceScore}</div><div className="stat-label">Confidence</div></div></div>
          <div className="stat-card"><div className="stat-icon yellow" style={{fontSize: '20px'}}>👁️</div><div><div className="stat-value">{r.eyeContactScore}%</div><div className="stat-label">Eye Contact</div></div></div>
          <div className="stat-card"><div className="stat-icon red"><Mic size={20} /></div><div><div className="stat-value">{r.fluencyScore}</div><div className="stat-label">Fluency</div></div></div>
          <div className="stat-card"><div className="stat-icon purple" style={{fontSize: '18px', textTransform: 'capitalize'}}>{r.dominantEmotion?.slice(0,3)}</div><div><div className="stat-value" style={{fontSize: '16px', textTransform: 'capitalize'}}>{r.dominantEmotion}</div><div className="stat-label">Emotion</div></div></div>
        </div>

        {/* Per-question */}
        {report.answers.map((ans, i) => (
          <div className="card" key={i} style={{marginTop: '16px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
              <h4 style={{fontSize: '14px', color: 'var(--accent-secondary)'}}>Q{i+1}: {ans.questionText}</h4>
              <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>{ans.duration}s</span>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px'}}>
              <div><span style={{fontSize: '11px', color: 'var(--text-muted)'}}>Emotion</span><div style={{fontSize: '14px', fontWeight: 600, textTransform: 'capitalize'}}>{ans.emotionScores.dominant}</div></div>
              <div><span style={{fontSize: '11px', color: 'var(--text-muted)'}}>Eye Contact</span><div style={{fontSize: '14px', fontWeight: 600}}>{ans.eyeContactScore}%</div></div>
              <div><span style={{fontSize: '11px', color: 'var(--text-muted)'}}>Fluency</span><div style={{fontSize: '14px', fontWeight: 600}}>{ans.fluencyScore.overallScore}/100</div></div>
              <div><span style={{fontSize: '11px', color: 'var(--text-muted)'}}>WPM</span><div style={{fontSize: '14px', fontWeight: 600}}>{ans.fluencyScore.wordsPerMinute}</div></div>
            </div>
            <p style={{fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--border-color)'}}>
              "{ans.speechText || 'No speech detected'}"
            </p>
          </div>
        ))}

        <div style={{display: 'flex', gap: '12px', marginTop: '24px'}}>
          <button className="btn btn-outline" onClick={() => navigate('/')}>Back to Dashboard</button>
          <button className="btn btn-primary" onClick={() => { setPhase('details'); setReport(null); setAnswers([]) }}>Retake Test</button>
        </div>
      </div>
    )
  }

  return null
}
