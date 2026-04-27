import { useEffect, useState } from 'react'
import { datasetsApi, formatDate } from '../../api/client.js'

function SyncBadge({ id }) {
  if (id != null) return <span className="badge badge-ready">Listo</span>
  return <span className="badge badge-pending" title="Registra este dataset desde Auto Labeling para usarlo en entrenamiento">Sin registrar</span>
}

function ClassNames({ names }) {
  if (!names?.length) return <span className="text-muted">—</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 240 }}>
      {names.map(n => (
        <span key={n} style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-light)',
          borderRadius: 4, padding: '1px 6px',
          fontSize: 11, color: 'var(--text-secondary)',
        }}>{n}</span>
      ))}
    </div>
  )
}

function formatTimestamp(ts) {
  if (!ts) return '—'
  // ISO-like: 20240427T120000 → readable
  const m = ts.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/)
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`
  // Already a readable date or short string → return as-is (trim long UUIDs)
  if (ts.length > 24) return ts.slice(0, 22) + '…'
  return ts
}

export default function MentatTab() {
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await datasetsApi.listMentat()
      setDatasets(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="empty-state">
      <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
      <p>Cargando datasets de Auto Labeling…</p>
    </div>
  )

  if (error) return (
    <div>
      <div className="alert alert-error">{error}</div>
      <button className="btn btn-secondary" onClick={load}>Reintentar</button>
    </div>
  )

  if (!datasets.length) return (
    <div className="empty-state">
      <div style={{ fontSize: 32 }}>🏷️</div>
      <p>No hay datasets de Auto Labeling.</p>
      <p>Exporta un proyecto etiquetado desde MENTAT usando<br /><strong>"Exportar a fábrica"</strong> para que aparezca aquí.</p>
    </div>
  )

  const registered   = datasets.filter(d => d.id != null)
  const unregistered = datasets.filter(d => d.id == null)

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 12 }}>
        <span className="text-muted">
          {datasets.length} dataset{datasets.length !== 1 ? 's' : ''}
          {unregistered.length > 0 && (
            <span style={{ marginLeft: 8, color: 'var(--warning, #f59e0b)', fontSize: 12 }}>
              · {unregistered.length} sin registrar (no disponibles para entrenamiento)
            </span>
          )}
        </span>
        <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Proyecto</th>
              <th>Fecha</th>
              <th>Clases</th>
              <th>Imágenes</th>
              <th>Etiquetas</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((ds, i) => (
              <tr key={ds.id ?? `gcs-${i}`}>
                <td style={{ fontWeight: 500 }}>
                  {ds.project_name || '—'}
                </td>
                <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                  {ds.id
                    ? formatDate(ds.upload_date)
                    : formatTimestamp(ds.timestamp)
                  }
                </td>
                <td>{ds.class_count ?? '—'}</td>
                <td>{ds.image_count != null ? ds.image_count.toLocaleString() : '—'}</td>
                <td><ClassNames names={ds.class_names} /></td>
                <td><SyncBadge id={ds.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
