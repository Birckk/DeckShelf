import { ArrowLeft, ArrowRight, Folder, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Artwork } from './components';
import type { CollectionSource } from './domain';
import { formatOf } from './domain';
import FormatSelect from './FormatSelect';

export type FolderDiscovery = {
  name: string;
  folders: { source: CollectionSource; path: string; root: boolean }[];
};

export default function SourceSetup({ value, setValue, discovery, selected, setSelected, busy, back, connect, save, formatScope, setFormatScope }: {
  formatScope: string; setFormatScope: (value: string) => void;
  value: string; setValue: (value: string) => void;
  discovery: FolderDiscovery | null; selected: string[];
  setSelected: (ids: string[]) => void; busy: boolean;
  back: () => void; connect: (event: React.FormEvent) => void; save: (onlyFolders: boolean) => void;
}) {
  const [onlyFolders, setOnlyFolders] = useState(true);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (discovery) heading.current?.focus(); }, [discovery]);
  const entries = discovery?.folders.flatMap(f => f.source.entries) || [];
  const folders = discovery?.folders.map(folder => ({ ...folder, source: { ...folder.source, entries: folder.source.entries.filter(entry => formatScope === 'all' || formatOf(entry).id === formatScope) } })) || [];
  const allIds = [...new Set(folders.flatMap(f => f.source.entries.map(e => e.id)))];
  const select = (ids: string[], on: boolean) => setSelected(on
    ? [...new Set([...selected, ...ids])]
    : selected.filter(id => !ids.includes(id)));
  return <div className="source-setup">
    <button className="text-button" disabled={busy} onClick={back}><ArrowLeft size={14} />{discovery ? 'Change source' : 'Back to collections'}</button>
    {!discovery ? <form onSubmit={connect} className="manager-connect">
      <h3>Bring your decks</h3>
      <p>Paste your username to choose folders, or add a deck by its link.</p>
      <label htmlFor="collection-source-input">Username, profile, folder or deck link</label>
      <div className="manager-input-line">
        <input id="collection-source-input" value={value} onChange={e => setValue(e.target.value)} placeholder="Archidekt username or link" required disabled={busy} autoFocus autoComplete="off" spellCheck={false} />
        <button className="button button-gold" disabled={busy}><Search size={15} />{busy ? 'Finding decks…' : 'Continue'}</button>
      </div>
      <p className="manager-note">Public decks only. Decklists stay on Archidekt.</p>
    </form> : <>
      <div className="source-choice-heading"><h3 ref={heading} tabIndex={-1}>Which folders do you want to show?</h3><p>{discovery.name} · {allIds.length} decks</p></div>
      <p className="source-choice-note">Pick folders or individual decks. Subfolders are listed separately.</p>
      <div className="manager-bulk"><span>{folders.length} {folders.length === 1 ? 'folder' : 'folders'}</span><FormatSelect label="Format" value={formatScope} onChange={setFormatScope} items={entries} all disabled={busy} /><button className="text-button" disabled={busy} onClick={() => select(allIds, true)}>Select all</button><button className="text-button" disabled={busy} onClick={() => select(allIds, false)}>Clear</button></div>
      <div className="source-folders">
        {folders.map(({ source, path, root }) => {
          const ids = source.entries.map(e => e.id);
          const count = ids.filter(id => selected.includes(id)).length;
          return <div className="source-folder" key={source.key}>
            <label className="source-folder-choice">
              <input type="checkbox" aria-label={`Select ${path}`} checked={!!ids.length && count === ids.length} ref={el => { if (el) el.indeterminate = count > 0 && count < ids.length; }} disabled={busy || !ids.length} onChange={e => select(ids, e.target.checked)} />
              <Folder size={21} />
              <span><strong>{source.name}</strong><small>{root ? 'Top-level decks' : path} · {ids.length} {ids.length === 1 ? 'deck' : 'decks'}{count > 0 ? ` · ${count} selected` : ''}</small></span>
              <span className="source-folder-art" aria-hidden="true">{source.entries.slice(0, 3).filter(e => e.image).map(e => <Artwork key={e.id} src={e.image} alt="" colors={e.colors} />)}</span>
            </label>
            {ids.length > 0 && <details><summary>Choose individual decks</summary><div className="source-folder-decks">{source.entries.map(entry => <label key={entry.id}><input type="checkbox" checked={selected.includes(entry.id)} disabled={busy} onChange={e => select([entry.id], e.target.checked)} />{entry.image && <Artwork src={entry.image} alt="" colors={entry.colors} />}<span>{entry.name}<small>{formatOf(entry).name}</small></span></label>)}</div></details>}
          </div>;
        })}
      </div>
      {!allIds.length && <p className="source-choice-note">No public decks in this format. Try All formats or another source.</p>}
      <div className="source-choice-footer"><label><input type="checkbox" checked={onlyFolders} disabled={busy} onChange={e => setOnlyFolders(e.target.checked)} /><span>Show only these folders<small>Other collections stay saved.</small></span></label><button className="button button-gold" disabled={busy || !selected.length} onClick={() => save(onlyFolders)}>Add {selected.length} {selected.length === 1 ? 'deck' : 'decks'} <ArrowRight size={15} /></button></div>
    </>}
  </div>;
}
