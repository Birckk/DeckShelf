"""Build the display-only starter catalog from the reference workbook and Archidekt.

Uses Python's standard library. Does not modify the workbook or import owner data.
Usage: python scripts/seed.py path/to/Commander.xlsx
"""
import html
import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
HEADERS = {'User-Agent': 'DeckShelf/1.0 (personal deck showcase)', 'Accept': 'application/json,text/html,image/*'}

def get(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=40) as r:
                return r.read()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 + attempt)

def description_text(value):
    if not value:
        return ''
    try:
        rich = json.loads(value) if isinstance(value, str) else value
        if isinstance(rich, dict) and isinstance(rich.get('ops'), list):
            value = ''.join(op['insert'] if isinstance(op.get('insert'),str) else op.get('insert',{}).get('card-link','') for op in rich['ops'])
    except (ValueError, TypeError):
        pass
    return html.unescape(re.sub('<[^>]+>', '', str(value))).strip()

def sheet_rows(path):
    with zipfile.ZipFile(path) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(e.itertext()) for e in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si', NS)]
        workbook = ET.fromstring(z.read('xl/workbook.xml'))
        sheets = workbook.find('s:sheets', NS)
        sheet = next(s for s in sheets if s.attrib['name'] == 'Decks')
        rel_id = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        target = next(r.attrib['Target'] for r in rels if r.attrib['Id'] == rel_id)
        target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        for row in ET.fromstring(z.read(target)).findall('.//s:sheetData/s:row', NS):
            cells = {}
            for cell in row:
                val = cell.find('s:v', NS)
                value = val.text if val is not None else ''
                if cell.attrib.get('t') == 's':
                    value = strings[int(value)]
                elif cell.attrib.get('t') == 'inlineStr':
                    value = ''.join(cell.find('s:is', NS).itertext())
                cells[re.sub(r'\d+', '', cell.attrib['r'])] = value or ''
            yield int(row.attrib['r']), cells

if __name__ == '__main__':
    rows = [cells for n, cells in sheet_rows(sys.argv[1]) if 2 <= n <= 30]
    cache_path = ROOT / 'scripts' / 'catalog.tmp.html'
    catalog = cache_path.read_text(encoding='utf-8') if cache_path.exists() else get('https://archidekt.com/commander-precons').decode()
    (ROOT / 'scripts' / 'catalog.tmp.html').write_text(catalog, encoding='utf-8')
    match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', catalog)
    precons = json.loads(match[1])['props']['pageProps']['precons']
    all_precons = [(group, deck) for group, decks in precons.items() for deck in decks]
    assets = ROOT / 'public' / 'images'
    assets.mkdir(parents=True, exist_ok=True)
    out = ROOT / 'src' / 'data'
    out.mkdir(parents=True, exist_ok=True)
    decks = []
    colors = {'White':'W', 'Blue':'U', 'Black':'B', 'Red':'R', 'Green':'G'}
    for row in rows:
        name = row['O'].replace('Fatastic', 'Fantastic').replace('World Shapers', 'World Shaper')
        matches = [(group, d) for group, d in all_precons if d['name'].casefold().startswith(name.casefold())]
        if len(matches) != 1:
            print('UNRESOLVED', name, [(g, d['name']) for g,d in matches], flush=True)
            raise ValueError('Need unambiguous curated match for ' + name)
        group, brief = matches[0]
        deck_id = brief['id']
        cache = ROOT / 'scripts' / f'{deck_id}.tmp.json'
        raw = json.loads(cache.read_text(encoding='utf-8')) if cache.exists() else json.loads(get(f'https://archidekt.com/api/decks/{deck_id}/'))
        cache.write_text(json.dumps(raw), encoding='utf-8')
        assert raw['owner']['username'] == 'Archidekt_Precons'
        commander_cards = [item['card'] for item in raw['cards'] if 'Commander' in item['categories']]
        if not commander_cards:
            raise ValueError('No commander: ' + name)
        featured = raw.get('featured') or brief.get('featured') or ''
        commander_cards.sort(key=lambda c: c['uid'] not in featured)
        commanders = []
        for card in commander_cards:
            uid = card['uid']
            urls = {kind: f'https://card-images.archidekt.com/{kind}/front/{uid[0]}/{uid[1]}/{uid}.webp' for kind in ['art','grid']}
            paths = {}
            for kind, url in urls.items():
                file = assets / f'{uid}-{kind}.webp'
                if not file.exists():
                    file.write_bytes(get(url))
                paths[kind] = '/images/' + file.name
            commanders.append({'name': card['oracleCard']['name'], 'art': paths['art'], 'image': paths['grid'], 'artSource': urls['art'], 'imageSource': urls['grid'], 'artist': card['artist']})
        color_set = {colors[c] for card in commander_cards for c in card['oracleCard']['colorIdentity'] if c in colors}
        tags = [t['name'] for t in brief.get('tags',[]) if t['name'] != 'Unmodified Precon']
        tag_aliases = {'token':'Tokens', 'artifact':'Artifacts', 'big mana':'Big Mana', 'life gain':'Lifegain'}
        tags = list(dict.fromkeys(tag_aliases.get(t.lower(),t) for t in tags + [s.strip() for s in row.get('D','').split(',') if s.strip()]))
        set_name = re.sub(r'\s*\([A-Z0-9]+\)$','',group).replace('Cmdr','Commander')
        if set_name == 'Home':
            set_name = {'Foundation':'Foundations Commander', 'Realty Fracture':'Reality Fracture'}.get(row['E'], commander_cards[0]['edition']['editionname'])
        decks.append({'id': str(deck_id), 'name': name, 'set': set_name, 'colors': [c for c in 'WUBRG' if c in color_set], 'theme': row['B'].strip(), 'tags': tags, 'description': description_text(raw.get('description')), 'commanders': commanders, 'sourceUrl': f'https://archidekt.com/decks/{deck_id}', 'originalUrl': row['P'], 'sourceName': 'Archidekt', 'cardCount': sum(c['quantity'] for c in raw['cards'] if not any(k in c['categories'] for k in ['Maybeboard','Sideboard'])), 'releasedAt': commander_cards[0]['releasedAt'], 'fetchedAt': datetime.now(timezone.utc).isoformat()})
        print(f"{len(decks):02d} {name}: {', '.join(c['name'] for c in commanders)}", flush=True)
        time.sleep(.2)
    (out / 'decks.json').write_text(json.dumps(decks, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'Saved {len(decks)} decks and their commander images.', flush=True)
