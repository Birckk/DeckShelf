import type { CardBackStyle, Color } from "./domain";
import { CardBackArt } from "./placeholders/CardBackArt";
import "./settings.css";

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

export type Settings = { cardBack: CardBackStyle; hideArtwork: boolean };

/** Help's Settings section. Choices are saved with the collection, so backups carry them. */
export default function SettingsSection({ value, onChange }: { value: Settings; onChange: (value: Partial<Settings>) => void }) {
  return <>
  <fieldset className="card-back-settings" aria-describedby="card-back-description">
    <legend>Card backs</legend>
    <p id="card-back-description">Used for card backs and when commander artwork can’t load. Saved with your collection and included in backups.</p>
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
  </fieldset>
  <fieldset className="card-back-settings artwork-setting">
    <legend>Artwork</legend>
    <label className="artwork-toggle">
      <input type="checkbox" checked={value.hideArtwork} onChange={e => onChange({ hideArtwork: e.target.checked })} />
      <span><strong>Show card backs instead of artwork</strong>
        <span>Every deck uses your card back, and no commander artwork is downloaded. Saves data and looks the same offline.</span></span>
    </label>
  </fieldset>
  </>;
}

