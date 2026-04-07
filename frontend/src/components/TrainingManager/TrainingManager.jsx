import { useEffect, useRef, useState } from 'react'
import { datasetsApi, trainingApi, formatDate, formatDuration } from '../../api/client.js'
import TrainingCharts from './TrainingCharts.jsx'

const MODEL_TYPES = [
  'yolov8n', 'yolov8s', 'yolov8m', 'yolov8l', 'yolov8x',
  'yolo11n', 'yolo11s', 'yolo11m', 'yolo11l', 'yolo11x',
]

const ACTIVE_STATUSES = new Set(['pending', 'provisioning', 'training'])

function StatusBadge({ status }) {
  const map = {
    pending:      'badge-pending',
    provisioning: 'badge-processing',
    training:     'badge-processing',
    completed:    'badge-ready',
    failed:       'badge-failed',
  }
  return (
    <span className={`badge ${map[status] || 'badge-pending'} flex gap-8`}>
      {ACTIVE_STATUSES.has(status) && <span className="spinner" />}
      {status}
    </span>
  )
}

export default function TrainingManager() {
  const [datasets, setDatasets]     = useState([])
  const [jobs, setJobs]             = useState([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [toast, setToast]           = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [chartsJob, setChartsJob]   = useState(null)
  const pollRef = useRef(null)

  // Form state
  const [form, setForm] = useState({
    dataset_ids: [],
    model_type:  'yolov8m',
    model_name:  '',
    epochs:      100,
    batch_size:  -1,
  })

  // Load all ready datasets
  async function loadDatasets() {
    try {
      const [mentat, manual, gdrive] = await Promise.all([
        datasetsApi.listMentat(),
        datasetsApi.listManual(),
        datasetsApi.listGDrive(),
      ])
      const ready = [
        ...mentat.map(d => ({ ...d, label: `[MENTAT] ${d.project_name || d.timestamp}` })),
        ...manual.filter(d => d.status === 'ready').map(d => ({
          ...d, label: `[Manual] ${d.project_name || d.original_filename}`,
        })),
        ...gdrive.filter(d => d.status === 'ready').map(d => ({
          ...d, label: `[GDrive] ${d.project_name || d.original_filename}`,
        })),
      ]
      setDatasets(ready)
    } catch (_) {}
  }

  async function loadJobs(silent = false) {
    if (!silent) setLoadingJobs(true)
    try {
      const data = await trainingApi.listJobs()
      setJobs(data)
    } catch (_) {}
    setLoadingJobs(false)
  }

  useEffect(() => {
    loadDatasets()
    loadJobs()
  }, [])

  // Poll while any job is active
  useEffect(() => {
    const hasActive = jobs.some(j => ACTIVE_STATUSES.has(j.status))
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(() => loadJobs(true), 10_000)
    }
    if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current); pollRef.current = null
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [jobs])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  function toggleDataset(id) {
    setForm(f => {
      const ids = f.dataset_ids.includes(id)
        ? f.dataset_ids.filter(d => d !== id)
        : [...f.dataset_ids, id]
      return { ...f, dataset_ids: ids }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.dataset_ids.length || !form.model_name.trim()) return
    setSubmitting(true)
    try {
      await trainingApi.createJob({
        dataset_ids: form.dataset_ids.map(Number),
        model_type:  form.model_type,
        model_name:  form.model_name.trim(),
        epochs:      Number(form.epochs),
        batch_size:  Number(form.batch_size),
      })
      showToast('Training job launched!')
      loadJobs()
    } catch (e) {
      showToast(e.message, 'error')
    }
    setSubmitting(false)
  }

  return (
    <div>
      <div className="page-header">
        <h2>Training Manager</h2>
      </div>

      {toast && (
        <div className={`alert alert-${toast.type === 'error' ? 'error' : 'success'}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Launch form ──────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-title">Launch Training Job</div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Datasets (select one or more)</label>
            <div style={{
              background: 'var(--bg-input)', border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-sm)', padding: '8px 12px',
              maxHeight: 160, overflowY: 'auto',
            }}>
              {!datasets.length ? (
                <div className="text-muted" style={{ padding: 4 }}>No ready datasets found.</div>
              ) : datasets.map((d, i) => (
                <label key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
                  cursor: 'pointer', fontSize: 13,
                }}>
                  <input type="checkbox"
                    checked={form.dataset_ids.includes(d.id)}
                    onChange={() => toggleDataset(d.id)} />
                  {d.label}
                </label>
              ))}
            </div>
            {form.dataset_ids.length > 1 && (
              <div className="text-muted mt-4">
                {form.dataset_ids.length} datasets selected — will be merged for training
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Model Type</label>
              <select className="form-select" value={form.model_type}
                onChange={e => setForm(f => ({ ...f, model_type: e.target.value }))}>
                {MODEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Model Name (for registry)</label>
              <input className="form-input" placeholder="e.g. glove-detector"
                value={form.model_name}
                onChange={e => setForm(f => ({ ...f, model_name: e.target.value }))} required />
            </div>
            <div className="form-row" style={{ gap: 12, marginBottom: 0 }}>
              <div className="form-group">
                <label className="form-label">Epochs</label>
                <input className="form-input" type="number" min={1} max={1000}
                  value={form.epochs}
                  onChange={e => setForm(f => ({ ...f, epochs: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Batch Size</label>
                <input className="form-input" type="number" min={-1}
                  value={form.batch_size}
                  onChange={e => setForm(f => ({ ...f, batch_size: e.target.value }))} />
                <div className="text-muted mt-4">-1 = auto</div>
              </div>
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? <><span className="spinner" /> Launching…</> : '⚡ Launch Training'}
          </button>
        </form>
      </div>

      {/* ── Job history ───────────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex-between" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Job History</div>
          <button className="btn btn-secondary btn-sm" onClick={() => loadJobs()}>↻ Refresh</button>
        </div>

        {loadingJobs ? (
          <div className="empty-state">
            <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
          </div>
        ) : !jobs.length ? (
          <div className="empty-state">
            <p>No training jobs yet. Launch one above.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Model Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id}>
                    <td className="text-muted">#{j.id}</td>
                    <td style={{ fontWeight: 500 }}>{j.model_name}</td>
                    <td className="text-muted">{j.model_type}</td>
                    <td><StatusBadge status={j.status} /></td>
                    <td className="text-muted">{formatDuration(j.duration_s)}</td>
                    <td className="text-muted">{formatDate(j.created_at)}</td>
                    <td>
                      {(j.status === 'completed' || j.status === 'training') && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setChartsJob(j)}
                          title="View training charts"
                        >📊 Charts</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Training charts modal ─────────────────────────────────────── */}
      {chartsJob && (
        <TrainingCharts job={chartsJob} onClose={() => setChartsJob(null)} />
      )}
    </div>
  )
}
