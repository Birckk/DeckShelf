import { coverOf } from './domain';
import CollectionMenu from './CollectionMenu';
import { useEffect, useState } from 'react';
import { ArrowUpRight, EyeOff, Folder, Library, Link2, UserRound, Power, Focus, ChevronDown, ChevronUp, Trash2, Plus } from 'lucide-react';
import { Artwork } from './components';
import type { Collection, Deck } from './domain';
import { isHidden, type ShowcaseGroup } from './collection';

export default function CollectionOverview({ groups, collection, decks, busy, navigate, openScope, toggle, only, onlyMany, enableAll, addDemo, hide, remove, readOnly = false }: {
  /** A shared shelf: boxes to open, without switches or collection actions. */
  readOnly?: boolean;
  groups: ShowcaseGroup[]; collection: Collection; decks: Deck[]; busy: boolean;
  navigate: (key: string) => void; openScope: (key: string, name: string, keys: string[]) => void;
  toggle: (keys: string[], enabled: boolean, all?: boolean) => void; only: (key: string) => void;
  onlyMany: (keys: string[]) => void; enableAll: () => void;
  hide: (keys: string[]) => void;
  remove: (keys: string[], name: string, count: number) => void;
  addDemo: () => void;
}) {
  const [expanded, setExpanded] = useState(() => { try { return localStorage.getItem('deckshelf.expanded-collections') === 'true'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('deckshelf.expanded-collections', String(expanded)); } catch { /* Keep session state if storage is unavailable. */ } }, [expanded]);
  const summaries: { group: ShowcaseGroup; children: ShowcaseGroup[]; keys: string[] }[] = [];
  const saved = new Map(decks.map(deck => [deck.id, deck]));
  const seen = new Set<string>();
  const visible = groups.filter(g => !isHidden(collection, g.key));
  const ordered = [...visible.filter(g => ['account', 'folder'].includes(g.kind)), ...visible.filter(g => !['account', 'folder'].includes(g.kind))];
  for (const group of ordered) {
    const source = collection.sources?.find(s => s.key === group.key);
    if (source?.connectionKey) {
      if (seen.has(source.connectionKey)) continue;
      seen.add(source.connectionKey);
      const sources = collection.sources!.filter(s => s.connectionKey === source.connectionKey && !isHidden(collection, s.key));
      const keys = sources.map(s => s.key);
      const children = visible.filter(g => keys.includes(g.key));
      summaries.push({ keys, children, group: { ...group, key: `connection:${source.connectionKey}`, name: source.connectionName || source.name, kind: 'account',
        ids: [...new Set(children.flatMap(g => g.ids))], available: new Set(sources.flatMap(s => s.knownIds)).size, enabled: children.some(g => g.enabled) } });
    } else summaries.push({ group, children: [], keys: [group.key] });
  }
  return <div className={`collection-overview ${expanded ? 'is-expanded' : ''}`}>
    <div className="overview-intro"><div><h3>Collections</h3></div><button className="text-button" disabled={busy} onClick={enableAll}><Power size={14} />Enable all</button></div>
    <button className="text-button overview-expand" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{expanded ? 'Collapse collections' : 'Expand collections'}</button>
    <div className="overview-groups">
      {summaries.filter(({ group }) => !readOnly || ['account', 'folder'].includes(group.kind)).map(({ group, children, keys }) => {
        const Icon = group.kind === 'account' ? UserRound : group.kind === 'folder' ? Folder : group.kind === 'manual' ? Link2 : Library;
        const partial = group.enabled && children.some(child => !child.enabled);
        const activeIds = children.length ? children.filter(child => child.enabled).flatMap(child => child.ids) : group.enabled ? group.ids : [];
        const active = new Set(activeIds.filter(id => !collection.hidden.includes(id))).size;
        const previews = [...new Map(group.ids.flatMap(id => {
          const deck = saved.get(id);
          const commander = deck ? coverOf(deck) : undefined;
          return commander?.art ? [[commander.art, { ...commander, colors: deck!.colors }] as const] : [];
        })).values()].slice(0, 3);
        const open = () => children.length ? openScope('scope:' + group.key, group.name, keys) : navigate(group.key);
        return <article key={group.key} className={`overview-group collection-box ${group.enabled ? '' : 'is-paused'}`}>
          <button className="collection-box-cover" disabled={busy} aria-label={`Open ${group.name}`} onClick={open}>
            {previews.length ? <span className="collection-box-art" aria-hidden="true">{previews.map(commander => <Artwork key={commander.art} src={commander.art} alt="" colors={commander.colors} />)}</span>
              : <span className="collection-box-empty"><Icon size={28} /><span>{group.available ? 'Choose decks to preview' : 'No decks added'}</span></span>}
            <span className="collection-box-open" aria-hidden="true"><ArrowUpRight size={17} /></span>
          </button>
          <div className="collection-box-body">
          <div className="overview-group-top"><Icon size={17} />
            <button className="overview-group-title" disabled={busy} onClick={() => children.length ? openScope(`scope:${group.key}`, group.name, keys) : navigate(group.key)}>{group.name}</button>
            <label className={`overview-switch ${partial ? 'is-partial' : ''}`}><input type="checkbox" role="switch" aria-label={`Enable ${group.name} in overview`} aria-description={partial ? 'Some folders enabled' : undefined} checked={group.enabled} disabled={busy} title="Click to pause/resume. Ctrl-click or Cmd-click to enable all folders; repeat to disable all." onChange={e => { const event = e.nativeEvent as MouseEvent; const all = event.ctrlKey || event.metaKey; toggle(keys, all ? keys.some(key => collection.disabledGroups?.includes(key)) : e.target.checked, all); }} /><span>{partial ? 'Some' : group.enabled ? 'On' : 'Off'}</span></label>
          </div>
          <div className="overview-group-footer">
            <small>{active}/{group.available} active</small>
            <button className="text-button" disabled={busy} onClick={() => children.length ? onlyMany(keys) : only(group.key)}><Focus size={14} />Only this</button>
            <CollectionMenu name={group.name} busy={busy} items={[
              { label: group.kind === 'demo' ? 'Hide precons' : 'Hide', icon: <EyeOff size={14} />, run: () => hide(keys) },
              ...(['account', 'folder'].includes(group.kind) && !readOnly ? [{ label: 'Remove', icon: <Trash2 size={14} />, run: () => remove(keys, group.name, group.ids.length) }] : []),
              ...(group.kind === 'included' ? [{ label: 'Remove', icon: <Trash2 size={14} />, run: () => remove(keys, group.name, 0) }] : []),
            ]} />
          </div>
          {expanded && children.length > 0 && <div className="overview-folder-summary">{children.map(folder => <button key={folder.key} disabled={busy} onClick={() => navigate(folder.key)}><Folder size={12} /><span>{collection.sources?.find(s => s.key === folder.key)?.folderPath || folder.name}</span><small>{folder.enabled ? folder.ids.filter(id => !collection.hidden.includes(id)).length : 0}/{folder.available} active</small></button>)}</div>}
          {expanded && group.kind === 'demo' && collection.demo && <p className="overview-provenance">Snapshot {new Date(collection.demo.snapshotAt).toLocaleDateString(undefined, { dateStyle: 'medium' })} · Curated by Archidekt</p>}
          </div>
        </article>;
      })}
    </div>
    {/* The precons are one collection: pick single decks inside it. Profiles without it can add it here. */}
    {!collection.demo && !readOnly && <div className="overview-precon-actions">
      <button className="text-button" disabled={busy} onClick={addDemo}><Plus size={14} />Add Official Commander precons</button>
    </div>}
  </div>;
}
