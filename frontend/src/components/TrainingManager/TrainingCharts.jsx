/**
 * TrainingCharts — modal with epoch-by-epoch training metrics.
 * Pure SVG charts, no external chart library required.
 */
import { useEffect, useState } from 'react'
import { trainingApi } from '../../api/client.js'

// ── Reusable SVG line chart ───────────────────────────────────────────────────

function SvgLineChart({ data, series, title, formatY = v => v?.toFixed(3) ?? '', yMax: yMaxOverride }) {
  if (!data?.length) return (
    <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
      No data for this chart.
    </div>
  )

  const W = 560, H = 220
  const P = { t: 28, r: 16, b: 38, l: 58 }
  const cW = W - P.l - P.r
  const cH = H - P.t - P.b

  const xs = data.map(d => d.epoch)
  const minX = xs[0], maxX = xs[xs.length - 1]
  const xRange = maxX - minX || 1

  const allVals = series.flatMap(s =>
    data.map(d => d[s.key]).filter(v => v != null && isFinite(v))
  )
  if (!allVals.length) return (
    <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
      No values recorded yet.
    </div>
  )

  const rawMin = Math.min(...allVals)
  const rawMax = Math.max(...allVals)
  const yMin = rawMin >= 0 ? 0 : rawMin * 1.1
  const yMax = yMaxOverride != null ? yMaxOverride : (rawMax || 1) * 1.12
  const yRange = yMax - yMin || 1

  const px = e  => P.l + ((e - minX) / xRange) * cW
  const py = v  => P.t + cH - ((v - yMin) / yRange) * cH

  const makePath = key => {
    const pts = data.filter(d => d[key] != null && isFinite(d[key]))
    if (!pts.length) return ''
    return pts
      .map((d, i) => `${i === 0 ? 'M' : 'L'}${px(d.epoch).toFixed(1)},${py(d[key]).toFixed(1)}`)
      .join(' ')
  }

  const N_Y = 5
  const yTicks = Array.from({ length: N_Y }, (_, i) => yMin + yRange * (i / (N_Y - 1)))
  const xStep = Math.max(1, Math.floor(data.length / 6))
  const xLabels = data.filter((_, i) => i === 0 || i === data.length - 1 || i % xStep === 0)

  return (
    <div>
      {title && (
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--text-primary)' }}>
          {title}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        {/* Horizontal grid */}
        {yTicks.map((v, i) => (
          <line key={i}
            x1={P.l} x2={P.l + cW}
            y1={py(v).toFixed(1)} y2={py(v).toFixed(1)}
            stroke="#1e2540" strokeWidth={1}
          />
        ))}
        {/* Axes */}
        <line x1={P.l} x2={P.l}        y1={P.t} y2={P.t + cH} stroke="#2d3555" strokeWidth={1} />
        <line x1={P.l} x2={P.l + cW}   y1={P.t + cH} y2={P.t + cH} stroke="#2d3555" strokeWidth={1} />

        {/* Y labels */}
        {yTicks.map((v, i) => (
          <text key={i}
            x={P.l - 6} y={py(v) + 4}
            textAnchor="end" fontSize={10} fill="#6b7280"
          >
            {formatY(v)}
          </text>
        ))}

        {/* X labels */}
        {xLabels.map(d => (
          <text key={d.epoch}
            x={px(d.epoch)} y={P.t + cH + 14}
            textAnchor="middle" fontSize={10} fill="#6b7280"
          >
            {d.epoch}
          </text>
        ))}
        <text x={W / 2} y={H - 2} textAnchor="middle" fontSize={10} fill="#4b5563">Epoch</text>

        {/* Lines */}
        {series.map(s => (
          <path key={s.key}
            d={makePath(s.key)}
            fill="none" stroke={s.color} strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round"
          />
        ))}

        {/* Legend — top-right */}
        <g transform={`translate(${P.l + 8}, ${P.t - 2})`}>
          {series.map((s, i) => (
            <g key={s.key} transform={`translate(${i * 110}, 0)`}>
              <line x1={0} x2={14} y1={5} y2={5} stroke={s.color} strokeWidth={2} />
              <text x={18} y={9} fontSize={10} fill="#9ca3af">{s.label}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-light)',
      borderRadius: 8,
      padding: '12px 16px',
      minWidth: 120,
      flex: 1,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {value ?? '—'}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TrainingCharts({ job, onClose }) {
  const [metrics, setMetrics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!job) return
    setLoading(true)
    trainingApi.getMetrics(job.id)
      .then(data => {
        setMetrics(data.sort((a, b) => a.epoch - b.epoch))
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [job?.id])

  // Keyboard close
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!job) return null

  // Derived stats
  const totalEpochs = metrics.length
  const bestRow = metrics.reduce((best, m) => {
    if (m.map50 != null && (best == null || m.map50 > best.map50)) return m
    return best
  }, null)
  const lastRow = metrics[metrics.length - 1]

  const fmtPct  = v => v != null ? `${(v * 100).toFixed(1)}%` : '—'
  const fmtLoss = v => v != null ? v.toFixed(4) : '—'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-light)',
        borderRadius: 12,
        width: '100%', maxWidth: 760,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: 28,
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>
              📊 {job.model_name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              Job #{job.id} · {job.model_type} · {job.status}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid var(--border-light)',
              borderRadius: 6, color: 'var(--text-muted)',
              cursor: 'pointer', padding: '4px 10px', fontSize: 13,
            }}
          >✕ Close</button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
            <div style={{ color: 'var(--text-muted)', marginTop: 12, fontSize: 13 }}>Loading metrics…</div>
          </div>
        )}

        {error && (
          <div className="alert alert-error">{error}</div>
        )}

        {!loading && !error && !metrics.length && (
          <div className="empty-state">
            <p>No epoch metrics yet. Metrics are reported during training.</p>
          </div>
        )}

        {!loading && !error && metrics.length > 0 && (
          <>
            {/* Stats row */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
              <StatCard label="Epochs recorded" value={totalEpochs} />
              <StatCard
                label="Best mAP@50"
                value={fmtPct(bestRow?.map50)}
                sub={bestRow ? `epoch ${bestRow.epoch}` : null}
              />
              <StatCard
                label="Best mAP@50-95"
                value={fmtPct(bestRow?.map50_95)}
              />
              <StatCard
                label="Final val loss"
                value={fmtLoss(lastRow?.val_loss)}
                sub={`epoch ${lastRow?.epoch}`}
              />
            </div>

            {/* Chart 1 — Detection Metrics */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 8, padding: 16, marginBottom: 16,
            }}>
              <SvgLineChart
                title="Detection Metrics"
                data={metrics}
                series={[
                  { key: 'map50',    color: '#3b82f6', label: 'mAP@50' },
                  { key: 'map50_95', color: '#8b5cf6', label: 'mAP@50-95' },
                ]}
                formatY={v => `${(v * 100).toFixed(1)}%`}
                yMax={1}
              />
            </div>

            {/* Chart 2 — Loss Curves */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 8, padding: 16,
            }}>
              <SvgLineChart
                title="Loss Curves"
                data={metrics}
                series={[
                  { key: 'train_loss', color: '#f59e0b', label: 'Train Loss' },
                  { key: 'val_loss',   color: '#ef4444', label: 'Val Loss' },
                ]}
                formatY={v => v.toFixed(3)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
