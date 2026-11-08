import { createContext, useContext, type MouseEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Artwork, Mana } from "./components";
import { coverOf, DEFAULT_LIST, formatOf, type Color, type Deck, type ListColumn, type ListSettings, type SourceEntry } from "./domain";
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
  /** Collections the deck is shown from, when the page knows them. */
  collections?: string[];
};

/** The List choices from Settings; App provides the saved ones. */
export const ListSettingsContext = createContext<ListSettings>(DEFAULT_LIST);

export const tableDeck = (deck: Deck, collections?: string[]): TableDeck => ({
  id: deck.id, name: deck.name, commanders: deck.commanders.map(c => c.name), colors: deck.colors, tags: deck.tags,
  format: formatOf(deck), set: deck.set, releasedAt: deck.releasedAt, image: coverOf(deck).art || coverOf(deck).image, collections,
});
/** A source listing not yet added has only its name, colors, format and artwork. */
export const tableEntry = (row: SourceEntry): TableDeck => ({
  id: row.id, name: row.name, commanders: [], colors: row.colors, tags: [], format: formatOf(row), image: row.image,
});

const none = <span className="deck-table-none">—</span>;
const releaseYear = (date?: string) => /^\d{4}/.test(date || "") ? date!.slice(0, 4) : "";
const list = (values: string[] | undefined, separator: string) => values?.length ? values.join(separator) : none;

type Column = {
  key: ListColumn;
  label: string;
  /** Natural order first; a second header click switches to the reverse. The sort menu offers the same values. */
  sort?: readonly [string, string];
  /** Drops out when no deck in the results has a value. */
  optional?: (deck: TableDeck) => boolean;
  cell: (deck: TableDeck) => ReactNode;
};
/* Columns after Name, in the order of LIST_COLUMNS. Settings choose which show; a new one is one more entry. */
const COLUMNS: Column[] = [
  { key: "commander", label: "Commander", sort: ["commander", "commander-desc"], cell: deck => list(deck.commanders, " & ") },
  { key: "colors", label: "Colors", sort: ["colors", "colors-desc"], cell: deck => <Mana colors={deck.colors} /> },
  // Commander is the default format, so the column appears only when the results hold another one.
  { key: "format", label: "Format", sort: ["format", "format-desc"], optional: deck => deck.format.id !== "commander", cell: deck => deck.format.name },
  { key: "tags", label: "Tags", optional: deck => deck.tags.length > 0, cell: deck => list(deck.tags.slice(0, 3), " · ") },
  {
    key: "release", label: "Release", sort: ["release", "release-asc"], cell: deck => {
      const set = (deck.set || "").replace(/ Commander$/, ""), year = releaseYear(deck.releasedAt);
      return set || year ? <><span title={deck.set}>{set || "—"}</span>{year && <span className="deck-table-year">{year}</span>}</> : none;
    },
  },
  { key: "collection", label: "Collection", sort: ["collection-name", "collection-name-desc"], optional: deck => !!deck.collections?.length, cell: deck => list(deck.collections, ", ") },
];
const NAME_SORT = ["name", "name-desc"] as const;
const ASCENDING = new Set(["name", "commander", "colors", "release-asc", "format", "collection-name"]);

export type DeckTableRow = {
  deck: TableDeck;
  /** The page's own name control: a button on Collection, a heading on Library. */
  title: ReactNode;
  className?: string;
  /** Clicks on the row body; links, inputs and buttons handle their own. */
  onActivate?: (event: MouseEvent) => void;
  mark?: number;
  note?: string;
  eager?: boolean;
  /** Library's Shown checkbox and Archidekt link. */
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
  const settings = useContext(ListSettingsContext);
  const desktop = (column: Column) => settings.columns.includes(column.key) && (!column.optional || rows.some(row => column.optional!(row.deck)));
  // The phone column is a deliberate pick, so it stays even when empty.
  const columns = COLUMNS.filter(column => desktop(column) || column.key === settings.phoneColumn);
  // Desktop and phone columns render together and CSS shows the right set, so resizing never needs a re-render.
  const placement = (column: Column) => `deck-table-${column.key}${column.key !== settings.phoneColumn ? " is-desktop" : desktop(column) ? "" : " is-phone"}`;
  // Phones always show the commander under the name; wider screens only without a Commander column.
  const subline = `deck-table-sub${columns.some(c => c.key === "commander") ? " is-phone" : ""}`;
  const art = settings.art !== "none";
  const ariaSort = (order?: readonly [string, string]) =>
    order?.includes(sort) ? (ASCENDING.has(sort) ? "ascending" : "descending") : undefined;
  const header = (text: string, order?: readonly [string, string]) => !order ? text
    : <button type="button" className={order.includes(sort) ? "is-sorted" : ""} onClick={() => onSort(sort === order[0] ? order[1] : order[0])}>
      {text}
      {order.includes(sort) && (ASCENDING.has(sort) ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
    </button>;
  return <div className={`deck-table-wrap deck-table-size-${size}${settings.art === "strip" ? " deck-table-strip" : ""}`}>
    <table className="deck-table" aria-label={label}>
      <thead>
        <tr>
          {lead && <th className="deck-table-lead" scope="col"><span className="sr-only">{lead}</span></th>}
          {art && <th className="deck-table-art" scope="col"><span className="sr-only">Artwork</span></th>}
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
            {art && <td className="deck-table-art">
              {deck.image ? <Artwork src={deck.image} alt={deck.commanders[0] || deck.name} colors={deck.colors} eager={eager} /> : <span className="deck-table-art-empty" />}
            </td>}
            <td className="deck-table-name">
              <div className="deck-table-name-line">
                {mark ? <span className="shortlist-mark deck-table-mark" aria-hidden="true">{String(mark).padStart(2, "0")}</span> : null}
                {title}
              </div>
              {deck.commanders.length > 0 && <span className={subline}>{deck.commanders.join(" & ")}</span>}
              {note && <span className="deck-table-note">{note}</span>}
            </td>
            {columns.map(column => <td key={column.key} className={placement(column)}>{column.cell(deck)}</td>)}
            {trail && <td className="deck-table-trail">{trailCell}</td>}
          </tr>)}
      </tbody>
    </table>
  </div>;
}
