import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { ChevronRight, Image, ImageOff, List as ListIcon, RectangleVertical } from "lucide-react";
import { LIST_COLUMNS, PHONE_LIST_COLUMNS, type CardBackStyle, type Color, type ListArt, type ListColumn, type ListSettings } from "./domain";
import { CardBackArt } from "./placeholders/CardBackArt";
import "./settings.css";

const FOLDS_KEY = "deckshelf.settings-folds";

const samples: { label: string; colors: Color[] }[] = [
  { label: "Mono-colour", colors: ["G"] },
  { label: "Two-colour", colors: ["U", "R"] },
  { label: "Five-colour", colors: ["W", "U", "B", "R", "G"] },
  { label: "Colourless", colors: [] },
];
const styles: { id: CardBackStyle; name: string }[] = [
  { id: "nest", name: "Dragon nest" },
  { id: "wedges", name: "Art deco wedges" },
];

export type Settings = { cardBack: CardBackStyle; hideArtwork: boolean; list: ListSettings };

const columnNames: Record<ListColumn, string> = { commander: "Commander", colors: "Colors", format: "Format", tags: "Tags", release: "Release", collection: "Collection" };
const artStyles: { id: ListArt; name: string }[] = [
  { id: "thumbnail", name: "Square thumbnail" },
  { id: "strip", name: "Wide art strip" },
  { id: "none", name: "No artwork" },
];

type Group = { id: string; title: string; summary: string; Icon: ComponentType<{ size?: number }>; body: ReactNode };

/** Help's Settings section. Choices are saved with the collection, so backups carry them. */
export default function SettingsSection({ value, onChange }: { value: Settings; onChange: (value: Partial<Settings>) => void }) {
  const list = value.list;
  const groups: Group[] = [
    {
      id: "card-backs", title: "Card backs", Icon: RectangleVertical,
      summary: styles.find(s => s.id === value.cardBack)!.name,
      body: <>
        <p className="settings-help">Used for card backs and when commander artwork can’t load.</p>
        <div className="card-back-options">
          {styles.map(style => <label className="card-back-option" key={style.id}>
            <span className="card-back-choice"><input type="radio" name="card-back" value={style.id} checked={value.cardBack === style.id} onChange={() => onChange({ cardBack: style.id })} /><strong>{style.name}</strong>{style.id === "nest" && <span>Default</span>}</span>
            <span className="card-back-samples">
              {samples.map(sample => <span className="card-back-sample" key={sample.label}>
                <CardBackArt style={style.id} colors={sample.colors} /><span>{sample.label}</span>
              </span>)}
            </span>
          </label>)}
        </div>
      </>,
    },
    {
      id: "artwork", title: "Artwork", Icon: value.hideArtwork ? ImageOff : Image,
      summary: value.hideArtwork ? "Card backs only" : "Commander artwork",
      body: <label className="artwork-toggle">
        <input type="checkbox" checked={value.hideArtwork} onChange={e => onChange({ hideArtwork: e.target.checked })} />
        <span><strong>Show card backs instead of artwork</strong>
          <span>Every deck uses your card back, and no commander artwork is downloaded. Saves data and looks the same offline.</span></span>
      </label>,
    },
    {
      id: "list", title: "List", Icon: ListIcon,
      summary: `${list.columns.length + 1} columns · ${columnNames[list.phoneColumn]} on phones · ${artStyles.find(a => a.id === list.art)!.name}`,
      body: <ListSettingsFields value={list} onChange={next => onChange({ list: next })} />,
    },
  ];
  return <div className="settings-layout">
    <SettingsFolds groups={groups} />
    <p className="settings-note">Settings are saved with your collection and included in backups.</p>
  </div>;
}

/* Every setting is one row showing its current value; a row opens to its controls. Open rows are remembered. */
function SettingsFolds({ groups }: { groups: Group[] }) {
  const [open, setOpen] = useState<string[]>(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem(FOLDS_KEY) || "[]"); return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : []; } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem(FOLDS_KEY, JSON.stringify(open)); } catch { /* Folding still works without storage. */ } }, [open]);
  return <div className="settings-folds">
    {groups.map(g => {
      const expanded = open.includes(g.id);
      return <section key={g.id} className={`settings-fold${expanded ? " is-open" : ""}`}>
        <h3>
          <button type="button" aria-expanded={expanded} aria-controls={`settings-${g.id}`}
            onClick={() => setOpen(current => expanded ? current.filter(id => id !== g.id) : [...current, g.id])}>
            <span className="settings-fold-icon"><g.Icon size={17} /></span>
            <span className="settings-fold-title">{g.title}</span>
            <span className="settings-fold-summary">{g.summary}</span>
            <ChevronRight size={16} className="settings-fold-chevron" aria-hidden="true" />
          </button>
        </h3>
        {expanded && <fieldset id={`settings-${g.id}`} className="settings-panel"><legend className="sr-only">{g.title}</legend>{g.body}</fieldset>}
      </section>;
    })}
  </div>;
}

/** The List layout's table on Collection and My collection. */
function ListSettingsFields({ value, onChange }: { value: ListSettings; onChange: (value: ListSettings) => void }) {
  const toggle = (column: ListColumn, on: boolean) =>
    onChange({ ...value, columns: LIST_COLUMNS.filter(c => c === column ? on : value.columns.includes(c)) });
  return <div className="list-settings">
    <p className="settings-help">How the List layout’s table looks on Collection and My collection.</p>
    <div className="list-settings-group" role="group" aria-labelledby="list-columns-label" aria-describedby="list-columns-hint">
      <h4 id="list-columns-label">Columns</h4>
      <div className="list-settings-choices">
        <label className="list-choice"><input type="checkbox" checked disabled />Name</label>
        {LIST_COLUMNS.map(c => <label className="list-choice" key={c}>
          <input type="checkbox" checked={value.columns.includes(c)} onChange={e => toggle(c, e.target.checked)} />{columnNames[c]}
        </label>)}
      </div>
      <p id="list-columns-hint">Format, Tags and Collection only appear when a deck in the results has one. Without Commander, the commander sits under the name.</p>
    </div>
    <div className="list-settings-group" role="radiogroup" aria-labelledby="list-phone-label" aria-describedby="list-phone-hint">
      <h4 id="list-phone-label">On phones</h4>
      <div className="list-settings-choices">
        {PHONE_LIST_COLUMNS.map(c => <label className="list-choice" key={c}>
          <input type="radio" name="list-phone-column" checked={value.phoneColumn === c} onChange={() => onChange({ ...value, phoneColumn: c })} />{columnNames[c]}
        </label>)}
      </div>
      <p id="list-phone-hint">Phones show the name with its commander under it, plus this column.</p>
    </div>
    <div className="list-settings-group" role="radiogroup" aria-labelledby="list-art-label">
      <h4 id="list-art-label">Row artwork</h4>
      <div className="list-settings-choices">
        {artStyles.map(style => <label className="list-choice list-art-choice" key={style.id}>
          <input type="radio" name="list-art" checked={value.art === style.id} onChange={() => onChange({ ...value, art: style.id })} />
          <span className={`list-art-sample is-${style.id}`} aria-hidden="true" />{style.name}
        </label>)}
      </div>
    </div>
  </div>;
}
