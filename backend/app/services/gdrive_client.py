"""
Google Drive client — download dataset ZIPs from Google Drive.

Supports two modes:
1. Service account / ADC (for files shared with the SA email)
2. Public URL fallback (for files shared as "anyone with the link")
"""
import logging
import re
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Timeout for large file downloads (datasets can be several GB)
_DOWNLOAD_TIMEOUT = httpx.Timeout(30.0, read=600.0)


# ── Drive API (service account / ADC) ──────────────────────────────────────────

def _get_drive_service():
    from app.config import settings
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    if settings.GOOGLE_APPLICATION_CREDENTIALS:
        creds = service_account.Credentials.from_service_account_file(
            settings.GOOGLE_APPLICATION_CREDENTIALS,
            scopes=["https://www.googleapis.com/auth/drive.readonly"],
        )
    else:
        import google.auth
        creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/drive.readonly"])

    return build("drive", "v3", credentials=creds)


def _is_permission_error(exc: Exception) -> bool:
    """Return True for any 403/Drive-API error that should trigger the public URL fallback."""
    msg = str(exc).lower()
    return (
        "403" in msg
        or "permission" in msg
        or "forbidden" in msg
        or "accessnotconfigured" in msg
        or "drive api has not been used" in msg
        or "disabled" in msg
    )


# ── Public URL download (for "anyone with the link" files) ─────────────────────

def _download_public_url(file_id: str, local_path: str) -> None:
    """Download a publicly shared Google Drive file using direct URL (no auth required)."""
    # Use the usercontent endpoint with confirm=t to bypass virus-scan warning for large files
    url = f"https://drive.usercontent.google.com/download?id={file_id}&export=download&authuser=0&confirm=t"

    logger.info("Downloading public Drive file %s via URL", file_id)

    with httpx.Client(timeout=_DOWNLOAD_TIMEOUT, follow_redirects=True) as client:
        with client.stream("GET", url) as resp:
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")

            # If we still get HTML, Google is showing a confirmation page — parse the confirm token
            if "text/html" in content_type:
                html = resp.read().decode("utf-8", errors="ignore")
                match = re.search(r'confirm=([0-9A-Za-z_\-]+)', html)
                if match:
                    token = match.group(1)
                    url2 = f"https://drive.google.com/uc?export=download&id={file_id}&confirm={token}"
                    with client.stream("GET", url2) as resp2:
                        resp2.raise_for_status()
                        with open(local_path, "wb") as f:
                            for chunk in resp2.iter_bytes(chunk_size=65536):
                                f.write(chunk)
                    return
                raise RuntimeError(f"Could not download file {file_id}: Google returned HTML page")

            with open(local_path, "wb") as f:
                for chunk in resp.iter_bytes(chunk_size=65536):
                    f.write(chunk)

    logger.info("Public download complete: %s → %s", file_id, local_path)


def _get_public_metadata(file_id: str) -> Optional[dict]:
    """Get basic metadata for a public file by making a HEAD request."""
    url = f"https://drive.usercontent.google.com/download?id={file_id}&export=download&authuser=0&confirm=t"
    try:
        with httpx.Client(timeout=httpx.Timeout(15.0), follow_redirects=True) as client:
            resp = client.head(url)
            content_disp = resp.headers.get("content-disposition", "")
            name_match = re.search(r'filename[*]?=["\']?([^"\';\r\n]+)', content_disp)
            name = name_match.group(1).strip() if name_match else f"{file_id}.zip"
            size = int(resp.headers.get("content-length", 0))
            return {"id": file_id, "name": name, "size": size, "mime_type": "application/zip"}
    except Exception as exc:
        logger.warning("Could not get public metadata for %s: %s", file_id, exc)
        return None


# ── Public API ─────────────────────────────────────────────────────────────────

def get_file_metadata(file_id: str) -> Optional[dict]:
    """Get file metadata. Tries Drive API first, falls back to public URL."""
    try:
        service = _get_drive_service()
        meta = service.files().get(
            fileId=file_id,
            fields="id,name,size,mimeType",
            supportsAllDrives=True,
        ).execute()
        return {
            "id": meta["id"],
            "name": meta.get("name", "unknown"),
            "size": int(meta.get("size", 0)),
            "mime_type": meta.get("mimeType", ""),
        }
    except Exception as exc:
        if _is_permission_error(exc):
            logger.info("Drive API permission denied for %s, trying public URL", file_id)
            return _get_public_metadata(file_id)
        logger.error("Failed to get Drive metadata for %s: %s", file_id, exc)
        return None


def download_file(file_id: str, local_path: str) -> None:
    """Download a file from Google Drive. Tries Drive API first, falls back to public URL."""
    try:
        from googleapiclient.http import MediaIoBaseDownload
        service = _get_drive_service()
        request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
        with open(local_path, "wb") as f:
            downloader = MediaIoBaseDownload(f, request, chunksize=50 * 1024 * 1024)
            done = False
            while not done:
                _, done = downloader.next_chunk()
        logger.info("Downloaded Drive file %s to %s via API", file_id, local_path)
    except Exception as exc:
        if _is_permission_error(exc):
            logger.info("Drive API denied for %s, falling back to public URL", file_id)
            _download_public_url(file_id, local_path)
        else:
            raise


def list_folder_files(folder_id: str, mime_filter: str = None) -> list[dict]:
    """List files in a Google Drive folder (requires SA access)."""
    service = _get_drive_service()
    query = f"'{folder_id}' in parents and trashed = false"
    if mime_filter:
        query += f" and mimeType = '{mime_filter}'"

    results = []
    page_token = None
    while True:
        resp = service.files().list(
            q=query,
            fields="nextPageToken, files(id, name, size, mimeType)",
            pageSize=100,
            pageToken=page_token,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        ).execute()
        results.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    return [
        {
            "id": f["id"],
            "name": f.get("name", "unknown"),
            "size": int(f.get("size", 0)),
            "mime_type": f.get("mimeType", ""),
        }
        for f in results
    ]
