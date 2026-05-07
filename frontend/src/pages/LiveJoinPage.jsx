import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Peer from 'peerjs'
import { Camera, Mic, MicOff, User, CheckCircle, Clock, ChevronRight } from 'lucide-react'

export default function LiveJoinPage() {
  const { roomId } = useParams()
  const peerRef = useRef(null)
  const connRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const recognitionRef = useRef(null)

  const [status, setStatus] = useState('joining') // joining, connected, interview, ended
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)
  const [questions, setQuestions] = useState([])
  const [currentQ, setCurrentQ] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const currentQRef = useRef(0)
  const transcriptRef = useRef('')
  const [speechSupported, setSpeechSupported] = useState(true)

  // Keep currentQ ref in sync
  useEffect(() => { currentQRef.current = currentQ }, [currentQ])
  useEffect(() => { transcriptRef.current = transcript }, [transcript])

  // Attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream
  }, [localStream, status, joined])
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream
  }, [remoteStream, status])

  const joinRoom = async () => {
    if (!name.trim()) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      setLocalStream(stream)
      if (localVideoRef.current) localVideoRef.current.srcObject = stream

      const peer = new Peer(undefined, { debug: 0 })
      peerRef.current = peer

      peer.on('open', () => {
        // Data connection for messages
        const conn = peer.connect(`interviewiq-host-${roomId}`)
        connRef.current = conn

        conn.on('open', () => {
          conn.send({ type: 'join', name: name.trim() })
          setStatus('connected')
          setJoined(true)
        })

        conn.on('data', (data) => {
          if (data.type === 'start') {
            setQuestions(data.questions || [])
            setCurrentQ(0)
            setStatus('interview')
            startSpeechRecognition()
          }
          if (data.type === 'nextQuestion') {
            conn.send({ type: 'speech', questionIndex: currentQRef.current, text: transcriptRef.current })
            setCurrentQ(data.index)
            setTranscript('')
            restartSpeechRecognition()
          }
          if (data.type === 'end') {
            conn.send({ type: 'speech', questionIndex: currentQRef.current, text: transcriptRef.current })
            stopSpeechRecognition()
            setStatus('ended')
          }
        })

        // Video call to host
        const call = peer.call(`interviewiq-host-${roomId}`, stream)
        call.on('stream', (rs) => setRemoteStream(rs))
      })

      peer.on('error', (err) => console.error('Peer error:', err))
    } catch (err) {
      alert('Camera/microphone access is required for the live interview.')
    }
  }

  // Speech recognition
  const startSpeechRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setSpeechSupported(false)
      console.warn('Speech Recognition API not supported in this browser')
      return
    }
    setSpeechSupported(true)
    startNewRecognition()
  }

  const startNewRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    // Stop any existing
    try { recognitionRef.current?.stop() } catch (e) {}

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    // Accumulate final results separately
    let accumulatedFinal = ''

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event) => {
      let interimTranscript = ''

      // Only process new results since last event
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript

        if (event.results[i].isFinal) {
          accumulatedFinal += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }

      // Show accumulated final + interim
      const displayText = (accumulatedFinal + interimTranscript).trim()
      setTranscript(displayText)
      transcriptRef.current = displayText
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      // Handle specific errors
      if (['network', 'audio-capture', 'no-speech'].includes(event.error)) {
        setIsListening(false)
        setTimeout(() => {
          try {
            recognition.start()
            setIsListening(true)
          } catch (e) { console.error('Failed to restart:', e) }
        }, 1500)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      // Auto-restart if still in interview
      setTimeout(() => {
        try {
          recognition.start()
          setIsListening(true)
        } catch (e) { }
      }, 500)
    }

    try {
      recognition.start()
      setIsListening(true)
    } catch (e) {
      console.error('Failed to start speech recognition:', e)
    }
    recognitionRef.current = recognition
  }

  const restartSpeechRecognition = () => {
    // Stop current recognition and start fresh for next question
    try { recognitionRef.current?.stop() } catch (e) {}
    setTranscript('')
    transcriptRef.current = ''
    setTimeout(startNewRecognition, 300)
  }

  const stopSpeechRecognition = () => {
    try { recognitionRef.current?.stop() } catch (e) {}
    setIsListening(false)
  }

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop() } catch (e) {}
      localStream?.getTracks().forEach(t => t.stop())
      peerRef.current?.destroy()
    }
  }, [])

  // ── JOIN SCREEN ──
  if (!joined) {
    return (
      <div className="animate-in" style={{ maxWidth: '500px', margin: '60px auto', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎥</div>
        <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Join Live Interview</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>You're joining a live interview session. Camera and microphone access required.</p>
        <div className="card" style={{ padding: '32px' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px', textAlign: 'left' }}>Your Name *</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your full name"
                style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={joinRoom} style={{ width: '100%' }} disabled={!name.trim()}>
            <Camera size={20} /> Join Interview
          </button>
        </div>
      </div>
    )
  }

  // ── WAITING FOR HOST TO START ──
  if (status === 'connected') {
    return (
      <div className="animate-in" style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '32px' }}>
          <CheckCircle size={48} style={{ color: 'var(--color-success)', margin: '0 auto 16px', display: 'block' }} />
          <h3>Connected! ✅</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Waiting for the interviewer to start...</p>
          <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', maxHeight: '300px', borderRadius: 'var(--radius-md)', background: '#000' }} />
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-success)', animation: 'pulse-glow 1.5s infinite' }} />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Connected to interviewer</span>
          </div>
        </div>
      </div>
    )
  }

  // ── INTERVIEW IN PROGRESS ──
  if (status === 'interview' && questions.length > 0) {
    const q = questions[currentQ]
    return (
      <div className="animate-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Question {currentQ + 1} of {questions.length}</span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>🔴 Live Interview</span>
        </div>
        <div className="progress-bar" style={{ height: '6px', marginBottom: '20px' }}>
          <div className="progress-bar-fill purple" style={{ width: `${(currentQ / questions.length) * 100}%` }} />
        </div>

        {/* Question */}
        <div className="card" style={{ textAlign: 'center', padding: '32px', marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Question {currentQ + 1}</div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, lineHeight: 1.5 }}>{q?.text}</h2>
        </div>

        {/* Camera + Transcript */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ background: '#000', borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '4/3', marginBottom: '12px', position: 'relative' }}>
              <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              <div style={{ position: 'absolute', top: '8px', left: '8px' }}><div className="webcam-badge live">● REC</div></div>
            </div>
            {/* Interviewer small video */}
            <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 'var(--radius-sm)', background: '#000', maxHeight: '120px', objectFit: 'contain' }} />
          </div>
          <div className="card" style={{ minHeight: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              {isListening ? <Mic size={16} color="var(--color-danger)" /> : <MicOff size={16} color="var(--text-muted)" />}
              <span style={{ fontSize: '13px', fontWeight: 600, color: isListening ? 'var(--color-danger)' : 'var(--text-muted)' }}>
              {isListening ? 'Listening...' : speechSupported ? 'Mic off' : 'Speech not supported on this browser'}
              </span>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.7 }}>
              {transcript || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Start speaking to answer...</span>}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── ENDED ──
  if (status === 'ended') {
    return (
      <div className="animate-in" style={{ maxWidth: '500px', margin: '80px auto', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
        <h2>Interview Complete!</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>Thank you, {name}. The interviewer will review your results.</p>
        <div className="card" style={{ padding: '24px', marginTop: '24px' }}>
          <CheckCircle size={32} style={{ color: 'var(--color-success)', margin: '0 auto 12px', display: 'block' }} />
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>You may close this tab.</p>
        </div>
      </div>
    )
  }

  return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Connecting...</div>
}
