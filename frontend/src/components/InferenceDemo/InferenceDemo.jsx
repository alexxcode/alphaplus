import { useEffect, useRef, useState } from 'react'
import { inferenceApi } from '../../api/client.js'

const ACCEPTED_TYPES = 'image/*,video/mp4,video/avi,video/quicktime,video/x-matroska,video/webm,.mp4,.avi,.mov,.mkv,.webm'

function isVideo(file) {
  if (file.type && file.type.startsWith('video/')) return true
  const ext = file.name?.split('.').pop()?.toLowerCase()
  return ['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)
}

export default function InferenceDemo() {
  const [modelStatus, setModelStatus] = useState(null)
  const [file, setFile]               = useState(null)
  const [fileIsVideo, setFileIsVideo]  = useState(false)
  const [preview, setPreview]          = useState(null)
  const [result, setResult]            = useState(null)
  const [running, setRunning]          = useState(false)
  const [downloading, setDownloading]  = useState(false)
  const [error, setError]              = useState(null)
  const [dragOver, setDragOver]        = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inferenceApi.status().then(setModelStatus).catch(() => setModelStatus(null))
  }, [])

  function pickFile(f) {
    if (!f) return
    const isVid = isVideo(f)
    if (!isVid && !f.type.startsWith('image/')) return
    setFile(f)
    setFileIsVideo(isVid)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setError(null)
  }

  function onDrop(e) {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer.files[0]) pickFile(e.dataTransfer.files[0])
  }

  async function runInference() {
    if (!file) return
    setRunning(true); setError(null); setResult(null)
    try {
      const data = await inferenceApi.predict(file)
      setResult(data)
    } catch (e) { setError(e.message) }
    setRunning(false)
  }

  async function downloadAnnotated() {
    if (!file || !fileIsVideo) return
    setDownloading(true); setError(null)
    try {
      await inferenceApi.downloadAnnotated(file)
    } catch (e) { setError(e.message) }
    setDownloading(false)
  }

  return (
    <div>
      <div className="page-header">
        <h2>Inference API</h2>
      </div>

      {/* Model status */}
      {modelStatus && (
        <div className={`alert alert-${modelStatus.has_production_model ? 'success' : 'warning'}`}
          style={{ marginBottom: 20 }}>
          {modelStatus.has_production_model
            ? `Production model: ${modelStatus.model_name} v${modelStatus.version}`
            : 'No production model. Go to Model Registry and promote a version.'}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Upload */}
        <div className="card">
          <div className="card-title">Input</div>
          <div
            className={`drop-zone${dragOver ? ' drag-over' : ''}${file ? ' has-file' : ''}`}
            style={{ marginBottom: 16 }}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current.click()}
          >
            <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} hidden
              onChange={e => e.target.files[0] && pickFile(e.target.files[0])} />
            {preview ? (
              fileIsVideo ? (
                <div style={{ textAlign: 'center' }}>
                  <video src={preview} style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 6 }}
                    controls={false} muted />
                  <div style={{ fontSize: 12, marginTop: 6, color: 'var(--success)' }}>{file.name}</div>
                </div>
              ) : (
                <img src={preview} alt="preview"
                  style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 6, objectFit: 'contain' }} />
              )
            ) : (
              <>
                <div className="drop-icon">🎯</div>
                <div>Drop an image or video, or click to browse</div>
                <div className="text-muted mt-4">JPG, PNG, BMP, WebP, MP4, AVI, MOV, MKV, WebM</div>
              </>
            )}
          </div>

          <button
            className="btn btn-primary"
            disabled={!file || running || downloading || !modelStatus?.has_production_model}
            onClick={runInference}
            style={{ width: '100%', justifyContent: 'center', marginBottom: fileIsVideo ? 8 : 0 }}
          >
            {running
              ? <><span className="spinner" /> {fileIsVideo ? 'Processing video...' : 'Running...'}</>
              : 'Run Inference'}
          </button>

          {fileIsVideo && (
            <button
              className="btn btn-secondary"
              disabled={!file || running || downloading || !modelStatus?.has_production_model}
              onClick={downloadAnnotated}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {downloading
                ? <><span className="spinner" /> Generating annotated video...</>
                : '⬇ Download Annotated Video'}
            </button>
          )}
        </div>

        {/* Results */}
        <div className="card">
          <div className="card-title">Results</div>

          {error && <div className="alert alert-error">{error}</div>}

          {!result && !error && (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <p>Upload an image or video and click Run Inference.</p>
            </div>
          )}

          {result && result.type === 'image' && <ImageResult result={result} />}
          {result && result.type === 'video' && <VideoResult result={result} />}
        </div>
      </div>
    </div>
  )
}


