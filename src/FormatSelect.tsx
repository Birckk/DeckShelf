import { formatOf, formatName, type DeckFormat } from './domain';

function availableFormats(items: { format?: DeckFormat }[]) {
  return [...new Map(items.map(item => { const format = formatOf(item); return [format.id, format]; })).values()]
    .sort((a, b) => a.id === 'commander' ? -1 : b.id === 'commander' ? 1 : a.name.localeCompare(b.name));
}
export default function FormatSelect({ label, value, onChange, items, all = false, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void;
  items: { format?: DeckFormat }[]; all?: boolean; disabled?: boolean;
}) {
  const formats = availableFormats([{}, ...items]);
  return <label className="format-select"><span>{label}</span><select aria-label={label} value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>
    {all && <option value="all">All formats</option>}
    {value !== 'all' && !formats.some(format => format.id === value) && <option value={value}>{formatName(value)} (0)</option>}
    {formats.map(format => <option key={format.id} value={format.id}>{format.name}</option>)}
  </select></label>;
}
