import { ArrowRight, Dices, X } from 'lucide-react';

type Props = {
  view: 'grid' | 'cards' | 'picker'; selecting: boolean; total: number; eligible: number;
  busy: boolean; hasVisible: boolean; allSelected: boolean;
  edit: () => void; pick: () => void; clear: () => void; toggleAll: () => void;
};

// One layout at every width: close, count/edit, All while editing, then Picker at the far edge.
export default function QuickChoiceControls({ view, selecting, total, eligible, busy, hasVisible, allSelected, edit, pick, clear, toggleAll }: Props) {
  const editing = view === 'grid' && selecting;
  const active = total > 0 || editing;
  const outside = total > 0 && total !== eligible ? total - eligible : 0;
  return <div className={`shortlist-controls ${active ? 'is-active' : ''}`} role="group" aria-label="Quick deck choice">
    {!active && view !== 'grid' ? <span className="sr-only">All matching decks</span> : <>
      {active && <button className="shortlist-clear" aria-label="Clear selection" title="Clear shortlist and leave selection mode" disabled={busy} onClick={clear}><X size={14} /></button>}
      <button className="shortlist-entry" disabled={busy} aria-pressed={editing} title={editing ? 'Finish selecting · Shift-click cards for a range' : 'Choose or edit your shortlist'} onClick={edit}>
        <Dices size={17} /><span>{total ? `${total} selected` : editing ? 'Select cards' : 'Choose a few'}</span>
      </button>
      {editing && <button className="shortlist-mode" disabled={!hasVisible} aria-label={allSelected ? 'Deselect visible' : 'Select visible'} title="Toggle selection of all visible decks" onClick={toggleAll}>{allSelected ? 'None' : 'All'}</button>}
      {active && view !== 'picker' && <button className="shortlist-action" title="Open Pick a deck with your selection" disabled={busy || !total || !eligible} onClick={pick}><span>Picker</span><ArrowRight size={15} aria-hidden="true" /></button>}
      {outside > 0 && <span className="sr-only" role="status">{outside} outside this view</span>}
    </>}
  </div>;
}
