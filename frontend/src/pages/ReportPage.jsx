import { useState } from 'react'
import { FileText, Download, TrendingUp, Eye, Smile, AlertTriangle, CheckCircle } from 'lucide-react'
import { Doughnut, Line } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler)

const EMOTION_COLORS = {
  happy: '#fdcb6e', sad: '#74b9ff', angry: '#ff6b6b',
  fear: '#a29bfe', surprise: '#fd79a8', disgust: '#00b894', neutral: '#636e72'
}

// Demo data for when no real session exists
const DEMO_REPORT = {
  score: { overall_score: 72, components: { eye_contact: 78, emotion_positivity: 68, emotion_stability: 75, movement_stability: 82, smile_frequency: 55 } },
  dominant_emotion: 'neutral',
  emotion_timeline: { happy: 25, neutral: 40, surprise: 10, sad: 8, angry: 5, fear: 7, disgust: 5 },
  eye_contact: { overall_score: 78, total_frames: 450, contact_frames: 351 },
  recommendations: [
    { area: 'Eye Contact', score: 78, tip: 'Good eye contact! Try to maintain it even more consistently during complex answers.' },
    { area: 'Smile Frequency', score: 55, tip: 'Consider smiling more naturally to appear warmer and more approachable.' },
    { area: 'Overall', score: 72, tip: 'Strong interview presence! Focus on maintaining positive expressions throughout.' }
  ]
}

export default function ReportPage() {
  const [report] = useState(DEMO_REPORT)

  const emotionData = {
    labels: Object.keys(report.emotion_timeline),
    datasets: [{
      data: Object.values(report.emotion_timeline),
      backgroundColor: Object.keys(report.emotion_timeline).map(e => EMOTION_COLORS[e] || '#636e72'),
      borderWidth: 0,
      hoverOffset: 8
    }]
  }

  const doughnutOptions = {
    responsive: true,
    cutout: '65%',
    plugins: {
      legend: { position: 'bottom', labels: { color: '#9d9daf', padding: 16, font: { size: 12 } } }
    }
  }

  const scoreColor = report.score.overall_score > 70 ? 'var(--color-success)' :
                     report.score.overall_score > 45 ? 'var(--color-warning)' : 'var(--color-danger)'

  return (
    <div className="animate-in">
      <div className="page-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div>
          <h2>Interview Report</h2>
          <p>Comprehensive analysis of your interview performance</p>
        </div>
        <button className="btn btn-outline"><Download size={16} /> Export PDF</button>
      </div>

      {/* Score Overview */}
      <div className="stats-grid" style={{gridTemplateColumns: 'repeat(4, 1fr)'}}>
        <div className="stat-card">
          <div className="stat-icon purple"><TrendingUp size={22} /></div>
          <div>
            <div className="stat-value" style={{color: scoreColor}}>{Math.round(report.score.overall_score)}</div>
            <div className="stat-label">Confidence Score</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Eye size={22} /></div>
          <div>
            <div className="stat-value">{report.eye_contact.overall_score}%</div>
            <div className="stat-label">Eye Contact</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><Smile size={22} /></div>
          <div>
            <div className="stat-value" style={{fontSize: '18px', textTransform: 'capitalize'}}>{report.dominant_emotion}</div>
            <div className="stat-label">Dominant Emotion</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><FileText size={22} /></div>
          <div>
            <div className="stat-value">{report.eye_contact.total_frames}</div>
            <div className="stat-label">Frames Analyzed</div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{marginTop: '24px'}}>
        {/* Emotion Distribution */}
        <div className="card">
          <h3 className="card-title">Emotion Distribution</h3>
          <div style={{maxWidth: '320px', margin: '0 auto'}}>
            <Doughnut data={emotionData} options={doughnutOptions} />
          </div>
        </div>

        {/* Confidence Components */}
        <div className="card">
          <h3 className="card-title">Confidence Breakdown</h3>
          <div style={{display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px'}}>
            {Object.entries(report.score.components).map(([key, val]) => {
              const color = val > 70 ? 'green' : val > 45 ? 'yellow' : 'red'
              return (
                <div key={key}>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                    <span style={{fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize'}}>
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span style={{fontSize: '14px', fontWeight: 700, color: val > 70 ? 'var(--color-success)' : val > 45 ? 'var(--color-warning)' : 'var(--color-danger)'}}>
                      {Math.round(val)}/100
                    </span>
                  </div>
                  <div className="progress-bar" style={{height: '10px'}}>
                    <div className={`progress-bar-fill ${color}`} style={{width: `${val}%`}} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="card" style={{marginTop: '24px'}}>
        <h3 className="card-title" style={{fontSize: '18px'}}>💡 Improvement Recommendations</h3>
        <div style={{marginTop: '16px'}}>
          {report.recommendations.map((rec, i) => (
            <div className="recommendation-card" key={i} style={{
              borderLeftColor: rec.score > 70 ? 'var(--color-success)' : rec.score > 45 ? 'var(--color-warning)' : 'var(--color-danger)'
            }}>
              <div style={{minWidth: '40px'}}>
                {rec.score > 70 ? <CheckCircle size={20} color="var(--color-success)" /> :
                 rec.score > 45 ? <AlertTriangle size={20} color="var(--color-warning)" /> :
                 <AlertTriangle size={20} color="var(--color-danger)" />}
              </div>
              <div>
                <div className="area">{rec.area} — {rec.score}/100</div>
                <div className="tip">{rec.tip}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
