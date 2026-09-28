"""Create a shareable source + production-build ZIP using only Python stdlib."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
destination = root.parent / 'commander-archive.zip'
excluded = {'node_modules', '.git', 'qa', '__pycache__'}
with ZipFile(destination, 'w', ZIP_DEFLATED) as archive:
    for path in root.rglob('*'):
        if not path.is_file():
            continue
        relative = path.relative_to(root)
        if any(part in excluded for part in relative.parts) or '.tmp.' in path.name or path.suffix == '.tsbuildinfo':
            continue
        archive.write(path, Path(root.name) / relative)
with ZipFile(destination) as archive:
    assert archive.testzip() is None
    assert 'commander-archive/dist/index.html' in archive.namelist()
    assert 'commander-archive/Start Commander Archive.cmd' in archive.namelist()
    print(f'{destination} ({destination.stat().st_size:,} bytes, {len(archive.namelist())} files)')
