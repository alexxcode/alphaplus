import { useEffect, useState } from 'react'
import { modelsApi, formatDate, BASE } from '../../api/client.js'

export default function ModelRegistry() {
  const [versions, setVersions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [promoting, setPromoting] = useState(null)
  const [toast, setToast]       = useState(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const data = await modelsApi.list()
      setVersions(data)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function handlePromote(id, modelName) {
    setPromoting(id)
    try {
      await modelsApi.promote(id)
      showToast(`${modelName} promoted to production.`)
      load()
    } catch (e) { showToast(e.message, 'error') }
    setPromoting(null)
  }

  // Group by model_name
  const groups = versions.reduce((acc, v) => {
    if (!acc[v.model_name]) acc[v.model_name] = []
    acc[v.model_name].push(v)
    return acc
  }, {})

  return (
    <div>
      <div className="page-header">
        <h2>Model Registry</h2>
        <button className="btn btn-secondary" onClick={load}>↻ Refresh</button>
      </div>

      {toast && (
        <div className={`alert alert-${toast.type === 'error' ? 'error' : 'success'}`}>
          {toast.msg}
        </div>
      )}

      {loading && (
        <div className="empty-state">
          <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && !Object.keys(groups).length && (
        <div className="empty-state">
          <div style={{ fontSize: 32 }}>📦</div>
          <p>No model versions registered yet.</p>
          <p>Complete a training job to see models here.</p>
        </div>
      )}

      {Object.entries(groups).map(([modelName, mvs]) => (
        <div className="card" key={modelName}>
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>
              {modelName}
              {mvs.some(v => v.is_production) && (
                <span className="badge badge-production" style={{ marginLeft: 10 }}>
                  PRODUCTION ACTIVE
                </span>
              )}
            </div>
            <span className="text-muted">{mvs.length} version{mvs.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>mAP@50</th>
                  <th>Precision</th>
                  <th>Recall</th>
                  <th>Speed (ms/img)</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {mvs.sort((a, b) => b.version - a.version).map(v => (
                  <tr key={v.id} style={{ background: v.is_production ? 'rgba(34,197,94,0.04)' : undefined }}>
                    <td style={{ fontWeight: 600 }}>v{v.version}</td>
                    <td>{v.map50 != null ? (v.map50 * 100).toFixed(1) + '%' : '—'}</td>
                    <td>{v.precision != null ? (v.precision * 100).toFixed(1) + '%' : '—'}</td>
                    <td>{v.recall != null ? (v.recall * 100).toFixed(1) + '%' : '—'}</td>
                    <td>{v.speed_ms != null ? v.speed_ms.toFixed(1) : '—'}</td>
                    <td className="text-muted">{formatDate(v.created_at)}</td>
                    <td>
                      {v.is_production
                        ? <span className="badge badge-production">PRODUCTION</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      {!v.is_production && (
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={promoting === v.id}
                          onClick={() => handlePromote(v.id, modelName)}
                        >
                          {promoting === v.id
                            ? <><span className="spinner" /> Promoting…</>
                            : 'Promote'}
                        </button>
                      )}
                      <a
                        href={`${BASE}/models/${v.id}/download`}
                        download={`${v.model_name}_v${v.version}_best.pt`}
                        className="btn btn-secondary btn-sm"
                        title="Download best.pt"
                      >
                        ↓ .pt
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
