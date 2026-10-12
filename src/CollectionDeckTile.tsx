import { ExternalLink, Library } from 'lucide-react';
import { Artwork, Mana } from './components';
import type { Deck, SourceEntry } from './domain';

export default function CollectionDeckTile({ row, deck, layout, checked, member, busy, note, toggle }: {
  row: SourceEntry; deck?: Deck; layout: string; checked: boolean; member: boolean; busy: boolean;
  note: string; toggle: (on: boolean) => void;
}) {
  const image = (layout === 'art' ? deck?.commanders[0].image : deck?.commanders[0].art) || row.image;
  return <article className={`workspace-tile ${checked ? '' : 'is-hidden'}`} onClick={e => {
    if (!busy && !(e.target as HTMLElement).closest('a, input, label, button')) toggle(!checked);
  }}>
    <div className="workspace-tile-art">
      {image ? <Artwork src={image} alt={row.name} /> : <div className="workspace-art-placeholder"><Library size={28} /><span>{row.name}</span></div>}
      <Mana colors={deck?.colors || row.colors} size="mini" />
    </div>
    <div className="workspace-tile-title">
      <h4>{deck?.name || row.name}</h4>
      <span className="workspace-tile-controls">
      <a className="workspace-deck-link" href={deck?.sourceUrl || `https://archidekt.com/decks/${row.id}`} target="_blank" rel="noreferrer" aria-label={`Open ${row.name} on Archidekt`} title="Open on Archidekt"><ExternalLink size={13} /></a>
      <label className="workspace-select"><input type="checkbox" aria-label={`${member ? 'Show' : 'Select'} ${row.name}`} checked={checked} disabled={busy} onChange={e => toggle(e.target.checked)} /></label>
      </span>
    </div>
    <p className="workspace-tile-note">{note}</p>
  </article>;
}
