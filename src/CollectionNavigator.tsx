import { useEffect, useState } from 'react';
import { ChevronRight, Folder, Library, LayoutGrid } from 'lucide-react';
import type { Collection, CollectionSource, Deck } from './domain';
import { groupActive, sourceDeckIds, type ShowcaseGroup } from './collection';

type Node = { key: string; name: string; sources: CollectionSource[]; children: Node[] };
function sourceTree(sources: CollectionSource[]): Node[] {
  const roots: Node[] = [];
  for (const source of sources) {
    const key = source.connectionKey || source.key;
    let root = roots.find(n => n.key === key);
    if (!root) { root = { key, name: source.connectionName || source.name, sources: [], children: [] }; roots.push(root); }
    root.sources.push(source);
    if (!source.folderPath) continue;
    let node = root;
    for (const part of source.folderPath.split(' / ')) {
      const childKey = `${node.key}/${part}`;
      let child = node.children.find(n => n.key === childKey);
      if (!child) { child = { key: childKey, name: part, sources: [], children: [] }; node.children.push(child); }
      child.sources.push(source);
      node = child;
    }
  }
  return roots;
}

export default function CollectionNavigator({ collection, decks, groups, section, busy, navigate, openScope, toggle }: {
  collection: Collection; decks: Deck[]; groups: ShowcaseGroup[]; section: string; busy: boolean;
  navigate: (key: string) => void;
  openScope: (key: string, name: string, keys: string[]) => void;
  toggle: (keys: string[], enabled: boolean, all?: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [folded, setFolded] = useState<string[]>(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem('deckshelf.folded-folders') || '[]'); return Array.isArray(saved) ? saved.filter((key): key is string => typeof key === 'string').slice(0, 500) : []; } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem('deckshelf.folded-folders', JSON.stringify(folded)); } catch { /* Folding still works when storage is unavailable. */ } }, [folded]);
  const [showSwitches, setShowSwitches] = useState(() => { try { return localStorage.getItem('deckshelf.folder-switches') !== 'false'; } catch { return true; } });
  const roots = sourceTree(collection.sources || []);
  const count = (sources: CollectionSource[]) => new Set(sources.filter(s => groupActive(collection, s.key)).flatMap(s => sourceDeckIds(s, decks)).filter(id => !collection.hidden.includes(id))).size;
  function renderNode(node: Node, depth: number) {
    const match = (n: Node): boolean => n.name.toLowerCase().includes(query.toLowerCase()) || n.children.some(match);
    if (query && !match(node)) return null;
    const expanded = !!query || !folded.includes(node.key);
    const keys = node.sources.map(s => s.key);
    const archived = keys.every(key => collection.archivedGroups?.includes(key));
    const aggregate = node.children.length > 0 || keys.length > 1;
    const target = aggregate ? `scope:${node.key}` : keys[0];
    const total = new Set(node.sources.flatMap(s => s.knownIds)).size;
    const enabled = keys.some(key => groupActive(collection, key));
    const partial = enabled && keys.some(key => !groupActive(collection, key));
    const direct = aggregate ? node.sources.filter(s => !node.children.some(child => child.sources.includes(s))) : [];
    return <div className="navigator-node" key={node.key}>
      <div className="navigator-row" style={{ paddingLeft: Math.min(depth, 4) * 10 }}>
        {aggregate ? <button className="navigator-fold" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.name}`} aria-expanded={expanded}
          onClick={() => setFolded(current => expanded ? [...current, node.key] : current.filter(key => key !== node.key))}><ChevronRight size={14} style={{ transform: expanded ? 'rotate(90deg)' : undefined }} /></button> : <Folder size={14} />}
        <button className="navigator-name" disabled={busy} aria-current={section === target ? 'page' : undefined}
          title={node.name} onClick={() => aggregate ? openScope(target, node.name, keys) : navigate(keys[0])}>{node.name}</button>
        {!archived && <small title="Active here / available">{count(node.sources)}/{total}</small>}
        {archived ? <small className="navigator-state">Disabled</small> : (depth === 0 || showSwitches) && <label className={`overview-switch ${partial ? 'is-partial' : ''}`} title={partial ? 'Some folders enabled; switch off to pause this selection' : undefined}><input type="checkbox" role="switch" aria-label={`Enable ${node.name} in sidebar`} aria-description={partial ? 'Some folders enabled' : undefined} checked={enabled} disabled={busy} title="Click to pause/resume. Ctrl-click or Cmd-click to enable all folders; repeat to disable all." onChange={e => { const event = e.nativeEvent as MouseEvent; const all = event.ctrlKey || event.metaKey; toggle(keys, all ? keys.some(key => collection.disabledGroups?.includes(key)) : e.target.checked, all); }} /></label>}
      </div>
      {expanded && direct.map(source => <div className="navigator-row" key={source.key} style={{ paddingLeft: Math.min(depth + 1, 4) * 10 }}><Folder size={14} /><button className="navigator-name" disabled={busy} aria-current={section === source.key ? 'page' : undefined} title={`Direct decks in ${source.name}`} aria-label={`Direct decks in ${source.name}`} onClick={() => navigate(source.key)}>Direct decks</button><small title="Active here / available">{count([source])}/{source.entries.length}</small>{showSwitches && <label className="overview-switch"><input type="checkbox" role="switch" aria-label={`Enable direct decks in ${source.name}`} checked={groupActive(collection, source.key)} disabled={busy || collection.archivedGroups?.includes(source.key)} onChange={e => toggle([source.key], e.target.checked)} /></label>}</div>)}
      {expanded && node.children.map(child => renderNode(child, depth + 1))}
    </div>;
  }
  return <nav className="manager-nav" aria-label="Collection sources">
    <button disabled={busy} aria-current={section === 'overview' ? 'page' : undefined} onClick={() => navigate('overview')}><LayoutGrid size={16} /><span>Overview</span></button>
    <button disabled={busy} aria-current={section === 'all' ? 'page' : undefined} onClick={() => navigate('all')}><Library size={16} /><span>All saved decks</span><small>{decks.length}</small></button>
    <label className="navigator-search"><span className="sr-only">Find a source or folder</span><input placeholder="Find a source or folder…" value={query} onChange={e => setQuery(e.target.value)} /></label>
    {roots.length > 0 && <label className="navigator-switch-option"><input type="checkbox" checked={showSwitches} onChange={e => { setShowSwitches(e.target.checked); try { localStorage.setItem('deckshelf.folder-switches', String(e.target.checked)); } catch { /* Session preference still works without storage. */ } }} />Show folder switches</label>}
    {roots.map(node => renderNode(node, 0))}
    {groups.filter(g => !['account', 'folder'].includes(g.kind) && g.name.toLowerCase().includes(query.toLowerCase())).map(group => <div className="navigator-row navigator-saved-group" key={group.key}><Library size={16} /><button className="navigator-name" disabled={busy} aria-current={section === group.key ? 'page' : undefined} onClick={() => navigate(group.key)}>{group.name}</button>{!collection.archivedGroups?.includes(group.key) && <small title="Active here / available">{group.enabled ? group.ids.filter(id => !collection.hidden.includes(id)).length : 0}/{group.available}</small>}{collection.archivedGroups?.includes(group.key) ? <small className="navigator-state">Disabled</small> : <label className="overview-switch"><input type="checkbox" role="switch" aria-label={`Enable ${group.name} in sidebar`} checked={group.enabled} disabled={busy} onChange={e => toggle([group.key], e.target.checked)} /></label>}</div>)}
    {collection.demo?.removed && <button className="navigator-disabled" disabled={busy} onClick={() => navigate("demo")}><Library size={16} /><span>Official Commander precons</span><small>Disabled</small></button>}
  </nav>;
}