function ImageResult({ result }) {
  return (
    <>
      <div className="flex-between" style={{ marginBottom: 12 }}>
        <span className="text-muted">
          Model: {result.model_name} v{result.model_version}
        </span>
        <span className="text-muted">{result.inference_time_ms} ms</span>
      </div>

      {result.detections?.length === 0 ? (
        <div className="alert alert-warning">No detections found.</div>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Class</th><th>Confidence</th><th>BBox (x1,y1,x2,y2)</th></tr>
          </thead>
          <tbody>
            {result.detections?.map((d, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{d.class_name}</td>
                <td>{(d.confidence * 100).toFixed(1)}%</td>
                <td className="text-muted" style={{ fontSize: 11 }}>
                  {d.bbox
                    ? `${d.bbox.x1.toFixed(0)}, ${d.bbox.y1.toFixed(0)}, ${d.bbox.x2.toFixed(0)}, ${d.bbox.y2.toFixed(0)}`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}


function VideoResult({ result }) {
  const [expandedFrame, setExpandedFrame] = useState(null)
  const { video_info, summary, frames } = result

  return (
    <>
      <div className="flex-between" style={{ marginBottom: 12 }}>
        <span className="text-muted">
          Model: {result.model_name} v{result.model_version}
        </span>
        <span className="text-muted">{result.inference_time_ms} ms total</span>
      </div>

      {/* Video info */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
        marginBottom: 16, fontSize: 12,
      }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
          <div className="text-muted">Duration</div>
          <div style={{ fontWeight: 600 }}>{video_info.duration_s}s</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
          <div className="text-muted">Frames</div>
          <div style={{ fontWeight: 600 }}>{video_info.frames_processed} / {video_info.total_frames}</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
          <div className="text-muted">Resolution</div>
          <div style={{ fontWeight: 600 }}>{video_info.width}x{video_info.height}</div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Summary</div>
        <div className="text-muted" style={{ fontSize: 12 }}>
          {summary.total_detections} total detections across {frames.length} frames
        </div>
        {summary.unique_classes.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {summary.unique_classes.map(c => (
              <span key={c} className="badge badge-ready">{c}</span>
            ))}
          </div>
        )}
      </div>

      {result.note && (
        <div className="alert alert-info" style={{ fontSize: 11, marginBottom: 16 }}>
          {result.note}
        </div>
      )}

      {/* Frame-by-frame results */}
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Frame Details</div>
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {frames.filter(f => f.detections.length > 0).length === 0 ? (
          <div className="alert alert-warning">No detections in any frame.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Frame</th>
                <th>Time</th>
                <th>Detections</th>
                <th>Classes</th>
              </tr>
            </thead>
            <tbody>
              {frames.filter(f => f.detections.length > 0).map((f, i) => (
                <tr key={i} onClick={() => setExpandedFrame(expandedFrame === f.frame ? null : f.frame)}
                  style={{ cursor: 'pointer' }}>
                  <td className="text-muted">#{f.frame}</td>
                  <td className="text-muted">{f.timestamp_s}s</td>
                  <td>{f.detections.length}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {[...new Set(f.detections.map(d => d.class_name))].map(c => (
                        <span key={c} className="badge badge-ready" style={{ fontSize: 10, padding: '1px 5px' }}>{c}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
