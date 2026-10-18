import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const OPEN_KEY = 'deckshelf.tags-open';
// Folded, the list keeps the most-used tags plus any already chosen.
const FOLDED = 8;

function readOpen() {
  try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; }
}

export default function TagFilter({ counts, selected, onToggle }: {
  counts: [string, number][]; selected: string[]; onToggle: (tag: string) => void;
}) {
  const [open, setOpen] = useState(readOpen);
  // A chosen tag stays removable here after a format change leaves it without decks.
  const all = [...counts, ...selected.filter(tag => !counts.some(([t]) => t === tag)).map(tag => [tag, 0] as [string, number])];
  if (!all.length) return null;
  const shown = open ? all : all.filter(([tag], index) => index < FOLDED || selected.includes(tag));
  function fold() {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(OPEN_KEY, next ? '1' : '0'); } catch { /* The fold just won't be remembered. */ }
  }
  return <div className="filter-group tag-filter" role="group" aria-labelledby="tag-filter-label">
    <span className="filter-label" id="tag-filter-label">Tags</span>
    <div className="tag-chips">
      {shown.map(([tag, count]) => <button key={tag} type="button" aria-pressed={selected.includes(tag)} onClick={() => onToggle(tag)}>
        {tag}<small aria-label={`${count} ${count === 1 ? 'deck' : 'decks'}`}>{count}</small>
      </button>)}
    </div>
    {all.length > FOLDED && <button type="button" className="text-button tag-fold" aria-expanded={open} onClick={fold}>
      {open ? 'Fewer tags' : `All ${all.length} tags`}<ChevronDown size={13} />
    </button>}
  </div>;
}
