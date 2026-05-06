import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useParams } from 'react-router-dom'
import { FileText, Users, Share2, Trash2, Eye, ChevronRight, Download, Clock } from 'lucide-react'
import jsPDF from 'jspdf'

export default function MyTestsPage() {
  const { authFetch } = useAuth()
  const navigate = useNavigate()
  const [tests, setTests] = useState([])
  const [selectedTest, setSelectedTest] = useState(null)
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadTests() }, [])

  const loadTests = async () => {
    try {
      const res = await authFetch('/tests')
      const data = await res.json()
      setTests(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const viewResponses = async (test) => {
    setSelectedTest(test)
    try {
      const res = await authFetch(`/tests/${test._id}/responses`)
      const data = await res.json()
      setResponses(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
  }

  const deleteTest = async (id) => {
    if (!confirm('Delete this test and all responses?')) return
    await authFetch(`/tests/${id}`, { method: 'DELETE' })
    loadTests()
    if (selectedTest?._id === id) { setSelectedTest(null); setResponses([]) }
  }

  const copyLink = (code) => {
    navigator.clipboard.writeText(`${window.location.origin}/test/${code}`)
  }

  const downloadResponsePDF = (resp) => {
    const doc = new jsPDF()
    const d = resp.respondentDetails || {}
    const r = resp.overallReport || {}

    doc.setFontSize(20); doc.setTextColor(108,92,231)
    doc.text('InterviewIQ — Response Report', 20, 20)
    doc.setDrawColor(108,92,231); doc.line(20, 25, 190, 25)

    doc.setFontSize(11); doc.setTextColor(80,80,80)
    doc.text(`Name: ${d.name || 'N/A'}`, 20, 34)
    doc.text(`Email: ${d.email || 'N/A'}`, 20, 41)
    doc.text(`Grade: ${r.grade || 'N/A'}`, 120, 34)
    doc.text(`Confidence: ${r.confidenceScore || 0}/100`, 120, 41)

    let y = 55
    doc.setFontSize(14); doc.setTextColor(40,40,40)
    doc.text('Scores', 20, y); y += 10
    doc.setFontSize(11); doc.setTextColor(80,80,80)
    doc.text(`Eye Contact: ${r.eyeContactScore || 0}%`, 20, y)
    doc.text(`Fluency: ${r.fluencyScore || 0}/100`, 80, y)
    doc.text(`Emotion: ${r.dominantEmotion || 'N/A'}`, 140, y); y += 15

    ;(resp.answers || []).forEach((ans, i) => {
      if (y > 260) { doc.addPage(); y = 20 }
      doc.setTextColor(108,92,231); doc.setFontSize(10)
      doc.text(`Q${i+1}: ${ans.questionText || ''}`, 20, y); y += 6
      doc.setTextColor(80,80,80)
      const speech = doc.splitTextToSize(`"${ans.speechText || 'No speech'}"`, 160)
      doc.text(speech, 25, y); y += speech.length * 4 + 8
    })

    doc.save(`Report_${(d.name || 'response').replace(/\s/g,'_')}.pdf`)
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h2>My Tests</h2>
        <p>Manage your created tests and view responses</p>
      </div>

      {loading ? <p style={{color:'var(--text-muted)'}}>Loading...</p> : (
        <div className="grid-2">
          {/* Test List */}
          <div>
            {tests.length === 0 ? (
              <div className="card" style={{textAlign:'center', padding:'40px'}}>
                <FileText size={40} style={{color:'var(--text-muted)', marginBottom:'16px'}} />
                <p style={{color:'var(--text-secondary)'}}>No tests created yet</p>
                <button className="btn btn-primary" style={{marginTop:'16px'}} onClick={() => navigate('/create-test')}>Create Your First Test</button>
              </div>
            ) : tests.map(test => (
              <div className="card" key={test._id} style={{marginBottom:'12px', cursor:'pointer', border: selectedTest?._id === test._id ? '1px solid var(--accent-primary)' : undefined}}
                onClick={() => viewResponses(test)}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                  <div>
                    <h4 style={{fontSize:'15px', fontWeight:600, marginBottom:'6px'}}>{test.title}</h4>
                    <div style={{display:'flex', gap:'16px', fontSize:'12px', color:'var(--text-muted)'}}>
                      <span><FileText size={12} style={{display:'inline',marginRight:4}} />{test.questions?.length || 0} questions</span>
                      <span><Users size={12} style={{display:'inline',marginRight:4}} />{test.responseCount || 0} responses</span>
                      <span style={{textTransform:'capitalize'}}>{test.mode}</span>
                    </div>
                  </div>
                  <div style={{display:'flex', gap:'8px'}}>
                    <button className="btn btn-outline" style={{padding:'6px 10px', fontSize:'11px'}}
                      onClick={(e) => { e.stopPropagation(); copyLink(test.shareCode) }}>
                      <Share2 size={12} /> Copy Link
                    </button>
                    <button style={{background:'none', border:'none', cursor:'pointer', color:'var(--color-danger)', opacity:0.6, padding:'6px'}}
                      onClick={(e) => { e.stopPropagation(); deleteTest(test._id) }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Responses Panel */}
          <div>
            {selectedTest ? (
              <>
                <h3 style={{fontSize:'16px', fontWeight:600, marginBottom:'16px'}}>
                  Responses — {selectedTest.title}
                  <span style={{fontSize:'12px', color:'var(--text-muted)', marginLeft:'8px'}}>({responses.length})</span>
                </h3>
                {responses.length === 0 ? (
                  <div className="card" style={{textAlign:'center', padding:'32px'}}>
                    <Users size={32} style={{color:'var(--text-muted)', marginBottom:'12px'}} />
                    <p style={{color:'var(--text-secondary)', fontSize:'14px'}}>No responses yet</p>
                    <p style={{color:'var(--text-muted)', fontSize:'12px', marginTop:'4px'}}>Share the link to start collecting responses</p>
                  </div>
                ) : responses.map(resp => {
                  const r = resp.overallReport || {}
                  const d = resp.respondentDetails || {}
                  const gradeColor = r.grade === 'A' ? 'var(--color-success)' : r.grade === 'B' ? '#00cec9' : r.grade === 'C' ? 'var(--color-warning)' : 'var(--color-danger)'

                  return (
                    <div className="card" key={resp._id} style={{marginBottom:'12px', padding:'16px'}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px'}}>
                        <div>
                          <div style={{fontWeight:600, fontSize:'14px'}}>{d.name || 'Anonymous'}</div>
                          <div style={{fontSize:'12px', color:'var(--text-muted)'}}>{d.email} {d.college ? `• ${d.college}` : ''}</div>
                        </div>
                        <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                          <span style={{fontSize:'24px', fontWeight:900, color:gradeColor}}>{r.grade || '?'}</span>
                          <button onClick={() => downloadResponsePDF(resp)} style={{background:'none', border:'none', cursor:'pointer', color:'var(--accent-secondary)', padding:'4px'}}>
                            <Download size={16} />
                          </button>
                        </div>
                      </div>
                      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'8px'}}>
                        <div style={{fontSize:'11px', color:'var(--text-muted)'}}>Confidence<div style={{fontSize:'14px', fontWeight:600, color:'var(--text-primary)'}}>{r.confidenceScore || 0}</div></div>
                        <div style={{fontSize:'11px', color:'var(--text-muted)'}}>Eye Contact<div style={{fontSize:'14px', fontWeight:600, color:'var(--text-primary)'}}>{r.eyeContactScore || 0}%</div></div>
                        <div style={{fontSize:'11px', color:'var(--text-muted)'}}>Fluency<div style={{fontSize:'14px', fontWeight:600, color:'var(--text-primary)'}}>{r.fluencyScore || 0}</div></div>
                        <div style={{fontSize:'11px', color:'var(--text-muted)'}}>Emotion<div style={{fontSize:'14px', fontWeight:600, color:'var(--text-primary)', textTransform:'capitalize'}}>{r.dominantEmotion || 'N/A'}</div></div>
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              <div className="card" style={{textAlign:'center', padding:'40px', color:'var(--text-muted)'}}>
                <Eye size={32} style={{marginBottom:'12px', opacity:0.4}} />
                <p>Select a test to view responses</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
