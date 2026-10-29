"""Restore preserved experiment snapshots; verify archive before extracting."""
from pathlib import Path
import hashlib
import io
import tarfile

root = Path(__file__).resolve().parents[1]
parts = sorted((root / 'evidence/snapshot-parts').glob('snapshots.tar.xz.part-*'))
if len(parts) != 11:
    raise SystemExit('Expected 11 snapshot archive parts')
data = b''.join(part.read_bytes() for part in parts)
if hashlib.sha256(data).hexdigest() != 'fa3d44d5362f3e68a8e3b7e3dc4e38cecd744718ae05a613e7544ff6cba2b4f4':
    raise SystemExit('Snapshot archive integrity mismatch')
with tarfile.open(fileobj=io.BytesIO(data), mode='r:xz') as archive:
    for member in archive.getmembers():
        destination = (root / member.name).resolve()
        if not destination.is_relative_to(root / 'evidence') or not member.isfile():
            raise SystemExit('Unexpected snapshot archive entry')
    archive.extractall(root, filter='data')
print('Experiment snapshots restored under evidence/')
