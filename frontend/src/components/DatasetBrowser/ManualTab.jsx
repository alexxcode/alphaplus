import { useEffect, useRef, useState } from 'react'
import { datasetsApi, formatBytes, formatDate } from '../../api/client.js'

const PROCESSING_STATUSES = new Set(['pending_upload', 'uploading', 'extracting', 'validating'])

function StatusBadge({ status, progressMessage }) {
  if (status === 'ready')   return <span className="badge badge-ready">Ready</span>
  if (status === 'failed')  return <span className="badge badge-failed">Failed</span>
  return (
    <span className="badge badge-processing flex gap-8">
      <span className="spinner" />
      {progressMessage || status}
    </span>
  )
}

export default function ManualTab({ refreshTrigger }) {
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const pollRef = useRef(null)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const data = await datasetsApi.listManual()
      setDatasets(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Auto-poll if any dataset is processing
  useEffect(() => {
    const hasProcessing = datasets.some(d => PROCESSING_STATUSES.has(d.status))
    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(() => load(true), 5000)
    }
    if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [datasets])

  useEffect(() => { load() }, [refreshTrigger])

  if (loading) return (
    <div className="empty-state">
      <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
      <p>Loading datasets…</p>
    </div>
  )

  if (error) return (
    <div>
      <div className="alert alert-error">{error}</div>
      <button className="btn btn-secondary" onClick={() => load()}>Retry</button>
    </div>
  )

  if (!datasets.length) return (
    <div className="empty-state">
      <div style={{ fontSize: 32 }}>📂</div>
      <p>No manual datasets yet.</p>
      <p>Click <strong>"+ Upload Dataset"</strong> to add one.</p>
    </div>
  )

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 12 }}>
        <span className="text-muted">{datasets.length} dataset{datasets.length !== 1 ? 's' : ''}</span>
        <button className="btn btn-secondary btn-sm" onClick={() => load()}>↻ Refresh</button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>File</th>
              <th>Project</th>
              <th>Size</th>
              <th>Status</th>
              <th>Classes</th>
              <th>Images</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {datasets.map(ds => (
              <tr key={ds.id}>
                <td style={{ fontWeight: 500 }}>
                  {ds.original_filename || '—'}
                </td>
                <td className="text-muted">{ds.project_name || '—'}</td>
                <td className="text-muted">{formatBytes(ds.file_size_bytes)}</td>
                <td>
                  <StatusBadge status={ds.status} progressMessage={ds.progress_message} />
                  {ds.status === 'failed' && ds.error_message && (
                    <div className="text-muted mt-4" style={{ maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      title={ds.error_message}>
                      {ds.error_message}
                    </div>
                  )}
                </td>
                <td>{ds.class_count ?? '—'}</td>
                <td>{ds.image_count ?? '—'}</td>
                <td className="text-muted">{formatDate(ds.upload_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
