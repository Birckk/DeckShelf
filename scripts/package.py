"""Optional developer source + build archive; use npm run package:windows for users."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
destination = root.parent / 'commander-archive.zip'
directories = {'src', 'public', 'server', 'desktop', 'scripts', 'tests', 'docs', '.github', 'dist'}
files = {'package.json', 'package-lock.json', 'index.html', 'vite.config.ts',
         'tsconfig.json', 'electron-builder.yml', 'README.md', 'AGENTS.md',
         'DESIGN.md', 'LICENSE.md', 'THIRD_PARTY_NOTICES.md', '.gitignore',
         'Start Commander Archive.cmd'}
excluded = {'node_modules', '.git', 'qa', '__pycache__', 'release'}
if not (root / 'dist/index.html').is_file():
    raise SystemExit('Run npm run build before creating a source archive.')
with ZipFile(destination, 'w', ZIP_DEFLATED) as archive:
    for path in root.rglob('*'):
        if not path.is_file():
            continue
        relative = path.relative_to(root)
        if relative.parts[0] not in directories and str(relative) not in files and relative.as_posix() != 'build/installer.nsh':
            continue
        if any(part in excluded for part in relative.parts) or '.tmp.' in path.name or path.suffix == '.tsbuildinfo':
            continue
        if path.name.startswith('.env') or path.suffix in {'.log', '.pyc'}:
            continue
        archive.write(path, Path(root.name) / relative)
with ZipFile(destination) as archive:
    assert archive.testzip() is None
    assert 'commander-archive/dist/index.html' in archive.namelist()
    assert 'commander-archive/Start Commander Archive.cmd' in archive.namelist()
    print(f'{destination} ({destination.stat().st_size:,} bytes, {len(archive.namelist())} files)')
