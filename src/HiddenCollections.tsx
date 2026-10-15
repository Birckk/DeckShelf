import { useEffect, useState } from 'react';
import { ChevronRight, EyeOff } from 'lucide-react';
import type { HiddenEntry } from './collection';

// Hidden collections wait in one folded list: open one to look inside, or show it again.
export default function HiddenCollections({ entries, busy, open, show, className = '' }: {
  entries: HiddenEntry[]; busy: boolean; className?: string;
  open: (entry: HiddenEntry) => void; show: (entry: HiddenEntry) => void;
}) {
  const [expanded, setExpanded] = useState(() => { try { return localStorage.getItem('deckshelf.hidden-collections') === 'true'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('deckshelf.hidden-collections', String(expanded)); } catch { /* Folding still works without storage. */ } }, [expanded]);
  if (!entries.length) return null;
  return <div className={`hidden-collections ${className}`}>
    <button className="hidden-collections-toggle" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
      <ChevronRight size={14} style={{ transform: expanded ? 'rotate(90deg)' : undefined }} /><EyeOff size={14} /><span>Hidden</span><small>{entries.length}</small>
    </button>
    {expanded && <ul>
      {entries.map(entry => <li key={entry.key}>
        <button className="hidden-collection-name" disabled={busy} title={entry.name} onClick={() => open(entry)}>{entry.name}</button>
        <small>{entry.count}</small>
        <button className="text-button" disabled={busy} aria-label={`Show ${entry.name}`} onClick={() => show(entry)}>Show</button>
      </li>)}
    </ul>}
  </div>;
}
