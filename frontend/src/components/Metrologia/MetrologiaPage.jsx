import { useEffect, useRef, useState } from 'react'
import { BASE } from '../../api/client.js'

const ACCEPTED = 'image/png,image/jpeg,image/bmp,image/webp,.png,.jpg,.jpeg,.bmp,.webp'

async function apiStatus() {
  const r = await fetch(`${BASE}/metrology/status`)
  return r.json()
}

async function apiPredict(file) {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(`${BASE}/metrology/predict`, { method: 'POST', body: fd })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: `HTTP ${r.status}` }))
    throw new Error(err.detail || `HTTP ${r.status}`)
  }
  return r.json()
}

function StatusBadge({ reachable }) {
  if (reachable === null) return <span className="badge" style={{ background: 'var(--border)' }}>Comprobando…</span>
  return reachable
    ? <span className="badge" style={{ background: 'var(--success)', color: '#fff' }}>● Servicio activo</span>
    : <span className="badge" style={{ background: 'var(--danger)', color: '#fff' }}>● Servicio no disponible</span>
}

function VerdictBadge({ verdict }) {
  if (!verdict) return null
  const ok = verdict === 'CONFORME'
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 14px',
      borderRadius: 6,
      fontWeight: 700,
      fontSize: '1rem',
      background: ok ? 'var(--success)' : 'var(--danger)',
      color: '#fff',
    }}>
      {verdict}
    </span>
  )
}

function MetricRow({ label, value, unit }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span className="text-muted">{label}</span>
      <span style={{ fontWeight: 600 }}>{value != null ? `${value}${unit ? ' ' + unit : ''}` : '—'}</span>
    </div>
  )
}

export default function MetrologiaPage() {
  const [serviceStatus, setServiceStatus] = useState(null)
  const [file, setFile]     = useState(null)
  const [preview, setPreview] = useState(null)
  const [running, setRunning] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    apiStatus().then(s => setServiceStatus(s.reachable)).catch(() => setServiceStatus(false))
  }, [])

  function pickFile(f) {
    if (!f || !f.type.startsWith('image/')) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setError(null)
  }

  function onDrop(e) {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer.files[0]) pickFile(e.dataTransfer.files[0])
  }

  async function runAnalysis() {
    if (!file) return
    setRunning(true); setError(null); setResult(null)
    try {
      const data = await apiPredict(file)
      setResult(data)
    } catch (e) { setError(e.message) }
    setRunning(false)
  }

  return (
    <div>
      <div className="page-header">
        <h2>Metrología de Piezas</h2>
        <StatusBadge reachable={serviceStatus} />
      </div>

      <div className="alert" style={{ background: 'var(--bg-secondary)', marginBottom: 20, fontSize: 13 }}>
        Servicio de inspección geométrica de brackets metálicos — extrae <strong>ángulo de pliegue</strong>,
        <strong> agujeros detectados</strong>, <strong>ratio de convexidad</strong> y <strong>área de silhouette</strong>
        &nbsp;a partir de renders sintéticos Omniverse (1024×1024 RGBA). Latencia ~40 ms/imagen (CPU).
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Upload */}
        <div className="card">
          <div className="card-title">Imagen de entrada</div>
          <div
            className={`drop-zone${dragOver ? ' drag-over' : ''}${file ? ' has-file' : ''}`}
            style={{ marginBottom: 16 }}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current.click()}
          >
            <input ref={inputRef} type="file" accept={ACCEPTED} hidden
              onChange={e => e.target.files[0] && pickFile(e.target.files[0])} />
            {preview ? (
              <div style={{ textAlign: 'center' }}>
                <img src={preview} alt="preview"
                  style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 6, objectFit: 'contain' }} />
                <div style={{ fontSize: 12, marginTop: 6, color: 'var(--success)' }}>{file.name}</div>
              </div>
            ) : (
              <>
                <div className="drop-icon">📐</div>
                <div>Arrastra una imagen de bracket o haz clic para seleccionar</div>
                <div className="text-muted mt-4">PNG, JPG, BMP, WebP · Resolución recomendada 1024×1024</div>
              </>
            )}
          </div>

          <button
            className="btn btn-primary"
            disabled={!file || running || serviceStatus === false}
            onClick={runAnalysis}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {running ? <><span className="spinner" /> Analizando…</> : 'Analizar pieza'}
          </button>

          {serviceStatus === false && (
            <div className="alert alert-warning" style={{ marginTop: 10, fontSize: 12 }}>
              El servicio de metrología no está disponible en <code>localhost:8100</code>.
              Arranca el servicio con <code>uvicorn metrology_service:app --port 8100</code>.
            </div>
          )}
        </div>

        {/* Results */}
        <div className="card">
          <div className="card-title">Resultado</div>

          {error && <div className="alert alert-error">{error}</div>}

          {!result && !error && (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <p>Sube una imagen y pulsa Analizar pieza.</p>
            </div>
          )}

          {result && (
            <div>
              {/* Veredicto */}
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div className="text-muted" style={{ marginBottom: 6, fontSize: 12 }}>Veredicto</div>
                <VerdictBadge verdict={result.verdict} />
                {result.score != null && (
                  <div className="text-muted" style={{ marginTop: 6, fontSize: 12 }}>
                    Score: {result.score} / 4 checks
                  </div>
                )}
              </div>

              {/* Métricas */}
              <div style={{ marginBottom: 16 }}>
                <div className="card-title" style={{ marginBottom: 8 }}>Métricas geométricas</div>
                <MetricRow label="Agujeros detectados"  value={result.holes_detected}  unit="" />
                <MetricRow label="Ángulo de pliegue"    value={result.fold_angle_deg != null ? result.fold_angle_deg.toFixed(1) : null} unit="°" />
                <MetricRow label="Ratio de convexidad"  value={result.convexity_ratio != null ? result.convexity_ratio.toFixed(4) : null} unit="" />
                <MetricRow label="Área de silhouette"   value={result.piece_area_px != null ? Math.round(result.piece_area_px).toLocaleString() : null} unit="px²" />
                {result.pixel_to_mm != null && (
                  <MetricRow label="Escala px → mm" value={result.pixel_to_mm.toFixed(4)} unit="mm/px" />
                )}
              </div>

              {/* Violaciones */}
              {result.violations && result.violations.length > 0 && (
                <div>
                  <div className="card-title" style={{ marginBottom: 8 }}>Violaciones detectadas</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--danger)' }}>
                    {(typeof result.violations === 'string'
                      ? result.violations.split(';').map(v => v.trim()).filter(Boolean)
                      : result.violations
                    ).map((v, i) => <li key={i}>{v}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info panel */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title">Referencia del servicio</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Endpoint', value: 'localhost:8100' },
            { label: 'Latencia media', value: '~40 ms' },
            { label: 'Aceleración', value: 'CPU (OpenCV)' },
            { label: 'Veredicto', value: 'SOFT-SCORE ≥ 3/4' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
              <div className="text-muted" style={{ fontSize: 11 }}>{label}</div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          <strong>Limitación conocida:</strong> las distribuciones OK/NOK se solapan para vistas sintéticas con orientación de cámara aleatoria.
          Recall NOK = 0 % sobre el dataset de 28 imágenes. Se recomienda vistas frontales controladas o clasificador supervisado para producción.
        </div>
      </div>
    </div>
  )
}
