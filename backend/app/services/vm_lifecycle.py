"""
GCP Compute Engine — VM lifecycle management for the GPU training worker (VM2).
"""
import logging
import time
from app.config import settings

logger = logging.getLogger(__name__)


def _compute():
    from googleapiclient.discovery import build
    import google.auth
    credentials, _ = google.auth.default()
    return build("compute", "v1", credentials=credentials)


def start_training_vm(
    project: str = None,
    zone: str = None,
    vm_name: str = None,
) -> dict:
    project = project or settings.GCP_PROJECT
    zone = zone or settings.GCP_ZONE
    vm_name = vm_name or settings.GPU_VM_NAME
    logger.info("Starting VM %s in %s/%s", vm_name, project, zone)
    op = _compute().instances().start(project=project, zone=zone, instance=vm_name).execute()
    return op


def stop_training_vm(
    project: str = None,
    zone: str = None,
    vm_name: str = None,
) -> dict:
    project = project or settings.GCP_PROJECT
    zone = zone or settings.GCP_ZONE
    vm_name = vm_name or settings.GPU_VM_NAME
    logger.info("Stopping VM %s", vm_name)
    op = _compute().instances().stop(project=project, zone=zone, instance=vm_name).execute()
    return op


def get_vm_status(
    project: str = None,
    zone: str = None,
    vm_name: str = None,
) -> str:
    project = project or settings.GCP_PROJECT
    zone = zone or settings.GCP_ZONE
    vm_name = vm_name or settings.GPU_VM_NAME
    result = _compute().instances().get(project=project, zone=zone, instance=vm_name).execute()
    return result.get("status", "UNKNOWN")


def is_vm_running(project: str = None, zone: str = None, vm_name: str = None) -> bool:
    return get_vm_status(project, zone, vm_name) == "RUNNING"


def set_vm_metadata(
    key: str,
    value: str,
    project: str = None,
    zone: str = None,
    vm_name: str = None,
) -> None:
    """Set a metadata key on the VM instance (used to pass job config to startup script)."""
    project = project or settings.GCP_PROJECT
    zone = zone or settings.GCP_ZONE
    vm_name = vm_name or settings.GPU_VM_NAME

    compute = _compute()
    instance = compute.instances().get(project=project, zone=zone, instance=vm_name).execute()
    metadata = instance.get("metadata", {})
    items = metadata.get("items", [])

    # Update or add key
    existing = next((i for i in items if i["key"] == key), None)
    if existing:
        existing["value"] = value
    else:
        items.append({"key": key, "value": value})

    metadata["items"] = items
    operation = compute.instances().setMetadata(
        project=project,
        zone=zone,
        instance=vm_name,
        body=metadata,
    ).execute()

    # Wait for the async operation to complete before returning
    op_name = operation.get("name", "")
    deadline = time.time() + 60
    while time.time() < deadline:
        op = compute.zoneOperations().get(
            project=project, zone=zone, operation=op_name
        ).execute()
        if op.get("status") == "DONE":
            if "error" in op:
                raise RuntimeError(f"setMetadata failed: {op['error']}")
            break
        time.sleep(1)
    logger.info("Set metadata %s on VM %s", key, vm_name)
