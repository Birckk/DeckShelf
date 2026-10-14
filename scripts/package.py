"""Optional developer source + build archive; use npm run package:windows for users."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
destination = root.parent / 'deckshelf.zip'
directories = {'src', 'public', 'server', 'desktop', 'deploy', 'scripts', 'tests', 'docs', '.github', 'dist'}
files = {'package.json', 'package-lock.json', 'index.html', 'vite.config.ts',
         'tsconfig.json', 'playwright.config.ts', 'README.md', 'AGENTS.md',
         'LICENSE.md', '.gitignore', '.gitattributes'}
excluded = {'node_modules', '.git', 'qa', '__pycache__', 'release'}
if not (root / 'dist/index.html').is_file():
    raise SystemExit('Run npm run build before creating a source archive.')
with ZipFile(destination, 'w', ZIP_DEFLATED) as archive:
    for path in root.rglob('*'):
        if not path.is_file():
            continue
        relative = path.relative_to(root)
        if relative.parts[0] not in directories and str(relative) not in files:
            continue
        if any(part in excluded for part in relative.parts) or '.tmp.' in path.name or path.suffix == '.tsbuildinfo':
            continue
        if path.name.startswith('.env') or path.suffix in {'.log', '.pyc'}:
            continue
        archive.write(path, Path(root.name) / relative)
with ZipFile(destination) as archive:
    assert archive.testzip() is None
    assert f'{root.name}/dist/index.html' in archive.namelist()
    assert f'{root.name}/scripts/start-windows.cmd' in archive.namelist()
    print(f'{destination} ({destination.stat().st_size:,} bytes, {len(archive.namelist())} files)')
