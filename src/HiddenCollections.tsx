import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, EyeOff } from 'lucide-react';

// Hidden collections wait in one folded section that mirrors the sidebar tree above it.
export default function HiddenCollections({ count, children }: { count: number; children: ReactNode }) {
  const [expanded, setExpanded] = useState(() => { try { return localStorage.getItem('deckshelf.hidden-collections') === 'true'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('deckshelf.hidden-collections', String(expanded)); } catch { /* Folding still works without storage. */ } }, [expanded]);
  if (!count) return null;
  return <div className="hidden-collections">
    <button className="navigator-row hidden-collections-toggle" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
      <ChevronRight size={14} style={{ transform: expanded ? 'rotate(90deg)' : undefined }} />
      <span><EyeOff size={13} />Hidden</span>
      <small>{count}</small>
    </button>
    {expanded && children}
  </div>;
}
