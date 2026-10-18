import type { MouseEvent, ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Artwork, Mana } from "./components";
import { coverOf, formatOf, type Color, type Deck, type SourceEntry } from "./domain";
import "./deck-table.css";

/** What a table row shows; both pages map their decks to this. */
export type TableDeck = {
  id: string;
  name: string;
  commanders: string[];
  colors: Color[];
  tags: string[];
  format: { id: string; name: string };
  set?: string;
  releasedAt?: string;
  image?: string;
};

export const tableDeck = (deck: Deck): TableDeck => ({
  id: deck.id, name: deck.name, commanders: deck.commanders.map(c => c.name), colors: deck.colors, tags: deck.tags,
  format: formatOf(deck), set: deck.set, releasedAt: deck.releasedAt, image: coverOf(deck).art || coverOf(deck).image,
});
/** A source listing not yet added has only its name, colors, format and artwork. */
export const tableEntry = (row: SourceEntry): TableDeck => ({
  id: row.id, name: row.name, commanders: [], colors: row.colors, tags: [], format: formatOf(row), image: row.image,
});

const none = <span className="deck-table-none">—</span>;
const releaseYear = (date?: string) => /^\d{4}/.test(date || "") ? date!.slice(0, 4) : "";
const list = (values: string[], separator: string) => values.length ? values.join(separator) : none;

type Column = {
  key: string;
  label: string;
  /** Natural order first; a second header click switches to the reverse. The sort menu offers the same values. */
  sort?: readonly [string, string];
  /** Drops out when no deck in the results has a value. */
  optional?: (deck: TableDeck) => boolean;
  /** Phones keep only these, with the commander under the name. */
  phone?: boolean;
  cell: (deck: TableDeck) => ReactNode;
};
/* Columns after Name, in display order. A new column, such as a deck format, is one more entry. */
const COLUMNS: Column[] = [
  { key: "commander", label: "Commander", sort: ["commander", "commander-desc"], cell: deck => list(deck.commanders, " & ") },
  { key: "colors", label: "Colors", sort: ["colors", "colors-desc"], phone: true, cell: deck => <Mana colors={deck.colors} /> },
  // Commander is the default format, so the column appears only when the results hold another one.
  { key: "format", label: "Format", optional: deck => deck.format.id !== "commander", cell: deck => deck.format.name },
  { key: "tags", label: "Tags", optional: deck => deck.tags.length > 0, cell: deck => list(deck.tags.slice(0, 3), " · ") },
  {
    key: "release", label: "Release", sort: ["release", "release-asc"], cell: deck => {
      const set = (deck.set || "").replace(/ Commander$/, ""), year = releaseYear(deck.releasedAt);
      return set || year ? <><span title={deck.set}>{set || "—"}</span>{year && <span className="deck-table-year">{year}</span>}</> : none;
    },
  },
];
const NAME_SORT = ["name", "name-desc"] as const;
const ASCENDING = new Set(["name", "commander", "colors", "release-asc"]);

export type DeckTableRow = {
  deck: TableDeck;
  /** The page's own name control: a button on Collection, a heading on My collection. */
  title: ReactNode;
  className?: string;
  /** Clicks on the row body; links, inputs and buttons handle their own. */
  onActivate?: (event: MouseEvent) => void;
  mark?: number;
  note?: string;
  eager?: boolean;
  /** My collection's Shown checkbox and Archidekt link. */
  lead?: ReactNode;
  trail?: ReactNode;
};

export function DeckTable({ label, rows, sort, onSort, size, lead, trail }: {
  label: string;
  rows: DeckTableRow[];
  sort: string;
  onSort: (sort: string) => void;
  size: number;
  /** Accessible names for the lead and trail columns, when rows have them. */
  lead?: string;
  trail?: string;
}) {
  const columns = COLUMNS.filter(({ optional }) => !optional || rows.some(row => optional(row.deck)));
  // CSS hides desktop-only columns on phones, so resizing never needs a re-render.
  const placement = (column: Column) => `deck-table-${column.key}${column.phone ? "" : " is-desktop"}`;
  const ariaSort = (order?: readonly [string, string]) =>
    order?.includes(sort) ? (ASCENDING.has(sort) ? "ascending" : "descending") : undefined;
  const header = (text: string, order?: readonly [string, string]) => !order ? text
    : <button type="button" className={order.includes(sort) ? "is-sorted" : ""} onClick={() => onSort(sort === order[0] ? order[1] : order[0])}>
      {text}
      {order.includes(sort) && (ASCENDING.has(sort) ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
    </button>;
  return <div className={`deck-table-wrap deck-table-size-${size}`}>
    <table className="deck-table" aria-label={label}>
      <thead>
        <tr>
          {lead && <th className="deck-table-lead" scope="col"><span className="sr-only">{lead}</span></th>}
          <th className="deck-table-art" scope="col"><span className="sr-only">Artwork</span></th>
          <th className="deck-table-name" scope="col" aria-sort={ariaSort(NAME_SORT)}>{header("Name", NAME_SORT)}</th>
          {columns.map(column => <th key={column.key} className={placement(column)} scope="col" aria-sort={ariaSort(column.sort)}>
            {header(column.label, column.sort)}
          </th>)}
          {trail && <th className="deck-table-trail" scope="col"><span className="sr-only">{trail}</span></th>}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ deck, title, className, onActivate, mark, note, eager, lead: leadCell, trail: trailCell }) =>
          <tr key={deck.id} className={className} onClick={event => {
            if (onActivate && !(event.target as HTMLElement).closest("a, input, label, button")) onActivate(event);
          }}>
            {lead && <td className="deck-table-lead">{leadCell}</td>}
            <td className="deck-table-art">
              {deck.image ? <Artwork src={deck.image} alt={deck.commanders[0] || deck.name} colors={deck.colors} eager={eager} /> : <span className="deck-table-art-empty" />}
            </td>
            <td className="deck-table-name">
              <div className="deck-table-name-line">
                {mark ? <span className="shortlist-mark deck-table-mark" aria-hidden="true">{String(mark).padStart(2, "0")}</span> : null}
                {title}
              </div>
              {deck.commanders.length > 0 && <span className="deck-table-sub">{deck.commanders.join(" & ")}</span>}
              {note && <span className="deck-table-note">{note}</span>}
            </td>
            {columns.map(column => <td key={column.key} className={placement(column)}>{column.cell(deck)}</td>)}
            {trail && <td className="deck-table-trail">{trailCell}</td>}
          </tr>)}
      </tbody>
    </table>
  </div>;
}
