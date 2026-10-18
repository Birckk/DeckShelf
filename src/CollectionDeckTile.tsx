import { coverOf, formatOf } from './domain';
import { ExternalLink } from 'lucide-react';
import { Artwork, Mana } from './components';
import type { Deck, SourceEntry } from './domain';

type DeckControls = { row: SourceEntry; deck?: Deck; checked: boolean; member: boolean; busy: boolean; toggle: (on: boolean) => void };

export const DeckLink = ({ row, deck }: Pick<DeckControls, 'row' | 'deck'>) =>
  <a className="workspace-deck-link" href={deck?.sourceUrl || `https://archidekt.com/decks/${row.id}`} target="_blank" rel="noreferrer" aria-label={`Open ${row.name} on Archidekt`} title="Open on Archidekt"><ExternalLink size={13} /></a>;

export const ShownCheckbox = ({ row, checked, member, busy, toggle }: Omit<DeckControls, 'deck'>) =>
  <input type="checkbox" aria-label={`${member ? 'Show' : 'Select'} ${row.name}`} checked={checked} disabled={busy} onChange={e => toggle(e.target.checked)} />;

export default function CollectionDeckTile({ layout, status, ...controls }: DeckControls & {
  layout: string;
  /** Why the deck isn't simply shown, if it isn't; otherwise the tile shows the commanders. */
  status: string;
}) {
  const { row, deck, checked, busy, toggle } = controls;
  const detail = status || deck?.commanders.map(c => c.name).join(' & ');
  const image = (layout === 'art' ? (deck ? coverOf(deck).image : '') : (deck ? coverOf(deck).art : '')) || row.image;
  return <article className={`workspace-tile ${checked ? '' : 'is-hidden'}`} onClick={e => {
    if (!busy && !(e.target as HTMLElement).closest('a, input, label, button')) toggle(!checked);
  }}>
    <div className="workspace-tile-art">
      <Artwork src={image} alt={row.name} colors={deck?.colors || row.colors} />
      <Mana colors={deck?.colors || row.colors} size="mini" />
    </div>
    <div className="workspace-tile-title">
      <h4>{deck?.name || row.name}</h4>
      <span className="workspace-tile-controls">
      <DeckLink {...controls} />
      <label className="workspace-select"><ShownCheckbox {...controls} /></label>
      </span>
    </div>
    <p className="workspace-tile-note">{formatOf(deck || row).name}{detail ? ` · ${detail}` : ''}</p>
  </article>;
}
