import { useRef, useState } from 'react'
import { datasetsApi, formatBytes } from '../../api/client.js'

// ── Phase constants ───────────────────────────────────────────────────────────
const PHASE_SELECT     = 'select'
const PHASE_UPLOADING  = 'uploading'
const PHASE_PROCESSING = 'processing'

const MIN_BYTES = 10_485_760        // 10 MB
const MAX_BYTES = 21_474_836_480    // 20 GB
const POLL_MS   = 5_000
const POLL_TIMEOUT_MS = 30 * 60 * 1000

export default function UploadModal({ onClose, onComplete }) {
  const [phase, setPhase]           = useState(PHASE_SELECT)
  const [file, setFile]             = useState(null)
  const [projectName, setProjectName] = useState('')
  const [dragOver, setDragOver]     = useState(false)
  const [validationErr, setValErr]  = useState(null)

  // Upload progress
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed]       = useState(0)        // bytes/s
  const [eta, setEta]           = useState(null)     // seconds

  // Processing
  const [statusData, setStatusData] = useState(null)

  // IDs for cancel / polling
  const [datasetId, setDatasetId]   = useState(null)
  const xhrRef  = useRef(null)
  const pollRef = useRef(null)

  // ── File selection helpers ─────────────────────────────────────────────────
  function validateFile(f) {
    if (!f.name.toLowerCase().endsWith('.zip')) return 'Only .zip files are accepted.'
    if (f.size < MIN_BYTES) return `File too small. Minimum: ${formatBytes(MIN_BYTES)}.`
    if (f.size > MAX_BYTES) return `File too large. Maximum: ${formatBytes(MAX_BYTES)}.`
    return null
  }

  function pickFile(f) {
    const err = validateFile(f)
    setValErr(err)
    if (!err) setFile(f)
  }

  function onInputChange(e) {
    if (e.target.files[0]) pickFile(e.target.files[0])
  }

  function onDrop(e) {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer.files[0]) pickFile(e.dataTransfer.files[0])
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function startUpload() {
    if (!file || !projectName.trim()) return
    setValErr(null)

    // 1. Get resumable URL from backend
    let initData
    try {
      initData = await datasetsApi.initUpload({
        filename: file.name,
        file_size_bytes: file.size,
        project_name: projectName.trim(),
      })
    } catch (e) {
      setValErr(`Could not start upload: ${e.message}`)
      return
    }

    setDatasetId(initData.dataset_id)
    setPhase(PHASE_UPLOADING)

    const startTime = Date.now()
    let lastLoaded  = 0
    let lastTime    = startTime

    // 2. XHR PUT directly to GCS resumable URL
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhrRef.current = xhr

      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable) return
        const now = Date.now()
        const dt  = (now - lastTime) / 1000
        const db  = ev.loaded - lastLoaded

        if (dt > 0.5) {
          const currentSpeed = db / dt
          setSpeed(currentSpeed)
          const remaining = (ev.total - ev.loaded) / (currentSpeed || 1)
          setEta(remaining)
          lastLoaded = ev.loaded
          lastTime   = now
        }
        setProgress(Math.round((ev.loaded / ev.total) * 100))
      }

      xhr.onload = () => {
        // GCS returns 200 or 308 on success
        if (xhr.status === 200 || xhr.status === 308 || (xhr.status >= 200 && xhr.status < 300)) {
          resolve()
        } else {
          reject(new Error(`GCS upload failed (HTTP ${xhr.status})`))
        }
      }
      xhr.onerror  = () => reject(new Error('Network error during upload'))
      xhr.onabort  = () => reject(new Error('Upload cancelled'))

      xhr.open('PUT', initData.gcs_resumable_url)
      xhr.setRequestHeader('Content-Type', 'application/zip')
      xhr.send(file)
    }).catch(err => {
      // Cleanup on error
      if (initData?.dataset_id) datasetsApi.cancel(initData.dataset_id).catch(() => {})
      throw err
    })

    // 3. Notify backend → triggers Celery extraction
    try {
      await datasetsApi.completeUpload({
        dataset_id: initData.dataset_id,
        upload_id:  initData.upload_id,
      })
    } catch (e) {
      setValErr(`Upload complete, but processing could not start: ${e.message}`)
      return
    }

    // 4. Switch to processing phase and poll
    setPhase(PHASE_PROCESSING)
    startPolling(initData.dataset_id)
  }

  function startPolling(id) {
    const deadline = Date.now() + POLL_TIMEOUT_MS
    pollRef.current = setInterval(async () => {
      try {
        const data = await datasetsApi.getStatus(id)
        setStatusData(data)
        if (data.status === 'ready' || data.status === 'failed') {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      } catch (_) {}
      if (Date.now() > deadline) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }, POLL_MS)
  }

  async function handleUpload() {
    try {
      await startUpload()
    } catch (e) {
      setPhase(PHASE_SELECT)
      setValErr(e.message)
    }
  }

  function handleCancel() {
    if (xhrRef.current) xhrRef.current.abort()
    if (datasetId) datasetsApi.cancel(datasetId).catch(() => {})
    if (pollRef.current) clearInterval(pollRef.current)
    onClose()
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && phase === PHASE_SELECT && onClose()}>
      <div className="modal">

        {/* ── Phase: SELECT ──────────────────────────────────────────────── */}
        {phase === PHASE_SELECT && (
          <>
            <h3 className="modal-title">Upload Dataset</h3>

            {/* Drop zone */}
            <div
              className={`drop-zone${dragOver ? ' drag-over' : ''}${file ? ' has-file' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => document.getElementById('file-input').click()}
            >
              <input id="file-input" type="file" accept=".zip" hidden onChange={onInputChange} />
              {file ? (
                <>
                  <div className="drop-icon">✅</div>
                  <strong>{file.name}</strong>
                  <div className="text-muted mt-4">{formatBytes(file.size)}</div>
                </>
              ) : (
                <>
                  <div className="drop-icon">📦</div>
                  <div>Drag & drop your <strong>.zip</strong> here, or click to browse</div>
                  <div className="text-muted mt-4">Accepted: .zip · 10 MB – 20 GB</div>
                  <div className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
                    Structure: data.yaml / train/images/ / train/labels/ / val/images/ / val/labels/
                  </div>
                </>
              )}
            </div>

            {/* Project name */}
            <div className="form-group mt-16">
              <label className="form-label">Project name</label>
              <input
                className="form-input"
                placeholder="e.g. safety-gloves-v3"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
              />
            </div>

            {validationErr && <div className="alert alert-error">{validationErr}</div>}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!file || !projectName.trim() || !!validationErr}
                onClick={handleUpload}
              >
                Upload
              </button>
            </div>
          </>
        )}

        {/* ── Phase: UPLOADING ───────────────────────────────────────────── */}
        {phase === PHASE_UPLOADING && (
          <>
            <h3 className="modal-title">Uploading {file?.name}</h3>

            <div className="progress-wrap" style={{ marginBottom: 12 }}>
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>

            <div className="flex-between text-muted" style={{ marginBottom: 16 }}>
              <span>{progress}%</span>
              <span>
                {speed > 0 ? `${formatBytes(speed)}/s` : '—'}
                {eta != null && eta > 0 ? ` · ~${Math.ceil(eta)}s remaining` : ''}
              </span>
            </div>

            <div className="alert alert-info" style={{ marginBottom: 0 }}>
              Uploading directly to secure storage — do not close this window.
            </div>

            <div className="modal-footer">
              <button className="btn btn-danger" onClick={handleCancel}>Cancel Upload</button>
            </div>
          </>
        )}

        {/* ── Phase: PROCESSING ─────────────────────────────────────────── */}
        {phase === PHASE_PROCESSING && (
          <>
            <h3 className="modal-title">Processing Dataset</h3>

            {(!statusData || !['ready', 'failed'].includes(statusData.status)) && (
              <>
                <div className="flex gap-8" style={{ marginBottom: 16 }}>
                  <span className="spinner" />
                  <span>{statusData?.progress_message || 'Processing…'}</span>
                </div>
                <div className="alert alert-info">
                  You can close this window. The dataset will appear in the <strong>Manual Upload</strong> tab when ready.
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={onClose}>Close</button>
                </div>
              </>
            )}

            {statusData?.status === 'ready' && (
              <>
                <div className="alert alert-success">
                  ✅ Dataset ready! <strong>{statusData.image_count}</strong> images · <strong>{statusData.class_count}</strong> classes
                </div>
                <div className="modal-footer">
                  <button className="btn btn-primary" onClick={onComplete}>View Dataset</button>
                </div>
              </>
            )}

            {statusData?.status === 'failed' && (
              <>
                <div className="alert alert-error">
                  ❌ Processing failed: {statusData.error_message}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={onClose}>Close</button>
                </div>
              </>
            )}
          </>
        )}

      </div>
    </div>
  )
}
